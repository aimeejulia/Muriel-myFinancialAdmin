import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDataDir, removeDataDir, writeStateFile, sampleState, sampleInvoice, launchApp,
  reportCards, assertRealDataUntouched,
} from './helpers.mjs';

let dataDir;

beforeEach(() => {
  dataDir = createDataDir();
});

afterEach(async () => {
  await removeDataDir(dataDir);
  assertRealDataUntouched();
});

test('reports leave draft invoices out of invoiced totals', async () => {
  const draft = { ...sampleInvoice, issueDate: '2026-03-10', status: 'draft' };
  const sent = { ...draft, id: 'invoice-2', invoiceNumber: 'INV-2026-03-002', status: 'sent', subtotal: 200, vatAmount: 42, total: 242 };
  writeStateFile(dataDir, sampleState({ invoices: [draft, sent] }));

  const app = await launchApp(dataDir);
  const cards = await app.evaluate(reportCards(2026, 'year'));
  await app.stop();

  assert.equal(cards['Invoice count'], '1');
  assert.equal(cards['Net invoiced'], '€200.00');
  assert.equal(cards['VAT invoiced'], '€42.00');
});
