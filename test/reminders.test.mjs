import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// pdf.js uses state.js, which looks up DOM elements when it loads
function fakeElement() {
  return { value: '', textContent: '', innerHTML: '', dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {} };
}
globalThis.window = {};
globalThis.document = {
  getElementById: () => fakeElement(),
  querySelectorAll: () => [],
  createElement: () => fakeElement(),
};

const { state } = await import('../state.js');
const { buildReminder, getInvoiceDocumentLabel, bookCurrencySummary } = await import('../pdf.js');

const invoice = {
  id: 'invoice-1',
  invoiceNumber: 'INV-2026-09-001',
  clientId: 'client-1',
  issueDate: '2026-09-01',
  dueDate: '2026-09-15',
  status: 'sent',
  currency: 'USD',
  bookCurrency: 'EUR',
  subtotal: 1000,
  vatRate: 0,
  vatAmount: 0,
  total: 1000,
  exchangeRate: { rate: 1.1403, rateDate: '2026-09-25', source: 'ECB reference rate of 2026-09-25', manual: false },
  bookAmounts: { subtotal: 876.96, vatAmount: 0, total: 876.96 },
};

beforeEach(() => {
  state.clients = [{ id: 'client-1', name: 'Acme Ltd', contactName: 'Jo' }];
  state.profile.reportingCurrency = 'EUR';
});

test('each reminder tone names the invoice, the amount in the invoice currency and the due date', () => {
  const neutral = buildReminder(invoice, 'neutral');
  assert.match(neutral, /^Subject: Reminder for INV-2026-09-001\n\nHi Jo,/);
  assert.match(neutral, /invoice INV-2026-09-001 for \$1,000\.00 was due on 2026-09-15\./);

  const polite = buildReminder(invoice, 'polite');
  assert.match(polite, /^Subject: Friendly reminder for INV-2026-09-001/);
  assert.match(polite, /for \$1,000\.00 was due on 2026-09-15\./);

  const firm = buildReminder(invoice, 'firm');
  assert.match(firm, /^Subject: Overdue invoice INV-2026-09-001/);
  assert.match(firm, /for \$1,000\.00 is overdue since 2026-09-15\./);
});

test('a reminder greets the contact, then the client, then "there"', () => {
  state.clients = [{ id: 'client-1', name: 'Acme Ltd', contactName: '' }];
  assert.match(buildReminder(invoice, 'neutral'), /\n\nHi Acme Ltd,/);

  state.clients = [];
  assert.match(buildReminder(invoice, 'neutral'), /\n\nHi there,/);
});

test('a paid invoice is a receipt', () => {
  assert.equal(getInvoiceDocumentLabel(invoice), 'Invoice');
  assert.equal(getInvoiceDocumentLabel({ ...invoice, status: 'paid' }), 'Receipt');
});

test('an invoice in another currency shows the rate and the amounts in the book currency', () => {
  assert.deepEqual(bookCurrencySummary(invoice), {
    rateText: 'Exchange rate: 1 EUR = 1.1403 USD (ECB reference rate of 2026-09-25)',
    rows: [
      ['Subtotal (EUR)', '€876.96'],
      ['VAT 0% (EUR)', '€0.00'],
      ['Total (EUR)', '€876.96'],
    ],
  });

  const byHand = bookCurrencySummary({ ...invoice, exchangeRate: { rate: 1.2, rateDate: '2026-09-25', source: '', manual: true } });
  assert.equal(byHand.rateText, 'Exchange rate: 1 EUR = 1.2 USD (entered by hand)');
});

test('an invoice in the book currency, or without a rate, has no book currency summary', () => {
  assert.equal(bookCurrencySummary({ ...invoice, currency: 'EUR' }), null);
  assert.equal(bookCurrencySummary({ ...invoice, exchangeRate: null }), null);
});
