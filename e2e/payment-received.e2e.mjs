import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDataDir, removeDataDir, writeStateFile, sampleState, sampleClient, sampleInvoice, launchApp, waitFor, reportCards,
  assertRealDataUntouched,
} from './helpers.mjs';

let dataDir;
const usdClient = { ...sampleClient, id: 'client-usd', displayId: '0002', name: 'US Client', defaultCurrency: 'USD' };
const usdInvoice = {
  ...sampleInvoice,
  id: 'invoice-usd',
  clientId: 'client-usd',
  issueDate: '2026-09-27',
  dueDate: '2099-10-27',
  subtotal: 1000,
  vatRate: 0,
  vatAmount: 0,
  total: 1000,
  currency: 'USD',
  bookCurrency: 'EUR',
  defaultCurrency: 'EUR',
  exchangeRate: { rate: 1.1403, rateDate: '2026-09-25', source: 'ECB reference rate of 2026-09-25', manual: false },
  bookAmounts: { subtotal: 876.96, vatAmount: 0, total: 876.96 },
  serviceDate: '',
  status: 'sent',
};
const savedInvoice = `import('./state.js').then((module) => module.state.invoices[0])`;
const openInvoices = `document.querySelector('.nav-link[data-view="invoices"]').click(); true`;

beforeEach(() => {
  dataDir = createDataDir();
  writeStateFile(dataDir, { ...sampleState({ clients: [sampleClient, usdClient], invoices: [usdInvoice] }), schemaVersion: 2 });
});

afterEach(async () => {
  await removeDataDir(dataDir);
  assertRealDataUntouched();
});

test('mark paid asks for the euros that arrived, and they are the income', async () => {
  const app = await launchApp(dataDir);
  try {
    await app.evaluate(openInvoices);
    assert.match(await app.evaluate(`document.getElementById('invoices-table-body').textContent`), /\$1,000\.00 \(≈ €876\.96\)/);

    await app.evaluate(`document.querySelector('#invoices-table-body button[data-action="mark-paid"]').click(); true`);
    assert.equal(await app.evaluate(`document.getElementById('mark-paid-received-label').textContent`), 'Amount received in EUR (after bank charges)');
    assert.equal(await app.evaluate(`document.getElementById('markPaidReceived').value`), '876.96');
    assert.equal(await app.evaluate(`document.getElementById('mark-paid-received-hint').textContent`), 'Invoice total in the books: €876.96.');

    await app.evaluate(`(() => {
      document.getElementById('markPaidDate').value = '2026-10-02';
      document.getElementById('markPaidReceived').value = '861.40';
      document.getElementById('mark-paid-form').requestSubmit();
      return true;
    })()`);
    const invoice = await waitFor(async () => {
      const saved = await app.evaluate(savedInvoice);
      return saved.status === 'paid' && saved;
    });
    assert.equal(invoice.receivedAmount, 861.4);
    assert.equal(invoice.paidDate, '2026-10-02');
    assert.match(await app.evaluate(`document.getElementById('invoices-table-body').textContent`), /\$1,000\.00 \(€861\.40 received\)/);

    const cards = await app.evaluate(reportCards(2026, 'year'));
    assert.equal(cards.Received, '€861.40');
    assert.equal(cards.Income, '€861.40');
    assert.equal(cards['Net invoiced'], '€876.96');
  } finally {
    await app.stop();
  }
});

test('the status modal asks for the received amount only when the invoice is paid', async () => {
  const app = await launchApp(dataDir);
  try {
    await app.evaluate(openInvoices);
    await app.evaluate(`document.querySelector('#invoices-table-body button[data-action="change-status"]').click(); true`);
    const receivedField = (status) => app.evaluate(`(() => {
      const select = document.getElementById('changeStatusSelect');
      select.value = '${status}';
      select.dispatchEvent(new Event('change'));
      const input = document.getElementById('changeStatusReceived');
      return { visible: input.offsetParent !== null, required: input.required, value: input.value };
    })()`);
    assert.deepEqual(await receivedField('sent'), { visible: false, required: false, value: '876.96' });
    assert.deepEqual(await receivedField('paid'), { visible: true, required: true, value: '876.96' });

    await app.evaluate(`(() => {
      document.getElementById('changeStatusReceived').value = '870';
      document.getElementById('change-status-form').requestSubmit();
      return true;
    })()`);
    const invoice = await waitFor(async () => {
      const saved = await app.evaluate(savedInvoice);
      return saved.status === 'paid' && saved;
    });
    assert.equal(invoice.receivedAmount, 870);
    const cards = await app.evaluate(reportCards(2026, 'year'));
    assert.equal(cards.Received, '€870.00');
  } finally {
    await app.stop();
  }
});

test('a paid invoice from the form uses the entered amount, or the total in the books', async () => {
  writeStateFile(dataDir, { ...sampleState({ clients: [sampleClient], invoices: [] }), schemaVersion: 2 });
  const app = await launchApp(dataDir);
  try {
    const save = (received) => app.evaluate(`(() => {
      document.querySelector('.nav-link[data-view="invoices"]').click();
      document.getElementById('invoiceClient').value = 'client-1';
      document.getElementById('invoiceDescription').value = 'Work ${received || 'default'}';
      document.getElementById('invoiceSubtotal').value = '100';
      document.getElementById('invoiceVatRate').value = '21';
      const status = document.getElementById('invoiceStatus');
      status.value = 'paid';
      status.dispatchEvent(new Event('change'));
      document.getElementById('invoiceReceived').value = '${received}';
      document.getElementById('invoice-form').requestSubmit();
      document.getElementById('invoice-preview-modal').hidden = true;
      return true;
    })()`);

    await save('');
    await save('119.50');
    const invoices = await waitFor(async () => {
      const saved = await app.evaluate(`import('./state.js').then((module) => module.state.invoices)`);
      return saved.length === 2 && saved;
    });
    const byDescription = Object.fromEntries(invoices.map((invoice) => [invoice.description, invoice]));
    assert.equal(byDescription['Work default'].receivedAmount, 121);
    assert.equal(byDescription['Work 119.50'].receivedAmount, 119.5);
  } finally {
    await app.stop();
  }
});
