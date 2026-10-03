import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  createDataDir, removeDataDir, writeStateFile, sampleState, launchApp, assertRealDataUntouched,
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
  writeStateFile(dataDir, sampleState());
});

afterEach(async () => {
  await removeDataDir(dataDir);
  assertRealDataUntouched();
});

test('the update banner shows the command and copies it', async () => {
  const clipboardBefore = readClipboard();
  const app = await launchApp(dataDir);
  try {
    await app.evaluate(`import('./update-banner.js').then(({ describeUpdate, showUpdateBanner }) => {
      showUpdateBanner(describeUpdate({
        currentVersion: '1.2.0',
        latestVersion: '1.3.0',
        installType: 'snap',
        assetUrl: 'https://example.test/app.snap',
        updateCommand: 'sudo snap install --dangerous ~/Downloads/app.snap',
      }));
      return true;
    })`);

    const banner = await app.evaluate(`({
      visible: !document.getElementById('update-banner').hidden,
      command: document.getElementById('update-banner-command').textContent,
      commandVisible: !document.getElementById('update-banner-command').hidden,
      download: document.getElementById('update-download-btn').textContent,
      copyVisible: !document.getElementById('update-copy-btn').hidden,
    })`);
    assert.deepEqual(banner, {
      visible: true,
      command: 'sudo snap install --dangerous ~/Downloads/app.snap',
      commandVisible: true,
      download: 'Download Snap file',
      copyVisible: true,
    });

    await app.evaluate(`document.getElementById('update-copy-btn').click(); true`);
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(await app.evaluate(`document.getElementById('update-copy-btn').textContent`), 'Copied');
    if (clipboardBefore !== null) {
      assert.equal(readClipboard(), 'sudo snap install --dangerous ~/Downloads/app.snap');
    }
  } finally {
    await app.stop();
    if (clipboardBefore !== null) writeClipboard(clipboardBefore);
  }
});

test('a Snap install is detected by the update check', async (t) => {
  const app = await launchApp(dataDir, { env: { SNAP: '/snap/muriel-myfinancialadmin/x1' } });
  try {
    const result = await app.evaluate('window.desktopStore.checkForUpdates()');
    if (!result.ok) {
      t.skip(`GitHub is not reachable: ${result.message}`);
      return;
    }
    assert.equal(result.installType, 'snap');
  } finally {
    await app.stop();
  }
});
