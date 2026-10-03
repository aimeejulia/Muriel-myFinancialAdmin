import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  writeFileAtomic,
  isStateJson,
  readFirstValidStateFile,
  decryptStatePayload,
} = require('../state-file.js');

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

test('writeFileAtomic makes the file readable only by the current user', () => {
  const filePath = path.join(dir, 'state.json');
  fs.writeFileSync(filePath, 'old', { mode: 0o664 });
  fs.chmodSync(filePath, 0o664);

  writeFileAtomic(filePath, validState);

  assert.equal(fs.statSync(filePath).mode & 0o777, 0o600);
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

// A fake Electron app and safeStorage: only the key of keyName can decrypt.
function fakeElectron(keyName) {
  const app = {
    name: 'muriel-myfinancialadmin',
    names: [],
    getName() { return this.name; },
    setName(name) { this.name = name; this.names.push(name); },
  };
  const safeStorage = {
    isEncryptionAvailable: () => true,
    decryptString(buffer) {
      if (app.name !== keyName) throw new Error('wrong key');
      return buffer.toString('utf8');
    },
  };
  return { app, safeStorage };
}
const encryptedPayload = JSON.stringify({ version: 1, encrypted: true, data: Buffer.from(validState).toString('base64') });

test('state encrypted with an older app name is decrypted, and the app name is set back', () => {
  const electron = fakeElectron('darwin-myfinancialadmin');

  assert.equal(decryptStatePayload(encryptedPayload, electron), validState);
  assert.equal(electron.app.getName(), 'muriel-myfinancialadmin');
});

test('state encrypted with the current app name keeps the app name', () => {
  const electron = fakeElectron('muriel-myfinancialadmin');

  assert.equal(decryptStatePayload(encryptedPayload, electron), validState);
  assert.equal(electron.app.getName(), 'muriel-myfinancialadmin');
});

test('when no app name can decrypt the state, the error is thrown and the app name is set back', () => {
  const electron = fakeElectron('another-app');

  assert.throws(() => decryptStatePayload(encryptedPayload, electron), /Unable to decrypt/);
  assert.equal(electron.app.getName(), 'muriel-myfinancialadmin');
});

test('text that is not an encrypted payload is not decrypted', () => {
  const electron = fakeElectron('muriel-myfinancialadmin');

  assert.equal(decryptStatePayload(validState, electron), null);
  assert.equal(decryptStatePayload('not json', electron), null);
  assert.deepEqual(electron.app.names, []);
});
