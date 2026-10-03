import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  createDataDir, removeDataDir, writeStateFile, sampleState, sampleInvoice, launchApp, waitFor, assertRealDataUntouched,
} from './helpers.mjs';

let dataDir;

// The app writes to the desktop clipboard, so the test keeps what was there and puts it back.
function readClipboard() {
  try {
    return execFileSync('xclip', ['-o', '-selection', 'clipboard'], { encoding: 'utf8', timeout: 2000 });
  } catch {
    return null;
  }
}

function writeClipboard(text) {
  try {
    execFileSync('xclip', ['-i', '-selection', 'clipboard'], { input: text, timeout: 2000 });
  } catch {
    // Without xclip there is nothing to restore.
  }
}

beforeEach(() => {
  dataDir = createDataDir();
  writeStateFile(dataDir, sampleState({ invoices: [{ ...sampleInvoice, status: 'sent' }] }));
});

afterEach(async () => {
  await removeDataDir(dataDir);
  assertRealDataUntouched();
});

test('a payment reminder is copied to the clipboard', async () => {
  const clipboardBefore = readClipboard();
  const app = await launchApp(dataDir);
  try {
    await app.evaluate(`window.alerts = []; window.alert = (message) => window.alerts.push(message); true`);
    await app.evaluate(`document.querySelector('#invoices-table-body button[data-action="reminder"]').click(); true`);
    await waitFor(() => app.evaluate('window.alerts.length > 0'));

    assert.deepEqual(await app.evaluate('window.alerts'), ['Reminder copied.']);
    if (clipboardBefore !== null) {
      assert.match(await waitFor(() => /INV-2026-09-001/.test(readClipboard()) && readClipboard()), /INV-2026-09-001/);
    }
  } finally {
    await app.stop();
    if (clipboardBefore !== null) writeClipboard(clipboardBefore);
  }
});
