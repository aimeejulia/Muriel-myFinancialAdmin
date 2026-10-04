import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// state.js looks up DOM elements when it loads
globalThis.window = {};
globalThis.document = {
  getElementById: () => null,
  querySelectorAll: () => [],
  createElement: () => ({}),
};

const { state, startPeriodInfo, currentQuarterInfo } = await import('../state.js');

const invoice = (issueDate, status = 'sent') => ({ id: issueDate, issueDate, dueDate: '2099-01-01', status, subtotal: 100, total: 121 });

beforeEach(() => {
  state.invoices = [];
  state.expenses = [];
});

test('the start period is the last quarter with issued invoices or expenses', () => {
  state.invoices = [invoice('2026-05-10'), invoice('2026-08-25')];
  state.expenses = [{ id: 'e1', date: '2026-07-01', amount: 10 }];

  assert.deepEqual(startPeriodInfo(), { year: 2026, quarter: 3 });
});

test('an expense can be the last record', () => {
  state.invoices = [invoice('2025-11-10')];
  state.expenses = [{ id: 'e1', date: '2026-02-01', amount: 10 }];

  assert.deepEqual(startPeriodInfo(), { year: 2026, quarter: 1 });
});

test('drafts, aborted invoices and future dates do not set the start period', () => {
  state.invoices = [invoice('2026-04-10'), invoice('2026-08-01', 'draft'), invoice('2026-08-02', 'aborted'), invoice('2099-01-01')];

  assert.deepEqual(startPeriodInfo(), { year: 2026, quarter: 2 });
});

test('without records the start period is the current quarter', () => {
  assert.deepEqual(startPeriodInfo(), currentQuarterInfo());
});
