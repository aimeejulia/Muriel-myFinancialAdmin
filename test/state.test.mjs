import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// state.js looks up DOM elements when it loads, so give it an empty document
globalThis.window = {};
globalThis.document = {
  getElementById: () => null,
  querySelectorAll: () => [],
  createElement: () => ({}),
};

const { state, upsertInvoice, canUseInvoiceNumber } = await import('../state.js');

function sampleInvoice(overrides = {}) {
  return {
    id: 'invoice-1',
    invoiceNumber: 'INV-2026-03-001',
    clientId: 'client-1',
    issueDate: '2026-03-10',
    dueDate: '2026-03-24',
    description: 'Website maintenance',
    subtotal: 100,
    vatRate: 21,
    vatAmount: 21,
    total: 121,
    status: 'sent',
    paidDate: '',
    abortedNumberHandling: '',
    ...overrides,
  };
}

beforeEach(() => {
  state.invoices = [];
});

test('upsertInvoice updates an edited invoice in place', () => {
  state.invoices = [
    sampleInvoice(),
    sampleInvoice({ id: 'invoice-2', invoiceNumber: 'INV-2026-03-002' }),
  ];

  const updated = upsertInvoice('invoice-1', { description: 'Website redesign', subtotal: 200 });

  assert.equal(state.invoices.length, 2);
  assert.equal(state.invoices[0], updated);
  assert.equal(updated.id, 'invoice-1');
  assert.equal(updated.description, 'Website redesign');
  assert.equal(updated.subtotal, 200);
  assert.equal(updated.invoiceNumber, 'INV-2026-03-001');
  assert.equal(state.invoices[1].id, 'invoice-2');
});

test('upsertInvoice keeps fields that the invoice form does not edit', () => {
  state.invoices = [sampleInvoice({ status: 'aborted', abortedNumberHandling: 'keep' })];

  const updated = upsertInvoice('invoice-1', { description: 'Corrected description' });

  assert.equal(updated.status, 'aborted');
  assert.equal(updated.abortedNumberHandling, 'keep');
});

test('upsertInvoice adds a new invoice when no invoice has the id', () => {
  state.invoices = [sampleInvoice()];

  const created = upsertInvoice('invoice-2', { invoiceNumber: 'INV-2026-03-002' });

  assert.equal(state.invoices.length, 2);
  assert.equal(created.id, 'invoice-2');
  assert.equal(created.abortedNumberHandling, '');
});

test('an invoice that is being edited can keep its own invoice number', () => {
  state.invoices = [sampleInvoice()];

  assert.equal(canUseInvoiceNumber('INV-2026-03-001', 'invoice-1'), true);
  assert.equal(canUseInvoiceNumber('INV-2026-03-001'), false);
});
