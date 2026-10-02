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

test('west of UTC an invoice dated 1 January counts in that year', async () => {
  const invoice = { ...sampleInvoice, issueDate: '2026-01-01', dueDate: '2099-01-15', status: 'sent' };
  writeStateFile(dataDir, sampleState({ invoices: [invoice] }));

  const app = await launchApp(dataDir, { env: { TZ: 'America/New_York' } });
  assert.equal(await app.evaluate(`Intl.DateTimeFormat().resolvedOptions().timeZone`), 'America/New_York');
  const firstQuarter = await app.evaluate(reportCards(2026, 1));
  const previousYear = await app.evaluate(reportCards(2025, 'year'));
  await app.stop();

  assert.equal(firstQuarter['Invoice count'], '1');
  assert.equal(previousYear['Invoice count'], '0');
});
