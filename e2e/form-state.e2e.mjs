import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDataDir, removeDataDir, writeStateFile, sampleState, sampleClient, launchApp, sleep, assertRealDataUntouched,
} from './helpers.mjs';

let dataDir;

beforeEach(() => {
  dataDir = createDataDir();
  writeStateFile(dataDir, sampleState({
    clients: [sampleClient, { ...sampleClient, id: 'client-2', displayId: '0002', name: 'Second Client' }],
    invoices: [],
  }));
});

afterEach(async () => {
  await removeDataDir(dataDir);
  assertRealDataUntouched();
});

test('a new invoice keeps its client when the app shows the data again', async () => {
  const app = await launchApp(dataDir);
  try {
    await app.evaluate(`document.getElementById('invoiceClient').value = 'client-2'; true`);
    // Saving an expense shows all data again.
    await app.evaluate(`(() => {
      document.getElementById('expenseAmount').value = '12';
      document.getElementById('expense-form').requestSubmit();
      return true;
    })()`);
    await sleep(500);

    assert.equal(await app.evaluate(`document.querySelectorAll('#expenses-table-body tr').length > 0`), true);
    assert.equal(await app.evaluate(`document.getElementById('invoiceClient').value`), 'client-2');
  } finally {
    await app.stop();
  }
});

test('a client edit stays open when an invoice is saved', async () => {
  const app = await launchApp(dataDir);
  try {
    await app.evaluate(`document.querySelector('#clients-table-body button[data-action="edit-client"]').click(); true`);
    await app.evaluate(`document.getElementById('clientName').value = 'Name typed but not saved'; true`);
    await app.evaluate(`(() => {
      document.getElementById('invoiceClient').value = 'client-1';
      document.querySelector('#invoice-lines-body [name="lineDescription"]').value = 'Work';
      document.querySelector('#invoice-lines-body [name="lineUnitPrice"]').value = '10';
      document.getElementById('invoiceStatus').value = 'draft';
      document.getElementById('invoice-form').requestSubmit();
      document.getElementById('invoice-preview-modal').hidden = true;
      return true;
    })()`);
    await sleep(500);

    assert.equal(await app.evaluate(`document.querySelectorAll('#invoices-table-body button[data-action="preview-invoice"]').length`), 1);
    assert.equal(await app.evaluate(`document.getElementById('client-submit-btn').textContent`), 'Update client');
    assert.equal(await app.evaluate(`document.getElementById('clientName').value`), 'Name typed but not saved');
  } finally {
    await app.stop();
  }
});
