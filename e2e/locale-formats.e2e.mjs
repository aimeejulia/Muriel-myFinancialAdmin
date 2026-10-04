import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDataDir, removeDataDir, writeStateFile, sampleState, sampleInvoice, launchApp, assertRealDataUntouched,
} from './helpers.mjs';

let dataDir;

beforeEach(() => {
  dataDir = createDataDir();
  writeStateFile(dataDir, sampleState({
    invoices: [{ ...sampleInvoice, issueDate: '2026-03-10', dueDate: '2099-03-24', status: 'sent', subtotal: 1500, vatAmount: 315, total: 1815 }],
  }));
});

afterEach(async () => {
  await removeDataDir(dataDir);
  assertRealDataUntouched();
});

const invoiceRow = `(() => {
  document.querySelector('.nav-link[data-view="invoices"]').click();
  const cells = [...document.querySelector('#invoices-table-body tr').children].map((cell) => cell.textContent);
  document.querySelector('#invoices-table-body button[data-action="mark-paid"]').click();
  return { issued: cells[2], due: cells[3], total: cells[5], received: document.getElementById('markPaidReceived').value };
})()`;

test('amounts and dates use the region formats of the desktop', async () => {
  const app = await launchApp(dataDir, { env: { LC_NUMERIC: 'es_ES.UTF-8', LC_TIME: 'es_ES.UTF-8' } });
  try {
    assert.deepEqual(await app.evaluate(invoiceRow), {
      issued: '10/03/2026',
      due: '24/03/2099',
      total: '1815,00 €',
      received: '1815,00',
    });
  } finally {
    await app.stop();
  }
});

test('a US desktop shows the month first and a decimal point', async () => {
  const app = await launchApp(dataDir, { env: { LANG: 'en_US.UTF-8' } });
  try {
    assert.deepEqual(await app.evaluate(invoiceRow), {
      issued: '03/10/2026',
      due: '03/24/2099',
      total: '€1,815.00',
      received: '1815.00',
    });
  } finally {
    await app.stop();
  }
});
