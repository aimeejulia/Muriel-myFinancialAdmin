import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// state.js looks up DOM elements when it loads, so give it an empty document
globalThis.window = {};
globalThis.document = {
  getElementById: () => null,
  querySelectorAll: () => [],
  createElement: () => ({}),
};

const { state, restoreStateFromRaw, serializeStateForBackup } = await import('../state.js');

const currentInvoice = { id: 'invoice-1', invoiceNumber: 'INV-2026-03-001', clientId: 'client-1' };
const backupState = {
  clients: [{ id: 'client-2', displayId: '0002', name: 'Restored Client', status: 'active' }],
  invoices: [{ id: 'invoice-2', invoiceNumber: 'INV-2025-12-001', clientId: 'client-2' }],
  expenses: [{ id: 'expense-1', amount: 10 }],
};

beforeEach(() => {
  state.clients = [{ id: 'client-1', displayId: '0001', name: 'Current Client', status: 'active' }];
  state.invoices = [currentInvoice];
  state.expenses = [];
});

async function assertRejected(raw, expectedError) {
  const result = await restoreStateFromRaw(raw);

  assert.equal(result.ok, false);
  assert.match(result.error, expectedError);
  assert.deepEqual(state.invoices.map((invoice) => invoice.id), [currentInvoice.id]);
  assert.equal(state.clients[0].name, 'Current Client');
}

test('an empty JSON object is rejected and the current data is kept', async () => {
  await assertRejected('{}', /not a Muriel backup/);
});

test('an unrelated JSON file is rejected', async () => {
  await assertRejected(JSON.stringify({ name: 'muriel-myfinancialadmin', version: '1.1.2' }), /not a Muriel backup/);
});

test('an exported backup without data lists is rejected', async () => {
  await assertRejected(JSON.stringify({ app: 'muriel-myfinancialadmin', schemaVersion: 1, state: {} }), /not a Muriel backup/);
});

test('data lists with entries that are not records are rejected', async () => {
  await assertRejected(JSON.stringify({ ...backupState, invoices: ['INV-1', null] }), /not a Muriel backup/);
});

test('a truncated file is rejected', async () => {
  await assertRejected(JSON.stringify(backupState).slice(0, 30), /could not be read/);
});

test('a backup from a newer schema version is rejected', async () => {
  await assertRejected(JSON.stringify({ app: 'muriel-myfinancialadmin', schemaVersion: 2, state: backupState }), /newer version/);
});

test('an exported backup is restored', async () => {
  const result = await restoreStateFromRaw(JSON.stringify({ app: 'muriel-myfinancialadmin', schemaVersion: 1, state: backupState }));

  assert.equal(result.ok, true);
  assert.equal(state.invoices[0].id, 'invoice-2');
  assert.equal(state.clients[0].name, 'Restored Client');
  assert.equal(state.expenses.length, 1);
});

test('a plain saved state is restored', async () => {
  const result = await restoreStateFromRaw(JSON.stringify(backupState));

  assert.equal(result.ok, true);
  assert.equal(state.invoices[0].id, 'invoice-2');
});

test('a backup made by serializeStateForBackup can be restored', async () => {
  const raw = serializeStateForBackup();
  state.invoices = [];

  const result = await restoreStateFromRaw(raw);

  assert.equal(result.ok, true);
  assert.deepEqual(state.invoices.map((invoice) => invoice.id), ['invoice-1']);
});

test('a backup with records that the app cannot show is rejected and the current data is kept', async () => {
  const badBackup = {
    clients: [{ id: 'client-2', name: 42 }],
    invoices: [
      { id: 'invoice-2', invoiceNumber: 'INV-1', clientId: 'client-2', total: 'a lot' },
      { id: 'invoice-2', invoiceNumber: 'INV-2', clientId: 'client-2' },
    ],
    expenses: [{ amount: 10 }],
  };

  const result = await restoreStateFromRaw(JSON.stringify(badBackup));

  assert.equal(result.ok, false);
  assert.match(result.error, /records that Muriel cannot use/);
  assert.match(result.error, /client 1: name must be text/);
  assert.match(result.error, /invoice 1: total must be an amount/);
  assert.match(result.error, /invoice 2 has the same id as another invoice/);
  assert.match(result.error, /1 more problems were found/);
  assert.deepEqual(state.invoices.map((invoice) => invoice.id), [currentInvoice.id]);
});

test('older backups with optional fields missing and amounts as text are still restored', async () => {
  const olderBackup = {
    clients: [{ id: 'client-2', name: 'Older Client' }],
    invoices: [{ id: 'invoice-2', invoiceNumber: 'INV-2025-01-001', clientId: 'client-2', subtotal: '100.00', total: 121 }],
    expenses: [{ id: 'expense-1', amount: '12.50' }],
  };

  const result = await restoreStateFromRaw(JSON.stringify(olderBackup));

  assert.equal(result.ok, true);
  assert.equal(state.clients[0].name, 'Older Client');
});
