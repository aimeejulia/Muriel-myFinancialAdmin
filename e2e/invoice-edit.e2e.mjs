import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDataDir, removeDataDir, writeStateFile, sampleState, launchApp, savedInvoices,
  forceSave, sleep, assertRealDataUntouched,
} from './helpers.mjs';

const clickEdit = `document.querySelector('#invoices-table-body button[data-action="edit-invoice"]').click(); true`;
let dataDir;

beforeEach(() => {
  dataDir = createDataDir();
  writeStateFile(dataDir, sampleState());
});

afterEach(async () => {
  await removeDataDir(dataDir);
  assertRealDataUntouched();
});

test('an invoice stays saved when the app closes during an edit', async () => {
  const app = await launchApp(dataDir);
  await app.evaluate(clickEdit);
  assert.equal(await app.evaluate(`document.getElementById('invoice-submit-btn').textContent`), 'Update invoice');
  await app.evaluate(forceSave());
  await sleep(300);
  await app.stop();

  const invoices = await savedInvoices(dataDir);
  assert.deepEqual(invoices.map((invoice) => invoice.id), ['invoice-1']);
});

test('submitting an edit updates the invoice in place', async () => {
  const app = await launchApp(dataDir);
  await app.evaluate(clickEdit);
  await app.evaluate(`document.querySelector('#invoice-lines-body [name="lineDescription"]').value = 'Edited description'; document.getElementById('invoice-form').requestSubmit(); true`);
  await sleep(500);
  assert.equal(await app.evaluate(`document.getElementById('invoice-submit-btn').textContent`), 'Create invoice');
  await app.stop();

  const invoices = await savedInvoices(dataDir);
  assert.equal(invoices.length, 1);
  assert.equal(invoices[0].id, 'invoice-1');
  assert.equal(invoices[0].invoiceNumber, 'INV-2026-09-001');
  assert.equal(invoices[0].description, 'Edited description');
});

test('cancel edit leaves the invoice unchanged and the next save creates a new invoice', async () => {
  const app = await launchApp(dataDir);
  await app.evaluate(clickEdit);
  await app.evaluate(`document.getElementById('invoice-edit-cancel-btn').click(); true`);
  assert.equal(await app.evaluate(`document.getElementById('invoice-form-panel').hidden`), true);
  await app.evaluate(`(() => {
    document.getElementById('new-invoice-btn').click();
    document.getElementById('invoiceClient').value = 'client-1';
    document.querySelector('#invoice-lines-body [name="lineDescription"]').value = 'Second invoice';
    document.querySelector('#invoice-lines-body [name="lineUnitPrice"]').value = '50';
    document.getElementById('invoiceStatus').value = 'draft';
    document.getElementById('invoice-form').requestSubmit();
    return true;
  })()`);
  await sleep(500);
  await app.stop();

  const invoices = await savedInvoices(dataDir);
  assert.equal(invoices.length, 2);
  assert.equal(invoices.find((invoice) => invoice.id === 'invoice-1').description, 'Original description');
});
