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

const { state, elements, invoiceReceivedAmount, invoiceIncome, formatCurrency } = await import('../state.js');
const { runReport } = await import('../reports.js');

const usdInvoice = {
  id: 'usd',
  invoiceNumber: 'INV-2026-03-001',
  issueDate: '2026-03-10',
  dueDate: '2099-03-24',
  currency: 'USD',
  bookCurrency: 'EUR',
  subtotal: 1000,
  vatRate: 0,
  vatAmount: 0,
  total: 1000,
  bookAmounts: { subtotal: 876.96, vatAmount: 0, total: 876.96 },
  status: 'paid',
  paidDate: '2026-04-02',
  receivedAmount: 861.4,
};
const eurInvoice = {
  id: 'eur',
  invoiceNumber: 'INV-2026-03-002',
  issueDate: '2026-03-12',
  dueDate: '2099-03-26',
  currency: 'EUR',
  bookCurrency: 'EUR',
  subtotal: 100,
  vatRate: 21,
  vatAmount: 21,
  total: 121,
  bookAmounts: { subtotal: 100, vatAmount: 21, total: 121 },
  status: 'sent',
};

const card = (label) => {
  const match = elements.reportCards.innerHTML.match(new RegExp(`<span>${label}</span>\\s*<strong>(.*?)</strong>`));
  return match?.[1];
};

beforeEach(() => {
  state.profile.reportingCurrency = 'EUR';
  state.expenses = [];
  elements.reportYear.value = '2026';
  elements.reportQuarter.value = 'year';
});

test('a paid invoice counts the euros that arrived', () => {
  assert.equal(invoiceReceivedAmount(usdInvoice), 861.4);
  assert.equal(invoiceIncome(usdInvoice), 861.4);
});

test('a paid invoice without a recorded amount counts its total in the books', () => {
  const { receivedAmount, ...withoutAmount } = usdInvoice;
  assert.equal(receivedAmount, 861.4);
  assert.equal(invoiceReceivedAmount(withoutAmount), 876.96);
  assert.equal(invoiceReceivedAmount({ ...usdInvoice, receivedAmount: null }), 876.96);
  assert.equal(invoiceReceivedAmount({ ...usdInvoice, receivedAmount: '' }), 876.96);
});

test('the VAT of a paid invoice is not income', () => {
  const paidEur = { ...eurInvoice, status: 'paid', paidDate: '2026-03-20', receivedAmount: 119.5 };

  assert.equal(invoiceIncome(paidEur), 98.5);
});

test('an invoice that is not paid counts its estimate from the invoice date', () => {
  assert.equal(invoiceIncome(eurInvoice), 100);
  assert.equal(invoiceIncome({ ...usdInvoice, status: 'sent', receivedAmount: null }), 876.96);
});

test('reports show what was received and the income', () => {
  state.invoices = [usdInvoice, eurInvoice];

  runReport();

  assert.equal(card('Received'), formatCurrency(861.4, 'EUR'));
  assert.equal(card('Income'), formatCurrency(961.4, 'EUR'));
  assert.equal(card('Estimated net'), formatCurrency(961.4, 'EUR'));
  assert.equal(card('Net invoiced'), formatCurrency(976.96, 'EUR'), 'the tax figures keep the amounts of the invoice date');
  assert.equal(card('Marked paid'), undefined);
});
