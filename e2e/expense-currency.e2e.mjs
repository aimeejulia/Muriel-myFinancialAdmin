import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createDataDir, removeDataDir, writeStateFile, sampleState, launchApp, waitFor, reportCards, assertRealDataUntouched,
} from './helpers.mjs';

let dataDir;
const savedExpenses = `import('./state.js').then((module) => module.state.expenses)`;
const ecbRate = { rate: 1.1403, rateDate: '2026-09-25', source: 'ECB reference rate of 2026-09-25', manual: false };

beforeEach(() => {
  dataDir = createDataDir();
  writeStateFile(dataDir, { ...sampleState({ expenses: [] }), schemaVersion: 2 });
  // A cached ECB rate, so the test does not need the network.
  fs.writeFileSync(path.join(dataDir, 'exchange-rates.json'), JSON.stringify({
    'USD:2026-09-27': { rate: 1.1403, rateDate: '2026-09-25', source: 'ECB reference rate of 2026-09-25', url: '' },
  }));
});

afterEach(async () => {
  await removeDataDir(dataDir);
  assertRealDataUntouched();
});

async function fillUsdExpense(app) {
  await app.evaluate(`(() => {
    document.querySelector('.nav-link[data-view="expenses"]').click();
    const date = document.getElementById('expenseDate');
    date.value = '2026-09-27';
    date.dispatchEvent(new Event('change'));
    const amount = document.getElementById('expenseAmount');
    amount.value = '114.03';
    amount.dispatchEvent(new Event('input'));
    const currency = document.getElementById('expenseCurrency');
    currency.value = 'USD';
    currency.dispatchEvent(new Event('change'));
    document.getElementById('expenseCategory').value = 'Software';
    document.getElementById('expenseNote').value = 'Hosting';
    return true;
  })()`);
  return waitFor(() => app.evaluate(`(() => {
    const hint = document.getElementById('expense-exchange-rate-hint').textContent;
    return hint.startsWith('ECB') && {
      hint,
      amountLabel: document.getElementById('expense-amount-label').textContent,
      rate: document.getElementById('expenseExchangeRate').value,
      paidLabel: document.getElementById('expense-paid-label').textContent,
      paid: document.getElementById('expensePaid').value,
      paidVisible: !document.getElementById('expense-paid-field').hidden,
    };
  })()`));
}

test('an expense in another currency gets the ECB rate, and the euros paid are the expense', async () => {
  const app = await launchApp(dataDir);
  try {
    assert.deepEqual(await fillUsdExpense(app), {
      hint: 'ECB reference rate of 2026-09-25.',
      amountLabel: 'Amount (USD)',
      rate: '1.1403',
      paidLabel: 'Amount paid in EUR (after bank charges)',
      paid: '100.00',
      paidVisible: true,
    });

    await app.evaluate(`(() => {
      const paid = document.getElementById('expensePaid');
      paid.value = '101.25';
      paid.dispatchEvent(new Event('input'));
      const amount = document.getElementById('expenseAmount');
      amount.dispatchEvent(new Event('input'));
      document.getElementById('expense-form').requestSubmit();
      return true;
    })()`);
    const [expense] = await waitFor(async () => {
      const expenses = await app.evaluate(savedExpenses);
      return expenses.length === 1 && expenses;
    });
    assert.equal(expense.amount, 101.25);
    assert.equal(expense.currency, 'USD');
    assert.equal(expense.bookCurrency, 'EUR');
    assert.equal(expense.originalAmount, 114.03);
    assert.deepEqual(expense.exchangeRate, ecbRate);

    assert.match(await app.evaluate(`document.getElementById('expenses-table-body').textContent`), /€101\.25 \(US\$114\.03\)/);
    assert.equal((await app.evaluate(reportCards(2026, 'year')))['Deductible expenses'], '€101.25');

    // The form is back to the book currency for the next expense.
    assert.deepEqual(await app.evaluate(`({
      currency: document.getElementById('expenseCurrency').value,
      amountLabel: document.getElementById('expense-amount-label').textContent,
      rateHidden: document.getElementById('expense-exchange-rate-field').hidden,
      paidHidden: document.getElementById('expense-paid-field').hidden,
    })`), { currency: 'EUR', amountLabel: 'Amount (EUR)', rateHidden: true, paidHidden: true });
  } finally {
    await app.stop();
  }
});

test('an edit of an expense in another currency keeps its rate and the euros paid', async () => {
  writeStateFile(dataDir, {
    ...sampleState({
      expenses: [{
        id: 'expense-usd', date: '2026-09-27', category: 'Software', deductible: 'yes', note: 'Hosting',
        amount: 101.25, currency: 'USD', bookCurrency: 'EUR', originalAmount: 114.03, exchangeRate: ecbRate,
      }],
    }),
    schemaVersion: 2,
  });
  const app = await launchApp(dataDir);
  try {
    await app.evaluate(`(() => {
      document.querySelector('.nav-link[data-view="expenses"]').click();
      document.querySelector('#expenses-table-body button[data-action="edit-expense"]').click();
      return true;
    })()`);
    assert.deepEqual(await app.evaluate(`({
      currency: document.getElementById('expenseCurrency').value,
      amount: document.getElementById('expenseAmount').value,
      rate: document.getElementById('expenseExchangeRate').value,
      hint: document.getElementById('expense-exchange-rate-hint').textContent,
      paid: document.getElementById('expensePaid').value,
    })`), { currency: 'USD', amount: '114.03', rate: '1.1403', hint: 'ECB reference rate of 2026-09-25.', paid: '101.25' });

    await app.evaluate(`(() => {
      document.getElementById('expenseNote').value = 'Hosting for September';
      document.getElementById('expense-form').requestSubmit();
      return true;
    })()`);
    const [expense] = await waitFor(async () => {
      const expenses = await app.evaluate(savedExpenses);
      return expenses[0]?.note === 'Hosting for September' && expenses;
    });
    assert.equal(expense.amount, 101.25);
    assert.equal(expense.originalAmount, 114.03);
    assert.deepEqual(expense.exchangeRate, ecbRate);
  } finally {
    await app.stop();
  }
});

test('an expense in the book currency is saved as before', async () => {
  const app = await launchApp(dataDir);
  try {
    await app.evaluate(`(() => {
      document.querySelector('.nav-link[data-view="expenses"]').click();
      document.getElementById('expenseDate').value = '2026-09-27';
      document.getElementById('expenseAmount').value = '45.50';
      document.getElementById('expense-form').requestSubmit();
      return true;
    })()`);
    const [expense] = await waitFor(async () => {
      const expenses = await app.evaluate(savedExpenses);
      return expenses.length === 1 && expenses;
    });
    assert.equal(expense.amount, 45.5);
    assert.equal(expense.currency, 'EUR');
    assert.equal(expense.originalAmount, null);
    assert.equal(expense.exchangeRate, null);
    assert.match(await app.evaluate(`document.getElementById('expenses-table-body').textContent`), /€45\.50/);
  } finally {
    await app.stop();
  }
});
