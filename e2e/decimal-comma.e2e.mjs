import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDataDir, removeDataDir, writeStateFile, sampleState, sampleClient, sampleInvoice, launchApp, waitFor, assertRealDataUntouched,
} from './helpers.mjs';

let dataDir;
const saved = (list) => `import('./state.js').then((module) => module.state.${list})`;

beforeEach(() => {
  dataDir = createDataDir();
  writeStateFile(dataDir, { ...sampleState({ invoices: [{ ...sampleInvoice, status: 'sent' }] }), schemaVersion: 3 });
});

afterEach(async () => {
  await removeDataDir(dataDir);
  assertRealDataUntouched();
});

test('an expense amount with a decimal comma is saved as typed', async () => {
  const app = await launchApp(dataDir);
  try {
    await app.evaluate(`(() => {
      document.querySelector('.nav-link[data-view="expenses"]').click();
      document.getElementById('expenseAmount').value = '12,50';
      document.getElementById('expense-form').requestSubmit();
      return true;
    })()`);
    const [expense] = await waitFor(async () => {
      const expenses = await app.evaluate(saved('expenses'));
      return expenses.length === 1 && expenses;
    });
    assert.equal(expense.amount, 12.5);
    assert.match(await app.evaluate(`document.getElementById('expenses-table-body').textContent`), /€12\.50/);
  } finally {
    await app.stop();
  }
});

test('an invoice and its payment accept amounts with a decimal comma and thousands separators', async () => {
  const app = await launchApp(dataDir);
  try {
    await app.evaluate(`(() => {
      document.querySelector('.nav-link[data-view="invoices"]').click();
      const client = document.getElementById('invoiceClient');
      client.value = '${sampleClient.id}';
      client.dispatchEvent(new Event('change'));
      document.getElementById('invoiceDescription').value = 'Comma amounts';
      const subtotal = document.getElementById('invoiceSubtotal');
      subtotal.value = '1.234,56';
      subtotal.dispatchEvent(new Event('input'));
      document.getElementById('invoiceVatRate').value = '21';
      document.getElementById('invoiceStatus').value = 'sent';
      return true;
    })()`);
    assert.equal(await app.evaluate(`document.getElementById('invoiceTotalPreview').textContent`), '€1,493.82');

    await app.evaluate(`(() => {
      document.getElementById('invoice-form').requestSubmit();
      document.getElementById('invoice-preview-modal').hidden = true;
      return true;
    })()`);
    const invoice = await waitFor(async () => {
      const invoices = await app.evaluate(saved('invoices'));
      return invoices.find((item) => item.description === 'Comma amounts');
    });
    assert.equal(invoice.subtotal, 1234.56);
    assert.equal(invoice.total, 1493.82);

    await app.evaluate(`(() => {
      document.querySelector('#invoices-table-body button[data-action="mark-paid"][data-id="${invoice.id}"]').click();
      document.getElementById('markPaidReceived').value = '1.490,10';
      document.getElementById('mark-paid-form').requestSubmit();
      return true;
    })()`);
    const paid = await waitFor(async () => {
      const invoices = await app.evaluate(saved('invoices'));
      return invoices.find((item) => item.id === invoice.id && item.status === 'paid');
    });
    assert.equal(paid.receivedAmount, 1490.1);
  } finally {
    await app.stop();
  }
});

test('an amount that is not a number blocks the save', async () => {
  const app = await launchApp(dataDir);
  try {
    const result = await app.evaluate(`(() => {
      document.querySelector('.nav-link[data-view="expenses"]').click();
      const amount = document.getElementById('expenseAmount');
      amount.value = '12,5,0';
      const valid = document.getElementById('expense-form').checkValidity();
      document.getElementById('expense-form').requestSubmit();
      return { valid, title: amount.title };
    })()`);
    assert.deepEqual(result, { valid: false, title: 'Enter a number, for example 12,50 or 12.50.' });
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.deepEqual(await app.evaluate(saved('expenses')), []);
  } finally {
    await app.stop();
  }
});
