import {
  state,
  uiState,
  elements,
  saveState,
  todayISO,
  addDaysISO,
  generateClientDisplayId,
  buildInvoiceNumber,
  readFileAsDataUrl,
  normalizeCurrencyCode,
  reportingCurrency,
  defaultPaymentMethods,
} from './state.js';
import { loadPdfJs } from './pdf-reader.js';
import { readExpenseCurrencyFields, syncExpenseCurrencyFields } from './expense-currency-form.js';

const NEW_CLIENT_OPTION_VALUE = '__create_client__';

let importHooks = {
  showView: () => {},
  resetInvoiceEditMode: () => {},
  upsertClientOptionList: () => {},
  updateInvoicePreview: () => {},
  useClientCurrency: () => {},
  toggleInvoicePaidDateField: () => {},
};

export function registerImportHooks(hooks) {
  importHooks = { ...importHooks, ...hooks };
}

export function getNewClientOptionValue() {
  return NEW_CLIENT_OPTION_VALUE;
}

export function parseAmount(value) {
  if (!value) return 0;
  // The text can end with a full stop, as in "Total: 1,234.56.", so separators at the start and end are removed.
  const raw = String(value).replace(/[^0-9,.-]/g, '').replace(/[.,]+$/, '').replace(/^[.,]+/, '');
  const hasComma = raw.includes(',');
  const hasDot = raw.includes('.');

  let normalized = raw;
  if (hasComma && hasDot) {
    const lastComma = raw.lastIndexOf(',');
    const lastDot = raw.lastIndexOf('.');
    normalized = lastComma > lastDot
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/,/g, '');
  } else if (hasComma) {
    const parts = raw.split(',');
    const decimalLike = parts.length === 2 && parts[1].length <= 2;
    normalized = decimalLike ? raw.replace(',', '.') : raw.replace(/,/g, '');
  } else if (hasDot) {
    const parts = raw.split('.');
    const decimalLike = parts.length === 2 && parts[1].length <= 2;
    normalized = decimalLike ? raw : raw.replace(/\./g, '');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

// Gives the date as YYYY-MM-DD, or an empty text when the parts are not a date that exists, for example 31/02.
function isoDateFromParts(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseDateToIso(value) {
  if (!value) return '';
  const dateText = String(value).trim();
  const isoDate = dateText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) return isoDateFromParts(Number(isoDate[1]), Number(isoDate[2]), Number(isoDate[3]));

  // Day, month and year with slashes or dashes, as in 10/03/2026 or 10-03-26
  const dayFirstDate = dateText.match(/^(\d{1,2})([/-])(\d{1,2})\2(\d{2,4})$/);
  if (dayFirstDate) {
    const year = Number(dayFirstDate[4].length === 2 ? `20${dayFirstDate[4]}` : dayFirstDate[4]);
    return isoDateFromParts(year, Number(dayFirstDate[3]), Number(dayFirstDate[1]));
  }

  return '';
}

export function extractPdfInvoiceFields(text, fileName = '') {
  const normalized = text.replace(/\s+/g, ' ').trim();

  const invoiceNumberMatch = normalized.match(/\b(?:Invoice\s*(?:Number|No\.?|#)\s*[:#-]?\s*|INV[-\s#:]+)([A-Z0-9][A-Z0-9-]{2,})\b/i);
  const issueDateMatch = normalized.match(/(?:Issue\s*date|Issued\s*on|Invoice\s*date)\s*[:#-]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i);
  const dueDateMatch = normalized.match(/(?:Due\s*date|Payment\s*due)\s*[:#-]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i);
  const subtotalMatch = normalized.match(/\b(?:Subtotal|Sub\s*total|Net)\b\s*[:#-]?\s*([€$£]?\s*[\d.,]+)/i);
  const totalMatch = normalized.match(/(?:\bGrand\s*total\b|\bTotal\b(?!\s*(?:vat|tax))\s*(?:due|amount)?)\s*[:#-]?\s*([€$£]?\s*[\d.,]+)/i);
  const vatAmountMatch = normalized.match(/(?:VAT\s*(?:amount)?|Tax)\s*[:#-]?\s*([€$£]?\s*[\d.,]+)/i);
  const vatRateMatch = normalized.match(/(?:VAT|Tax)\s*(?:rate)?\s*[:#-]?\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*%/i);
  const descriptionMatch = normalized.match(/(?:Description|Service|Details)\s*[:#-]?\s*([^\n]{5,120})/i);
  const clientIdMatch = normalized.match(/Client\s*ID\s*[:#-]?\s*([A-Z0-9-]+)/i);
  const clientNameMatch = normalized.match(/(?:Client|Bill\s*to|Billed\s*to)\s*[:#-]?\s*([A-Za-z0-9 .,&'-]{3,80})/i);

  const issueDate = parseDateToIso(issueDateMatch?.[1]) || todayISO();
  const dueDate = parseDateToIso(dueDateMatch?.[1]) || addDaysISO(issueDate, 14);

  const subtotal = parseAmount(subtotalMatch?.[1]);
  const total = parseAmount(totalMatch?.[1]);
  const vatAmount = parseAmount(vatAmountMatch?.[1]);
  const vatRate = parseAmount(vatRateMatch?.[1]) || (subtotal > 0 ? (vatAmount / subtotal) * 100 : 21);

  let computedSubtotal = subtotal;
  let computedVatAmount = vatAmount;
  let computedTotal = total;

  if (!computedSubtotal && computedTotal) {
    computedSubtotal = computedTotal / (1 + vatRate / 100);
  }
  if (!computedVatAmount && computedSubtotal) {
    computedVatAmount = computedSubtotal * (vatRate / 100);
  }
  if (!computedTotal && computedSubtotal) {
    computedTotal = computedSubtotal + computedVatAmount;
  }
  if (computedTotal && computedSubtotal && computedTotal < computedSubtotal) {
    computedTotal = computedSubtotal + computedVatAmount;
  }

  const fileInvoiceNumber = String(fileName || '')
    .replace(/\.pdf$/i, '')
    .replace(/[^A-Za-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase();

  return {
    invoiceNumber: invoiceNumberMatch?.[1] || fileInvoiceNumber || buildInvoiceNumber(issueDate),
    issueDate,
    dueDate,
    subtotal: Number(computedSubtotal.toFixed(2)),
    vatRate: Number(vatRate.toFixed(2)),
    vatAmount: Number(computedVatAmount.toFixed(2)),
    total: Number(computedTotal.toFixed(2)),
    description: (descriptionMatch?.[1] || 'Imported from PDF').trim(),
    clientName: (clientNameMatch?.[1] || '').trim(),
    clientDisplayId: (clientIdMatch?.[1] || '').trim(),
  };
}

export function inferExpenseCategoryFromText(normalizedText = '') {
  const text = normalizedText.toLowerCase();
  if (/saas|software|subscription|license|hosting|cloud|domain/.test(text)) return 'Software';
  if (/flight|train|uber|taxi|travel|hotel|airbnb/.test(text)) return 'Travel';
  if (/office|stationery|printer|chair|desk/.test(text)) return 'Office';
  if (/ad|ads|campaign|marketing|seo|newsletter/.test(text)) return 'Marketing';
  if (/lawyer|legal|accountant|consult|professional/.test(text)) return 'Professional services';
  return 'Other';
}

export function extractPdfExpenseFields(text, fileName = '') {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const issueDateMatch = normalized.match(/(?:Issue\s*date|Issued\s*on|Invoice\s*date|Date)\s*[:#-]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i);
  const totalMatch = normalized.match(/(?:Total\s*(?:due|amount)?|Amount\s*due|Grand\s*total)\s*[:#-]?\s*([€$£]?\s*[\d.,]+)/i);
  const vatAmountMatch = normalized.match(/(?:VAT\s*(?:amount)?|Tax)\s*[:#-]?\s*([€$£]?\s*[\d.,]+)/i);
  const vendorMatch = normalized.match(/(?:From|Supplier|Vendor|Company|Billed\s*by)\s*[:#-]?\s*([A-Za-z0-9 .,&'-]{3,80})/i);

  const amount = parseAmount(totalMatch?.[1]);
  const vatAmount = parseAmount(vatAmountMatch?.[1]);
  const date = parseDateToIso(issueDateMatch?.[1]) || todayISO();
  const vendor = (vendorMatch?.[1] || '').trim();
  const inferredCategory = inferExpenseCategoryFromText(normalized);
  const notePrefix = vendor ? `${vendor}` : 'Imported from PDF';

  return {
    date,
    amount: Number((amount || 0).toFixed(2)),
    category: inferredCategory,
    deductible: vatAmount > 0 ? 'yes' : 'no',
    note: `${notePrefix}${fileName ? ` (${fileName})` : ''}`,
  };
}

export function setPendingExpenseImportInfo(message = '') {
  if (!message) {
    elements.expenseImportInfo.remove();
    return;
  }

  elements.expenseImportInfo.className = 'full-span';
  elements.expenseImportInfo.style.color = 'var(--muted)';
  elements.expenseImportInfo.style.fontSize = '0.9rem';
  elements.expenseImportInfo.textContent = message;

  if (!elements.expenseImportInfo.parentElement) {
    const actions = elements.expenseForm.querySelector('.form-actions.full-span');
    elements.expenseForm.insertBefore(elements.expenseImportInfo, actions);
  }
}

export function loadImportedExpenseIntoForm(importedExpense) {
  elements.expenseDate.value = importedExpense.date || todayISO();
  elements.expenseAmount.value = String(importedExpense.amount || 0);
  elements.expenseCategory.value = importedExpense.category || 'Other';
  elements.expenseDeductible.value = importedExpense.deductible || 'yes';
  elements.expenseNote.value = importedExpense.note || 'Imported from PDF';
  syncExpenseCurrencyFields();
  importHooks.showView('expenses');
}

export async function importExpensePdfFile(file) {
  const dataUrl = await readFileAsDataUrl(file);

  uiState.pendingImportedExpenseReceipt = {
    fileName: file.name,
    mimeType: file.type || 'application/pdf',
    dataUrl,
  };

  try {
    const text = await extractTextFromPdf(file);
    const extracted = extractPdfExpenseFields(text, file.name);
    loadImportedExpenseIntoForm(extracted);
    setPendingExpenseImportInfo(`Imported ${file.name}. Review details, edit if needed, then click Save expense to store the receipt.`);
  } catch (error) {
    console.error('Failed to parse expense PDF fields', file.name, error);
    loadImportedExpenseIntoForm({
      date: todayISO(),
      amount: 0,
      category: 'Other',
      deductible: 'yes',
      note: `Receipt attached (${file.name})`,
    });
    setPendingExpenseImportInfo(`Attached ${file.name}, but parsing failed. Fill in the expense details manually, then click Save expense to store the receipt.`);
  }
}

export function getOrCreateImportedClient(clientName, clientDisplayId, vatRate) {
  if (!clientName && !clientDisplayId) return '';

  const normalizedName = clientName.toLowerCase();
  const existing = state.clients.find((client) => {
    const nameMatches = normalizedName && client.name.toLowerCase() === normalizedName;
    const idMatches = clientDisplayId && client.displayId === clientDisplayId;
    return nameMatches || idMatches;
  });
  if (existing) return existing.id;

  const createdClient = {
    id: crypto.randomUUID(),
    displayId: clientDisplayId || generateClientDisplayId(),
    name: clientName || `Imported client ${state.clients.length + 1}`,
    contactName: '',
    email: '',
    vatNumber: '',
    address: '',
    defaultVatRate: Number(vatRate || 21),
    defaultCurrency: normalizeCurrencyCode(reportingCurrency()),
    status: 'active',
    preferredPaymentMethodId: defaultPaymentMethods()[0]?.id || '',
  };
  state.clients.push(createdClient);
  return createdClient.id;
}

export async function extractTextFromPdf(file) {
  const pdfjs = await loadPdfJs();

  const buffer = await file.arrayBuffer();
  const task = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await task.promise;

  const pages = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(' ');
    pages.push(pageText);
  }

  return pages.join('\n');
}

export async function importInvoicePdfFiles(files) {
  if (!files.length) return;

  let queuedCount = 0;
  let failedCount = 0;

  uiState.pendingImportedDrafts.length = 0;

  for (const file of files) {
    try {
      const text = await extractTextFromPdf(file);
      const extracted = extractPdfInvoiceFields(text, file.name);

      const duplicate = state.invoices.some((invoice) => invoice.invoiceNumber === extracted.invoiceNumber);
      if (duplicate) {
        extracted.invoiceNumber = '';
        extracted.description = `${extracted.description} (duplicate number found - please review)`;
      }

      uiState.pendingImportedDrafts.push(extracted);
      queuedCount += 1;
    } catch (error) {
      console.error('Failed to import PDF invoice', file.name, error);
      failedCount += 1;
    }
  }

  if (uiState.pendingImportedDrafts.length > 0) {
    const nextDraft = uiState.pendingImportedDrafts.shift();
    loadImportedDraftIntoForm(nextDraft);
  }

  alert(`Invoice PDF import ready. Review queue: ${queuedCount}, skipped: 0, failed: ${failedCount}. Files with partial data are still queued so you can correct them manually.`);
}

export function updateImportQueueInfo() {
  if (!uiState.pendingImportedDrafts.length) {
    elements.importQueueInfo.remove();
    return;
  }

  elements.importQueueInfo.className = 'full-span';
  elements.importQueueInfo.style.color = 'var(--muted)';
  elements.importQueueInfo.style.fontSize = '0.9rem';
  elements.importQueueInfo.textContent = `${uiState.pendingImportedDrafts.length} imported invoice(s) remaining for review.`;

  if (!elements.importQueueInfo.parentElement) {
    const actions = elements.invoiceForm.querySelector('.form-actions.full-span');
    elements.invoiceForm.insertBefore(elements.importQueueInfo, actions);
  }
}

export function loadImportedDraftIntoForm(draft) {
  importHooks.resetInvoiceEditMode();
  const clientId = getOrCreateImportedClient(draft.clientName, draft.clientDisplayId, draft.vatRate);
  importHooks.upsertClientOptionList(clientId);
  importHooks.useClientCurrency(clientId);
  uiState.lastInvoiceClientValue = clientId || '';

  elements.invoiceIssueDate.value = draft.issueDate || todayISO();
  elements.invoiceDueDate.value = draft.dueDate || todayISO();
  elements.invoiceStatus.value = 'sent';
  elements.invoiceNumber.value = draft.invoiceNumber || '';
  elements.invoiceDescription.value = draft.description || 'Imported from PDF';
  elements.invoiceSubtotal.value = String(draft.subtotal || 0);
  elements.invoiceVatRate.value = String(draft.vatRate || 21);
  elements.invoicePaidDate.value = '';
  elements.invoiceIssuerSelect.value = 'legal';
  importHooks.toggleInvoicePaidDateField();
  importHooks.updateInvoicePreview();
  updateImportQueueInfo();
  importHooks.showView('invoices');
}

export function persistExpenseFromForm(editingExpenseId = '') {
  const formData = new FormData(elements.expenseForm);
  const pendingReceipt = uiState.pendingImportedExpenseReceipt;
  const baseExpense = {
    date: formData.get('expenseDate'),
    ...readExpenseCurrencyFields(),
    category: formData.get('expenseCategory'),
    deductible: formData.get('expenseDeductible'),
    note: String(formData.get('expenseNote') || '').trim(),
  };

  if (editingExpenseId) {
    const index = state.expenses.findIndex((expense) => expense.id === editingExpenseId);
    if (index >= 0) {
      const existing = state.expenses[index];
      state.expenses[index] = {
        ...existing,
        ...baseExpense,
        receiptFileName: pendingReceipt?.fileName || existing.receiptFileName || '',
        receiptMimeType: pendingReceipt?.mimeType || existing.receiptMimeType || '',
        receiptDataUrl: pendingReceipt?.dataUrl || existing.receiptDataUrl || '',
      };
    } else {
      state.expenses.push({
        id: editingExpenseId,
        ...baseExpense,
        receiptFileName: pendingReceipt?.fileName || '',
        receiptMimeType: pendingReceipt?.mimeType || '',
        receiptDataUrl: pendingReceipt?.dataUrl || '',
      });
    }
  } else {
    state.expenses.push({
      id: crypto.randomUUID(),
      ...baseExpense,
      receiptFileName: pendingReceipt?.fileName || '',
      receiptMimeType: pendingReceipt?.mimeType || '',
      receiptDataUrl: pendingReceipt?.dataUrl || '',
    });
  }

  saveState();
  uiState.pendingImportedExpenseReceipt = null;
  setPendingExpenseImportInfo('');
}
