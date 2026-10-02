import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { writeFileAtomic, isStateJson, readFirstValidStateFile } = require('../state-file.js');

const plain = (raw) => raw;
const validState = JSON.stringify({ clients: [], invoices: [{ id: 'invoice-1' }], expenses: [] });
let dir;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'muriel-state-file-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

test('writeFileAtomic replaces the file and leaves no temporary file', () => {
  const filePath = path.join(dir, 'state.json');
  fs.writeFileSync(filePath, 'old');

  writeFileAtomic(filePath, validState);

  assert.equal(fs.readFileSync(filePath, 'utf8'), validState);
  assert.deepEqual(fs.readdirSync(dir), ['state.json']);
});

test('isStateJson accepts only a JSON object', () => {
  assert.equal(isStateJson(validState), true);
  assert.equal(isStateJson(validState.slice(0, 20)), false);
  assert.equal(isStateJson(''), false);
  assert.equal(isStateJson('null'), false);
  assert.equal(isStateJson('[]'), false);
});

test('a truncated state file falls back to the backup', () => {
  const statePath = path.join(dir, 'state.json');
  const backupPath = path.join(dir, 'state.backup.json');
  fs.writeFileSync(statePath, validState.slice(0, 20));
  fs.writeFileSync(backupPath, validState);

  const result = readFirstValidStateFile([statePath, backupPath], plain);

  assert.equal(result.path, backupPath);
  assert.equal(result.plainText, validState);
  assert.deepEqual(result.failedPaths, [statePath]);
});

test('a state file that cannot be decrypted falls back to the backup', () => {
  const statePath = path.join(dir, 'state.json');
  const backupPath = path.join(dir, 'state.backup.json');
  fs.writeFileSync(statePath, '{"encrypted":true,"data":"abc"}');
  fs.writeFileSync(backupPath, validState);

  const decrypt = (raw) => {
    if (JSON.parse(raw).encrypted) throw new Error('Unable to decrypt');
    return raw;
  };
  const result = readFirstValidStateFile([statePath, backupPath], decrypt);

  assert.equal(result.path, backupPath);
});

test('reports every file that exists but cannot be read', () => {
  const statePath = path.join(dir, 'state.json');
  const backupPath = path.join(dir, 'state.backup.json');
  fs.writeFileSync(statePath, '');
  fs.writeFileSync(backupPath, '{"clients":');

  const result = readFirstValidStateFile([statePath, backupPath, path.join(dir, 'missing.json')], plain);

  assert.equal(result.path, '');
  assert.deepEqual(result.failedPaths, [statePath, backupPath]);
});

test('no saved files is not a failure', () => {
  const result = readFirstValidStateFile([path.join(dir, 'state.json')], plain);

  assert.equal(result.path, '');
  assert.deepEqual(result.failedPaths, []);
});
