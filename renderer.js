import {
  state,
  uiState,
  isDesktopApp,
  elements,
  loadState,
  saveState,
  renderDesktopOnlyScreen,
  formatCurrency,
  todayISO,
  canUseInvoiceNumber,
  downloadFile,
  buildInvoiceNumber,
  generateClientDisplayId,
  currentQuarterInfo,
  getClient,
  reportingCurrency,
  normalizeCurrencyCode,
  clientCurrencyFor,
  normalizeThemePreset,
} from './state.js';
import {
  renderProfile,
  renderIssuerOptions,
  attachProfileHandlers,
  registerProfileHooks,
} from './profile.js';
import {
  openInvoicePreview,
  closeInvoicePreview,
  buildReminder,
  printInvoice,
} from './pdf.js';
import { runReport } from './reports.js';
import {
  registerImportHooks,
  getNewClientOptionValue,
  importExpensePdfFile,
  importInvoicePdfFiles,
  setPendingExpenseImportInfo,
  updateImportQueueInfo,
  exportInvoicesCsv,
  exportExpensesCsv,
  exportReportCsv,
  persistExpenseFromForm,
} from './imports.js';
import {
  showView,
  renderClients,
  renderInvoices,
  renderExpenses,
  renderDashboard,
  closeInvoiceRowMenus,
} from './views.js';

let latestUpdateUrl = '';
let activeExpenseReceipt = null;
const PDFJS_CDN = './vendor/pdfjs/pdf.min.mjs';
const PDFJS_WORKER_CDN = './vendor/pdfjs/pdf.worker.min.mjs';

function hideUpdateBanner() {
  if (!elements.updateBanner) return;
  elements.updateBanner.hidden = true;
  elements.updateBanner.dataset.tone = 'info';
  latestUpdateUrl = '';
  if (elements.updateDownloadBtn) {
    elements.updateDownloadBtn.hidden = true;
  }
}

function showUpdateBanner({ title, message, tone = 'info', downloadUrl = '' }) {
  if (!elements.updateBanner || !elements.updateBannerTitle || !elements.updateBannerMessage) return;

  elements.updateBanner.hidden = false;
  elements.updateBanner.dataset.tone = tone;
  elements.updateBannerTitle.textContent = title;
  elements.updateBannerMessage.textContent = message;
  latestUpdateUrl = downloadUrl;

  if (elements.updateDownloadBtn) {
    elements.updateDownloadBtn.hidden = !downloadUrl;
  }
}

function applyTheme(themeName = state.profile.themePreset) {
  const nextTheme = normalizeThemePreset(themeName);
  state.profile.themePreset = nextTheme;
  document.documentElement.dataset.theme = nextTheme;

  elements.themeButtons.forEach((button) => {
    const isActive = button.dataset.theme === nextTheme;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

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
    const module = await import(PDFJS_CDN);
    const pdfjs = module.default || module;
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
    }

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

async function openExpenseReceiptModal(expense) {
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

async function checkForUpdates({ manual = false } = {}) {
  if (!isDesktopApp || typeof window.desktopStore?.checkForUpdates !== 'function') {
    return;
  }

  if (manual && elements.checkUpdatesBtn) {
    elements.checkUpdatesBtn.disabled = true;
    elements.checkUpdatesBtn.textContent = 'Checking…';
  }

  try {
    const result = await window.desktopStore.checkForUpdates();

    if (!result?.configured) {
      if (manual) {
        showUpdateBanner({
          title: 'Update checks are ready',
          message: result?.message || 'Connect the GitHub releases URL and users will see update alerts here.',
        });
      }
      return;
    }

    if (result?.ok === false) {
      if (manual) {
        showUpdateBanner({
          title: 'Could not check for updates',
          message: result?.message || 'Please try again later.',
          tone: 'warning',
        });
      }
      return;
    }

    if (result?.updateAvailable) {
      showUpdateBanner({
        title: `Version ${result.latestVersion} is available`,
        message: `You are using version ${result.currentVersion}. Download the latest release to update the app while keeping saved data.`,
        tone: 'success',
        downloadUrl: result.releaseUrl || '',
      });
      return;
    }

    if (manual) {
      showUpdateBanner({
        title: 'You are up to date',
        message: `This device is already running the latest version, ${result.currentVersion}.`,
      });
    }
  } catch (error) {
    if (manual) {
      showUpdateBanner({
        title: 'Could not check for updates',
        message: error?.message || 'Please try again later.',
        tone: 'warning',
      });
    }
  } finally {
    if (manual && elements.checkUpdatesBtn) {
      elements.checkUpdatesBtn.disabled = false;
      elements.checkUpdatesBtn.textContent = 'Check for updates';
    }
  }
}

function syncClientIdPlaceholders() {
  const nextId = generateClientDisplayId();
  const clientDisplayIdInput = document.getElementById('clientDisplayId');
  const quickClientDisplayIdInput = document.getElementById('quickClientDisplayId');

  if (clientDisplayIdInput && !clientDisplayIdInput.value) {
    clientDisplayIdInput.placeholder = nextId;
  }

  if (quickClientDisplayIdInput && !quickClientDisplayIdInput.value) {
    quickClientDisplayIdInput.placeholder = nextId;
  }
}

function openCreateClientModal() {
  document.getElementById('quickClientDisplayId').value = generateClientDisplayId();
  syncClientIdPlaceholders();
  document.getElementById('quickClientDefaultCurrency').value = reportingCurrency();
  if (elements.quickClientPreferredPaymentMethod) {
    elements.quickClientPreferredPaymentMethod.value = '';
  }
  elements.createClientModal.hidden = false;
  document.getElementById('quickClientName').focus();
}

function closeCreateClientModal() {
  elements.quickClientForm.reset();
  document.getElementById('quickClientDefaultVat').value = 21;
  document.getElementById('quickClientDefaultCurrency').value = reportingCurrency();
  elements.createClientModal.hidden = true;
}

function syncInvoiceClientCurrencyFields(selectedClientId = elements.invoiceClient.value) {
  const defaultCurrency = reportingCurrency();
  const client = getClient(selectedClientId);
  const clientCurrency = clientCurrencyFor(client);
  const hasSecondaryCurrency = Boolean(client && clientCurrency !== defaultCurrency);

  elements.invoiceClientSecondaryTotalField.hidden = !hasSecondaryCurrency;
  elements.invoiceClientSecondaryTotal.required = hasSecondaryCurrency;
  elements.invoiceClientSecondaryTotalLabel.textContent = `Total in ${clientCurrency}`;

  elements.invoiceDefaultCurrencyReceivedField.hidden = !hasSecondaryCurrency;
  elements.invoiceDefaultCurrencyReceivedLabel.textContent = `Amount received (${defaultCurrency})`;

  if (!hasSecondaryCurrency) {
    elements.invoiceClientSecondaryTotal.value = '';
    elements.invoiceClientSecondaryTotalPreview.textContent = '';
    elements.invoiceDefaultCurrencyReceived.value = '';
    elements.invoiceDefaultCurrencyReceivedPreview.textContent = '';
    return;
  }

  const amount = Number(elements.invoiceClientSecondaryTotal.value || 0);
  elements.invoiceClientSecondaryTotalPreview.textContent = amount > 0
    ? `Displayed on invoice as ${formatCurrency(amount, clientCurrency)}`
    : 'Enter amount in the client currency for display on invoice.';

  const subtotal = Number(elements.invoiceSubtotal.value || 0);
  const vatRate = Number(elements.invoiceVatRate.value || 0);
  const calcTotal = subtotal * (1 + vatRate / 100);
  const calcFormatted = formatCurrency(calcTotal, defaultCurrency);
  const receivedAmount = Number(elements.invoiceDefaultCurrencyReceived.value || 0);
  elements.invoiceDefaultCurrencyReceivedPreview.textContent = receivedAmount > 0
    ? `Recording as ${formatCurrency(receivedAmount, defaultCurrency)} (auto-calculated: ${calcFormatted})`
    : `Leave blank to use auto-calculated total: ${calcFormatted}`;
}

function openMarkPaidModal(invoice) {
  uiState.pendingMarkPaidInvoiceId = invoice.id;
  elements.markPaidDateInput.value = invoice.paidDate || todayISO();
  elements.markPaidModal.hidden = false;
  elements.markPaidDateInput.focus();
}

function closeMarkPaidModal() {
  uiState.pendingMarkPaidInvoiceId = '';
  elements.markPaidForm.reset();
  elements.markPaidModal.hidden = true;
}

function syncChangeStatusFields() {
  const isPaid = elements.changeStatusSelect.value === 'paid';
  const isAborted = elements.changeStatusSelect.value === 'aborted';

  elements.changeStatusPaidDateField.hidden = !isPaid;
  elements.changeStatusPaidDate.required = isPaid;
  if (isPaid && !elements.changeStatusPaidDate.value) {
    elements.changeStatusPaidDate.value = todayISO();
  }

  elements.changeStatusAbortedNumberField.hidden = !isAborted;
  elements.changeStatusAbortedNumberHandling.required = isAborted;
}

function openChangeStatusModal(invoice) {
  uiState.pendingChangeStatusInvoiceId = invoice.id;
  elements.changeStatusSelect.value = invoice.status === 'paid' ? 'sent' : (invoice.status || 'sent');
  elements.changeStatusAbortedNumberHandling.value = invoice.abortedNumberHandling || 'cancelled';
  elements.changeStatusPaidDate.value = invoice.paidDate || todayISO();
  syncChangeStatusFields();
  elements.changeStatusModal.hidden = false;
  elements.changeStatusSelect.focus();
}

function closeChangeStatusModal() {
  uiState.pendingChangeStatusInvoiceId = '';
  elements.changeStatusForm.reset();
  elements.changeStatusPaidDateField.hidden = true;
  elements.changeStatusPaidDate.required = false;
  elements.changeStatusAbortedNumberField.hidden = true;
  elements.changeStatusAbortedNumberHandling.required = false;
  elements.changeStatusAbortedNumberHandling.value = 'cancelled';
  elements.changeStatusModal.hidden = true;
}

function upsertClientOptionList(selectedValue = '') {
  elements.invoiceClient.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = state.clients.length ? 'Select client' : 'No clients yet';
  elements.invoiceClient.appendChild(placeholder);

  state.clients.forEach((client) => {
    const option = document.createElement('option');
    option.value = client.id;
    option.textContent = `${client.displayId} · ${client.name}`;
    elements.invoiceClient.appendChild(option);
  });

  const createOption = document.createElement('option');
  createOption.value = getNewClientOptionValue();
  createOption.textContent = '+ Create new client';
  elements.invoiceClient.appendChild(createOption);

  if (selectedValue) {
    elements.invoiceClient.value = selectedValue;
  }
}

function syncPaymentMethodSelects() {
  const paymentMethods = Array.isArray(state.profile.paymentMethods) ? state.profile.paymentMethods : [];
  const methodOptions = paymentMethods.map((method) => ({
    value: method.id,
    label: method.type ? `${method.label} (${method.type})` : method.label,
  }));

  const setOptions = (selectEl, placeholder, previousValue = '') => {
    if (!selectEl) return;
    const wantedValue = String(previousValue || selectEl.value || '').trim();
    selectEl.innerHTML = '';

    const first = document.createElement('option');
    first.value = '';
    first.textContent = placeholder;
    selectEl.appendChild(first);

    methodOptions.forEach((optionData) => {
      const option = document.createElement('option');
      option.value = optionData.value;
      option.textContent = optionData.label;
      selectEl.appendChild(option);
    });

    if (wantedValue && methodOptions.some((optionData) => optionData.value === wantedValue)) {
      selectEl.value = wantedValue;
    } else {
      selectEl.value = '';
    }
  };

  setOptions(elements.clientPreferredPaymentMethod, 'Use profile default method(s)', elements.clientPreferredPaymentMethod?.value);
  setOptions(elements.quickClientPreferredPaymentMethod, 'Use profile default method(s)', elements.quickClientPreferredPaymentMethod?.value);
  setOptions(elements.invoicePaymentMethod, 'Use client/default method(s)', elements.invoicePaymentMethod?.value);
}


function renderAll() {
  renderProfile();
  syncPaymentMethodSelects();
  renderIssuerOptions();
  upsertClientOptionList();
  renderClients();
  renderInvoices();
  renderExpenses();
  renderDashboard();
  runReport();
}

function resetForms() {
  elements.clientForm.reset();
  document.getElementById('clientDefaultCurrency').value = reportingCurrency();
  elements.clientPreferredPaymentMethod.value = '';
  elements.invoiceForm.reset();
  elements.invoiceIssueDate.value = todayISO();
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);
  elements.invoiceDueDate.value = dueDate.toISOString().split('T')[0];
  elements.invoiceVatRate.value = 21;
  elements.invoiceStatus.value = 'sent';
  elements.invoicePaidDate.value = '';
  elements.invoiceNumber.value = '';
  elements.invoiceTotalPreview.textContent = formatCurrency(0, reportingCurrency());
  elements.invoiceIssuerSelect.value = 'legal';
  elements.invoicePaymentMethod.value = '';
  elements.invoiceClientSecondaryTotal.value = '';
  elements.invoiceClientSecondaryTotalPreview.textContent = '';
  elements.invoiceClientSecondaryTotalField.hidden = true;
  elements.invoiceDefaultCurrencyReceived.value = '';
  elements.invoiceDefaultCurrencyReceivedPreview.textContent = '';
  elements.invoiceDefaultCurrencyReceivedField.hidden = true;
  uiState.lastInvoiceClientValue = '';
  toggleInvoicePaidDateField();
  updateImportQueueInfo();
}

function resetExpenseEditMode() {
  uiState.editingExpenseId = '';
  elements.expenseSubmitBtn.textContent = 'Save expense';
  elements.expenseEditCancelBtn.hidden = true;
  uiState.pendingImportedExpenseReceipt = null;
  setPendingExpenseImportInfo('');
}

function loadExpenseForEditing(expense) {
  uiState.editingExpenseId = expense.id;
  elements.expenseDate.value = expense.date || todayISO();
  elements.expenseAmount.value = String(expense.amount || 0);
  elements.expenseCategory.value = expense.category || 'Other';
  elements.expenseDeductible.value = expense.deductible || 'yes';
  elements.expenseNote.value = expense.note || '';
  elements.expenseSubmitBtn.textContent = 'Update expense';
  elements.expenseEditCancelBtn.hidden = false;

  if (expense.receiptDataUrl) {
    setPendingExpenseImportInfo(`Editing expense with attached receipt: ${expense.receiptFileName || 'PDF receipt'}. Upload another PDF to replace it.`);
  } else {
    setPendingExpenseImportInfo('Editing expense without receipt. Upload a PDF now if you want to attach one.');
  }

  showView('expenses');
  elements.expenseForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateInvoicePreview() {
  const subtotal = Number(elements.invoiceSubtotal.value || 0);
  const vatRate = Number(elements.invoiceVatRate.value || 0);
  const total = subtotal * (1 + vatRate / 100);
  elements.invoiceTotalPreview.textContent = formatCurrency(total, reportingCurrency());
  syncInvoiceClientCurrencyFields();
}

function toggleInvoicePaidDateField() {
  const isPaid = elements.invoiceStatus.value === 'paid';
  elements.invoicePaidDateField.hidden = !isPaid;
  elements.invoicePaidDate.required = isPaid;

  if (isPaid && !elements.invoicePaidDate.value) {
    elements.invoicePaidDate.value = todayISO();
  }

  if (!isPaid) {
    elements.invoicePaidDate.value = '';
  }
}

function loadInvoiceForEditing(invoice) {
  state.invoices = state.invoices.filter((item) => item.id !== invoice.id);
  saveState();
  renderAll();

  upsertClientOptionList(invoice.clientId);
  uiState.lastInvoiceClientValue = invoice.clientId || '';

  elements.invoiceNumber.value = invoice.invoiceNumber || '';
  elements.invoiceIssueDate.value = invoice.issueDate || todayISO();
  elements.invoiceDueDate.value = invoice.dueDate || todayISO();
  elements.invoiceDescription.value = invoice.description || '';
  elements.invoiceSubtotal.value = String(invoice.subtotal || 0);
  elements.invoiceVatRate.value = String(invoice.vatRate ?? 21);
  elements.invoiceStatus.value = invoice.status || 'draft';
  elements.invoicePaidDate.value = invoice.paidDate || '';
  elements.invoicePaymentMethod.value = invoice.paymentMethodId || '';
  elements.invoiceClientSecondaryTotal.value = String(invoice.clientCurrencyTotal || '');
  const calcTotal = invoice.subtotal * (1 + (invoice.vatRate || 0) / 100);
  elements.invoiceDefaultCurrencyReceived.value =
    Math.abs((invoice.total || 0) - calcTotal) > 0.005 ? String(invoice.total) : '';
  if (invoice.issuerType === 'business' && invoice.issuerBusinessId) {
    renderIssuerOptions(`business:${invoice.issuerBusinessId}`);
  } else {
    renderIssuerOptions('legal');
  }
  toggleInvoicePaidDateField();
  syncInvoiceClientCurrencyFields(invoice.clientId);
  updateInvoicePreview();
  showView('invoices');
  elements.invoiceForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

registerProfileHooks({ renderAll });
registerImportHooks({
  showView,
  upsertClientOptionList,
  updateInvoicePreview,
  toggleInvoicePaidDateField,
});

elements.navLinks.forEach((link) => {
  link.addEventListener('click', () => {
    showView(link.dataset.view);
  });
});

elements.themeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const nextTheme = normalizeThemePreset(button.dataset.theme);
    if (nextTheme === state.profile.themePreset && document.documentElement.dataset.theme === nextTheme) {
      return;
    }
    applyTheme(nextTheme);
    saveState();
  });
});

if (elements.checkUpdatesBtn) {
  elements.checkUpdatesBtn.addEventListener('click', () => {
    checkForUpdates({ manual: true });
  });
}

if (elements.updateDismissBtn) {
  elements.updateDismissBtn.addEventListener('click', () => {
    hideUpdateBanner();
  });
}

if (elements.updateDownloadBtn) {
  elements.updateDownloadBtn.addEventListener('click', async () => {
    if (!latestUpdateUrl || typeof window.desktopStore?.openExternalUrl !== 'function') return;
    await window.desktopStore.openExternalUrl(latestUpdateUrl);
  });
}

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

try {
  attachProfileHandlers();
} catch (error) {
  console.error('Failed to attach profile handlers', error);
}

elements.clientForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(elements.clientForm);
  const displayId = formData.get('clientDisplayId') || generateClientDisplayId();
  state.clients.push({
    id: crypto.randomUUID(),
    displayId,
    name: String(formData.get('clientName') || '').trim(),
    contactName: String(formData.get('clientContactName') || '').trim(),
    email: String(formData.get('clientEmail') || '').trim(),
    vatNumber: String(formData.get('clientVatNumber') || '').trim(),
    address: String(formData.get('clientAddress') || '').trim(),
    defaultVatRate: Number(formData.get('clientDefaultVat') || 0),
    defaultCurrency: normalizeCurrencyCode(formData.get('clientDefaultCurrency') || reportingCurrency()),
    preferredPaymentMethodId: String(formData.get('clientPreferredPaymentMethod') || '').trim(),
  });
  saveState();
  renderAll();
  elements.clientForm.reset();
  document.getElementById('clientDefaultCurrency').value = reportingCurrency();
  elements.clientPreferredPaymentMethod.value = '';
  syncClientIdPlaceholders();
});

elements.expenseForm.addEventListener('submit', (event) => {
  event.preventDefault();
  persistExpenseFromForm(uiState.editingExpenseId);
  renderAll();
  elements.expenseForm.reset();
  elements.expenseDate.value = todayISO();
  resetExpenseEditMode();
});

elements.expenseEditCancelBtn.addEventListener('click', () => {
  elements.expenseForm.reset();
  elements.expenseDate.value = todayISO();
  resetExpenseEditMode();
});

elements.invoiceForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(elements.invoiceForm);
  const clientId = formData.get('invoiceClient');
  if (!clientId) {
    alert('Add or select a client first.');
    return;
  }

  const issueDate = formData.get('invoiceIssueDate');
  const issuerSelection = String(formData.get('invoiceIssuer') || 'legal');
  const manualInvoiceNumber = String(formData.get('invoiceNumber') || '').trim();
  const invoiceNumber = manualInvoiceNumber || buildInvoiceNumber(issueDate);
  if (!canUseInvoiceNumber(invoiceNumber)) {
    alert('Invoice number already exists. Please change it before saving.');
    return;
  }

  const subtotal = Number(formData.get('invoiceSubtotal'));
  const vatRate = Number(formData.get('invoiceVatRate'));
  const vatAmount = subtotal * vatRate / 100;
  const calcTotal = subtotal + vatAmount;
  const receivedDefaultTotal = Number(formData.get('invoiceDefaultCurrencyReceived') || 0);
  const total = receivedDefaultTotal > 0 ? receivedDefaultTotal : calcTotal;

  let issuerType = 'legal';
  let issuerBusinessId = '';
  let issuerName = state.profile.legalName || '';
  if (issuerSelection.startsWith('business:')) {
    const businessId = issuerSelection.split(':')[1] || '';
    const selectedBusiness = state.profile.businesses.find((business) => business.id === businessId);
    if (selectedBusiness) {
      issuerType = 'business';
      issuerBusinessId = selectedBusiness.id;
      issuerName = selectedBusiness.name;
    }
  }

  const createdInvoice = {
    id: crypto.randomUUID(),
    invoiceNumber,
    clientId,
    issuerType,
    issuerBusinessId,
    issuerName,
    issueDate,
    dueDate: formData.get('invoiceDueDate'),
    description: String(formData.get('invoiceDescription') || '').trim(),
    subtotal,
    vatRate,
    vatAmount,
    total,
    defaultCurrency: reportingCurrency(),
    clientCurrency: clientCurrencyFor(getClient(clientId)),
    paymentMethodId: String(formData.get('invoicePaymentMethod') || '').trim() || String(getClient(clientId)?.preferredPaymentMethodId || '').trim(),
    clientCurrencyTotal: Number(formData.get('invoiceClientSecondaryTotal') || 0),
    status: formData.get('invoiceStatus'),
    paidDate: formData.get('invoicePaidDate'),
    abortedNumberHandling: '',
  };

  if (createdInvoice.clientCurrency === createdInvoice.defaultCurrency) {
    createdInvoice.clientCurrencyTotal = 0;
  }

  // Auto-set status to overdue if due date is today or in the past and status is sent
  if (createdInvoice.status === 'sent' && createdInvoice.dueDate <= todayISO()) {
    createdInvoice.status = 'overdue';
  }

  state.invoices.push(createdInvoice);

  saveState();
  renderAll();
  if (uiState.pendingImportedDrafts.length > 0) {
    const nextDraft = uiState.pendingImportedDrafts.shift();
    import('./imports.js').then(({ loadImportedDraftIntoForm }) => loadImportedDraftIntoForm(nextDraft));
  } else {
    resetForms();
    const savedInvoice = state.invoices.find((item) => item.id === createdInvoice.id);
    if (savedInvoice) {
      openInvoicePreview(savedInvoice);
    }
  }
  showView('invoices');
});

elements.invoiceSubtotal.addEventListener('input', updateInvoicePreview);
elements.invoiceVatRate.addEventListener('input', updateInvoicePreview);
elements.invoiceStatus.addEventListener('change', toggleInvoicePaidDateField);
elements.invoiceClient.addEventListener('change', (event) => {
  if (event.target.value === getNewClientOptionValue()) {
    event.target.value = uiState.lastInvoiceClientValue || '';
    openCreateClientModal();
    return;
  }

  uiState.lastInvoiceClientValue = event.target.value;
  const client = getClient(event.target.value);
  if (client) {
    elements.invoiceVatRate.value = client.defaultVatRate;
    elements.invoicePaymentMethod.value = String(client.preferredPaymentMethodId || '').trim();
    syncInvoiceClientCurrencyFields(client.id);
    updateInvoicePreview();
  }
});

elements.invoiceClientSecondaryTotal.addEventListener('input', () => {
  syncInvoiceClientCurrencyFields();
});

elements.invoiceDefaultCurrencyReceived.addEventListener('input', () => {
  syncInvoiceClientCurrencyFields();
});

elements.quickClientCancel.addEventListener('click', closeCreateClientModal);
elements.createClientModal.addEventListener('click', (event) => {
  if (event.target === elements.createClientModal) {
    closeCreateClientModal();
  }
});

elements.invoicePreviewCloseBtn.addEventListener('click', closeInvoicePreview);
elements.invoicePreviewModal.addEventListener('click', (event) => {
  if (event.target === elements.invoicePreviewModal) {
    closeInvoicePreview();
  }
});
elements.invoicePreviewEditBtn.addEventListener('click', () => {
  if (!uiState.pendingPreviewInvoiceId) return;
  const invoice = state.invoices.find((item) => item.id === uiState.pendingPreviewInvoiceId);
  if (!invoice) {
    closeInvoicePreview();
    return;
  }
  closeInvoicePreview();
  loadInvoiceForEditing(invoice);
});
elements.invoicePreviewDownloadBtn.addEventListener('click', () => {
  if (!uiState.pendingPreviewInvoiceId) return;
  const invoice = state.invoices.find((item) => item.id === uiState.pendingPreviewInvoiceId);
  if (!invoice) {
    closeInvoicePreview();
    return;
  }
  printInvoice(invoice);
});

elements.quickClientForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(elements.quickClientForm);
  const name = String(formData.get('quickClientName') || '').trim();
  if (!name) {
    alert('Client name is required.');
    return;
  }

  const displayId = String(formData.get('quickClientDisplayId') || generateClientDisplayId()).trim();
  const duplicateDisplayId = state.clients.some((client) => client.displayId === displayId);
  if (duplicateDisplayId) {
    alert('Client ID already exists. Please use another one.');
    return;
  }

  const createdClient = {
    id: crypto.randomUUID(),
    displayId,
    name,
    contactName: String(formData.get('quickClientContactName') || '').trim(),
    email: String(formData.get('quickClientEmail') || '').trim(),
    vatNumber: String(formData.get('quickClientVatNumber') || '').trim(),
    address: String(formData.get('quickClientAddress') || '').trim(),
    defaultVatRate: Number(formData.get('quickClientDefaultVat') || 21),
    defaultCurrency: normalizeCurrencyCode(formData.get('quickClientDefaultCurrency') || reportingCurrency()),
    preferredPaymentMethodId: String(formData.get('quickClientPreferredPaymentMethod') || '').trim(),
  };

  state.clients.push(createdClient);
  saveState();
  renderAll();
  upsertClientOptionList(createdClient.id);
  uiState.lastInvoiceClientValue = createdClient.id;
  elements.invoiceVatRate.value = createdClient.defaultVatRate;
  syncInvoiceClientCurrencyFields(createdClient.id);
  updateInvoicePreview();
  closeCreateClientModal();
  syncClientIdPlaceholders();
  showView('invoices');
});

elements.markPaidCancel.addEventListener('click', closeMarkPaidModal);
elements.markPaidModal.addEventListener('click', (event) => {
  if (event.target === elements.markPaidModal) {
    closeMarkPaidModal();
  }
});

elements.changeStatusCancel.addEventListener('click', closeChangeStatusModal);
elements.changeStatusModal.addEventListener('click', (event) => {
  if (event.target === elements.changeStatusModal) {
    closeChangeStatusModal();
  }
});

elements.changeStatusSelect.addEventListener('change', syncChangeStatusFields);

elements.changeStatusForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!uiState.pendingChangeStatusInvoiceId) return;
  const invoice = state.invoices.find((item) => item.id === uiState.pendingChangeStatusInvoiceId);
  if (!invoice) {
    closeChangeStatusModal();
    return;
  }
  const newStatus = elements.changeStatusSelect.value;
  const abortedNumberHandling = newStatus === 'aborted' ? elements.changeStatusAbortedNumberHandling.value : '';
  const nextReservesNumber = !(newStatus === 'aborted' && abortedNumberHandling === 'reuse');
  if (nextReservesNumber && !canUseInvoiceNumber(invoice.invoiceNumber, invoice.id)) {
    alert('This invoice number is already in use. Keep it reusable or change the invoice number before leaving aborted status.');
    return;
  }

  invoice.status = newStatus;
  invoice.abortedNumberHandling = abortedNumberHandling;
  invoice.paidDate = newStatus === 'paid' ? (elements.changeStatusPaidDate.value || todayISO()) : '';
  saveState();
  renderAll();
  closeChangeStatusModal();
});

elements.markPaidForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!uiState.pendingMarkPaidInvoiceId) return;
  const invoice = state.invoices.find((item) => item.id === uiState.pendingMarkPaidInvoiceId);
  if (!invoice) {
    closeMarkPaidModal();
    return;
  }

  invoice.status = 'paid';
  invoice.abortedNumberHandling = '';
  invoice.paidDate = elements.markPaidDateInput.value || todayISO();
  saveState();
  renderAll();
  closeMarkPaidModal();
});

elements.importInvoicesPdfBtn.addEventListener('click', () => {
  elements.invoicePdfInput.value = '';
  elements.invoicePdfInput.click();
});

elements.importExpensePdfBtn.addEventListener('click', () => {
  elements.expensePdfInput.value = '';
  elements.expensePdfInput.click();
});

elements.expensePdfInput.addEventListener('change', async (event) => {
  const file = (event.target.files || [])[0];
  if (!file) return;

  try {
    await importExpensePdfFile(file);
  } catch (error) {
    console.error('Failed to import expense PDF', file.name, error);
    alert('Could not parse this expense PDF. You can still fill the expense manually and save it.');
  }
});

elements.invoicePdfInput.addEventListener('change', async (event) => {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;
  await importInvoicePdfFiles(files);
});

elements.invoiceFilter.addEventListener('change', renderInvoices);
elements.statusSummary.addEventListener('click', (event) => {
  const statusButton = event.target.closest('.status-row[data-status]');
  if (!statusButton) return;
  elements.invoiceFilter.value = statusButton.dataset.status;
  renderInvoices();
  showView('invoices');
});

elements.invoiceSortToggle.addEventListener('click', () => {
  uiState.invoiceSortAsc = !uiState.invoiceSortAsc;
  elements.invoiceSortToggle.textContent = uiState.invoiceSortAsc ? 'Date ↑' : 'Date ↓';
  renderInvoices();
});
elements.dashboardYear.addEventListener('input', renderDashboard);
elements.dashboardPeriod.addEventListener('change', renderDashboard);
elements.runQuarterReportBtn.addEventListener('click', runReport);

elements.invoicesTableBody.addEventListener('toggle', (event) => {
  const menu = event.target;
  if (!(menu instanceof HTMLDetailsElement) || !menu.classList.contains('invoice-row-menu')) {
    return;
  }
  if (menu.open) {
    closeInvoiceRowMenus(menu);
  }
}, true);

document.addEventListener('click', (event) => {
  if (!event.target.closest('.invoice-row-menu')) {
    closeInvoiceRowMenus();
  }
});

elements.invoicesTableBody.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;

  const invoice = state.invoices.find((item) => item.id === button.dataset.id);
  if (!invoice) return;

  if (button.dataset.action === 'mark-paid') {
    closeInvoiceRowMenus();
    openMarkPaidModal(invoice);
    return;
  }

  if (button.dataset.action === 'edit-invoice') {
    closeInvoiceRowMenus();
    loadInvoiceForEditing(invoice);
    return;
  }

  if (button.dataset.action === 'change-status') {
    closeInvoiceRowMenus();
    openChangeStatusModal(invoice);
    return;
  }

  if (button.dataset.action === 'reminder') {
    const text = buildReminder(invoice, 'neutral');
    navigator.clipboard.writeText(text)
      .then(() => alert('Reminder copied.'))
      .catch(() => prompt('Copy reminder text:', text));
    return;
  }

  if (button.dataset.action === 'preview-invoice') {
    closeInvoiceRowMenus();
    openInvoicePreview(invoice);
  }
});

elements.expensesTableBody.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const expense = state.expenses.find((item) => item.id === button.dataset.id);
  if (!expense) return;

  if (button.dataset.action === 'view-expense-receipt') {
    if (!expense.receiptDataUrl) return;
    openExpenseReceiptModal(expense);
    return;
  }

  if (button.dataset.action === 'edit-expense') {
    loadExpenseForEditing(expense);
    return;
  }

  if (button.dataset.action === 'delete-expense') {
    const confirmed = confirm(`Delete expense from ${expense.date} for ${formatCurrency(expense.amount, reportingCurrency())}?`);
    if (!confirmed) return;

    state.expenses = state.expenses.filter((item) => item.id !== expense.id);
    saveState();
    renderAll();

    if (uiState.editingExpenseId === expense.id) {
      elements.expenseForm.reset();
      elements.expenseDate.value = todayISO();
      resetExpenseEditMode();
    }
  }
});

async function init() {
  if (!isDesktopApp) {
    renderDesktopOnlyScreen();
    return;
  }

  await loadState();
  applyTheme(state.profile.themePreset);
  document.getElementById('clientDefaultCurrency').value = reportingCurrency();
  document.getElementById('quickClientDefaultCurrency').value = reportingCurrency();
  const now = currentQuarterInfo();
  elements.dashboardYear.value = now.year;
  elements.dashboardPeriod.value = `q${now.quarter}`;
  elements.reportYear.value = now.year;
  elements.reportQuarter.value = String(now.quarter);
  resetForms();
  elements.expenseDate.value = todayISO();
  renderAll();
  showView('dashboard');
  syncClientIdPlaceholders();
  hideUpdateBanner();
  checkForUpdates();
}

if (elements.exportInvoicesCsvBtn) {
  elements.exportInvoicesCsvBtn.addEventListener('click', exportInvoicesCsv);
}
if (elements.exportExpensesCsvBtn) {
  elements.exportExpensesCsvBtn.addEventListener('click', exportExpensesCsv);
}
if (elements.exportReportCsvBtn) {
  elements.exportReportCsvBtn.addEventListener('click', exportReportCsv);
}

init().catch((error) => {
  console.error('Failed to initialize app', error);
});
