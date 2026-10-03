import { test } from 'node:test';
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

const { state, expenseCurrency, expenseBookCurrency } = await import('../state.js');

test('an older expense is in the book currency', () => {
  state.profile.reportingCurrency = 'EUR';
  const expense = { date: '2026-03-12', amount: 45.5 };
  assert.equal(expenseCurrency(expense), 'EUR');
  assert.equal(expenseBookCurrency(expense), 'EUR');
});

test('an expense keeps its own currency and the book currency of the day it was saved', () => {
  state.profile.reportingCurrency = 'GBP';
  const expense = { amount: 101.25, currency: 'USD', bookCurrency: 'EUR', originalAmount: 114.03 };
  assert.equal(expenseCurrency(expense), 'USD');
  assert.equal(expenseBookCurrency(expense), 'EUR');
  state.profile.reportingCurrency = 'EUR';
});
