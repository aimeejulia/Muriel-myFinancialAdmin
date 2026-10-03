const fs = require('fs');
const https = require('https');
const { writeFileAtomic } = require('./state-file');

// The ECB reference rates are the euro exchange rates that the Banco de España also publishes.
// Spanish VAT uses the rate in force when the tax accrues (Ley 37/1992, artículo 79.Once).
const ECB_DATA_URL = 'https://data-api.ecb.europa.eu/service/data/EXR';
// The ECB publishes no rates on weekends and holidays, so a window of two weeks always has a rate.
const LOOKBACK_DAYS = 14;

function isIsoDate(text) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(text || ''));
}

function addDays(isoDate, days) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function ecbUrl(currency, startDate, endDate) {
  return `${ECB_DATA_URL}/D.${currency}.EUR.SP00.A?startPeriod=${startDate}&endPeriod=${endDate}&format=csvdata`;
}

// Reads the ECB CSV data: one row for each day, the rate is units of the currency for one euro.
function parseEcbCsv(text) {
  const lines = String(text || '').trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(',');
  const dateColumn = header.indexOf('TIME_PERIOD');
  const valueColumn = header.indexOf('OBS_VALUE');
  if (dateColumn === -1 || valueColumn === -1) return [];

  return lines.slice(1)
    .map((line) => line.split(','))
    .map((cells) => ({ date: cells[dateColumn], rate: Number(cells[valueColumn]) }))
    .filter((row) => isIsoDate(row.date) && Number.isFinite(row.rate) && row.rate > 0)
    .sort((left, right) => left.date.localeCompare(right.date));
}

// The last published rate on or before the date.
function rateOnOrBefore(rows, date) {
  let found = null;
  for (const row of rows) {
    if (row.date <= date) found = row;
  }
  return found;
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': 'Muriel-myFinancialAdmin', Accept: 'text/csv' } }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        if (response.statusCode && response.statusCode >= 400) {
          reject(new Error(`The ECB answered with status ${response.statusCode}.`));
          return;
        }
        resolve(body);
      });
    });
    request.on('error', reject);
    request.setTimeout(10000, () => request.destroy(new Error('The ECB did not answer in time.')));
  });
}

function readCache(cacheFile) {
  try {
    const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    return cache && typeof cache === 'object' && !Array.isArray(cache) ? cache : {};
  } catch {
    return {};
  }
}

// Gives the euro exchange rate of a currency for a date. Rates of past days do not change, so they are kept
// in a local cache. A rate for today is kept only when the ECB has published the rate of today.
function createExchangeRateService({ cacheFile, fetch = fetchText, today = () => new Date().toISOString().slice(0, 10) }) {
  let cache = null;

  return {
    async getRate(currencyCode, date) {
      const currency = String(currencyCode || '').trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(currency)) {
        return { ok: false, error: `"${currencyCode}" is not a currency code.` };
      }
      if (!isIsoDate(date)) {
        return { ok: false, error: `"${date}" is not a date.` };
      }
      if (currency === 'EUR') {
        return { ok: true, currency, date, rate: 1, rateDate: date, source: 'Euro' };
      }
      if (date > today()) {
        return { ok: false, error: `There is no exchange rate for ${date} yet, because the date is in the future.` };
      }

      cache = cache || readCache(cacheFile);
      const key = `${currency}:${date}`;
      if (cache[key]) {
        return { ok: true, currency, date, ...cache[key] };
      }

      const url = ecbUrl(currency, addDays(date, -LOOKBACK_DAYS), date);
      let rows;
      try {
        rows = parseEcbCsv(await fetch(url));
      } catch (error) {
        return { ok: false, error: `Could not get the ${currency} exchange rate from the ECB: ${error.message} Enter the rate by hand.` };
      }

      const found = rateOnOrBefore(rows, date);
      if (!found) {
        return { ok: false, error: `The ECB has no ${currency} exchange rate for ${date}. Enter the rate by hand.` };
      }

      const result = {
        rate: found.rate,
        rateDate: found.date,
        source: `ECB reference rate of ${found.date}`,
        url,
      };
      if (found.date === date || date < today()) {
        cache[key] = result;
        try {
          writeFileAtomic(cacheFile, JSON.stringify(cache));
        } catch {
          // The cache only saves time, so the rate is still correct without it.
        }
      }
      return { ok: true, currency, date, ...result };
    },
  };
}

module.exports = {
  addDays,
  createExchangeRateService,
  parseEcbCsv,
  rateOnOrBefore,
};
