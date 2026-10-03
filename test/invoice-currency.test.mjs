import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// state.js and reports.js look up DOM elements, so give them simple stand-ins
function fakeElement() {
  return { value: '', textContent: '', innerHTML: '', dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {} };
}
const fakeElements = new Map();
globalThis.window = {};
globalThis.document = {
  getElementById: (id) => {
    if (!fakeElements.has(id)) fakeElements.set(id, fakeElement());
    return fakeElements.get(id);
  },
  querySelectorAll: () => [],
  createElement: () => fakeElement(),
};

const {
  state,
  elements,
  migrateSavedState,
  restoreStateFromRaw,
  convertToBookAmounts,
  invoiceMoneyForSave,
  invoiceBookAmounts,
  invoiceCurrency,
  formatCurrency,
} = await import('../state.js');
const { runReport } = await import('../reports.js');

const version1Invoice = {
  id: 'invoice-1',
  invoiceNumber: 'INV-2026-03-001',
  clientId: 'client-1',
  issueDate: '2026-03-10',
  dueDate: '2099-03-24',
  subtotal: 100,
  vatRate: 21,
  vatAmount: 21,
  total: 121,
  defaultCurrency: 'EUR',
  clientCurrency: 'USD',
  clientCurrencyTotal: 130,
  status: 'sent',
};

beforeEach(() => {
  state.profile.reportingCurrency = 'EUR';
});

test('version 1 invoices get their amounts as book amounts', () => {
  const migrated = migrateSavedState({ invoices: [version1Invoice], profile: { reportingCurrency: 'EUR' } }, 1);
  const invoice = migrated.invoices[0];

  assert.equal(invoice.currency, 'EUR');
  assert.equal(invoice.bookCurrency, 'EUR');
  assert.equal(invoice.exchangeRate, null);
  assert.deepEqual(invoice.bookAmounts, { subtotal: 100, vatAmount: 21, total: 121 });
  assert.equal(invoice.clientCurrencyTotal, 130, 'the older client currency total stays');
});

test('a version 1 total that the user entered by hand stays the book total', () => {
  const migrated = migrateSavedState({ invoices: [{ ...version1Invoice, total: 118.5 }] }, 1);

  assert.equal(migrated.invoices[0].bookAmounts.total, 118.5);
});

test('without a stored currency the reporting currency of the profile is used', () => {
  const { defaultCurrency, ...withoutCurrency } = version1Invoice;
  assert.equal(defaultCurrency, 'EUR');
  const migrated = migrateSavedState({ invoices: [withoutCurrency], profile: { reportingCurrency: 'GBP' } }, 1);

  assert.equal(migrated.invoices[0].currency, 'GBP');
  assert.equal(migrated.invoices[0].bookCurrency, 'GBP');
});

test('a version 1 backup is restored with book amounts and gives the same report figures', async () => {
  const result = await restoreStateFromRaw(JSON.stringify({ clients: [], invoices: [version1Invoice], expenses: [] }));
  assert.equal(result.ok, true);
  assert.deepEqual(invoiceBookAmounts(state.invoices[0]), { subtotal: 100, vatAmount: 21, total: 121 });

  elements.reportYear.value = '2026';
  elements.reportQuarter.value = 'year';
  runReport();
  assert.match(elements.reportCards.innerHTML, new RegExp(`<span>Gross invoiced</span>\\s*<strong>${formatCurrency(121, 'EUR').replace('.', '\\.')}</strong>`));
});

test('amounts in another currency are converted with the rate, and the VAT is calculated on the converted base', () => {
  // 1 EUR = 1.1403 USD
  assert.deepEqual(convertToBookAmounts(1000, 21, 1.1403), { subtotal: 876.96, vatAmount: 184.16, total: 1061.12 });
  assert.deepEqual(convertToBookAmounts(100, 0, 0.8), { subtotal: 125, vatAmount: 0, total: 125 });
});

test('a new invoice in the book currency has the same book amounts', () => {
  const money = invoiceMoneyForSave({ subtotal: '200', vatRate: 21, currency: 'EUR', bookCurrency: 'EUR', exchangeRate: null });

  assert.deepEqual(money, { subtotal: 200, vatAmount: 42, total: 242, bookAmounts: { subtotal: 200, vatAmount: 42, total: 242 } });
});

test('a new invoice in another currency gets converted book amounts', () => {
  const money = invoiceMoneyForSave({ subtotal: '1000', vatRate: 21, currency: 'USD', bookCurrency: 'EUR', exchangeRate: { rate: 1.1403 } });

  assert.deepEqual(money, { subtotal: 1000, vatAmount: 210, total: 1210, bookAmounts: { subtotal: 876.96, vatAmount: 184.16, total: 1061.12 } });
});

test('an edit that changes no amount, currency or rate keeps the stored amounts', () => {
  const previous = {
    ...version1Invoice,
    currency: 'USD',
    bookCurrency: 'EUR',
    subtotal: 1000,
    vatAmount: 210,
    total: 1210,
    exchangeRate: { rate: 1.1403, rateDate: '2026-09-25', source: 'ECB reference rate of 2026-09-25' },
    bookAmounts: { subtotal: 876.96, vatAmount: 184.16, total: 1061.12 },
  };

  const money = invoiceMoneyForSave({ subtotal: '1000', vatRate: 21, currency: 'USD', bookCurrency: 'EUR', exchangeRate: { rate: 1.1403 } }, previous);
  assert.equal(money.bookAmounts, previous.bookAmounts);

  const legacy = { ...version1Invoice, total: 118.5, bookAmounts: { subtotal: 100, vatAmount: 21, total: 118.5 } };
  const legacyMoney = invoiceMoneyForSave({ subtotal: '100', vatRate: 21, currency: 'EUR', bookCurrency: 'EUR', exchangeRate: null }, legacy);
  assert.equal(legacyMoney.total, 118.5, 'a total that the user entered stays');
});

test('an edit that changes the amount or the rate calculates the book amounts again', () => {
  const previous = {
    ...version1Invoice,
    currency: 'USD',
    bookCurrency: 'EUR',
    subtotal: 1000,
    exchangeRate: { rate: 1.1403 },
    bookAmounts: { subtotal: 876.96, vatAmount: 184.16, total: 1061.12 },
  };

  assert.equal(invoiceMoneyForSave({ subtotal: '2000', vatRate: 21, currency: 'USD', bookCurrency: 'EUR', exchangeRate: { rate: 1.1403 } }, previous).bookAmounts.subtotal, 1753.92);
  assert.equal(invoiceMoneyForSave({ subtotal: '1000', vatRate: 21, currency: 'USD', bookCurrency: 'EUR', exchangeRate: { rate: 1.25 } }, previous).bookAmounts.subtotal, 800);
});

test('reports add up book amounts, not the amounts in the invoice currency', () => {
  state.invoices = [
    { ...version1Invoice, id: 'eur', bookAmounts: { subtotal: 100, vatAmount: 21, total: 121 } },
    {
      ...version1Invoice,
      id: 'usd',
      invoiceNumber: 'INV-2026-03-002',
      currency: 'USD',
      bookCurrency: 'EUR',
      subtotal: 1000,
      vatAmount: 210,
      total: 1210,
      bookAmounts: { subtotal: 876.96, vatAmount: 184.16, total: 1061.12 },
    },
  ];
  state.expenses = [];
  elements.reportYear.value = '2026';
  elements.reportQuarter.value = 'year';

  runReport();

  assert.match(elements.reportCards.innerHTML, new RegExp(`<span>Net invoiced</span>\\s*<strong>${formatCurrency(976.96, 'EUR').replace(/[.]/g, '\\.')}</strong>`));
  assert.equal(invoiceCurrency(state.invoices[1]), 'USD');
});
