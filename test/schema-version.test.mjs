import { test } from 'node:test';
import assert from 'node:assert/strict';

// state.js looks up DOM elements when it loads, so give it an empty document and a fake desktop store
const writes = [];
let savedRaw = '';
const alerts = [];
globalThis.alert = (message) => alerts.push(message);
globalThis.window = {
  desktopStore: {
    isDesktopApp: true,
    readState: async () => savedRaw,
    writeState: async (serialized) => {
      writes.push(serialized);
      return { ok: true };
    },
  },
};
globalThis.document = {
  getElementById: () => null,
  querySelectorAll: () => [],
  createElement: () => ({}),
};

const {
  state,
  STATE_SCHEMA_VERSION,
  loadState,
  saveState,
  restoreStateFromRaw,
  migrateSavedState,
} = await import('../state.js');

const savedState = {
  clients: [{ id: 'client-1', displayId: '0001', name: 'Client', status: 'active' }],
  invoices: [{ id: 'invoice-1', invoiceNumber: 'INV-2026-03-001', clientId: 'client-1' }],
  expenses: [],
};

test('saved data records the schema version', async () => {
  writes.length = 0;

  await saveState();

  assert.equal(JSON.parse(writes.at(-1)).schemaVersion, STATE_SCHEMA_VERSION);
});

test('saved data without a schema version loads as version 1', async () => {
  savedRaw = JSON.stringify(savedState);

  await loadState();

  assert.deepEqual(state.invoices.map((invoice) => invoice.id), ['invoice-1']);
});

test('migrations run in order from the saved version to the current version', () => {
  const migrations = {
    1: (saved) => ({ ...saved, notes: [] }),
    2: (saved) => ({ ...saved, notes: [...saved.notes, 'added in version 3'] }),
  };

  const migrated = migrateSavedState({ clients: [] }, 1, migrations, 3);

  assert.deepEqual(migrated, { clients: [], notes: ['added in version 3'] });
  assert.deepEqual(migrateSavedState({ clients: [] }, 3, migrations, 3), { clients: [] });
});

test('a backup from a newer schema version is not restored', async () => {
  const result = await restoreStateFromRaw(JSON.stringify({ ...savedState, schemaVersion: STATE_SCHEMA_VERSION + 1 }));

  assert.equal(result.ok, false);
  assert.match(result.error, /newer version/);
});

test('data from a newer version is not loaded and never overwritten', async () => {
  state.invoices = [];
  savedRaw = JSON.stringify({ ...savedState, schemaVersion: STATE_SCHEMA_VERSION + 1 });
  writes.length = 0;
  alerts.length = 0;

  await loadState();
  await saveState();

  assert.deepEqual(state.invoices, []);
  assert.equal(writes.length, 0);
  assert.match(alerts[0], /newer version of Muriel/);

  // Restoring a backup is an explicit choice to replace the data, so saving works again.
  const result = await restoreStateFromRaw(JSON.stringify(savedState));
  assert.equal(result.ok, true);
  assert.equal(writes.length, 1);
});
