import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { detectInstallType, findReleaseAsset, updateCommand } = require('../update-info.js');

// Asset names as GitHub shows them for the 1.1.2 release
const releaseAssets = [
  { name: 'muriel-myfinancialadmin_1.1.2_amd64.snap', browser_download_url: 'https://example.test/app.snap' },
  { name: 'Muriel.-.myFinancialAdmin-1.1.2-x86_64.flatpak', browser_download_url: 'https://example.test/app.flatpak' },
  { name: 'Muriel.-.myFinancialAdmin-1.1.2.AppImage', browser_download_url: 'https://example.test/app.AppImage' },
  { name: 'latest-linux.yml', browser_download_url: 'https://example.test/latest-linux.yml' },
];

test('the install type comes from the runtime of each package format', () => {
  assert.equal(detectInstallType({ env: { APPIMAGE: '/home/user/Muriel.AppImage' } }), 'appimage');
  assert.equal(detectInstallType({ env: { SNAP: '/snap/muriel-myfinancialadmin/1' } }), 'snap');
  assert.equal(detectInstallType({ env: { FLATPAK_ID: 'com.muriel.myfinancialadmin' } }), 'flatpak');
  assert.equal(detectInstallType({ env: {}, flatpakInfoExists: true }), 'flatpak');
  assert.equal(detectInstallType({ env: {}, isPackaged: false }), 'source');
  assert.equal(detectInstallType({ env: {}, isPackaged: true }), 'other');
});

test('each install type gets its own release file', () => {
  assert.equal(findReleaseAsset(releaseAssets, 'appimage').name, 'Muriel.-.myFinancialAdmin-1.1.2.AppImage');
  assert.equal(findReleaseAsset(releaseAssets, 'snap').url, 'https://example.test/app.snap');
  assert.equal(findReleaseAsset(releaseAssets, 'flatpak').name, 'Muriel.-.myFinancialAdmin-1.1.2-x86_64.flatpak');
  assert.equal(findReleaseAsset(releaseAssets, 'source'), null);
  assert.equal(findReleaseAsset(releaseAssets.slice(2), 'snap'), null);
  assert.equal(findReleaseAsset(undefined, 'snap'), null);
});

test('Snap, Flatpak and source checkouts get the command that installs the update', () => {
  assert.equal(
    updateCommand('snap', { assetName: 'muriel-myfinancialadmin_1.2.0_amd64.snap' }),
    'sudo snap install --dangerous ~/Downloads/muriel-myfinancialadmin_1.2.0_amd64.snap',
  );
  assert.equal(
    updateCommand('flatpak', { assetName: 'Muriel.-.myFinancialAdmin-1.2.0-x86_64.flatpak' }),
    'flatpak install --user ~/Downloads/Muriel.-.myFinancialAdmin-1.2.0-x86_64.flatpak',
  );
  assert.equal(
    updateCommand('source', { appPath: '/home/user/src/Muriel-myFinancialAdmin' }),
    'cd /home/user/src/Muriel-myFinancialAdmin && git pull --ff-only && npm ci',
  );
});

test('paths with spaces or quotes are quoted for the shell', () => {
  assert.equal(
    updateCommand('source', { appPath: "/home/user/My Apps/Ann's Muriel" }),
    "cd '/home/user/My Apps/Ann'\\''s Muriel' && git pull --ff-only && npm ci",
  );
});

test('no command when there is nothing to run', () => {
  assert.equal(updateCommand('snap', {}), '');
  assert.equal(updateCommand('appimage', { assetName: 'Muriel.AppImage' }), '');
  assert.equal(updateCommand('other', {}), '');
});
