import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDataDir, removeDataDir, writeStateFile, sampleState, sampleInvoice, launchApp, waitFor, assertRealDataUntouched,
} from './helpers.mjs';

let dataDir;

beforeEach(() => {
  dataDir = createDataDir();
  writeStateFile(dataDir, sampleState({ invoices: [{ ...sampleInvoice, status: 'sent' }] }));
});

afterEach(async () => {
  await removeDataDir(dataDir);
  assertRealDataUntouched();
});

const modalOpen = (id) => `!document.getElementById('${id}').hidden`;
const focusInside = (id) => `document.getElementById('${id}').contains(document.activeElement)`;

test('modals are dialogs with a name', async () => {
  const app = await launchApp(dataDir);
  try {
    const dialogs = await app.evaluate(`[...document.querySelectorAll('.modal-backdrop')].map((dialog) => ({
      role: dialog.getAttribute('role'),
      modal: dialog.getAttribute('aria-modal'),
      name: document.getElementById(dialog.getAttribute('aria-labelledby'))?.textContent.trim() || '',
      hasClose: Boolean(dialog.querySelector('[data-dialog-close]')),
    }))`);
    assert.equal(dialogs.length, 5);
    for (const dialog of dialogs) {
      assert.equal(dialog.role, 'dialog');
      assert.equal(dialog.modal, 'true');
      assert.notEqual(dialog.name, '');
      assert.equal(dialog.hasClose, true);
    }
    assert.equal(await app.evaluate(`document.getElementById('invoiceTotalPreview').getAttribute('aria-labelledby')`), 'invoiceTotalLabel');
  } finally {
    await app.stop();
  }
});

test('a modal takes the focus, keeps Tab inside, and closes with Escape', async () => {
  const app = await launchApp(dataDir);
  try {
    await app.evaluate(`(() => {
      document.querySelector('.nav-link[data-view="invoices"]').click();
      const button = document.querySelector('#invoices-table-body button[data-action="preview-invoice"]');
      button.focus();
      button.click();
      return true;
    })()`);
    assert.equal(await waitFor(() => app.evaluate(modalOpen('invoice-preview-modal'))), true);
    assert.equal(await waitFor(() => app.evaluate(focusInside('invoice-preview-modal'))), true);

    for (let press = 0; press < 12; press += 1) {
      await app.pressKey('Tab', { shift: press % 3 === 0 });
      assert.equal(await app.evaluate(focusInside('invoice-preview-modal')), true, `focus left the modal after Tab ${press + 1}`);
    }

    await app.pressKey('Escape');
    assert.equal(await waitFor(() => app.evaluate(`!(${modalOpen('invoice-preview-modal')})`)), true);
    assert.equal(
      await waitFor(() => app.evaluate(`document.activeElement?.dataset.action === 'preview-invoice'`)),
      true,
      'the focus goes back to the button that opened the modal',
    );
  } finally {
    await app.stop();
  }
});

test('Escape closes a form modal without saving', async () => {
  const app = await launchApp(dataDir);
  try {
    await app.evaluate(`document.querySelector('.nav-link[data-view="invoices"]').click(); document.querySelector('#invoices-table-body button[data-action="mark-paid"]').click(); true`);
    assert.equal(await waitFor(() => app.evaluate(modalOpen('mark-paid-modal'))), true);
    assert.equal(await app.evaluate(`document.activeElement.id`), 'markPaidDate', 'the modal keeps its own first focus');

    await app.pressKey('Escape');
    assert.equal(await waitFor(() => app.evaluate(`!(${modalOpen('mark-paid-modal')})`)), true);
    assert.equal(await app.evaluate(`import('./state.js').then((module) => module.state.invoices[0].status)`), 'sent');
  } finally {
    await app.stop();
  }
});

test('the mark paid and status modals name the invoice that they change', async () => {
  const app = await launchApp(dataDir);
  try {
    const subject = await app.evaluate(`(() => {
      document.querySelector('.nav-link[data-view="invoices"]').click();
      document.querySelector('#invoices-table-body button[data-action="mark-paid"]').click();
      const markPaid = document.getElementById('mark-paid-subject').textContent;
      document.getElementById('mark-paid-cancel').click();
      document.querySelector('#invoices-table-body button[data-action="change-status"]').click();
      const status = document.getElementById('change-status-subject').textContent;
      return { markPaid, status, described: document.getElementById('change-status-modal').getAttribute('aria-describedby') };
    })()`);
    assert.deepEqual(subject, {
      markPaid: 'INV-2026-09-001 · Test Client · €121.00',
      status: 'INV-2026-09-001 · Test Client · €121.00',
      described: 'change-status-subject',
    });
  } finally {
    await app.stop();
  }
});
