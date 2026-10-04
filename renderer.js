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
  addDaysISO,
  canUseInvoiceNumber,
  invoiceCurrency,
  invoiceBookAmounts,
  invoiceBookCurrency,
  invoiceReceivedAmount,
  roundMoney,
  readDecimal,
  displayInvoiceNumber,
  attachDecimalInputs,
  invoiceMoneyForSave,
  upsertInvoice,
  buildInvoiceNumber,
  generateClientDisplayId,
  startPeriodInfo,
  getClient,
  invoiceClientOptions,
  reportingCurrency,
  bookCurrencyOn,
  expenseBookCurrency,
  normalizeCurrencyCode,
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
import { attachUpdateHandlers, checkForUpdates, hideUpdateBanner } from './update-banner.js';
import { attachExpenseReceiptHandlers, openExpenseReceiptModal } from './expense-receipt.js';
import { attachDialogHandlers } from './dialogs.js';
import {
  attachInvoiceCurrencyHandlers,
  fillInvoiceCurrencyOptions,
  loadInvoiceCurrencyFields,
  readInvoiceCurrencyFields,
  resetInvoiceCurrencyFields,
  syncInvoiceCurrencyFields,
  useClientCurrency,
} from './invoice-currency-form.js';
import {
  attachExpenseCurrencyHandlers,
  fillExpenseCurrencyOptions,
  loadExpenseCurrencyFields,
  resetExpenseCurrencyFields,
  syncExpenseCurrencyFields,
} from './expense-currency-form.js';
import { exportInvoicesCsv, exportExpensesCsv, exportReportCsv } from './csv-export.js';


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

// The received amount is in the book currency: the euros that arrived, after bank charges.
function receivedLabel(invoice) {
  return `Amount received in ${invoiceBookCurrency(invoice)} (after bank charges)`;
}

// The invoice that a modal changes, so the user sees that it is the correct one.
function invoiceSubject(invoice) {
  const client = getClient(invoice.clientId);
  return [displayInvoiceNumber(invoice), client?.name || 'Unknown client', formatCurrency(invoice.total, invoiceCurrency(invoice))].join(' · ');
}

function openMarkPaidModal(invoice) {
  uiState.pendingMarkPaidInvoiceId = invoice.id;
  elements.markPaidSubject.textContent = invoiceSubject(invoice);
  elements.markPaidDateInput.value = invoice.paidDate || todayISO();
  elements.markPaidReceivedLabel.textContent = receivedLabel(invoice);
  elements.markPaidReceived.value = invoiceReceivedAmount(invoice).toFixed(2);
  elements.markPaidReceivedHint.textContent = `Invoice total in the books: ${formatCurrency(invoiceBookAmounts(invoice).total, invoiceBookCurrency(invoice))}.`;
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
  elements.changeStatusReceived.required = isPaid;
  if (isPaid && !elements.changeStatusPaidDate.value) {
    elements.changeStatusPaidDate.value = todayISO();
  }

  elements.changeStatusAbortedNumberField.hidden = !isAborted;
  elements.changeStatusAbortedNumberHandling.required = isAborted;
}

function openChangeStatusModal(invoice) {
  uiState.pendingChangeStatusInvoiceId = invoice.id;
  elements.changeStatusSubject.textContent = invoiceSubject(invoice);
  elements.changeStatusSelect.value = invoice.status === 'paid' ? 'sent' : (invoice.status || 'sent');
  elements.changeStatusAbortedNumberHandling.value = invoice.abortedNumberHandling || 'cancelled';
  elements.changeStatusPaidDate.value = invoice.paidDate || todayISO();
  elements.changeStatusReceivedLabel.textContent = receivedLabel(invoice);
  elements.changeStatusReceived.value = invoiceReceivedAmount(invoice).toFixed(2);
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

// Keeps the client that is selected now, unless the caller selects another one.
function upsertClientOptionList(selectedValue = elements.invoiceClient.value) {
  elements.invoiceClient.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  const clientOptions = invoiceClientOptions(selectedValue);
  placeholder.textContent = clientOptions.length ? 'Select client' : 'No active clients yet';
  elements.invoiceClient.appendChild(placeholder);

  clientOptions.forEach((clientOption) => {
    const option = document.createElement('option');
    option.value = clientOption.value;
    option.textContent = clientOption.label;
    elements.invoiceClient.appendChild(option);
  });

  const createOption = document.createElement('option');
  createOption.value = getNewClientOptionValue();
  createOption.textContent = '+ Create new client';
  elements.invoiceClient.appendChild(createOption);

  if (selectedValue) {
    const hasSelectedValue = Array.from(elements.invoiceClient.options).some((option) => option.value === selectedValue);
    if (hasSelectedValue) {
      elements.invoiceClient.value = selectedValue;
    } else {
      elements.invoiceClient.value = '';
    }
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
  syncExpenseCurrencyFields();
  renderDashboard();
  runReport();
}

function resetClientEditMode() {
  uiState.editingClientId = '';
  elements.clientSubmitBtn.textContent = 'Save client';
  elements.cancelClientEditBtn.hidden = true;
  elements.clientForm.reset();
  document.getElementById('clientDefaultCurrency').value = reportingCurrency();
  elements.clientPreferredPaymentMethod.value = '';
  syncClientIdPlaceholders();
}

function loadClientForEditing(client) {
  uiState.editingClientId = client.id;
  elements.clientName.value = client.name || '';
  elements.clientContactName.value = client.contactName || '';
  elements.clientDisplayId.value = client.displayId || '';
  elements.clientEmail.value = client.email || '';
  elements.clientVatNumber.value = client.vatNumber || '';
  elements.clientAddress.value = client.address || '';
  elements.clientDefaultVat.value = String(client.defaultVatRate ?? 21);
  elements.clientDefaultCurrency.value = client.defaultCurrency || reportingCurrency();
  elements.clientStatus.value = client.status === 'inactive' ? 'inactive' : 'active';
  elements.clientPreferredPaymentMethod.value = String(client.preferredPaymentMethodId || '').trim();
  elements.clientSubmitBtn.textContent = 'Update client';
  elements.cancelClientEditBtn.hidden = false;
  showView('clients');
  elements.clientForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetInvoiceEditMode() {
  uiState.editingInvoiceId = '';
  elements.invoiceSubmitBtn.textContent = 'Create invoice';
  elements.invoiceFormTitle.textContent = 'New invoice';
}

// The invoice form opens above the invoice list for a new invoice, an edit or an imported PDF, so the list can
// use the full width.
function showInvoiceForm() {
  elements.invoiceFormPanel.hidden = false;
  showView('invoices');
  elements.invoiceFormPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  elements.invoiceClient.focus({ preventScroll: true });
}

function hideInvoiceForm() {
  elements.invoiceFormPanel.hidden = true;
}

function resetForms() {
  resetInvoiceEditMode();
  elements.invoiceForm.reset();
  elements.invoiceIssueDate.value = todayISO();
  elements.invoiceDueDate.value = addDaysISO(todayISO(), 14);
  elements.invoiceVatRate.value = 21;
  elements.invoiceStatus.value = 'sent';
  elements.invoicePaidDate.value = '';
  elements.invoiceNumber.value = '';
  elements.invoiceTotalPreview.textContent = formatCurrency(0, reportingCurrency());
  elements.invoiceIssuerSelect.value = 'legal';
  elements.invoicePaymentMethod.value = '';
  resetInvoiceCurrencyFields();
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
  resetExpenseCurrencyFields();
}

function loadExpenseForEditing(expense) {
  uiState.editingExpenseId = expense.id;
  elements.expenseDate.value = expense.date || todayISO();
  elements.expenseAmount.value = String(expense.amount || 0);
  elements.expenseCategory.value = expense.category || 'Other';
  elements.expenseDeductible.value = expense.deductible || 'yes';
  elements.expenseNote.value = expense.note || '';
  loadExpenseCurrencyFields(expense);
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
  syncInvoiceCurrencyFields();
}

function toggleInvoicePaidDateField() {
  const isPaid = elements.invoiceStatus.value === 'paid';
  elements.invoicePaidDateField.hidden = !isPaid;
  elements.invoicePaidDate.required = isPaid;
  elements.invoiceReceivedField.hidden = !isPaid;
  elements.invoiceReceivedLabel.textContent = `Amount received in ${bookCurrencyOn(elements.invoiceIssueDate.value || todayISO())} (after bank charges)`;

  if (isPaid && !elements.invoicePaidDate.value) {
    elements.invoicePaidDate.value = todayISO();
  }

  if (!isPaid) {
    elements.invoicePaidDate.value = '';
    elements.invoiceReceived.value = '';
  }
}

function loadInvoiceForEditing(invoice) {
  renderAll();

  uiState.editingInvoiceId = invoice.id;
  upsertClientOptionList(invoice.clientId);
  uiState.lastInvoiceClientValue = invoice.clientId || '';

  elements.invoiceNumber.value = invoice.invoiceNumber || '';
  elements.invoiceIssueDate.value = invoice.issueDate || todayISO();
  elements.invoiceDueDate.value = invoice.dueDate || todayISO();
  elements.invoiceDescription.value = invoice.description || '';
  elements.invoiceSubtotal.value = String(invoice.subtotal || 0);
  elements.invoiceVatRate.value = String(invoice.vatRate ?? 21);
  elements.invoiceStatus.value = invoice.status === 'overdue' ? 'sent' : invoice.status || 'draft';
  elements.invoicePaidDate.value = invoice.paidDate || '';
  elements.invoiceReceived.value = invoice.receivedAmount ?? '';
  elements.invoicePaymentMethod.value = invoice.paymentMethodId || '';
  if (invoice.issuerType === 'business' && invoice.issuerBusinessId) {
    renderIssuerOptions(`business:${invoice.issuerBusinessId}`);
  } else {
    renderIssuerOptions('legal');
  }
  toggleInvoicePaidDateField();
  loadInvoiceCurrencyFields(invoice, invoiceCurrency(invoice));
  elements.invoiceSubmitBtn.textContent = 'Update invoice';
  elements.invoiceFormTitle.textContent = `Edit invoice ${invoice.invoiceNumber || ''}`.trim();
  showInvoiceForm();
}

registerProfileHooks({ renderAll });
registerImportHooks({
  showView,
  useClientCurrency,
  resetInvoiceEditMode,
  upsertClientOptionList,
  updateInvoicePreview,
  toggleInvoicePaidDateField,
  showInvoiceForm,
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

attachUpdateHandlers();
attachExpenseReceiptHandlers();
attachDialogHandlers();
attachDecimalInputs();
fillInvoiceCurrencyOptions();
attachInvoiceCurrencyHandlers();
fillExpenseCurrencyOptions();
attachExpenseCurrencyHandlers();

try {
  attachProfileHandlers();
} catch (error) {
  console.error('Failed to attach profile handlers', error);
}

if (elements.cancelClientEditBtn) {
  elements.cancelClientEditBtn.addEventListener('click', () => {
    resetClientEditMode();
  });
}

elements.clientForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(elements.clientForm);
  const name = String(formData.get('clientName') || '').trim();
  if (!name) {
    alert('Client name is required.');
    return;
  }

  const displayId = String(formData.get('clientDisplayId') || '').trim() || generateClientDisplayId();
  const duplicateDisplayId = state.clients.some((client) => client.id !== uiState.editingClientId && client.displayId === displayId);
  if (duplicateDisplayId) {
    alert('Client ID already exists. Please use another one.');
    return;
  }

  const clientPayload = {
    id: uiState.editingClientId || crypto.randomUUID(),
    displayId,
    name,
    contactName: String(formData.get('clientContactName') || '').trim(),
    email: String(formData.get('clientEmail') || '').trim(),
    vatNumber: String(formData.get('clientVatNumber') || '').trim(),
    address: String(formData.get('clientAddress') || '').trim(),
    defaultVatRate: readDecimal(formData.get('clientDefaultVat'), { amount: false }),
    defaultCurrency: normalizeCurrencyCode(formData.get('clientDefaultCurrency') || reportingCurrency()),
    status: String(formData.get('clientStatus') || 'active').trim().toLowerCase() === 'inactive' ? 'inactive' : 'active',
    preferredPaymentMethodId: String(formData.get('clientPreferredPaymentMethod') || '').trim(),
  };

  if (uiState.editingClientId) {
    const existingClient = state.clients.find((client) => client.id === uiState.editingClientId);
    if (!existingClient) {
      state.clients.push(clientPayload);
    } else {
      Object.assign(existingClient, clientPayload);
    }
  } else {
    state.clients.push(clientPayload);
  }

  saveState();
  renderAll();
  resetClientEditMode();
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

elements.invoiceEditCancelBtn.addEventListener('click', () => {
  resetForms();
  hideInvoiceForm();
});

elements.newInvoiceBtn.addEventListener('click', () => {
  resetForms();
  showInvoiceForm();
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
  if (!canUseInvoiceNumber(invoiceNumber, uiState.editingInvoiceId)) {
    alert('Invoice number already exists. Please change it before saving.');
    return;
  }

  const currencyFields = readInvoiceCurrencyFields();
  if (currencyFields.currency !== currencyFields.bookCurrency && !currencyFields.exchangeRate) {
    alert(`Enter the exchange rate from ${currencyFields.currency} to ${currencyFields.bookCurrency}, or wait until the app has the rate from the ECB.`);
    return;
  }
  const editingInvoice = state.invoices.find((item) => item.id === uiState.editingInvoiceId);
  const vatRate = readDecimal(formData.get('invoiceVatRate'), { amount: false });
  const money = invoiceMoneyForSave({ subtotal: readDecimal(formData.get('invoiceSubtotal')), vatRate, ...currencyFields }, editingInvoice);

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

  const invoiceFields = {
    invoiceNumber,
    clientId,
    issuerType,
    issuerBusinessId,
    issuerName,
    issueDate,
    dueDate: formData.get('invoiceDueDate'),
    description: String(formData.get('invoiceDescription') || '').trim(),
    ...money,
    vatRate,
    currency: currencyFields.currency,
    bookCurrency: currencyFields.bookCurrency,
    defaultCurrency: currencyFields.bookCurrency,
    exchangeRate: currencyFields.exchangeRate,
    serviceDate: currencyFields.serviceDate,
    paymentMethodId: String(formData.get('invoicePaymentMethod') || '').trim() || String(getClient(clientId)?.preferredPaymentMethodId || '').trim(),
    // Statuses such as aborted or delinquent are not in the form, so keep them when editing
    status: formData.get('invoiceStatus') || editingInvoice?.status || 'draft',
    paidDate: formData.get('invoicePaidDate'),
  };
  // A paid invoice keeps the euros that arrived. Without an entered amount it is the total in the books.
  invoiceFields.receivedAmount = invoiceFields.status === 'paid'
    ? (String(formData.get('invoiceReceived') || '').trim() ? roundMoney(readDecimal(formData.get('invoiceReceived'))) : money.bookAmounts.total)
    : null;

  // Auto-set status to overdue if due date is today or in the past and status is sent
  if (invoiceFields.status === 'sent' && invoiceFields.dueDate <= todayISO()) {
    invoiceFields.status = 'overdue';
  }

  const createdInvoice = upsertInvoice(editingInvoice?.id || crypto.randomUUID(), invoiceFields);
  resetInvoiceEditMode();

  saveState();
  renderAll();
  if (uiState.pendingImportedDrafts.length > 0) {
    const nextDraft = uiState.pendingImportedDrafts.shift();
    import('./imports.js').then(({ loadImportedDraftIntoForm }) => loadImportedDraftIntoForm(nextDraft));
  } else {
    resetForms();
    hideInvoiceForm();
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
    useClientCurrency(client.id);
    updateInvoicePreview();
  }
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
    defaultVatRate: String(formData.get('quickClientDefaultVat') || '').trim() ? readDecimal(formData.get('quickClientDefaultVat'), { amount: false }) : 21,
    defaultCurrency: normalizeCurrencyCode(formData.get('quickClientDefaultCurrency') || reportingCurrency()),
    status: String(formData.get('quickClientStatus') || 'active').trim().toLowerCase() === 'inactive' ? 'inactive' : 'active',
    preferredPaymentMethodId: String(formData.get('quickClientPreferredPaymentMethod') || '').trim(),
  };

  state.clients.push(createdClient);
  saveState();
  renderAll();
  upsertClientOptionList(createdClient.id);
  uiState.lastInvoiceClientValue = createdClient.id;
  elements.invoiceVatRate.value = createdClient.defaultVatRate;
  useClientCurrency(createdClient.id);
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
  invoice.receivedAmount = newStatus === 'paid' ? roundMoney(readDecimal(elements.changeStatusReceived.value)) : null;
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
  invoice.receivedAmount = roundMoney(readDecimal(elements.markPaidReceived.value));
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
// The report follows the selected year and period at once, so it never shows the figures of another period.
elements.reportYear.addEventListener('input', runReport);
elements.reportQuarter.addEventListener('change', runReport);
elements.reportForm.addEventListener('submit', (event) => {
  event.preventDefault();
  runReport();
});

elements.invoicesTableBody.addEventListener('toggle', (event) => {
  const menu = event.target;
  if (!(menu instanceof HTMLDetailsElement) || !menu.classList.contains('invoice-row-menu')) {
    return;
  }
  if (menu.open) {
    closeInvoiceRowMenus(menu);
    // The list is fixed to the window, so it goes below the More button, or above it near the bottom of the window.
    const button = menu.querySelector('summary').getBoundingClientRect();
    const list = menu.querySelector('.invoice-row-menu-list');
    list.style.right = `${Math.max(8, window.innerWidth - button.right)}px`;
    list.style.top = `${button.bottom + 6}px`;
    const height = list.getBoundingClientRect().height;
    if (button.bottom + 6 + height > window.innerHeight - 8) {
      list.style.top = `${Math.max(8, button.top - 6 - height)}px`;
    }
  }
}, true);

// A fixed menu does not move with the page, so it closes when the page scrolls.
document.addEventListener('scroll', () => closeInvoiceRowMenus(), true);

document.addEventListener('keydown', (event) => {
  const openMenu = document.querySelector('.invoice-row-menu[open]');
  if (event.key !== 'Escape' || !openMenu) return;
  openMenu.open = false;
  openMenu.querySelector('summary').focus();
});
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

  if (button.dataset.action === 'mark-unpaid') {
    closeInvoiceRowMenus();
    const confirmed = confirm(`Mark invoice ${invoice.invoiceNumber} as unpaid? The payment date and the amount received are removed.`);
    if (!confirmed) return;

    invoice.status = 'sent';
    invoice.paidDate = '';
    invoice.receivedAmount = null;
    saveState();
    renderAll();
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
      .catch(() => alert('Could not copy the reminder.'));
    return;
  }

  if (button.dataset.action === 'preview-invoice') {
    closeInvoiceRowMenus();
    openInvoicePreview(invoice);
  }
});

elements.clientsTableBody.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action="edit-client"]');
  if (!button) return;

  const client = state.clients.find((item) => item.id === button.dataset.id);
  if (!client) return;

  loadClientForEditing(client);
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
    const confirmed = confirm(`Delete expense from ${expense.date} for ${formatCurrency(expense.amount, expenseBookCurrency(expense))}?`);
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
  const now = startPeriodInfo();
  elements.dashboardYear.value = now.year;
  elements.dashboardPeriod.value = `q${now.quarter}`;
  elements.reportYear.value = now.year;
  elements.reportQuarter.value = String(now.quarter);
  resetClientEditMode();
  resetForms();
  elements.expenseDate.value = todayISO();
  resetExpenseCurrencyFields();
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
