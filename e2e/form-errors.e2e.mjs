import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDataDir, removeDataDir, writeStateFile, sampleState, sampleClient, sampleInvoice, launchApp, assertRealDataUntouched,
} from './helpers.mjs';

let dataDir;
const recordAlerts = `window.alerts = []; window.alert = (message) => window.alerts.push(message); true`;

beforeEach(() => {
  dataDir = createDataDir();
  writeStateFile(dataDir, sampleState({ invoices: [{ ...sampleInvoice, status: 'sent' }] }));
});

afterEach(async () => {
  await removeDataDir(dataDir);
  assertRealDataUntouched();
});

test('a client ID that exists shows a message at the field, not in a message box', async () => {
  const app = await launchApp(dataDir);
  try {
    await app.evaluate(recordAlerts);
    const result = await app.evaluate(`(() => {
      document.querySelector('.nav-link[data-view="clients"]').click();
      document.getElementById('clientName').value = 'Second client';
      document.getElementById('clientDisplayId').value = '${sampleClient.displayId}';
      document.getElementById('client-form').requestSubmit();
      const field = document.getElementById('clientDisplayId');
      return { message: field.validationMessage, focused: document.activeElement === field, alerts: window.alerts };
    })()`);
    assert.deepEqual(result, {
      message: `Another client has the client ID ${sampleClient.displayId}. Enter another ID.`,
      focused: true,
      alerts: [],
    });

    const afterEdit = await app.evaluate(`(() => {
      const field = document.getElementById('clientDisplayId');
      field.value = '0099';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      return field.validationMessage;
    })()`);
    assert.equal(afterEdit, '', 'the message goes away when the user changes the form');
  } finally {
    await app.stop();
  }
});

test('an invoice number that exists shows a message at the invoice number', async () => {
  const app = await launchApp(dataDir);
  try {
    await app.evaluate(recordAlerts);
    const result = await app.evaluate(`(() => {
      document.querySelector('.nav-link[data-view="invoices"]').click();
      document.getElementById('new-invoice-btn').click();
      document.getElementById('invoiceClient').value = '${sampleClient.id}';
      document.getElementById('invoiceNumber').value = '${sampleInvoice.invoiceNumber}';
      // The form has invoice lines, or one description and subtotal in older versions of the form.
      (document.getElementById('invoiceDescription') || document.querySelector('#invoice-lines-body [name="lineDescription"]')).value = 'Work';
      (document.getElementById('invoiceSubtotal') || document.querySelector('#invoice-lines-body [name="lineUnitPrice"]')).value = '10';
      document.getElementById('invoice-form').requestSubmit();
      return { message: document.getElementById('invoiceNumber').validationMessage, alerts: window.alerts };
    })()`);
    assert.deepEqual(result, {
      message: `Another invoice has the number ${sampleInvoice.invoiceNumber}. Enter another number, or leave the field empty.`,
      alerts: [],
    });
  } finally {
    await app.stop();
  }
});
