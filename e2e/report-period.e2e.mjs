import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDataDir, removeDataDir, writeStateFile, sampleState, sampleInvoice, launchApp, assertRealDataUntouched,
} from './helpers.mjs';

let dataDir;
const cards = `Object.fromEntries([...document.querySelectorAll('.report-card')]
  .map((card) => [card.querySelector('span').textContent, card.querySelector('strong').textContent]))`;

beforeEach(() => {
  dataDir = createDataDir();
  writeStateFile(dataDir, sampleState({
    invoices: [
      { ...sampleInvoice, id: 'q1', invoiceNumber: 'INV-2025-02-001', issueDate: '2025-02-10', status: 'sent' },
      { ...sampleInvoice, id: 'q3', invoiceNumber: 'INV-2025-08-001', issueDate: '2025-08-10', status: 'sent', subtotal: 300, vatAmount: 63, total: 363 },
    ],
  }));
});

afterEach(async () => {
  await removeDataDir(dataDir);
  assertRealDataUntouched();
});

test('the report follows the selected year and period without a button', async () => {
  const app = await launchApp(dataDir);
  try {
    await app.evaluate(`document.querySelector('.nav-link[data-view="reports"]').click(); true`);
    assert.equal(await app.evaluate(`document.getElementById('run-quarter-report')`), null);

    await app.evaluate(`(() => {
      const year = document.getElementById('reportYear');
      year.value = '2025';
      year.dispatchEvent(new Event('input'));
      return true;
    })()`);
    await app.evaluate(`(() => {
      const period = document.getElementById('reportQuarter');
      period.value = '1';
      period.dispatchEvent(new Event('change'));
      return true;
    })()`);
    let report = await app.evaluate(cards);
    assert.equal(report['Reporting period'], 'Q1 2025');
    assert.equal(report['Net invoiced'], '€100.00');

    await app.evaluate(`(() => {
      const period = document.getElementById('reportQuarter');
      period.value = 'year';
      period.dispatchEvent(new Event('change'));
      return true;
    })()`);
    report = await app.evaluate(cards);
    assert.equal(report['Reporting period'], 'Full year 2025');
    assert.equal(report['Net invoiced'], '€400.00');
  } finally {
    await app.stop();
  }
});

test('Enter in the year field runs the report and keeps the page', async () => {
  const app = await launchApp(dataDir);
  try {
    await app.evaluate(`(() => {
      document.querySelector('.nav-link[data-view="reports"]').click();
      document.getElementById('reportYear').value = '2025';
      document.getElementById('reportQuarter').value = '3';
      document.getElementById('reportYear').focus();
      return true;
    })()`);
    await app.pressKey('Enter');
    const report = await app.evaluate(cards);
    assert.equal(report['Reporting period'], 'Q3 2025');
    assert.equal(report['Net invoiced'], '€300.00');
    assert.equal(await app.evaluate(`document.querySelector('.nav-link.active').dataset.view`), 'reports');
  } finally {
    await app.stop();
  }
});

test('a chart without data shows a short text in place of empty axes', async () => {
  writeStateFile(dataDir, sampleState({
    invoices: [{ ...sampleInvoice, id: 'draft', issueDate: '2025-05-10', status: 'draft' }],
  }));
  const app = await launchApp(dataDir);
  try {
    const charts = (quarter) => app.evaluate(`(() => {
      document.querySelector('.nav-link[data-view="reports"]').click();
      const year = document.getElementById('reportYear');
      year.value = '2025';
      year.dispatchEvent(new Event('input'));
      const period = document.getElementById('reportQuarter');
      period.value = '${quarter}';
      period.dispatchEvent(new Event('change'));
      return {
        grid: !document.getElementById('report-charts').hidden,
        message: document.getElementById('report-charts-empty').hidden ? '' : document.getElementById('report-charts-empty').textContent,
        cards: [...document.querySelectorAll('.report-chart-card')].map((card) => card.querySelector('canvas').hidden
          ? card.querySelector('.report-chart-card-empty').textContent
          : 'chart'),
      };
    })()`);

    assert.deepEqual(await charts('2'), {
      grid: true,
      message: '',
      cards: ['chart', 'No amounts in this period.', 'No amounts in this period.'],
    });
    const empty = await charts('1');
    assert.deepEqual({ grid: empty.grid, message: empty.message }, {
      grid: false,
      message: 'No invoices or expenses in this period, so there are no charts.',
    });
  } finally {
    await app.stop();
  }
});
