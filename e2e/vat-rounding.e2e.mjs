import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDataDir, removeDataDir, writeStateFile, sampleState, launchApp, savedInvoices,
  reportCards, sleep, assertRealDataUntouched,
} from './helpers.mjs';

let dataDir;

beforeEach(() => {
  dataDir = createDataDir();
  writeStateFile(dataDir, sampleState({ invoices: [] }));
});

afterEach(async () => {
  await removeDataDir(dataDir);
  assertRealDataUntouched();
});

test('VAT is rounded for each invoice, so reports match the invoices', async () => {
  const app = await launchApp(dataDir);
  for (let index = 0; index < 4; index += 1) {
    await app.evaluate(`(() => {
      document.getElementById('invoiceClient').value = 'client-1';
      document.getElementById('invoiceIssueDate').value = '2026-03-10';
      document.getElementById('invoiceDescription').value = 'Item ${index}';
      document.getElementById('invoiceSubtotal').value = '12.50';
      document.getElementById('invoiceVatRate').value = '21';
      document.getElementById('invoiceStatus').value = 'sent';
      document.getElementById('invoice-form').requestSubmit();
      document.getElementById('invoice-preview-modal').hidden = true;
      return true;
    })()`);
    await sleep(200);
  }
  const cards = await app.evaluate(reportCards(2026, 'year'));
  await sleep(300);
  await app.stop();

  assert.equal(cards['VAT invoiced'], '€10.52');
  const invoices = await savedInvoices(dataDir);
  assert.equal(invoices.length, 4);
  for (const invoice of invoices) {
    assert.equal(invoice.vatAmount, 2.63);
    assert.equal(invoice.total, 15.13);
  }
});
