import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createDataDir, removeDataDir, writeStateFile, sampleState, launchApp,
  forceSave, sleep, invoiceTableHas, assertRealDataUntouched, STATE_FILE, BACKUP_FILE,
} from './helpers.mjs';

const isEncrypted = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')).encrypted === true;
  } catch {
    return false;
  }
};
const fileMode = (filePath) => fs.statSync(filePath).mode & 0o777;
let dataDir;

beforeEach(() => {
  dataDir = createDataDir();
});

afterEach(async () => {
  await removeDataDir(dataDir);
  assertRealDataUntouched();
});

test('plain state files become encrypted and private on the next save', async (t) => {
  for (const fileName of [STATE_FILE, BACKUP_FILE]) {
    writeStateFile(dataDir, sampleState(), fileName);
    fs.chmodSync(path.join(dataDir, fileName), 0o664);
  }

  let app = await launchApp(dataDir);
  assert.equal(await app.evaluate(invoiceTableHas('INV-2026-09-001')), true);
  const encryptionStatus = await app.evaluate(`import('./state.js').then((module) => module.getDesktopEncryptionStatus())`);
  if (!encryptionStatus.available) {
    await app.stop();
    t.skip('encrypted storage is not available in this session');
    return;
  }
  await app.evaluate(forceSave());
  await sleep(300);
  await app.stop();

  for (const fileName of [STATE_FILE, BACKUP_FILE]) {
    assert.equal(isEncrypted(path.join(dataDir, fileName)), true, `${fileName} is encrypted`);
    assert.equal(fileMode(path.join(dataDir, fileName)), 0o600, `${fileName} has mode 600`);
  }

  writeStateFile(dataDir, '{"version":1,"encr');
  app = await launchApp(dataDir);
  assert.equal(await app.evaluate(invoiceTableHas('INV-2026-09-001')), true, 'the encrypted backup is used');
  await app.stop();
});
