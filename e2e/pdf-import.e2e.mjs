import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDataDir, removeDataDir, writeStateFile, sampleState, launchApp, assertRealDataUntouched,
} from './helpers.mjs';

let dataDir;

beforeEach(() => {
  dataDir = createDataDir();
  writeStateFile(dataDir, sampleState());
});

afterEach(async () => {
  await removeDataDir(dataDir);
  assertRealDataUntouched();
});

test('the text of an invoice PDF is read and its fields are found', async () => {
  const app = await launchApp(dataDir);
  try {
    // Make an invoice PDF with the app's own jsPDF, then read it like an imported file.
    const fields = await app.evaluate(`import('./imports.js').then(async (module) => {
      const pdf = new window.jspdf.jsPDF();
      [
        'Invoice number: INV-2026-04-007',
        'Issue date: 2026-04-02',
        'Due date: 2026-04-16',
        'Bill to: Acme Trading Ltd',
        'Description: Website maintenance for April',
        'Subtotal: 200.00',
        'VAT rate: 21%',
        'Total: 242.00',
      ].forEach((line, index) => pdf.text(line, 20, 20 + index * 10));
      const file = new File([pdf.output('arraybuffer')], 'invoice.pdf', { type: 'application/pdf' });
      const text = await module.extractTextFromPdf(file);
      return module.extractPdfInvoiceFields(text, file.name);
    })`);

    assert.equal(fields.invoiceNumber, 'INV-2026-04-007');
    assert.equal(fields.issueDate, '2026-04-02');
    assert.equal(fields.dueDate, '2026-04-16');
    assert.equal(fields.subtotal, 200);
    assert.equal(fields.vatRate, 21);
    assert.equal(fields.total, 242);
    assert.match(fields.clientName, /^Acme Trading Ltd/);
  } finally {
    await app.stop();
  }
});
