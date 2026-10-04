import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDataDir, removeDataDir, writeStateFile, sampleState, sampleClient, sampleInvoice, launchApp, waitFor, assertRealDataUntouched,
} from './helpers.mjs';

let dataDir;
const formVisible = `!document.getElementById('invoice-form-panel').hidden`;

beforeEach(() => {
  dataDir = createDataDir();
  writeStateFile(dataDir, sampleState({
    invoices: [
      { ...sampleInvoice, id: 'draft', invoiceNumber: 'INV-2026-09-001', status: 'draft' },
      { ...sampleInvoice, id: 'paid', invoiceNumber: 'INV-2026-09-002', status: 'paid', paidDate: '2026-09-10' },
    ],
  }));
});

afterEach(async () => {
  await removeDataDir(dataDir);
  assertRealDataUntouched();
});

test('the invoice form opens with New invoice and closes with Cancel or after a save', async () => {
  const app = await launchApp(dataDir);
  try {
    await app.evaluate(`document.querySelector('.nav-link[data-view="invoices"]').click(); true`);
    assert.equal(await app.evaluate(formVisible), false, 'the list has the full width at first');

    await app.evaluate(`document.getElementById('new-invoice-btn').click(); true`);
    assert.equal(await app.evaluate(formVisible), true);
    assert.equal(await app.evaluate(`document.getElementById('invoice-form-title').textContent`), 'New invoice');

    await app.evaluate(`document.getElementById('invoice-edit-cancel-btn').click(); true`);
    assert.equal(await app.evaluate(formVisible), false);

    await app.evaluate(`(() => {
      document.getElementById('new-invoice-btn').click();
      document.getElementById('invoiceClient').value = '${sampleClient.id}';
      document.querySelector('#invoice-lines-body [name="lineDescription"]').value = 'Layout test';
      document.querySelector('#invoice-lines-body [name="lineUnitPrice"]').value = '50';
      document.getElementById('invoice-form').requestSubmit();
      return true;
    })()`);
    await waitFor(async () => (await app.evaluate(`import('./state.js').then((module) => module.state.invoices.length)`)) === 3);
    assert.equal(await app.evaluate(formVisible), false, 'the form closes after a save');
  } finally {
    await app.stop();
  }
});

test('Edit opens the form with the invoice', async () => {
  const app = await launchApp(dataDir);
  try {
    await app.evaluate(`(() => {
      document.querySelector('.nav-link[data-view="invoices"]').click();
      document.querySelector('#invoices-table-body button[data-action="edit-invoice"]').click();
      return true;
    })()`);
    assert.equal(await app.evaluate(formVisible), true);
    assert.equal(await app.evaluate(`document.getElementById('invoice-form-title').textContent`), 'Edit invoice INV-2026-09-001');
    assert.equal(await app.evaluate(`document.getElementById('invoice-submit-btn').textContent`), 'Update invoice');
  } finally {
    await app.stop();
  }
});

test('each row shows its main action and Preview, and the other actions are in the More menu', async () => {
  const app = await launchApp(dataDir);
  try {
    await app.evaluate(`document.querySelector('.nav-link[data-view="invoices"]').click(); true`);
    const rows = await app.evaluate(`[...document.querySelectorAll('#invoices-table-body tr')].map((row) => ({
      visible: [...row.querySelectorAll('.invoice-actions > button')].map((button) => button.textContent),
      more: [...row.querySelectorAll('.invoice-row-menu-list button')].map((button) => button.textContent),
    }))`);
    assert.deepEqual(rows, [
      { visible: ['Mark sent', 'Preview'], more: ['Edit', 'Status'] },
      { visible: ['Preview'], more: ['Edit', 'Mark unpaid'] },
    ]);

    const menu = await app.evaluate(`(() => {
      document.querySelector('#invoices-table-body .invoice-row-menu > summary').click();
      const list = document.querySelector('.invoice-row-menu[open] .invoice-row-menu-list').getBoundingClientRect();
      return { open: document.querySelectorAll('.invoice-row-menu[open]').length, inWindow: list.top >= 0 && list.bottom <= innerHeight && list.right <= innerWidth };
    })()`);
    assert.deepEqual(menu, { open: 1, inWindow: true });

    await app.pressKey('Escape');
    assert.equal(await app.evaluate(`document.querySelectorAll('.invoice-row-menu[open]').length`), 0);
  } finally {
    await app.stop();
  }
});

test('each status gets only the actions that make sense for it', async () => {
  writeStateFile(dataDir, sampleState({
    invoices: ['sent', 'overdue', 'delinquent', 'aborted'].map((status, index) => ({
      ...sampleInvoice,
      id: status,
      invoiceNumber: `INV-2026-09-00${index + 1}`,
      issueDate: `2026-09-0${4 - index}`,
      status: status === 'overdue' ? 'sent' : status,
      dueDate: status === 'overdue' ? '2026-01-01' : '2099-01-01',
    })),
  }));
  const app = await launchApp(dataDir);
  try {
    await app.evaluate(`document.querySelector('.nav-link[data-view="invoices"]').click(); true`);
    const rows = await app.evaluate(`[...document.querySelectorAll('#invoices-table-body tr')].map((row) => ({
      status: row.querySelector('.badge').textContent,
      visible: [...row.querySelectorAll('.invoice-actions > button')].map((button) => button.textContent),
      more: [...row.querySelectorAll('.invoice-row-menu-list button')].map((button) => button.textContent),
    }))`);
    assert.deepEqual(rows, [
      { status: 'sent', visible: ['Mark paid', 'Preview'], more: ['Edit', 'Status', 'Reminder'] },
      { status: 'overdue', visible: ['Mark paid', 'Preview'], more: ['Edit', 'Status', 'Reminder'] },
      { status: 'delinquent', visible: ['Mark paid', 'Preview'], more: ['Edit', 'Status', 'Reminder'] },
      { status: 'aborted', visible: ['Preview'], more: ['Edit', 'Status'] },
    ]);

    const options = await app.evaluate(`(() => {
      document.querySelector('#invoices-table-body button[data-action="change-status"][data-id="overdue"]').click();
      return { options: [...document.getElementById('changeStatusSelect').options].map((option) => option.value),
        selected: document.getElementById('changeStatusSelect').value };
    })()`);
    assert.deepEqual(options, { options: ['draft', 'sent', 'delinquent', 'aborted', 'paid'], selected: 'sent' });
  } finally {
    await app.stop();
  }
});

test('a new invoice starts as a draft, and Mark sent sends it', async () => {
  writeStateFile(dataDir, sampleState({ invoices: [] }));
  const app = await launchApp(dataDir);
  try {
    await app.evaluate(`(() => {
      document.querySelector('.nav-link[data-view="invoices"]').click();
      document.getElementById('new-invoice-btn').click();
      return true;
    })()`);
    assert.equal(await app.evaluate(`document.getElementById('invoiceStatus').value`), 'draft');

    await app.evaluate(`(() => {
      document.getElementById('invoiceClient').value = '${sampleClient.id}';
      document.querySelector('#invoice-lines-body [name="lineDescription"]').value = 'Draft first';
      document.querySelector('#invoice-lines-body [name="lineUnitPrice"]').value = '80';
      document.getElementById('invoice-form').requestSubmit();
      document.getElementById('invoice-preview-modal').hidden = true;
      return true;
    })()`);
    const saved = `import('./state.js').then((module) => module.state.invoices[0]?.status)`;
    assert.equal(await waitFor(() => app.evaluate(saved)), 'draft');

    await app.evaluate(`document.querySelector('#invoices-table-body button[data-action="mark-sent"]').click(); true`);
    assert.equal(await waitFor(async () => (await app.evaluate(saved)) === 'sent' && 'sent'), 'sent');
    assert.equal(await app.evaluate(`document.querySelector('#invoices-table-body .badge').textContent`), 'sent');
  } finally {
    await app.stop();
  }
});
