import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createDataDir, removeDataDir, writeStateFile, sampleState, launchApp,
  forceSave, sleep, invoiceTableHas, assertRealDataUntouched, STATE_FILE,
} from './helpers.mjs';

let dataDir;

beforeEach(() => {
  dataDir = createDataDir();
});

afterEach(async () => {
  await removeDataDir(dataDir);
  assertRealDataUntouched();
});

test('data from a newer version of the app is not loaded or overwritten', async () => {
  const newerData = JSON.stringify({ ...sampleState(), schemaVersion: 99 });
  writeStateFile(dataDir, newerData);

  const app = await launchApp(dataDir);
  assert.equal(await app.evaluate(invoiceTableHas('INV-2026-09-001')), false);
  await app.evaluate(forceSave());
  await sleep(300);
  await app.stop();

  assert.match(app.dialogs.join('\n'), /newer version of Muriel/);
  assert.equal(fs.readFileSync(path.join(dataDir, STATE_FILE), 'utf8'), newerData);
});
