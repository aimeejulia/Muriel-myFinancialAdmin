import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDataDir, removeDataDir, writeStateFile, sampleState, sampleClient, sampleInvoice, launchApp, waitFor, assertRealDataUntouched,
} from './helpers.mjs';

let dataDir;
const savedInvoices = `import('./state.js').then((module) => module.state.invoices)`;
// Types into the fields of a line, as a user does, so the form updates its totals.
const fillLine = (index, description, quantity, unitPrice) => `(() => {
  const row = document.querySelectorAll('#invoice-lines-body tr')[${index}];
  const set = (name, value) => {
    const input = row.querySelector('[name="' + name + '"]');
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  set('lineDescription', ${JSON.stringify(description)});
  set('lineQuantity', ${JSON.stringify(quantity)});
  set('lineUnitPrice', ${JSON.stringify(unitPrice)});
  return true;
})()`;

beforeEach(() => {
  dataDir = createDataDir();
  writeStateFile(dataDir, sampleState({ invoices: [{ ...sampleInvoice, status: 'sent' }] }));
});

afterEach(async () => {
  await removeDataDir(dataDir);
  assertRealDataUntouched();
});

test('an invoice can have several lines with a quantity and a unit price', async () => {
  const app = await launchApp(dataDir);
  try {
    await app.evaluate(`(() => {
      document.querySelector('.nav-link[data-view="invoices"]').click();
      document.getElementById('new-invoice-btn').click();
      document.getElementById('invoiceClient').value = '${sampleClient.id}';
      document.getElementById('add-invoice-line').click();
      document.getElementById('add-invoice-line').click();
      return true;
    })()`);
    await app.evaluate(fillLine(0, 'Design hours', '2,5', '40'));
    await app.evaluate(fillLine(1, 'Hosting', '12', '9,99'));
    await app.evaluate(fillLine(2, 'Mistake', '1', '1'));
    await app.evaluate(`document.querySelectorAll('#invoice-lines-body .invoice-line-remove')[2].click(); true`);

    const form = await app.evaluate(`({
      rows: document.querySelectorAll('#invoice-lines-body tr').length,
      amounts: [...document.querySelectorAll('#invoice-lines-body .invoice-line-amount')].map((cell) => cell.textContent),
      subtotal: document.getElementById('invoiceSubtotalPreview').textContent,
      total: document.getElementById('invoiceTotalPreview').textContent,
    })`);
    assert.deepEqual(form, { rows: 2, amounts: ['€100.00', '€119.88'], subtotal: '€219.88', total: '€266.05' });

    await app.evaluate(`document.getElementById('invoice-form').requestSubmit(); true`);
    const invoice = await waitFor(async () => (await app.evaluate(savedInvoices)).find((item) => item.description === 'Design hours; Hosting'));
    assert.deepEqual(invoice.lines, [
      { description: 'Design hours', quantity: 2.5, unitPrice: 40 },
      { description: 'Hosting', quantity: 12, unitPrice: 9.99 },
    ]);
    assert.equal(invoice.subtotal, 219.88);
    assert.equal(invoice.vatAmount, 46.17);
    assert.equal(invoice.total, 266.05);

    const preview = await app.evaluate(`[...document.querySelectorAll('#invoice-preview-content .preview-table tbody tr')]
      .map((row) => [...row.children].map((cell) => cell.textContent.trim()))`);
    assert.deepEqual(preview, [
      ['Design hours', '2.5', '€40.00', '€100.00'],
      ['Hosting', '12', '€9.99', '€119.88'],
    ]);
  } finally {
    await app.stop();
  }
});

test('an invoice from before lines opens with one line, and the last line cannot be removed', async () => {
  const app = await launchApp(dataDir);
  try {
    await app.evaluate(`(() => {
      document.querySelector('.nav-link[data-view="invoices"]').click();
      document.querySelector('#invoices-table-body button[data-action="edit-invoice"]').click();
      return true;
    })()`);
    const rows = await app.evaluate(`[...document.querySelectorAll('#invoice-lines-body tr')].map((row) => ({
      description: row.querySelector('[name="lineDescription"]').value,
      quantity: row.querySelector('[name="lineQuantity"]').value,
      unitPrice: row.querySelector('[name="lineUnitPrice"]').value,
      removable: !row.querySelector('.invoice-line-remove').disabled,
    }))`);
    assert.deepEqual(rows, [{ description: 'Original description', quantity: '1', unitPrice: '100.00', removable: false }]);
  } finally {
    await app.stop();
  }
});
