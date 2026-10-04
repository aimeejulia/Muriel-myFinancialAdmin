import { test, before } from 'node:test';
import assert from 'node:assert/strict';

// state.js, reports.js and views.js look up DOM elements, so give them simple stand-ins
function fakeElement() {
  return {
    value: '',
    textContent: '',
    innerHTML: '',
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {} },
    children: [],
    appendChild(child) {
      this.children.push(child);
    },
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

const { state, elements, countsAsInvoiced, formatCurrency } = await import('../state.js');
const { runReport } = await import('../reports.js');
const { renderDashboard } = await import('../views.js');

function invoice(status, subtotal) {
  return {
    id: `invoice-${status}`,
    invoiceNumber: `INV-2026-03-${status}`,
    clientId: 'client-1',
    issueDate: '2026-03-10',
    dueDate: '2099-03-24',
    subtotal,
    vatRate: 21,
    vatAmount: subtotal * 0.21,
    total: subtotal * 1.21,
    status,
    paidDate: status === 'paid' ? '2026-03-20' : '',
  };
}

before(() => {
  state.invoices = [
    invoice('draft', 100),
    invoice('sent', 200),
    invoice('paid', 300),
    invoice('aborted', 400),
  ];
  state.expenses = [];
  state.profile.reportingCurrency = 'EUR';
});

test('drafts and aborted invoices do not count as invoiced', () => {
  const statuses = state.invoices.filter(countsAsInvoiced).map((item) => item.status);

  assert.deepEqual(statuses, ['sent', 'paid']);
});

test('report totals leave out draft and aborted invoices', () => {
  elements.reportYear.value = '2026';
  elements.reportQuarter.value = 'year';

  runReport();

  const cards = Object.fromEntries(
    [...elements.reportCards.innerHTML.matchAll(/<span>(.*?)<\/span>\s*<strong>(.*?)<\/strong>/g)]
      .map(([, label, value]) => [label, value]),
  );
  assert.equal(cards['Net invoiced'], formatCurrency(500, 'EUR'));
  assert.equal(cards['VAT invoiced'], formatCurrency(105, 'EUR'));
  assert.equal(cards['Gross invoiced'], formatCurrency(605, 'EUR'));
  assert.equal(cards.Outstanding, formatCurrency(242, 'EUR'));
  assert.equal(cards['VAT exposure'], formatCurrency(42, 'EUR'));
  assert.equal(cards['Invoice count'], '2');
});

test('dashboard totals leave out draft and aborted invoices', () => {
  elements.dashboardYear.value = '2026';
  elements.dashboardPeriod.value = 'year';

  renderDashboard();

  assert.equal(globalThis.document.getElementById('metric-received').textContent, formatCurrency(500, 'EUR'));
  assert.equal(globalThis.document.getElementById('metric-outstanding').textContent, formatCurrency(242, 'EUR'));
  assert.equal(globalThis.document.getElementById('metric-vat-exposure').textContent, formatCurrency(42, 'EUR'));
});
