import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDataDir, removeDataDir, writeStateFile, sampleState, sampleClient, sampleInvoice, launchApp,
  sleep, assertRealDataUntouched,
} from './helpers.mjs';

const profile = {
  personalName: 'Ann Example',
  legalName: 'Ann Example Legal',
  email: 'ann@example.test',
  phone: '+34 600 000 000',
  vatNumber: 'ES12345678Z',
  address: 'Calle Mayor 1, Madrid',
  reportingCurrency: 'EUR',
  themePreset: 'muriel',
  businesses: [{ id: 'business-1', name: 'Studio Example', website: 'https://studio.example.test', contactEmail: 'studio@example.test' }],
  paymentMethods: [],
};
const client = { ...sampleClient, name: 'Client Example', address: 'Rue 2, Paris', vatNumber: 'FR99999999999' };
const invoice = {
  ...sampleInvoice,
  status: 'sent',
  issueDate: '2026-03-10',
  issuerType: 'business',
  issuerBusinessId: 'business-1',
  issuerName: 'Studio Example',
};
const expense = { id: 'expense-1', date: '2026-03-12', amount: 45.5, category: 'Software', deductible: 'yes', note: 'Domain renewal' };

// Downloads would open a save dialog, so the page code keeps the file contents instead.
const captureDownloads = `(() => {
  window.downloads = [];
  window.jspdf.jsPDF.API.save = function save(fileName) {
    window.downloads.push({ name: fileName, text: this.output() });
  };
  const blobs = new Map();
  URL.createObjectURL = (blob) => {
    const url = 'blob:test-' + blobs.size;
    blobs.set(url, blob);
    return url;
  };
  URL.revokeObjectURL = () => {};
  HTMLAnchorElement.prototype.click = function click() {
    const blob = blobs.get(this.href);
    if (blob) blob.text().then((text) => window.downloads.push({ name: this.download, text }));
  };
  return true;
})()`;

let dataDir;

beforeEach(() => {
  dataDir = createDataDir();
  writeStateFile(dataDir, sampleState({ clients: [client], invoices: [invoice], expenses: [expense], profile }));
});

afterEach(async () => {
  await removeDataDir(dataDir);
  assertRealDataUntouched();
});

test('the invoice PDF has the sender, client and amounts', async () => {
  const app = await launchApp(dataDir);
  try {
    await app.evaluate(captureDownloads);
    await app.evaluate(`document.querySelector('#invoices-table-body button[data-action="preview-invoice"]').click(); true`);
    await sleep(300);
    await app.evaluate(`document.getElementById('invoice-preview-download').click(); true`);
    await sleep(500);

    const [pdf] = await app.evaluate('window.downloads');
    assert.match(pdf.name, /INV-2026-09-001/);
    for (const text of [
      'Ann Example Legal', 'Studio Example', 'Calle Mayor 1, Madrid', 'studio@example.test',
      'https://studio.example.test', '+34 600 000 000', 'ES12345678Z',
      'Client Example', 'Rue 2, Paris', 'FR99999999999', 'Original description', '121.00',
    ]) {
      assert.ok(pdf.text.includes(text), `the PDF has "${text}"`);
    }
  } finally {
    await app.stop();
  }
});

test('the CSV exports have the invoices, expenses and report figures', async () => {
  const app = await launchApp(dataDir);
  try {
    await app.evaluate(captureDownloads);
    await app.evaluate(`document.getElementById('export-invoices-csv').click(); true`);
    await app.evaluate(`document.getElementById('export-expenses-csv').click(); true`);
    await app.evaluate(`(() => {
      document.getElementById('reportYear').value = '2026';
      document.getElementById('reportQuarter').value = 'year';
      document.getElementById('export-report-csv').click();
      return true;
    })()`);
    await sleep(500);

    const downloads = await app.evaluate('window.downloads');
    assert.deepEqual(downloads.map((download) => download.name).sort(), [
      'expenses_export.csv',
      'invoices_export.csv',
      'report_2026_full_year.csv',
    ]);
    const files = Object.fromEntries(downloads.map((download) => [download.name, download.text]));

    assert.equal(files['invoices_export.csv'], [
      '"Invoice Number","Client ID","Client Name","Issue Date","Due Date","Status","Subtotal","VAT Rate","VAT Amount","Total","Paid Date",'
        + '"Currency","Book Currency","Exchange Rate","Rate Date","Book Subtotal","Book VAT Amount","Book Total","Received"',
      '"INV-2026-09-001","0001","Client Example","2026-03-10","2099-09-15","sent","100","21","21","121","","EUR","EUR","1","","100","21","121",""',
    ].join('\n'));
    assert.equal(files['expenses_export.csv'], [
      '"Date","Category","Amount","Deductible","Note"',
      '"2026-03-12","Software","45.5","yes","Domain renewal"',
    ].join('\n'));
    assert.equal(files['report_2026_full_year.csv'], [
      '"Metric","Value"',
      '"Year","2026"',
      '"Period","Full year 2026"',
      '"Net invoiced","100"',
      '"VAT invoiced","21"',
      '"Gross invoiced","121"',
      '"Received","0"',
      '"Income","100"',
      '"Outstanding","121"',
      '"Delinquent","0"',
      '"Deductible expenses","45.5"',
      '"Estimated net after deductible expenses","54.5"',
    ].join('\n'));
  } finally {
    await app.stop();
  }
});

test('an expense receipt PDF shows in the preview', async () => {
  let app = await launchApp(dataDir);
  try {
    // Make a small PDF with the app's own jsPDF and attach it to the expense.
    await app.evaluate(`import('./state.js').then(async (module) => {
      const pdf = new window.jspdf.jsPDF();
      pdf.text('Receipt text', 20, 20);
      pdf.addPage();
      pdf.text('Second page', 20, 20);
      module.state.expenses[0].receiptDataUrl = pdf.output('datauristring');
      module.state.expenses[0].receiptFileName = 'receipt.pdf';
      module.state.expenses[0].receiptMimeType = 'application/pdf';
      await module.saveState();
      return true;
    })`);
    await sleep(300);
  } finally {
    await app.stop();
  }

  app = await launchApp(dataDir);
  try {
    await app.evaluate(`document.querySelector('#expenses-table-body button[data-action="view-expense-receipt"]').click(); true`);
    await sleep(1500);

    const preview = await app.evaluate(`({
      open: !document.getElementById('expense-receipt-modal').hidden,
      title: document.getElementById('expense-receipt-title').textContent,
      pages: document.querySelectorAll('#expense-receipt-content canvas').length,
      labels: [...document.querySelectorAll('#expense-receipt-content strong')].map((label) => label.textContent),
    })`);
    assert.deepEqual(preview, { open: true, title: 'receipt.pdf', pages: 2, labels: ['Page 1 of 2', 'Page 2 of 2'] });
  } finally {
    await app.stop();
  }
});

test('the app refuses to open popup windows', async () => {
  const app = await launchApp(dataDir);
  try {
    const opened = await app.evaluate(`[
      window.open('about:blank'),
      window.open('https://example.test/'),
      window.open(URL.createObjectURL(new Blob(['x'], { type: 'application/pdf' }))),
    ].map((popup) => popup !== null)`);
    assert.deepEqual(opened, [false, false, false]);
  } finally {
    await app.stop();
  }
});
