import { elements, todayISO, downloadFile } from './state.js';
import { loadPdfJs } from './pdf-reader.js';

let activeExpenseReceipt = null;

function decodeDataUrl(dataUrl) {
  const raw = String(dataUrl || '');
  const commaIndex = raw.indexOf(',');
  if (commaIndex === -1) {
    throw new Error('Invalid stored PDF data.');
  }

  const meta = raw.slice(0, commaIndex);
  const base64 = raw.slice(commaIndex + 1);
  const mimeTypeMatch = meta.match(/^data:(.*?)(?:;base64)?$/i);
  const mimeType = mimeTypeMatch?.[1] || 'application/octet-stream';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return { mimeType, bytes };
}

async function renderExpenseReceiptPreview(dataUrl) {
  if (!elements.expenseReceiptContent) return;

  elements.expenseReceiptContent.innerHTML = '<p class="empty-state">Loading receipt preview…</p>';

  try {
    const pdfjs = await loadPdfJs();

    const { bytes } = decodeDataUrl(dataUrl);
    const task = pdfjs.getDocument({ data: bytes });
    const pdf = await task.promise;

    elements.expenseReceiptContent.innerHTML = '';

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.2 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: context, viewport }).promise;

      const wrapper = document.createElement('div');
      wrapper.className = 'receipt-preview-page';

      const label = document.createElement('strong');
      label.textContent = `Page ${pageNumber} of ${pdf.numPages}`;
      wrapper.appendChild(label);
      wrapper.appendChild(canvas);
      elements.expenseReceiptContent.appendChild(wrapper);
    }
  } catch (error) {
    console.error('Could not render expense receipt preview', error);
    elements.expenseReceiptContent.innerHTML = '<p class="empty-state">Could not preview this PDF here, but it can still be downloaded below.</p>';
  }
}

function closeExpenseReceiptModal() {
  if (!elements.expenseReceiptModal || !elements.expenseReceiptContent) return;
  elements.expenseReceiptModal.hidden = true;
  elements.expenseReceiptContent.innerHTML = '';
  activeExpenseReceipt = null;
}

export async function openExpenseReceiptModal(expense) {
  if (!expense?.receiptDataUrl || !elements.expenseReceiptModal) return;

  activeExpenseReceipt = {
    dataUrl: expense.receiptDataUrl,
    fileName: expense.receiptFileName || `expense-receipt-${expense.date || todayISO()}.pdf`,
    mimeType: expense.receiptMimeType || 'application/pdf',
  };

  if (elements.expenseReceiptTitle) {
    elements.expenseReceiptTitle.textContent = activeExpenseReceipt.fileName;
  }

  elements.expenseReceiptModal.hidden = false;
  await renderExpenseReceiptPreview(activeExpenseReceipt.dataUrl);
}

export function attachExpenseReceiptHandlers() {
  if (elements.expenseReceiptCloseBtn) {
    elements.expenseReceiptCloseBtn.addEventListener('click', () => {
      closeExpenseReceiptModal();
    });
  }

  if (elements.expenseReceiptDownloadBtn) {
    elements.expenseReceiptDownloadBtn.addEventListener('click', async () => {
      if (!activeExpenseReceipt?.dataUrl) return;
      const { bytes, mimeType } = decodeDataUrl(activeExpenseReceipt.dataUrl);
      downloadFile(activeExpenseReceipt.fileName, bytes, activeExpenseReceipt.mimeType || mimeType || 'application/pdf');
    });
  }

  if (elements.expenseReceiptModal) {
    elements.expenseReceiptModal.addEventListener('click', (event) => {
      if (event.target === elements.expenseReceiptModal) {
        closeExpenseReceiptModal();
      }
    });
  }
}
