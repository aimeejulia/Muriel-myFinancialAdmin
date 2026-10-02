import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createDataDir, removeDataDir, writeStateFile, sampleState, launchApp,
  forceSave, sleep, assertRealDataUntouched,
} from './helpers.mjs';

const bannerHidden = `document.getElementById('save-error-banner').hidden`;
let dataDir;

function setDataReadOnly(readOnly) {
  for (const fileName of fs.readdirSync(dataDir).filter((name) => name.includes('-state'))) {
    fs.chmodSync(path.join(dataDir, fileName), readOnly ? 0o400 : 0o600);
  }
  fs.chmodSync(dataDir, readOnly ? 0o500 : 0o700);
}

beforeEach(() => {
  dataDir = createDataDir();
  writeStateFile(dataDir, sampleState());
});

afterEach(async () => {
  await removeDataDir(dataDir);
  assertRealDataUntouched();
});

test('a failed save shows an error until the next save works', async () => {
  const app = await launchApp(dataDir);
  try {
    await app.evaluate(forceSave('sunrise'));
    await sleep(300);
    assert.equal(await app.evaluate(bannerHidden), true);

    setDataReadOnly(true);
    await app.evaluate(forceSave('night'));
    await sleep(300);
    assert.equal(await app.evaluate(bannerHidden), false);
    assert.match(await app.evaluate(`document.getElementById('save-error-message').textContent`), /EACCES/);

    setDataReadOnly(false);
    await app.evaluate(forceSave('muriel'));
    await sleep(300);
    assert.equal(await app.evaluate(bannerHidden), true);
  } finally {
    setDataReadOnly(false);
    await app.stop();
  }
});
