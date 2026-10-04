import { test } from 'node:test';
import assert from 'node:assert/strict';

// state.js looks up DOM elements when it loads
globalThis.window = {};
globalThis.document = {
  getElementById: () => null,
  querySelectorAll: () => [],
  createElement: () => ({}),
};

const { invoiceLines, lineAmount, linesSubtotal, findBackupRecordProblems } = await import('../state.js');

test('an invoice from before lines has one line with its description and subtotal', () => {
  assert.deepEqual(invoiceLines({ description: 'Consulting', subtotal: 1500 }), [{ description: 'Consulting', quantity: 1, unitPrice: 1500 }]);
  assert.deepEqual(invoiceLines({ description: 'Old', subtotal: 10, lines: [] }), [{ description: 'Old', quantity: 1, unitPrice: 10 }]);
});

test('an invoice with lines keeps them', () => {
  const lines = [{ description: 'Design', quantity: 2.5, unitPrice: 40 }, { description: 'Hosting', quantity: 12, unitPrice: 9.99 }];
  assert.equal(invoiceLines({ description: 'Design; Hosting', subtotal: 219.88, lines }), lines);
});

test('each line is rounded to cents, and the subtotal is the sum of the lines', () => {
  assert.equal(lineAmount({ quantity: 3, unitPrice: 0.335 }), 1.01);
  assert.equal(lineAmount({ quantity: 1.5, unitPrice: 33.33 }), 50);
  assert.equal(linesSubtotal([{ quantity: 3, unitPrice: 0.335 }, { quantity: 3, unitPrice: 0.335 }]), 2.02);
  assert.equal(linesSubtotal([{ quantity: 2.5, unitPrice: 40 }, { quantity: 12, unitPrice: 9.99 }]), 219.88);
});

test('a backup with invoice lines that the app cannot read is refused', () => {
  const invoice = { id: 'i1', invoiceNumber: 'INV-1', clientId: 'c1', subtotal: 10, vatAmount: 0, total: 10 };
  const problems = (lines) => findBackupRecordProblems({ clients: [], expenses: [], invoices: [{ ...invoice, lines }] });

  assert.deepEqual(problems(undefined), []);
  assert.deepEqual(problems([{ description: 'Work', quantity: 1, unitPrice: 10 }]), []);
  assert.deepEqual(problems('Work'), ['invoice 1: lines must be a list of lines with a description, a quantity and a unit price.']);
  assert.deepEqual(problems([{ description: 'Work', quantity: 'many', unitPrice: 10 }]).length, 1);
});
