import { test } from 'node:test';
import assert from 'node:assert/strict';

// The ECB euro rates of one day, as the main process gives them.
const euroRates = { USD: 1.1403, GBP: 0.8712, EUR: 1 };
let failWith = null;
globalThis.window = {
  desktopStore: {
    getExchangeRate: async (currency, date) => {
      if (failWith !== null && currency !== 'EUR') return { ok: false, ...(failWith ? { error: failWith } : {}) };
      return {
        ok: true,
        currency,
        date,
        rate: euroRates[currency],
        rateDate: currency === 'EUR' ? date : '2026-09-25',
        source: currency === 'EUR' ? 'Euro' : 'ECB reference rate of 2026-09-25',
      };
    },
  },
};

const { getBookExchangeRate, canGetExchangeRates } = await import('../book-rate.js');

test('a rate for books in euros is the ECB rate of the currency', async () => {
  failWith = null;
  assert.deepEqual(await getBookExchangeRate('USD', 'EUR', '2026-09-27'), {
    ok: true, rate: 1.1403, rateDate: '2026-09-25', source: 'ECB reference rate of 2026-09-25',
  });
});

test('a rate of the euro for books in another currency uses the ECB rate of the book currency', async () => {
  failWith = null;
  const result = await getBookExchangeRate('EUR', 'GBP', '2026-09-27');
  assert.equal(result.rate, Number((1 / 0.8712).toPrecision(8)));
  assert.equal(result.source, 'ECB reference rate of 2026-09-25');
});

test('a rate between two currencies that are not the euro is the cross rate of their euro rates', async () => {
  failWith = null;
  assert.deepEqual(await getBookExchangeRate('USD', 'GBP', '2026-09-27'), {
    ok: true,
    rate: Number((1.1403 / 0.8712).toPrecision(8)),
    rateDate: '2026-09-25',
    source: 'Cross rate of the ECB reference rates of 2026-09-25',
  });
});

test('a failed rate gives the error of the ECB, or a general error', async () => {
  failWith = 'The ECB did not answer in time.';
  assert.deepEqual(await getBookExchangeRate('USD', 'EUR', '2026-09-27'), { ok: false, error: 'The ECB did not answer in time.' });

  failWith = '';
  assert.deepEqual(await getBookExchangeRate('USD', 'EUR', '2026-09-27'), {
    ok: false, error: 'Could not get the exchange rate. Enter the rate by hand.',
  });
  failWith = null;
});

test('rates are available only in the desktop app', () => {
  assert.equal(canGetExchangeRates(), true);
  const { desktopStore } = globalThis.window;
  delete globalThis.window.desktopStore;
  assert.equal(canGetExchangeRates(), false);
  globalThis.window.desktopStore = desktopStore;
});
