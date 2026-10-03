import { test } from 'node:test';
import assert from 'node:assert/strict';

// imports.js uses state.js, which looks up DOM elements when it loads
globalThis.window = {};
globalThis.document = {
  getElementById: () => null,
  querySelectorAll: () => [],
  createElement: () => ({}),
};

const { parseAmount, extractPdfInvoiceFields } = await import('../imports.js');

test('amounts at the end of a sentence are read', () => {
  assert.equal(parseAmount('1,234.56.'), 1234.56);
  assert.equal(parseAmount('€ 1.234,56.'), 1234.56);
  assert.equal(parseAmount('121.00.'), 121);
  assert.equal(parseAmount('12.'), 12);
  assert.equal(parseAmount('42,'), 42);
});

test('amounts in the usual formats are read as before', () => {
  assert.equal(parseAmount('1,234.56'), 1234.56);
  assert.equal(parseAmount('1.234,56'), 1234.56);
  assert.equal(parseAmount('€ 99,50'), 99.5);
  assert.equal(parseAmount('1.234'), 1234);
  assert.equal(parseAmount('£12'), 12);
  assert.equal(parseAmount(''), 0);
  assert.equal(parseAmount(undefined), 0);
});

test('an invoice total at the end of a sentence is found', () => {
  const fields = extractPdfInvoiceFields('Invoice number: INV-7 Subtotal: 1,000.00 VAT rate: 21% Total: 1,210.00.', 'x.pdf');

  assert.equal(fields.total, 1210);
  assert.equal(fields.subtotal, 1000);
});
