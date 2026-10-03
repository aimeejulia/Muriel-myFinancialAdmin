import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// csv-export.js uses state.js, which looks up DOM elements when it loads. A download is a link that is clicked,
// so the fake link keeps the file name and the file content.
function fakeElement() {
  return { value: '', textContent: '', innerHTML: '', dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {} };
}
const fakeElements = new Map();
const blobs = new Map();
let downloads = [];
globalThis.window = {};
globalThis.document = {
  getElementById: (id) => {
    if (!fakeElements.has(id)) fakeElements.set(id, fakeElement());
    return fakeElements.get(id);
  },
  querySelectorAll: () => [],
  createElement: () => ({
    ...fakeElement(),
    click() {
      downloads.push({ fileName: this.download, blob: blobs.get(this.href) });
    },
  }),
};
URL.createObjectURL = (blob) => {
  const url = `blob:${blobs.size}`;
  blobs.set(url, blob);
  return url;
};
URL.revokeObjectURL = () => {};

const { state, elements } = await import('../state.js');
const { exportInvoicesCsv, exportExpensesCsv, exportReportCsv } = await import('../csv-export.js');

async function downloadedText() {
  assert.equal(downloads.length, 1);
  return { fileName: downloads[0].fileName, text: await downloads[0].blob.text() };
}

const eurInvoice = {
  id: 'eur', invoiceNumber: 'INV-2026-03-001', clientId: 'client-1', issueDate: '2026-03-10', dueDate: '2099-03-24', status: 'paid',
  paidDate: '2026-03-20', receivedAmount: 119.5, currency: 'EUR', bookCurrency: 'EUR', subtotal: 100, vatRate: 21, vatAmount: 21,
  total: 121, exchangeRate: null, bookAmounts: { subtotal: 100, vatAmount: 21, total: 121 },
};
const gbpInvoice = {
  ...eurInvoice, id: 'gbp', invoiceNumber: 'INV-2026-05-001', issueDate: '2026-05-10', status: 'sent', paidDate: '', receivedAmount: null,
  currency: 'USD', bookCurrency: 'GBP', subtotal: 1000, vatRate: 0, vatAmount: 0, total: 1000,
  exchangeRate: { rate: 1.3089, rateDate: '2026-05-08', source: 'Cross rate', manual: false },
  bookAmounts: { subtotal: 764, vatAmount: 0, total: 764 },
};

beforeEach(() => {
  downloads = [];
  state.clients = [{ id: 'client-1', displayId: '0001', name: 'Client "Example", Ltd' }];
  state.invoices = [eurInvoice];
  state.expenses = [];
  state.profile.reportingCurrency = 'EUR';
  state.profile.bookCurrencyChanges = [];
  elements.reportYear.value = '2026';
  elements.reportQuarter.value = 'year';
});

test('the invoice CSV has the amounts in both currencies and what was received', async () => {
  state.profile.bookCurrencyChanges = [{ from: '2026-04-01', currency: 'GBP' }];
  state.invoices = [eurInvoice, gbpInvoice];

  exportInvoicesCsv();

  const { fileName, text } = await downloadedText();
  assert.equal(fileName, 'invoices_export.csv');
  const lines = text.split('\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[1], '"INV-2026-03-001","0001","Client ""Example"", Ltd","2026-03-10","2099-03-24","paid","100","21","21","121","2026-03-20",'
    + '"EUR","EUR","1","","100","21","121","119.5"');
  assert.equal(lines[2], '"INV-2026-05-001","0001","Client ""Example"", Ltd","2026-05-10","2099-03-24","sent","1000","0","0","1000","",'
    + '"USD","GBP","1.3089","2026-05-08","764","0","764",""');
});

test('the expense CSV has the amount on the receipt and the amount in the books', async () => {
  state.expenses = [
    { id: 'e1', date: '2026-02-01', category: 'Software', amount: 101.25, deductible: 'yes', note: 'Hosting',
      currency: 'USD', bookCurrency: 'EUR', originalAmount: 114.03, exchangeRate: { rate: 1.1403, rateDate: '2026-01-30' } },
    { id: 'e2', date: '2026-02-02', category: 'Office', amount: 10, deductible: 'no' },
  ];

  exportExpensesCsv();

  const { fileName, text } = await downloadedText();
  assert.equal(fileName, 'expenses_export.csv');
  assert.deepEqual(text.split('\n').slice(1), [
    '"2026-02-01","Software","101.25","yes","Hosting","USD","EUR","114.03","1.1403","2026-01-30"',
    '"2026-02-02","Office","10","no","","EUR","EUR","10","1",""',
  ]);
});

test('the report CSV of a quarter has the figures of the quarter', async () => {
  state.expenses = [{ id: 'e1', date: '2026-03-01', amount: 40, deductible: 'yes', bookCurrency: 'EUR' }];
  elements.reportQuarter.value = '1';

  exportReportCsv();

  const { fileName, text } = await downloadedText();
  assert.equal(fileName, 'report_2026_Q1.csv');
  assert.deepEqual(text.split('\n'), [
    '"Metric","Value"',
    '"Year","2026"',
    '"Period","Q1 2026"',
    '"Book currency","EUR"',
    '"Net invoiced","100"',
    '"VAT invoiced","21"',
    '"Gross invoiced","121"',
    '"Received","119.5"',
    '"Income","98.5"',
    '"Outstanding","0"',
    '"Delinquent","0"',
    '"Deductible expenses","40"',
    '"Estimated net after deductible expenses","58.5"',
  ]);
});

test('the report CSV of a year with two book currencies has the figures of each book currency', async () => {
  state.profile.bookCurrencyChanges = [{ from: '2026-04-01', currency: 'GBP' }];
  state.invoices = [eurInvoice, gbpInvoice];

  exportReportCsv();

  const { text } = await downloadedText();
  const lines = text.split('\n');
  assert.deepEqual(lines.filter((line) => line.startsWith('"Book currency"')), ['"Book currency","EUR"', '"Book currency","GBP"']);
  assert.deepEqual(lines.filter((line) => line.startsWith('"Net invoiced"')), ['"Net invoiced","100"', '"Net invoiced","764"']);
  assert.deepEqual(lines.filter((line) => line.startsWith('"Outstanding"')), ['"Outstanding","0"', '"Outstanding","764"']);
});
