import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// state.js looks up DOM elements when it loads, so give it a document with only the save error banner
const fakeElements = {
  'save-error-banner': { hidden: true },
  'save-error-message': { textContent: '' },
};
let writeResult;
globalThis.window = {
  desktopStore: {
    isDesktopApp: true,
    writeState: async () => {
      if (writeResult instanceof Error) throw writeResult;
      return writeResult;
    },
  },
};
globalThis.document = {
  getElementById: (id) => fakeElements[id] || null,
  querySelectorAll: () => [],
  createElement: () => ({}),
};

const { saveState } = await import('../state.js');
const banner = fakeElements['save-error-banner'];
const message = fakeElements['save-error-message'];

beforeEach(() => {
  banner.hidden = true;
  message.textContent = '';
  console.error = () => {};
});

test('a failed save shows the save error banner with the reason', async () => {
  writeResult = { ok: false, error: 'ENOSPC: no space left on device' };

  await saveState();

  assert.equal(banner.hidden, false);
  assert.match(message.textContent, /ENOSPC: no space left on device/);
});

test('a save that throws shows the save error banner', async () => {
  writeResult = new Error('IPC channel closed');

  await saveState();

  assert.equal(banner.hidden, false);
  assert.match(message.textContent, /IPC channel closed/);
});

test('a successful save hides the save error banner again', async () => {
  writeResult = { ok: false, error: 'EACCES: permission denied' };
  await saveState();
  assert.equal(banner.hidden, false);

  writeResult = { ok: true };
  await saveState();

  assert.equal(banner.hidden, true);
});
