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
  state, elements, bookCurrencyOn, reportingCurrency, changeBookCurrency, removeLastBookCurrencyChange, migrateSavedState,
  groupByBookCurrency, formatCurrencyTotals,
} = await import('../state.js');
const { runReport, bookCurrencyRangesText } = await import('../reports.js');

const eurInvoice = {
  id: 'eur', invoiceNumber: 'INV-2026-03-001', issueDate: '2026-03-10', dueDate: '2099-03-24', status: 'sent',
  currency: 'EUR', bookCurrency: 'EUR', subtotal: 100, vatRate: 21, vatAmount: 21, total: 121,
  bookAmounts: { subtotal: 100, vatAmount: 21, total: 121 },
};
const gbpInvoice = {
  ...eurInvoice, id: 'gbp', invoiceNumber: 'INV-2026-05-001', issueDate: '2026-05-10', currency: 'GBP', bookCurrency: 'GBP',
  subtotal: 500, vatRate: 20, vatAmount: 100, total: 600, bookAmounts: { subtotal: 500, vatAmount: 100, total: 600 },
};
const eurExpense = { id: 'e1', date: '2026-02-01', amount: 40, deductible: 'yes', currency: 'EUR', bookCurrency: 'EUR' };
const gbpExpense = { id: 'e2', date: '2026-06-01', amount: 30, deductible: 'yes', currency: 'GBP', bookCurrency: 'GBP' };

beforeEach(() => {
  state.profile.reportingCurrency = 'EUR';
  state.profile.bookCurrencyChanges = [];
  state.invoices = [];
  state.expenses = [];
  elements.reportYear.value = '2026';
  elements.reportQuarter.value = 'year';
});

test('the book currency of a date is the last one that starts on or before that date', () => {
  state.profile.bookCurrencyChanges = [{ from: '2026-04-01', currency: 'GBP' }, { from: '2099-01-01', currency: 'CHF' }];
  assert.equal(bookCurrencyOn('2026-03-31'), 'EUR');
  assert.equal(bookCurrencyOn('2026-04-01'), 'GBP');
  assert.equal(bookCurrencyOn('2099-01-02'), 'CHF');
  assert.equal(reportingCurrency(), 'GBP', 'the reporting currency is the book currency of today');
});

test('the book currency from the start changes only before the first invoice or expense', () => {
  assert.equal(changeBookCurrency('USD'), '');
  assert.equal(state.profile.reportingCurrency, 'USD');

  state.expenses = [eurExpense];
  assert.match(changeBookCurrency('GBP'), /^Enter the date from which the book currency is GBP\./);
  assert.equal(state.profile.reportingCurrency, 'USD');
});

test('a change of book currency is never before an invoice or expense that exists', () => {
  state.invoices = [eurInvoice];
  assert.match(changeBookCurrency('GBP', '2026-03-10'), /^The date must be after 2026-03-10, the date of the last invoice or expense\./);
  assert.deepEqual(state.profile.bookCurrencyChanges, []);

  assert.equal(changeBookCurrency('GBP', '2026-04-01'), '');
  assert.deepEqual(state.profile.bookCurrencyChanges, [{ from: '2026-04-01', currency: 'GBP' }]);
  assert.match(changeBookCurrency('EUR', '2026-04-01'), /^The date must be after 2026-04-01, the date of the last change/);
  assert.equal(changeBookCurrency('GBP', '2026-05-01'), '', 'the same book currency is no change');
  assert.equal(state.profile.bookCurrencyChanges.length, 1);
});

test('the last change of book currency can be removed only while it has no records', () => {
  state.profile.bookCurrencyChanges = [{ from: '2026-04-01', currency: 'GBP' }];
  state.invoices = [eurInvoice, gbpInvoice];
  assert.equal(removeLastBookCurrencyChange(), 'Invoices or expenses from 2026-04-01 or later are in GBP, so this change stays.');

  state.invoices = [eurInvoice];
  assert.equal(removeLastBookCurrencyChange(), '');
  assert.deepEqual(state.profile.bookCurrencyChanges, []);
});

test('the migration to version 3 keeps each older expense in the book currency of that time', () => {
  const saved = {
    profile: { reportingCurrency: 'USD' },
    invoices: [],
    expenses: [{ id: 'old', date: '2025-01-01', amount: 10 }, { id: 'new', date: '2026-01-01', amount: 5, currency: 'EUR', bookCurrency: 'USD' }],
  };
  const migrated = migrateSavedState(saved, 2);
  assert.deepEqual(migrated.expenses.map(({ currency, bookCurrency }) => [currency, bookCurrency]), [['USD', 'USD'], ['EUR', 'USD']]);
});

test('records are grouped by book currency, and amounts of two book currencies are never added', () => {
  state.profile.bookCurrencyChanges = [{ from: '2026-04-01', currency: 'GBP' }];
  const groups = groupByBookCurrency([gbpInvoice, eurInvoice], [eurExpense, gbpExpense]);
  assert.deepEqual(groups.map((group) => [group.currency, group.invoices.length, group.expenses.length]), [['EUR', 1, 1], ['GBP', 1, 1]]);
  assert.equal(formatCurrencyTotals(groups, (group) => group.expenses[0].amount), '€40.00 + £30.00');
  assert.deepEqual(groupByBookCurrency([], [], 'CHF').map((group) => group.currency), ['CHF']);
});

test('a report of a period with two book currencies has totals for each book currency', () => {
  state.profile.bookCurrencyChanges = [{ from: '2026-04-01', currency: 'GBP' }];
  state.invoices = [eurInvoice, gbpInvoice];
  state.expenses = [eurExpense, gbpExpense];

  runReport();

  const html = elements.reportCards.innerHTML;
  assert.match(html, /EUR books: 2026-01-01 to 2026-03-31/);
  assert.match(html, /GBP books: 2026-04-01 to 2026-12-31/);
  assert.match(html, /<span>Net invoiced<\/span>\s*<strong>€100\.00<\/strong>[\s\S]*<span>Net invoiced<\/span>\s*<strong>£500\.00<\/strong>/);
  assert.match(html, /<span>Estimated net<\/span>\s*<strong>€60\.00<\/strong>[\s\S]*<span>Estimated net<\/span>\s*<strong>£470\.00<\/strong>/);
  assert.equal(bookCurrencyRangesText('EUR', 2026, '2'), '');
  assert.equal(bookCurrencyRangesText('GBP', 2026, '2'), '2026-04-01 to 2026-06-30');
});

test('a report of a period with one book currency has no book currency titles', () => {
  state.profile.bookCurrencyChanges = [{ from: '2026-04-01', currency: 'GBP' }];
  state.invoices = [eurInvoice, gbpInvoice];
  elements.reportQuarter.value = '2';

  runReport();

  assert.doesNotMatch(elements.reportCards.innerHTML, /books:/);
  assert.match(elements.reportCards.innerHTML, /<span>Reporting currency<\/span>\s*<strong>GBP<\/strong>/);
});
