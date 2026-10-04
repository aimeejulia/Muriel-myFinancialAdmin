import { test } from 'node:test';
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

const { state, elements, formatCurrency } = await import('../state.js');
const { renderDashboard } = await import('../views.js');

function invoice(id, issueDate, dueDate, status, subtotal) {
  return {
    id, invoiceNumber: `INV-${id}`, clientId: 'client-1', issueDate, dueDate, status, subtotal, vatRate: 21,
    vatAmount: subtotal * 0.21, total: subtotal * 1.21, paidDate: status === 'paid' ? issueDate : '',
  };
}

function showDashboard(period) {
  state.clients = [{ id: 'client-1', name: 'Acme Ltd' }];
  state.expenses = [];
  state.profile.reportingCurrency = 'EUR';
  state.invoices = [
    invoice('august', '2026-08-25', '2026-09-08', 'sent', 450),
    invoice('october', '2026-10-02', '2099-10-16', 'sent', 100),
    invoice('july', '2026-07-03', '2026-07-17', 'paid', 800),
  ];
  elements.dashboardYear.value = '2026';
  elements.dashboardPeriod.value = period;
  elements.overdueTableBody.children = [];
  elements.statusSummary.children = [];
  renderDashboard();
}

test('the dashboard shows the open invoices of all periods', () => {
  showDashboard('q4');

  assert.equal(globalThis.document.getElementById('metric-outstanding').textContent, formatCurrency(665.5, 'EUR'), 'the totals with VAT');
  assert.equal(globalThis.document.getElementById('metric-vat-exposure').textContent, formatCurrency(115.5, 'EUR'));
  assert.equal(globalThis.document.getElementById('metric-received').textContent, formatCurrency(100, 'EUR'), 'income stays in the period');
});

test('the overdue list has overdue invoices from earlier periods', () => {
  showDashboard('q4');

  const rows = elements.overdueTableBody.children.map((row) => row.children.map((cell) => cell.textContent));
  assert.deepEqual(rows, [['INV-august', 'Acme Ltd', '2026-09-08', formatCurrency(544.5, 'EUR')]]);
});

test('the status summary counts the invoices of all periods', () => {
  showDashboard('q4');

  const counts = Object.fromEntries(elements.statusSummary.children.map((row) => [row.dataset.status, row.children[1].textContent]));
  assert.deepEqual(counts, { draft: '0', sent: '1', overdue: '1', delinquent: '0', aborted: '0', paid: '1' });
});
