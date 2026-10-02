import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createDataDir, removeDataDir, writeStateFile, sampleState, launchApp,
  forceSave, sleep, invoiceTableHas, assertRealDataUntouched, STATE_FILE, BACKUP_FILE,
} from './helpers.mjs';

const goodState = JSON.stringify(sampleState());
let dataDir;

beforeEach(() => {
  dataDir = createDataDir();
});

afterEach(async () => {
  await removeDataDir(dataDir);
  assertRealDataUntouched();
});

test('a truncated state file is recovered from the backup', async () => {
  writeStateFile(dataDir, goodState.slice(0, 40));
  writeStateFile(dataDir, goodState, BACKUP_FILE);

  let app = await launchApp(dataDir);
  assert.equal(await app.evaluate(invoiceTableHas('INV-2026-09-001')), true);
  await app.evaluate(forceSave());
  await sleep(300);
  await app.stop();

  assert.doesNotThrow(() => JSON.parse(fs.readFileSync(path.join(dataDir, STATE_FILE), 'utf8')));
  assert.ok(fs.readdirSync(dataDir).every((fileName) => !fileName.endsWith('.tmp')));

  fs.rmSync(path.join(dataDir, STATE_FILE));
  app = await launchApp(dataDir);
  assert.equal(await app.evaluate(invoiceTableHas('INV-2026-09-001')), true, 'the backup still has the data');
  await app.stop();
});

test('unreadable saved data is never overwritten', async () => {
  const damaged = goodState.slice(0, 40);
  writeStateFile(dataDir, damaged);

  const app = await launchApp(dataDir);
  await app.evaluate(forceSave());
  await sleep(300);
  await app.stop();

  assert.equal(fs.readFileSync(path.join(dataDir, STATE_FILE), 'utf8'), damaged);
  assert.deepEqual(fs.readdirSync(dataDir).filter((fileName) => fileName.includes('-state')), [STATE_FILE]);
});

test('the first start creates the state files', async () => {
  const app = await launchApp(dataDir);
  await app.evaluate(forceSave());
  await sleep(300);
  await app.stop();

  assert.ok(fs.existsSync(path.join(dataDir, STATE_FILE)));
  assert.ok(fs.existsSync(path.join(dataDir, BACKUP_FILE)));
});
