import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// imports.js uses state.js, which looks up DOM elements when it loads
globalThis.window = {};
globalThis.document = {
  getElementById: () => null,
  querySelectorAll: () => [],
  createElement: () => ({}),
};

const { state, todayISO, addDaysISO } = await import('../state.js');
const {
  parseDateToIso, extractPdfInvoiceFields, extractPdfExpenseFields, inferExpenseCategoryFromText, getOrCreateImportedClient,
} = await import('../imports.js');

beforeEach(() => {
  state.clients = [];
  state.profile.reportingCurrency = 'EUR';
  state.profile.bookCurrencyChanges = [];
});

test('dates in a PDF are read as day, month and year', () => {
  assert.equal(parseDateToIso('2026-03-10'), '2026-03-10');
  assert.equal(parseDateToIso('10/03/2026'), '2026-03-10');
  assert.equal(parseDateToIso('1/3/26'), '2026-03-01');
  assert.equal(parseDateToIso('10-03-2026'), '2026-03-10');
  assert.equal(parseDateToIso(' 5-11-26 '), '2026-11-05');
  assert.equal(parseDateToIso('March 10, 2026'), '');
  assert.equal(parseDateToIso(''), '');
  assert.equal(parseDateToIso(undefined), '');
});

test('a date that does not exist is not read', () => {
  assert.equal(parseDateToIso('31/02/2026'), '');
  assert.equal(parseDateToIso('13/25/2026'), '');
  assert.equal(parseDateToIso('0/3/2026'), '');
  assert.equal(parseDateToIso('2026-02-30'), '');
  assert.equal(parseDateToIso('2026-13-01'), '');
  assert.equal(parseDateToIso('29/02/2028'), '2028-02-29', 'a leap day exists in a leap year');
  assert.equal(parseDateToIso('29/02/2026'), '');
});

test('an invoice PDF with a date that does not exist gets today', () => {
  const fields = extractPdfInvoiceFields('Invoice #A-200 | Issue date: 31/02/2026 | Total: 121.00', 'a.pdf');

  assert.equal(fields.issueDate, todayISO());
});

test('the fields of an invoice PDF are read', () => {
  const fields = extractPdfInvoiceFields(
    'Invoice Number: INV-2026-03-004 | Issue date: 10/03/2026 | Due date: 2026-04-09 | Bill to: Acme Ltd | Client ID: 0007 | '
    + 'Description: Website redesign | Subtotal: €1.000,00 | VAT rate: 21% | VAT amount: €210,00 | Total due: €1.210,00',
    'scan.pdf',
  );
  delete fields.description;

  assert.deepEqual(fields, {
    invoiceNumber: 'INV-2026-03-004',
    issueDate: '2026-03-10',
    dueDate: '2026-04-09',
    subtotal: 1000,
    vatRate: 21,
    vatAmount: 210,
    total: 1210,
    clientName: 'Acme Ltd',
    clientDisplayId: '0007',
  });
});

test('missing invoice amounts are calculated from the ones that the PDF has', () => {
  const fromTotal = extractPdfInvoiceFields('Invoice #A-100 VAT rate: 10% Grand total: 110.00', 'a.pdf');
  assert.equal(fromTotal.subtotal, 100);
  assert.equal(fromTotal.vatAmount, 10);
  assert.equal(fromTotal.total, 110);
  assert.equal(fromTotal.vatRate, 10);

  const fromSubtotal = extractPdfInvoiceFields('Invoice #A-101 Subtotal: 200.00 VAT amount: 42.00', 'b.pdf');
  assert.equal(fromSubtotal.vatRate, 21, 'the VAT rate comes from the VAT amount and the subtotal');
  assert.equal(fromSubtotal.total, 242);

  const totalBelowSubtotal = extractPdfInvoiceFields('Invoice #A-102 Subtotal: 500.00 VAT rate: 20% Total: 50.00', 'c.pdf');
  assert.equal(totalBelowSubtotal.total, 600, 'a total below the subtotal is calculated again');
});

test('an invoice PDF without a number or dates gets them from the file name and today', () => {
  const fields = extractPdfInvoiceFields('Thank you for your business', 'Factura 2026 (marzo).pdf');

  assert.equal(fields.invoiceNumber, 'FACTURA-2026-MARZO');
  assert.equal(fields.issueDate, todayISO());
  assert.equal(fields.dueDate, addDaysISO(todayISO(), 14));
  assert.equal(fields.vatRate, 21, 'the VAT rate is 21% when the PDF does not give one');
  assert.equal(fields.description, 'Imported from PDF');
  assert.equal(fields.clientName, '');
});

test('an invoice PDF without a number or a file name gets a new invoice number', () => {
  const fields = extractPdfInvoiceFields('Issue date: 2026-03-10 Total: 121.00');

  assert.match(fields.invoiceNumber, /^INV-2026-03-\d{3}$/);
});

test('the fields of an expense PDF are read', () => {
  const fields = extractPdfExpenseFields('Supplier: Hetzner Online GmbH | Date: 02/09/2026 | Cloud hosting | VAT: 4.20 | Total: 24.20', 'hetzner.pdf');

  assert.deepEqual(fields, {
    date: '2026-09-02',
    amount: 24.2,
    category: 'Software',
    deductible: 'yes',
    note: 'Hetzner Online GmbH (hetzner.pdf)',
  });
});

test('an expense PDF without VAT is not deductible, and without details it gets today and a default note', () => {
  const fields = extractPdfExpenseFields('Thank you for your purchase', '');

  assert.deepEqual(fields, { date: todayISO(), amount: 0, category: 'Other', deductible: 'no', note: 'Imported from PDF' });
});

test('the category of an expense comes from words in the PDF', () => {
  assert.equal(inferExpenseCategoryFromText('Annual SaaS subscription'), 'Software');
  assert.equal(inferExpenseCategoryFromText('Train ticket Madrid'), 'Travel');
  assert.equal(inferExpenseCategoryFromText('Printer paper'), 'Office');
  assert.equal(inferExpenseCategoryFromText('Newsletter campaign'), 'Marketing');
  assert.equal(inferExpenseCategoryFromText('Accountant fees'), 'Professional services');
  assert.equal(inferExpenseCategoryFromText('Groceries'), 'Other');
  assert.equal(inferExpenseCategoryFromText(), 'Other');
});

test('an imported invoice uses an existing client with the same name or ID', () => {
  state.clients = [{ id: 'client-1', displayId: '0001', name: 'Acme Ltd' }];

  assert.equal(getOrCreateImportedClient('ACME LTD', '', 21), 'client-1');
  assert.equal(getOrCreateImportedClient('Other name', '0001', 21), 'client-1');
  assert.equal(getOrCreateImportedClient('', '', 21), '');
  assert.equal(state.clients.length, 1);
});

test('an imported invoice for an unknown client creates the client', () => {
  state.clients = [{ id: 'client-1', displayId: '0001', name: 'Acme Ltd' }];

  const id = getOrCreateImportedClient('', '0042', 10);
  const created = state.clients.find((client) => client.id === id);
  assert.equal(created.name, 'Imported client 2');
  assert.equal(created.displayId, '0042');
  assert.equal(created.defaultVatRate, 10);
  assert.equal(created.defaultCurrency, 'EUR');
  assert.equal(created.status, 'active');
});
