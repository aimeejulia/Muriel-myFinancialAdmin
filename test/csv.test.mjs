import { test } from 'node:test';
import assert from 'node:assert/strict';

// state.js looks up DOM elements when it loads, so give it an empty document
globalThis.window = {};
globalThis.document = {
  getElementById: () => null,
  querySelectorAll: () => [],
  createElement: () => ({}),
};

const { escapeCsv } = await import('../state.js');

test('text that a spreadsheet would run as a formula gets a quote mark in front', () => {
  assert.equal(escapeCsv('=HYPERLINK("https://example.test")'), '"\'=HYPERLINK(""https://example.test"")"');
  assert.equal(escapeCsv('+34 600 000 000'), '"\'+34 600 000 000"');
  assert.equal(escapeCsv('-discount'), '"\'-discount"');
  assert.equal(escapeCsv('@SUM(A1:A2)'), '"\'@SUM(A1:A2)"');
  assert.equal(escapeCsv('\tcmd'), '"\'\tcmd"');
});

test('numbers, normal text and empty values do not change', () => {
  assert.equal(escapeCsv(-5), '"-5"');
  assert.equal(escapeCsv(121), '"121"');
  assert.equal(escapeCsv('Client Example'), '"Client Example"');
  assert.equal(escapeCsv('2026-03-10'), '"2026-03-10"');
  assert.equal(escapeCsv('Say "hello"'), '"Say ""hello"""');
  assert.equal(escapeCsv(null), '""');
  assert.equal(escapeCsv(undefined), '""');
});
