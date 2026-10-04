import { test } from 'node:test';
import assert from 'node:assert/strict';

// state.js looks up DOM elements when it loads
globalThis.window = {};
globalThis.document = {
  getElementById: () => null,
  querySelectorAll: () => [],
  createElement: () => ({}),
};

const { readDecimal, DECIMAL_INPUT_PATTERN } = await import('../state.js');

test('a comma or a full stop is the decimal mark', () => {
  assert.equal(readDecimal('12,50'), 12.5);
  assert.equal(readDecimal('12.50'), 12.5);
  assert.equal(readDecimal('0,5'), 0.5);
  assert.equal(readDecimal('861,40'), 861.4);
  assert.equal(readDecimal(' 100 '), 100);
});

test('thousands can be grouped with full stops or commas', () => {
  assert.equal(readDecimal('1.234,56'), 1234.56);
  assert.equal(readDecimal('1,234.56'), 1234.56);
  assert.equal(readDecimal('1.234.567'), 1234567);
  assert.equal(readDecimal('1,234,567.8'), 1234567.8);
});

test('in an amount, one separator before three digits groups thousands', () => {
  assert.equal(readDecimal('1.234'), 1234);
  assert.equal(readDecimal('1,234'), 1234);
  assert.equal(readDecimal('1234,567'), 1234.567, 'four digits before the separator are not a thousands group');
});

test('in a rate or a percentage, one separator is always the decimal mark', () => {
  assert.equal(readDecimal('1,140', { amount: false }), 1.14);
  assert.equal(readDecimal('1.1403', { amount: false }), 1.1403);
  assert.equal(readDecimal('21,5', { amount: false }), 21.5);
});

test('an empty field is 0, and a text that is not a number is NaN', () => {
  assert.equal(readDecimal(''), 0);
  assert.equal(readDecimal(null), 0);
  for (const text of ['abc', '12,', ',5', '-5', '1.2.3', '1,23.456,7', '12 50', '1.23,4.5', '€12']) {
    assert.ok(Number.isNaN(readDecimal(text)), text);
  }
});

test('the field pattern accepts exactly the texts that can be read', () => {
  const field = new RegExp(`^(?:${DECIMAL_INPUT_PATTERN})$`, 'v');
  for (const text of ['12,50', '12.50', '1.234,56', '1,234.56', '1.234.567', '7']) {
    assert.ok(field.test(text), text);
  }
  for (const text of ['abc', '12,', '-5', '1.2.3', '12 50']) {
    assert.ok(!field.test(text), text);
  }
});
