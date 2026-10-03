import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// update-banner.js uses the banner elements, so give state.js simple stand-ins for them
const fakeElements = new Map();
globalThis.window = {};
globalThis.document = {
  getElementById: (id) => {
    if (!fakeElements.has(id)) fakeElements.set(id, { hidden: true, disabled: false, textContent: '', dataset: {} });
    return fakeElements.get(id);
  },
  querySelectorAll: () => [],
  createElement: () => ({}),
};

const { elements } = await import('../state.js');
const { downloadAndRestart, showUpdateBanner } = await import('../update-banner.js');

function fakeDesktopStore({ download = { ok: true }, progress = [] } = {}) {
  const calls = [];
  return {
    calls,
    onUpdateProgress(callback) {
      calls.push('onUpdateProgress');
      this.progressCallback = callback;
    },
    async downloadUpdate() {
      calls.push('downloadUpdate');
      for (const percent of progress) this.progressCallback(percent);
      return download;
    },
    async installUpdate() {
      calls.push('installUpdate');
      return { ok: true };
    },
  };
}

beforeEach(() => {
  showUpdateBanner({
    title: 'Version 1.3.0 is available',
    message: 'Muriel can download the update and restart.',
    tone: 'success',
    downloadUrl: 'https://example.test/app.AppImage',
    downloadLabel: 'Download AppImage',
    installLabel: 'Download and restart',
  });
});

test('a successful download restarts into the new version', async () => {
  const desktopStore = fakeDesktopStore({ progress: [10, 55] });

  await downloadAndRestart(desktopStore);

  assert.deepEqual(desktopStore.calls, ['onUpdateProgress', 'downloadUpdate', 'installUpdate']);
  assert.equal(elements.updateInstallBtn.textContent, 'Restarting…');
  assert.equal(elements.updateInstallBtn.disabled, true);
});

test('download progress shows on the button', async () => {
  const labels = [];
  const desktopStore = fakeDesktopStore();
  desktopStore.downloadUpdate = async function downloadUpdate() {
    this.progressCallback(42);
    labels.push(elements.updateInstallBtn.textContent);
    return { ok: false, error: 'stop here' };
  };

  await downloadAndRestart(desktopStore);

  assert.deepEqual(labels, ['Downloading… 42%']);
});

test('a failed download does not restart and offers the manual download', async () => {
  const desktopStore = fakeDesktopStore({ download: { ok: false, error: 'sha512 checksum mismatch.' } });

  await downloadAndRestart(desktopStore);

  assert.deepEqual(desktopStore.calls, ['onUpdateProgress', 'downloadUpdate']);
  assert.equal(elements.updateBannerTitle.textContent, 'Could not update');
  assert.match(elements.updateBannerMessage.textContent, /sha512 checksum mismatch/);
  assert.equal(elements.updateBanner.dataset.tone, 'warning');
  assert.equal(elements.updateInstallBtn.hidden, true);
  assert.equal(elements.updateDownloadBtn.hidden, false);
  assert.equal(elements.updateDownloadBtn.textContent, 'Download AppImage');
});

test('a failed source checkout update keeps the command to run by hand', async () => {
  showUpdateBanner({
    title: 'Version 1.3.0 is available',
    message: 'Muriel can update this folder with git and restart.',
    tone: 'success',
    installLabel: 'Update and restart',
    busyLabel: 'Updating…',
    command: 'cd /src/muriel && git pull --ff-only && npm ci',
  });
  const labels = [];
  const desktopStore = fakeDesktopStore();
  desktopStore.downloadUpdate = async function downloadUpdate() {
    labels.push(elements.updateInstallBtn.textContent);
    return { ok: false, error: 'The Muriel folder has changes that are not committed. Commit or remove them, then try again.' };
  };

  await downloadAndRestart(desktopStore);

  assert.deepEqual(labels, ['Updating…']);
  assert.match(elements.updateBannerMessage.textContent, /not committed.*Run this command in a terminal to update/);
  assert.equal(elements.updateBannerCommand.hidden, false);
  assert.equal(elements.updateBannerCommand.textContent, 'cd /src/muriel && git pull --ff-only && npm ci');
  assert.equal(elements.updateDownloadBtn.hidden, true);
});
