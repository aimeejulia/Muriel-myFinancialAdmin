import { test } from 'node:test';
import assert from 'node:assert/strict';

// update-banner.js imports state.js, which looks up DOM elements when it loads
globalThis.window = {};
globalThis.document = {
  getElementById: () => null,
  querySelectorAll: () => [],
  createElement: () => ({}),
};

const { describeUpdate } = await import('../update-banner.js');

const baseResult = {
  currentVersion: '1.2.0',
  latestVersion: '1.3.0',
  releaseUrl: 'https://github.com/aimeejulia/Muriel-myFinancialAdmin/releases/tag/v1.3.0',
};

test('a Snap install gets the Snap file and the install command', () => {
  const banner = describeUpdate({
    ...baseResult,
    installType: 'snap',
    assetUrl: 'https://example.test/app.snap',
    updateCommand: 'sudo snap install --dangerous ~/Downloads/app.snap',
  });

  assert.equal(banner.title, 'Version 1.3.0 is available');
  assert.equal(banner.downloadUrl, 'https://example.test/app.snap');
  assert.equal(banner.downloadLabel, 'Download Snap file');
  assert.equal(banner.command, 'sudo snap install --dangerous ~/Downloads/app.snap');
  assert.match(banner.message, /Download the Snap file, then run this command/);
});

test('a Flatpak install gets the Flatpak file and the install command', () => {
  const banner = describeUpdate({
    ...baseResult,
    installType: 'flatpak',
    assetUrl: 'https://example.test/app.flatpak',
    updateCommand: 'flatpak install --user ~/Downloads/app.flatpak',
  });

  assert.equal(banner.downloadLabel, 'Download Flatpak file');
  assert.equal(banner.command, 'flatpak install --user ~/Downloads/app.flatpak');
});

test('a source checkout gets the git command and no download', () => {
  const banner = describeUpdate({
    ...baseResult,
    installType: 'source',
    updateCommand: 'cd /src/muriel && git pull --ff-only && npm ci',
  });

  assert.equal(banner.downloadUrl, '');
  assert.equal(banner.command, 'cd /src/muriel && git pull --ff-only && npm ci');
  assert.match(banner.message, /Run this command in a terminal, then start Muriel again/);
});

test('an AppImage gets a direct download of the new AppImage', () => {
  const banner = describeUpdate({ ...baseResult, installType: 'appimage', assetUrl: 'https://example.test/app.AppImage' });

  assert.equal(banner.downloadUrl, 'https://example.test/app.AppImage');
  assert.equal(banner.downloadLabel, 'Download AppImage');
  assert.equal(banner.command, '');
});

test('without a matching release file, the banner opens the release page', () => {
  for (const installType of ['snap', 'flatpak', 'appimage', 'other']) {
    const banner = describeUpdate({ ...baseResult, installType });

    assert.equal(banner.downloadUrl, baseResult.releaseUrl, installType);
    assert.equal(banner.downloadLabel, 'Open download page', installType);
    assert.equal(banner.command, '', installType);
  }
});
