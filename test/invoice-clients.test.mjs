import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// state.js looks up DOM elements when it loads, so give it an empty document
globalThis.window = {};
globalThis.document = {
  getElementById: () => null,
  querySelectorAll: () => [],
  createElement: () => ({}),
};

const { state, invoiceClientOptions } = await import('../state.js');

beforeEach(() => {
  state.clients = [
    { id: 'client-1', displayId: '0001', name: 'Active Client', status: 'active' },
    { id: 'client-2', displayId: '0002', name: 'Former Client', status: 'inactive' },
  ];
});

test('a new invoice lists only active clients', () => {
  assert.deepEqual(invoiceClientOptions(), [
    { value: 'client-1', label: '0001 · Active Client' },
  ]);
});

test('an inactive client stays in the list when it is the selected client', () => {
  assert.deepEqual(invoiceClientOptions('client-2'), [
    { value: 'client-1', label: '0001 · Active Client' },
    { value: 'client-2', label: '0002 · Former Client (inactive)' },
  ]);
});

test('an unknown selected client adds nothing to the list', () => {
  assert.deepEqual(invoiceClientOptions('client-9').map((option) => option.value), ['client-1']);
});
