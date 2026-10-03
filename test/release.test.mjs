import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { changelogSection, checkLatestYml, findArtifacts, releaseNotes } = require('../scripts/release.js');

const changelog = `# Changelog

## 1.3.0

### Added
- Update steps for each install type.

## 1.2.0

### Fixed
- Older fix.
`;

const distFiles = [
  'Muriel-myFinancialAdmin-1.3.0.AppImage',
  'muriel-myfinancialadmin_1.3.0_amd64.snap',
  'Muriel-myFinancialAdmin-1.3.0-x86_64.flatpak',
  'latest-linux.yml',
  'builder-debug.yml',
  'linux-unpacked',
];

test('the changelog section of a version is found without the next version', () => {
  assert.equal(changelogSection(changelog, '1.3.0'), '### Added\n- Update steps for each install type.');
  assert.equal(changelogSection(changelog, '1.2.0'), '### Fixed\n- Older fix.');
  assert.equal(changelogSection(changelog, '9.9.9'), '');
});

test('one file of each package type is found for the version', () => {
  const { artifacts, errors } = findArtifacts(distFiles, '1.3.0');

  assert.deepEqual(errors, []);
  assert.deepEqual(artifacts, {
    appImage: 'Muriel-myFinancialAdmin-1.3.0.AppImage',
    snap: 'muriel-myfinancialadmin_1.3.0_amd64.snap',
    flatpak: 'Muriel-myFinancialAdmin-1.3.0-x86_64.flatpak',
  });
});

test('missing packages, old versions and missing latest-linux.yml are errors', () => {
  const { errors } = findArtifacts(['Muriel-myFinancialAdmin-1.2.0.AppImage', 'muriel-myfinancialadmin_1.3.0_amd64.snap'], '1.3.0');

  assert.equal(errors.length, 3);
  assert.match(errors[0], /one AppImage file for version 1.3.0 in dist, found 0/);
  assert.match(errors[1], /one Flatpak file/);
  assert.match(errors[2], /latest-linux.yml is missing/);
});

test('file names with spaces are errors', () => {
  const files = distFiles.map((name) => name.replace('Muriel-myFinancialAdmin', 'Muriel - myFinancialAdmin'));

  const { errors } = findArtifacts(files, '1.3.0');

  assert.equal(errors.length, 2);
  assert.match(errors[0], /"Muriel - myFinancialAdmin-1.3.0.AppImage" has spaces/);
});

test('latest-linux.yml must name the AppImage exactly and have the version', () => {
  const yml = `version: 1.3.0
files:
  - url: Muriel-myFinancialAdmin-1.3.0.AppImage
    sha512: abc
    size: 1
path: Muriel-myFinancialAdmin-1.3.0.AppImage
sha512: abc
`;

  assert.deepEqual(checkLatestYml(yml, 'Muriel-myFinancialAdmin-1.3.0.AppImage', '1.3.0'), []);
  assert.equal(checkLatestYml(yml, 'Other.AppImage', '1.3.0').length, 2);
  assert.match(checkLatestYml(yml, 'Muriel-myFinancialAdmin-1.3.0.AppImage', '1.4.0')[0], /version 1.3.0, expected 1.4.0/);
  assert.match(checkLatestYml('version: 1.3.0\n', 'x.AppImage', '1.3.0')[0], /names no file/);
});

test('release notes have the changelog text and the installation steps', () => {
  const notes = releaseNotes('### Added\n- Something.');

  assert.match(notes, /^### Added\n- Something\./);
  assert.match(notes, /## Installation/);
  assert.match(notes, /sudo snap install --dangerous <file>/);
  assert.match(notes, /flatpak install --user <file>/);
});
