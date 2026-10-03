import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDataDir, removeDataDir, writeStateFile, sampleState, sampleInvoice, launchApp, assertRealDataUntouched,
} from './helpers.mjs';

let dataDir;

beforeEach(() => {
  dataDir = createDataDir();
  writeStateFile(dataDir, sampleState({
    invoices: [{ ...sampleInvoice, status: 'sent', issueDate: '2026-03-10', defaultCurrency: 'USD' }],
    expenses: [{ id: 'expense-1', date: '2026-03-12', amount: 12.5, category: 'Software', deductible: 'yes', note: '' }],
    profile: { reportingCurrency: 'USD', businesses: [], paymentMethods: [] },
  }));
});

afterEach(async () => {
  await removeDataDir(dataDir);
  assertRealDataUntouched();
});

test('the expense form, the expense list and the dashboard use the reporting currency', async () => {
  const app = await launchApp(dataDir);
  try {
    assert.equal(await app.evaluate(`document.getElementById('expense-amount-label').textContent`), 'Amount (USD)');
    assert.equal(await app.evaluate(`document.querySelector('#expenses-table-body').textContent.includes('$12.50')`), true);

    await app.evaluate(`(() => {
      document.getElementById('dashboardYear').value = '2026';
      document.getElementById('dashboardPeriod').value = 'year';
      document.getElementById('dashboardPeriod').dispatchEvent(new Event('change'));
      return true;
    })()`);
    const metrics = await app.evaluate(`['metric-quarter-invoiced', 'metric-received', 'metric-outstanding', 'metric-vat-exposure']
      .map((id) => document.getElementById(id).textContent)`);
    for (const metric of metrics) {
      assert.match(metric, /^-?\$/, `the dashboard shows dollars: ${metric}`);
    }
  } finally {
    await app.stop();
  }
});
