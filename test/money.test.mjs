import { test } from 'node:test';
import assert from 'node:assert/strict';

// state.js and reports.js look up DOM elements, so give them simple stand-ins
function fakeElement() {
  return {
    value: '',
    textContent: '',
    innerHTML: '',
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {},
  };
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
  roundMoney,
  calculateInvoiceAmounts,
  restoreStateFromRaw,
  formatCurrency,
} = await import('../state.js');
const { runReport } = await import('../reports.js');

test('roundMoney rounds half cents up without floating point noise', () => {
  assert.equal(roundMoney(2.625), 2.63);
  assert.equal(roundMoney(1.005), 1.01);
  assert.equal(roundMoney(2.675), 2.68);
  assert.equal(roundMoney(0.1 + 0.2), 0.3);
  assert.equal(roundMoney(6.999299999999999), 7);
  assert.equal(roundMoney(''), 0);
});

test('calculateInvoiceAmounts rounds VAT for the invoice and adds it to the subtotal', () => {
  assert.deepEqual(calculateInvoiceAmounts(12.5, 21), { subtotal: 12.5, vatAmount: 2.63, total: 15.13 });
  assert.deepEqual(calculateInvoiceAmounts('33.33', '21'), { subtotal: 33.33, vatAmount: 7, total: 40.33 });
  assert.deepEqual(calculateInvoiceAmounts(100, 0), { subtotal: 100, vatAmount: 0, total: 100 });
});

test('report VAT is the sum of the VAT on each invoice', () => {
  state.invoices = [1, 2, 3, 4].map((number) => ({
    id: `invoice-${number}`,
    invoiceNumber: `INV-2026-03-00${number}`,
    issueDate: '2026-03-10',
    dueDate: '2099-03-24',
    vatRate: 21,
    status: 'sent',
    ...calculateInvoiceAmounts(12.5, 21),
  }));
  state.expenses = [];
  elements.reportYear.value = '2026';
  elements.reportQuarter.value = 'year';

  runReport();

  assert.match(elements.reportCards.innerHTML, new RegExp(`<span>VAT invoiced</span>\\s*<strong>${formatCurrency(10.52, 'EUR').replace('.', '\\.')}</strong>`));
});

test('invoices saved without rounding are rounded when they are loaded', async () => {
  const oldInvoice = {
    id: 'invoice-1',
    invoiceNumber: 'INV-2025-06-001',
    clientId: 'client-1',
    subtotal: 33.33,
    vatRate: 21,
    vatAmount: 6.999299999999999,
    total: 40.3293,
  };

  await restoreStateFromRaw(JSON.stringify({ clients: [], invoices: [oldInvoice], expenses: [] }));

  assert.equal(state.invoices[0].vatAmount, 7);
  assert.equal(state.invoices[0].total, 40.33);
  assert.equal(state.invoices[0].subtotal, 33.33);
});
