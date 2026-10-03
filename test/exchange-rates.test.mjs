import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createExchangeRateService, parseEcbCsv, rateOnOrBefore, addDays } = require('../exchange-rates.js');

// The same columns as the ECB data API returns. 2026-09-26 and 2026-09-27 are a weekend.
const ecbCsv = [
  'KEY,FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE,OBS_STATUS,UNIT',
  'EXR.D.USD.EUR.SP00.A,D,USD,EUR,SP00,A,2026-09-24,1.1367,A,USD',
  'EXR.D.USD.EUR.SP00.A,D,USD,EUR,SP00,A,2026-09-25,1.1403,A,USD',
  'EXR.D.USD.EUR.SP00.A,D,USD,EUR,SP00,A,2026-09-28,1.1378,A,USD',
].join('\n');

let dir;
let cacheFile;
let requests;

function service({ today = '2026-10-03', answer = ecbCsv } = {}) {
  return createExchangeRateService({
    cacheFile,
    today: () => today,
    fetch: async (url) => {
      requests.push(url);
      if (answer instanceof Error) throw answer;
      return answer;
    },
  });
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'muriel-rates-'));
  cacheFile = path.join(dir, 'exchange-rates.json');
  requests = [];
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the ECB CSV is read into dates and rates', () => {
  assert.deepEqual(parseEcbCsv(ecbCsv), [
    { date: '2026-09-24', rate: 1.1367 },
    { date: '2026-09-25', rate: 1.1403 },
    { date: '2026-09-28', rate: 1.1378 },
  ]);
  assert.deepEqual(parseEcbCsv(''), []);
  assert.deepEqual(parseEcbCsv('no,columns\n1,2'), []);
  assert.equal(rateOnOrBefore(parseEcbCsv(ecbCsv), '2026-09-23'), null);
  assert.equal(addDays('2026-03-01', -14), '2026-02-15');
});

test('a weekday gets the rate of that day', async () => {
  const result = await service().getRate('usd', '2026-09-28');

  assert.equal(result.ok, true);
  assert.equal(result.currency, 'USD');
  assert.equal(result.rate, 1.1378);
  assert.equal(result.rateDate, '2026-09-28');
  assert.equal(result.source, 'ECB reference rate of 2026-09-28');
  assert.equal(requests[0], 'https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?startPeriod=2026-09-14&endPeriod=2026-09-28&format=csvdata');
});

test('a weekend gets the last published rate before it', async () => {
  const result = await service().getRate('USD', '2026-09-27');

  assert.equal(result.rate, 1.1403);
  assert.equal(result.rateDate, '2026-09-25');
});

test('the euro needs no rate from the ECB', async () => {
  const result = await service().getRate('EUR', '2026-09-27');

  assert.deepEqual(result, { ok: true, currency: 'EUR', date: '2026-09-27', rate: 1, rateDate: '2026-09-27', source: 'Euro' });
  assert.equal(requests.length, 0);
});

test('wrong input and future dates are refused without a request', async () => {
  const rates = service();

  assert.match((await rates.getRate('dollars', '2026-09-28')).error, /not a currency code/);
  assert.match((await rates.getRate('USD', '28/09/2026')).error, /not a date/);
  assert.match((await rates.getRate('USD', '2026-10-04')).error, /in the future/);
  assert.equal(requests.length, 0);
});

test('rates of past days are kept in the cache file', async () => {
  await service().getRate('USD', '2026-09-27');
  const second = await service().getRate('USD', '2026-09-27');

  assert.equal(requests.length, 1);
  assert.equal(second.rate, 1.1403);
  assert.equal(JSON.parse(fs.readFileSync(cacheFile, 'utf8'))['USD:2026-09-27'].rateDate, '2026-09-25');
});

test('a rate for today that the ECB has not published yet is not kept', async () => {
  const rates = service({ today: '2026-09-29' });

  const first = await rates.getRate('USD', '2026-09-29');
  await rates.getRate('USD', '2026-09-29');

  assert.equal(first.rateDate, '2026-09-28');
  assert.equal(requests.length, 2, 'the rate of today is asked again later');
  assert.equal(fs.existsSync(cacheFile), false);
});

test('a missing network gives a message to enter the rate by hand', async () => {
  const result = await service({ answer: new Error('getaddrinfo ENOTFOUND data-api.ecb.europa.eu') }).getRate('USD', '2026-09-28');

  assert.equal(result.ok, false);
  assert.match(result.error, /Could not get the USD exchange rate from the ECB: getaddrinfo ENOTFOUND.*Enter the rate by hand/);
});

test('a currency without ECB rates gives a message to enter the rate by hand', async () => {
  const result = await service({ answer: '' }).getRate('XYZ', '2026-09-28');

  assert.equal(result.ok, false);
  assert.match(result.error, /The ECB has no XYZ exchange rate for 2026-09-28/);
});
