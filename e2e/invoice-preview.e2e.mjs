import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDataDir, removeDataDir, writeStateFile, sampleState, sampleClient, sampleInvoice, launchApp, assertRealDataUntouched,
} from './helpers.mjs';

let dataDir;

beforeEach(() => {
  dataDir = createDataDir();
  writeStateFile(dataDir, sampleState({
    clients: [{ ...sampleClient, address: 'Rue 2\n75001 Paris\nFrance' }],
    invoices: [{ ...sampleInvoice, status: 'draft' }],
    profile: {
      legalName: 'Ana García', address: 'Calle Mayor 1\n28013 Madrid\nSpain', businesses: [],
      paymentMethods: [{ id: 'pm1', label: 'Bank transfer', type: 'IBAN', details: 'IBAN ES91 2100 0418 4502 0005 1332\nBIC CAIXESBBXXX', includeByDefault: true }],
    },
  }));
});

afterEach(async () => {
  await removeDataDir(dataDir);
  assertRealDataUntouched();
});

test('the preview and the PDF keep the line breaks of addresses and payment details, and show no status', async () => {
  const app = await launchApp(dataDir);
  try {
    const preview = await app.evaluate(`(() => {
      document.querySelector('.nav-link[data-view="invoices"]').click();
      document.querySelector('#invoices-table-body button[data-action="preview-invoice"]').click();
      const sheet = document.getElementById('invoice-preview-content');
      return {
        multiline: [...sheet.querySelectorAll('.preview-multiline')].map((line) => [line.textContent, getComputedStyle(line).whiteSpace]),
        status: sheet.textContent.includes('Status:'),
      };
    })()`);
    assert.deepEqual(preview, {
      multiline: [
        ['Calle Mayor 1\n28013 Madrid\nSpain', 'pre-line'],
        ['Rue 2\n75001 Paris\nFrance', 'pre-line'],
        ['IBAN ES91 2100 0418 4502 0005 1332\nBIC CAIXESBBXXX', 'pre-line'],
      ],
      status: false,
    });

    const pdf = await app.evaluate(`(async () => {
      window.jspdf.jsPDF.API.save = function save() { window.pdfText = this.output(); };
      document.getElementById('invoice-preview-download').click();
      return window.pdfText;
    })()`);
    for (const line of ['Calle Mayor 1', '28013 Madrid', 'Spain', 'Rue 2', '75001 Paris', 'BIC CAIXESBBXXX']) {
      assert.match(pdf, new RegExp(`\\(${line}\\) Tj`), `the PDF has "${line}" as its own line`);
    }
  } finally {
    await app.stop();
  }
});
