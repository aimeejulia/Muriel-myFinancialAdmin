import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDataDir, removeDataDir, writeStateFile, sampleState, sampleClient, launchApp, waitFor, reportCards, assertRealDataUntouched,
} from './helpers.mjs';

let dataDir;
const usdClient = { ...sampleClient, id: 'client-usd', displayId: '0002', name: 'US Client', defaultCurrency: 'USD' };
const savedInvoices = `import('./state.js').then((module) => module.state.invoices)`;
// Keeps the PDF text in the page, so no save dialog opens.
const capturePdf = `window.jspdf.jsPDF.API.save = function save() { window.pdfText = this.output(); }; true`;

beforeEach(() => {
  dataDir = createDataDir();
  writeStateFile(dataDir, sampleState({ clients: [sampleClient, usdClient], invoices: [] }));
});

afterEach(async () => {
  await removeDataDir(dataDir);
  assertRealDataUntouched();
});

async function fillUsdInvoice(app) {
  await app.evaluate(`(() => {
    document.querySelector('.nav-link[data-view="invoices"]').click();
    document.getElementById('invoiceIssueDate').value = '2026-09-27';
    const client = document.getElementById('invoiceClient');
    client.value = 'client-usd';
    client.dispatchEvent(new Event('change'));
    document.getElementById('invoiceDescription').value = 'Consulting';
    document.getElementById('invoiceSubtotal').value = '1000';
    document.getElementById('invoiceVatRate').value = '21';
    document.getElementById('invoiceStatus').value = 'sent';
    return true;
  })()`);
}

test('an invoice in the client currency gets the ECB rate and book amounts in euros', async (t) => {
  const app = await launchApp(dataDir);
  try {
    await fillUsdInvoice(app);
    assert.equal(await app.evaluate(`document.getElementById('invoiceCurrency').value`), 'USD');
    // 2026-09-27 is a Sunday: the rate is the one of Friday 2026-09-25.
    const rate = await waitFor(async () => {
      const value = await app.evaluate(`document.getElementById('invoiceExchangeRate').value`);
      const hint = await app.evaluate(`document.getElementById('invoice-exchange-rate-hint').textContent`);
      return (value || hint.includes('Could not')) && { value, hint };
    }, { timeout: 15000 });
    if (!rate.value) {
      // afterEach does not run for a skipped test, so the test removes its data folder itself.
      await app.stop();
      await removeDataDir(dataDir);
      t.skip(`The ECB is not reachable: ${rate.hint}`);
      return;
    }
    assert.equal(rate.value, '1.1403');
    assert.equal(rate.hint, 'ECB reference rate of 2026-09-25.');
    assert.match(await app.evaluate(`document.getElementById('invoice-book-preview').textContent`), /total €1,061\.12/);

    await app.evaluate(`document.getElementById('invoice-form').requestSubmit(); true`);
    const [invoice] = await waitFor(async () => {
      const invoices = await app.evaluate(savedInvoices);
      return invoices.length === 1 && invoices;
    });
    assert.equal(invoice.currency, 'USD');
    assert.equal(invoice.bookCurrency, 'EUR');
    assert.deepEqual(
      { rate: invoice.exchangeRate.rate, rateDate: invoice.exchangeRate.rateDate, source: invoice.exchangeRate.source, manual: invoice.exchangeRate.manual },
      { rate: 1.1403, rateDate: '2026-09-25', source: 'ECB reference rate of 2026-09-25', manual: false },
    );
    assert.deepEqual([invoice.subtotal, invoice.vatAmount, invoice.total], [1000, 210, 1210]);
    assert.deepEqual(invoice.bookAmounts, { subtotal: 876.96, vatAmount: 184.16, total: 1061.12 });

    assert.match(await app.evaluate(`document.getElementById('invoices-table-body').textContent`), /\$1,210\.00/);
    const cards = await app.evaluate(reportCards(2026, 'year'));
    assert.equal(cards['Net invoiced'], '€876.96');
    assert.equal(cards['VAT invoiced'], '€184.16');

    const preview = await app.evaluate(`document.getElementById('invoice-preview-content')?.textContent || document.getElementById('invoice-preview-modal').textContent`);
    assert.match(preview, /Exchange rate: 1 EUR = 1\.1403 USD \(ECB reference rate of 2026-09-25\)/);
    assert.match(preview, /Total \(EUR\)\s*€1,061\.12/);

    await app.evaluate(capturePdf);
    await app.evaluate(`document.getElementById('invoice-preview-download').click(); true`);
    // In the PDF text, jsPDF writes ( and ) as \( and \).
    const pdfText = (await waitFor(() => app.evaluate('window.pdfText || ""'))).replace(/\\([()])/g, '$1');
    for (const text of ['Total (USD)', '1,210.00', 'Exchange rate: 1 EUR = 1.1403 USD', 'Total (EUR)', '1,061.12', 'VAT 21% (EUR)', '184.16']) {
      assert.ok(pdfText.includes(text), `the PDF has "${text}"`);
    }
  } finally {
    await app.stop();
  }
});

test('an edit of the description keeps the frozen rate, and a typed rate is marked as entered by hand', async () => {
  const frozen = {
    id: 'invoice-usd',
    invoiceNumber: 'INV-2026-09-001',
    clientId: 'client-usd',
    issuerType: 'legal',
    issueDate: '2026-09-27',
    dueDate: '2099-10-27',
    description: 'Consulting',
    subtotal: 1000,
    vatRate: 21,
    vatAmount: 210,
    total: 1210,
    currency: 'USD',
    bookCurrency: 'EUR',
    defaultCurrency: 'EUR',
    exchangeRate: { rate: 1.1403, rateDate: '2026-09-25', source: 'ECB reference rate of 2026-09-25', manual: false },
    bookAmounts: { subtotal: 876.96, vatAmount: 184.16, total: 1061.12 },
    serviceDate: '',
    status: 'draft',
  };
  writeStateFile(dataDir, { ...sampleState({ clients: [sampleClient, usdClient], invoices: [frozen] }), schemaVersion: 2 });

  const app = await launchApp(dataDir);
  try {
    await app.evaluate(`document.querySelector('.nav-link[data-view="invoices"]').click(); document.querySelector('#invoices-table-body button[data-action="edit-invoice"]').click(); true`);
    assert.equal(await app.evaluate(`document.getElementById('invoiceExchangeRate').value`), '1.1403');
    assert.equal(await app.evaluate(`document.getElementById('invoice-exchange-rate-hint').textContent`), 'ECB reference rate of 2026-09-25.');
    await app.evaluate(`document.getElementById('invoiceDescription').value = 'Consulting, September'; document.getElementById('invoice-form').requestSubmit(); true`);
    let [invoice] = await waitFor(async () => {
      const invoices = await app.evaluate(savedInvoices);
      return invoices[0]?.description === 'Consulting, September' && invoices;
    });
    assert.deepEqual(invoice.exchangeRate, frozen.exchangeRate);
    assert.deepEqual(invoice.bookAmounts, frozen.bookAmounts);

    await app.evaluate(`document.querySelector('#invoices-table-body button[data-action="edit-invoice"]').click(); true`);
    await app.evaluate(`(() => {
      const rate = document.getElementById('invoiceExchangeRate');
      rate.value = '1.25';
      rate.dispatchEvent(new Event('input'));
      document.getElementById('invoice-form').requestSubmit();
      return true;
    })()`);
    [invoice] = await waitFor(async () => {
      const invoices = await app.evaluate(savedInvoices);
      return invoices[0]?.exchangeRate?.rate === 1.25 && invoices;
    });
    assert.equal(invoice.exchangeRate.source, 'Entered by hand');
    assert.equal(invoice.exchangeRate.manual, true);
    assert.deepEqual(invoice.bookAmounts, { subtotal: 800, vatAmount: 168, total: 968 });
  } finally {
    await app.stop();
  }
});
