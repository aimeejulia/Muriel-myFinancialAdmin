import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createDataDir, removeDataDir, writeStateFile, sampleState, launchApp, assertRealDataUntouched,
} from './helpers.mjs';

let dataDir;

beforeEach(() => {
  dataDir = createDataDir();
  writeStateFile(dataDir, sampleState());
});

afterEach(async () => {
  await removeDataDir(dataDir);
  assertRealDataUntouched();
});

test('the app gets the ECB rate of the last working day and keeps it in its data folder', async (t) => {
  const app = await launchApp(dataDir);
  try {
    // 2026-09-27 is a Sunday, so the rate is the one of Friday 2026-09-25.
    const result = await app.evaluate(`window.desktopStore.getExchangeRate('USD', '2026-09-27')`);
    if (!result.ok) {
      // afterEach does not run for a skipped test, so the test removes its data folder itself.
      await app.stop();
      await removeDataDir(dataDir);
      t.skip(`The ECB is not reachable: ${result.error}`);
      return;
    }

    assert.equal(result.rate, 1.1403);
    assert.equal(result.rateDate, '2026-09-25');
    assert.equal(result.source, 'ECB reference rate of 2026-09-25');
    const cache = JSON.parse(fs.readFileSync(path.join(dataDir, 'exchange-rates.json'), 'utf8'));
    assert.equal(cache['USD:2026-09-27'].rate, 1.1403);
  } finally {
    await app.stop();
  }
});
