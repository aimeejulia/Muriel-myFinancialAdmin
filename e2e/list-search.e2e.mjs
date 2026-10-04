import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDataDir, removeDataDir, writeStateFile, sampleState, sampleClient, sampleInvoice, launchApp, assertRealDataUntouched,
} from './helpers.mjs';

let dataDir;
const panaderia = { ...sampleClient, id: 'client-2', displayId: '0002', name: 'Panadería López', contactName: 'Luis', email: 'luis@panaderia.example' };

beforeEach(() => {
  dataDir = createDataDir();
  writeStateFile(dataDir, sampleState({
    clients: [sampleClient, panaderia],
    invoices: [
      { ...sampleInvoice, id: 'a', invoiceNumber: 'INV-2026-09-001', description: 'Website maintenance', status: 'sent' },
      { ...sampleInvoice, id: 'b', invoiceNumber: 'INV-2026-09-002', clientId: 'client-2', description: 'Logo design', status: 'sent' },
      { ...sampleInvoice, id: 'c', invoiceNumber: 'INV-2026-09-003', clientId: 'client-2', description: 'Menu cards', status: 'paid', paidDate: '2026-09-20' },
    ],
  }));
});

afterEach(async () => {
  await removeDataDir(dataDir);
  assertRealDataUntouched();
});

const shownInvoices = `[...document.querySelectorAll('#invoices-table-body tr strong')].map((cell) => cell.textContent)`;
const setValue = (id, value, eventName) => `(() => {
  const field = document.getElementById('${id}');
  field.value = ${JSON.stringify(value)};
  field.dispatchEvent(new Event('${eventName}'));
  return true;
})()`;

test('the invoice list can be searched and filtered by client', async () => {
  const app = await launchApp(dataDir);
  try {
    await app.evaluate(`document.querySelector('.nav-link[data-view="invoices"]').click(); true`);
    assert.deepEqual(await app.evaluate(`[...document.getElementById('invoice-client-filter').options].map((option) => option.textContent)`),
      ['All clients', 'Panadería López', 'Test Client']);

    await app.evaluate(setValue('invoice-client-filter', 'client-2', 'change'));
    assert.deepEqual(await app.evaluate(shownInvoices), ['INV-2026-09-002', 'INV-2026-09-003']);

    await app.evaluate(setValue('invoice-search', 'menu', 'input'));
    assert.deepEqual(await app.evaluate(shownInvoices), ['INV-2026-09-003']);

    await app.evaluate(setValue('invoice-client-filter', '', 'change'));
    await app.evaluate(setValue('invoice-search', 'panaderia 002', 'input'));
    assert.deepEqual(await app.evaluate(shownInvoices), ['INV-2026-09-002'], 'every word must match, and accents do not matter');

    await app.evaluate(setValue('invoice-search', 'nothing like this', 'input'));
    assert.equal(await app.evaluate(`document.getElementById('invoices-table-body').textContent.trim()`), 'No invoices in this view.');
  } finally {
    await app.stop();
  }
});

test('the client list can be searched', async () => {
  const app = await launchApp(dataDir);
  try {
    await app.evaluate(`document.querySelector('.nav-link[data-view="clients"]').click(); true`);
    await app.evaluate(setValue('client-search', 'LUIS', 'input'));
    const rows = await app.evaluate(`[...document.querySelectorAll('#clients-table-body tr')].map((row) => row.children[1].textContent)`);
    assert.deepEqual(rows, ['Panadería López']);

    await app.evaluate(setValue('client-search', 'zzz', 'input'));
    assert.equal(await app.evaluate(`document.getElementById('clients-table-body').textContent.trim()`), 'No clients match the search.');
  } finally {
    await app.stop();
  }
});
