import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDataDir, removeDataDir, writeStateFile, sampleState, sampleInvoice, launchApp,
  sleep, invoiceTableHas, assertRealDataUntouched,
} from './helpers.mjs';

// The restore button opens a native file dialog, so the tests call the restore function in the page.
const restore = (raw) => `import('./state.js').then((module) => module.restoreStateFromRaw(${JSON.stringify(raw)}))`;
let dataDir;

beforeEach(() => {
  dataDir = createDataDir();
  writeStateFile(dataDir, sampleState());
});

afterEach(async () => {
  await removeDataDir(dataDir);
  assertRealDataUntouched();
});

test('restoring a file that is not a backup keeps the data', async () => {
  let app = await launchApp(dataDir);
  const result = await app.evaluate(restore('{}'));
  assert.equal(result.ok, false);
  await sleep(300);
  await app.stop();

  app = await launchApp(dataDir);
  assert.equal(await app.evaluate(invoiceTableHas('INV-2026-09-001')), true);
  await app.stop();
});

test('restoring an exported backup replaces the data', async () => {
  const backup = {
    app: 'muriel-myfinancialadmin',
    schemaVersion: 1,
    state: sampleState({ invoices: [{ ...sampleInvoice, id: 'invoice-9', invoiceNumber: 'INV-2025-01-009' }] }),
  };

  let app = await launchApp(dataDir);
  assert.equal((await app.evaluate(restore(JSON.stringify(backup)))).ok, true);
  await sleep(300);
  await app.stop();

  app = await launchApp(dataDir);
  assert.equal(await app.evaluate(invoiceTableHas('INV-2025-01-009')), true);
  assert.equal(await app.evaluate(invoiceTableHas('INV-2026-09-001')), false);
  await app.stop();
});
