import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDataDir, removeDataDir, writeStateFile, sampleState, sampleClient, sampleInvoice, launchApp,
  savedInvoices, sleep, assertRealDataUntouched,
} from './helpers.mjs';

let dataDir;

beforeEach(() => {
  dataDir = createDataDir();
  const inactiveClient = { ...sampleClient, id: 'client-2', displayId: '0002', name: 'Former Client', status: 'inactive' };
  writeStateFile(dataDir, sampleState({
    clients: [sampleClient, inactiveClient],
    invoices: [{ ...sampleInvoice, clientId: 'client-2' }],
  }));
});

afterEach(async () => {
  await removeDataDir(dataDir);
  assertRealDataUntouched();
});

test('an invoice for an inactive client keeps its client when edited', async () => {
  const app = await launchApp(dataDir);
  const newInvoiceOptions = await app.evaluate(`[...document.getElementById('invoiceClient').options].map((option) => option.value)`);
  assert.equal(newInvoiceOptions.includes('client-2'), false, 'new invoices do not offer inactive clients');

  await app.evaluate(`document.querySelector('#invoices-table-body button[data-action="edit-invoice"]').click(); true`);
  assert.equal(await app.evaluate(`document.getElementById('invoiceClient').value`), 'client-2');
  await app.evaluate(`document.getElementById('invoiceDescription').value = 'Edited'; document.getElementById('invoice-form').requestSubmit(); true`);
  await sleep(500);
  await app.stop();

  const invoices = await savedInvoices(dataDir);
  assert.equal(invoices.length, 1);
  assert.equal(invoices[0].clientId, 'client-2');
  assert.equal(invoices[0].description, 'Edited');
});
