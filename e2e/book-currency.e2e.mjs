import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDataDir, removeDataDir, writeStateFile, sampleState, sampleInvoice, launchApp, waitFor, reportCards, assertRealDataUntouched,
} from './helpers.mjs';

let dataDir;
const savedProfile = `import('./state.js').then((module) => module.state.profile)`;
const savedExpenses = `import('./state.js').then((module) => module.state.expenses)`;
const eurInvoice = { ...sampleInvoice, issueDate: '2026-03-10', status: 'sent' };

beforeEach(() => {
  dataDir = createDataDir();
  writeStateFile(dataDir, {
    ...sampleState({
      invoices: [eurInvoice],
      expenses: [{ id: 'expense-1', date: '2026-02-01', amount: 40, category: 'Software', deductible: 'yes', note: '' }],
    }),
    schemaVersion: 2,
  });
});

afterEach(async () => {
  await removeDataDir(dataDir);
  assertRealDataUntouched();
});

// Saves the profile with a book currency and a date, and gives the alerts that the app showed.
function saveBookCurrency(currency, from) {
  return `(() => {
    window.alerts = [];
    window.alert = (message) => window.alerts.push(message);
    document.querySelector('.nav-link[data-view="profile"]').click();
    document.getElementById('profileReportingCurrency').value = '${currency}';
    document.getElementById('profileBookCurrencyFrom').value = '${from}';
    document.getElementById('profile-form').requestSubmit();
    return window.alerts;
  })()`;
}

test('the book currency changes from a date, and older records keep their book currency', async () => {
  const app = await launchApp(dataDir);
  try {
    const [expenseBefore] = await app.evaluate(savedExpenses);
    assert.equal(expenseBefore.bookCurrency, 'EUR', 'the migration keeps the older expense in euros');

    assert.deepEqual(await app.evaluate(saveBookCurrency('GBP', '')), [
      'Enter the date from which the book currency is GBP. Invoices and expenses before this date stay in their book currency.',
    ]);
    assert.deepEqual(await app.evaluate(saveBookCurrency('GBP', '2026-03-10')), [
      'The date must be after 2026-03-10, the date of the last invoice or expense. A change of book currency does not change invoices and expenses that exist.',
    ]);
    assert.deepEqual((await app.evaluate(savedProfile)).bookCurrencyChanges, []);

    assert.deepEqual(await app.evaluate(saveBookCurrency('GBP', '2026-04-01')), []);
    assert.deepEqual((await app.evaluate(savedProfile)).bookCurrencyChanges, [{ from: '2026-04-01', currency: 'GBP' }]);
    assert.deepEqual(await app.evaluate(`({
      periods: document.getElementById('profile-book-currencies').textContent,
      currency: document.getElementById('profileReportingCurrency').value,
      undoVisible: !document.getElementById('profile-book-currency-undo').hidden,
    })`), { periods: 'EUR from the start, GBP from 2026-04-01', currency: 'GBP', undoVisible: true });

    // A new invoice uses the book currency of its issue date.
    const invoiceForm = (issueDate) => app.evaluate(`(() => {
      document.querySelector('.nav-link[data-view="invoices"]').click();
      document.getElementById('invoiceCurrency').value = 'EUR';
      const issueDate = document.getElementById('invoiceIssueDate');
      issueDate.value = '${issueDate}';
      issueDate.dispatchEvent(new Event('change'));
      return {
        rateVisible: !document.getElementById('invoice-exchange-rate-field').hidden,
        rateLabel: document.getElementById('invoice-exchange-rate-label').textContent,
      };
    })()`);
    assert.deepEqual(await invoiceForm('2026-05-01'), { rateVisible: true, rateLabel: 'Exchange rate (EUR for 1 GBP)' });
    assert.deepEqual(await invoiceForm('2026-03-20'), { rateVisible: false, rateLabel: 'Exchange rate (EUR for 1 EUR)' });

    // A new expense uses the book currency of its date.
    const addExpense = (date, amount) => app.evaluate(`(() => {
      document.querySelector('.nav-link[data-view="expenses"]').click();
      const date = document.getElementById('expenseDate');
      date.value = '${date}';
      date.dispatchEvent(new Event('change'));
      document.getElementById('expenseCurrency').value = ${date >= '2026-04-01' ? "'GBP'" : "'EUR'"};
      document.getElementById('expenseCurrency').dispatchEvent(new Event('change'));
      document.getElementById('expenseAmount').value = '${amount}';
      const label = document.getElementById('expense-amount-label').textContent;
      const paidHidden = document.getElementById('expense-paid-field').hidden;
      document.getElementById('expense-form').requestSubmit();
      return { label, paidHidden };
    })()`);
    assert.deepEqual(await addExpense('2026-05-01', '30'), { label: 'Amount (GBP)', paidHidden: true });
    assert.deepEqual(await addExpense('2026-03-15', '10'), { label: 'Amount (EUR)', paidHidden: true });
    const expenses = await waitFor(async () => {
      const saved = await app.evaluate(savedExpenses);
      return saved.length === 3 && saved;
    });
    assert.deepEqual(expenses.map((expense) => [expense.date, expense.amount, expense.bookCurrency]), [
      ['2026-02-01', 40, 'EUR'], ['2026-05-01', 30, 'GBP'], ['2026-03-15', 10, 'EUR'],
    ]);
    assert.match(await app.evaluate(`document.getElementById('expenses-table-body').textContent`), /£30\.00[\s\S]*€10\.00[\s\S]*€40\.00/);

    // The report of the year has totals for each book currency.
    await app.evaluate(reportCards(2026, 'year'));
    const report = await app.evaluate(`({
      titles: [...document.querySelectorAll('#report-cards .report-group-title')].map((title) => title.textContent),
      deductible: [...document.querySelectorAll('#report-cards .report-card')]
        .filter((card) => card.querySelector('span').textContent === 'Deductible expenses')
        .map((card) => card.querySelector('strong').textContent),
      charts: document.getElementById('report-charts-empty').textContent,
    })`);
    assert.deepEqual(report, {
      titles: ['EUR books: 2026-01-01 to 2026-03-31', 'GBP books: 2026-04-01 to 2026-12-31'],
      deductible: ['€50.00', '£30.00'],
      charts: 'The charts show the GBP books only. The totals above show each book currency.',
    });

    // The change stays while it has records.
    const undo = `(() => {
      window.alerts = [];
      document.querySelector('.nav-link[data-view="profile"]').click();
      document.getElementById('profile-book-currency-undo').click();
      return window.alerts;
    })()`;
    assert.deepEqual(await app.evaluate(undo), ['Invoices or expenses from 2026-04-01 or later are in GBP, so this change stays.']);
  } finally {
    await app.stop();
  }
});

test('the last change of book currency can be removed while it has no records', async () => {
  const app = await launchApp(dataDir);
  try {
    assert.deepEqual(await app.evaluate(saveBookCurrency('GBP', '2026-04-01')), []);
    await app.evaluate(`document.getElementById('profile-book-currency-undo').click(); true`);
    const profile = await waitFor(async () => {
      const saved = await app.evaluate(savedProfile);
      return saved.bookCurrencyChanges.length === 0 && saved;
    });
    assert.equal(profile.reportingCurrency, 'EUR');
    assert.deepEqual(await app.evaluate(`({
      periods: document.getElementById('profile-book-currencies').textContent,
      currency: document.getElementById('profileReportingCurrency').value,
      undoVisible: !document.getElementById('profile-book-currency-undo').hidden,
    })`), { periods: '', currency: 'EUR', undoVisible: false });
  } finally {
    await app.stop();
  }
});
