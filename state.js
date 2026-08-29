export const STORAGE_KEY = 'murielMyFinancialAdminPhase1';
export const PREVIOUS_STORAGE_KEY = 'darwinMyFinancialAdminPhase1';
export const LEGACY_STORAGE_KEY = 'flowInvoicePhase1';
export const isDesktopApp = Boolean(window.desktopStore?.isDesktopApp);
const SUPPORTED_REPORTING_CURRENCIES = new Set(['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY', 'SEK', 'NOK', 'DKK', 'PLN']);
const SUPPORTED_THEME_PRESETS = new Set(['muriel', 'sunrise', 'night']);

function normalizeReportingCurrency(value) {
  const code = String(value || 'EUR').trim().toUpperCase();
  return SUPPORTED_REPORTING_CURRENCIES.has(code) ? code : 'EUR';
}

export function normalizeThemePreset(value) {
  const preset = String(value || 'muriel').trim().toLowerCase();
  return SUPPORTED_THEME_PRESETS.has(preset) ? preset : 'muriel';
}

export async function getDesktopEncryptionStatus() {
  if (!isDesktopApp || typeof window.desktopStore?.getEncryptionStatus !== 'function') {
    return { ok: false, available: false };
  }

  try {
    const result = await window.desktopStore.getEncryptionStatus();
    return {
      ok: Boolean(result?.ok),
      available: Boolean(result?.available),
    };
  } catch {
    return { ok: false, available: false };
  }
}

function createDefaultProfile() {
  return {
    personalName: '',
    legalName: '',
    email: '',
    phone: '',
    vatNumber: '',
    address: '',
    reportingCurrency: 'EUR',
    themePreset: 'muriel',
    businesses: [],
    paymentMethods: [],
  };
}

function normalizeClientStatus(value) {
  const status = String(value || 'active').trim().toLowerCase();
  return status === 'inactive' ? 'inactive' : 'active';
}

function createDefaultState() {
  return {
    clients: [],
    invoices: [],
    expenses: [],
    profile: createDefaultProfile(),
  };
}

export const state = createDefaultState();

export const uiState = {
  lastInvoiceClientValue: '',
  pendingMarkPaidInvoiceId: '',
  pendingChangeStatusInvoiceId: '',
  invoiceSortAsc: false,
  pendingImportedExpenseReceipt: null,
  editingExpenseId: '',
  editingClientId: '',
  editingBusinessId: '',
  editingPaymentMethodId: '',
  profileSaveFeedbackTimeout: null,
  pendingPreviewInvoiceId: '',
  pendingImportedDrafts: [],
};

const byId = (id) => document.getElementById(id);

export const elements = {
  views: document.querySelectorAll('.view'),
  navLinks: document.querySelectorAll('.nav-link'),
  themeButtons: document.querySelectorAll('.theme-option'),
  pageTitle: byId('page-title'),
  clientForm: byId('client-form'),
  clientName: byId('clientName'),
  clientContactName: byId('clientContactName'),
  clientDisplayId: byId('clientDisplayId'),
  clientEmail: byId('clientEmail'),
  clientVatNumber: byId('clientVatNumber'),
  clientAddress: byId('clientAddress'),
  clientDefaultVat: byId('clientDefaultVat'),
  clientDefaultCurrency: byId('clientDefaultCurrency'),
  clientStatus: byId('clientStatus'),
  clientSubmitBtn: byId('client-submit-btn'),
  cancelClientEditBtn: byId('cancel-client-edit'),
  invoiceForm: byId('invoice-form'),
  profileForm: byId('profile-form'),
  profileSaveFeedback: byId('profile-save-feedback'),
  reportYear: byId('reportYear'),
  reportQuarter: byId('reportQuarter'),
  reportCards: byId('report-cards'),
  reportStatusChartCanvas: byId('report-status-chart'),
  reportCashflowChartCanvas: byId('report-cashflow-chart'),
  reportIncomeChartCanvas: byId('report-income-chart'),
  reportChartsEmpty: byId('report-charts-empty'),
  dashboardYear: byId('dashboardYear'),
  dashboardPeriod: byId('dashboardPeriod'),
  invoiceFilter: byId('invoice-filter'),
  importInvoicesPdfBtn: byId('import-invoices-pdf'),
  invoicePdfInput: byId('invoice-pdf-input'),
  importExpensePdfBtn: byId('import-expense-pdf'),
  expensePdfInput: byId('expense-pdf-input'),
  invoiceIssuerSelect: byId('invoiceIssuer'),
  profileBusinessNameInput: byId('profileBusinessName'),
  profileBusinessWebsiteInput: byId('profileBusinessWebsite'),
  profileBusinessContactEmailInput: byId('profileBusinessContactEmail'),
  profileBusinessLogoInput: byId('profileBusinessLogo'),
  profilePaymentMethodLabelInput: byId('profilePaymentMethodLabel'),
  profilePaymentMethodTypeInput: byId('profilePaymentMethodType'),
  profilePaymentMethodDetailsInput: byId('profilePaymentMethodDetails'),
  profilePaymentMethodDefaultInput: byId('profilePaymentMethodDefault'),
  addPaymentMethodBtn: byId('add-payment-method'),
  cancelPaymentMethodEditBtn: byId('cancel-payment-method-edit'),
  paymentMethodList: byId('payment-method-list'),
  addBusinessNameBtn: byId('add-business-name'),
  cancelBusinessEditBtn: byId('cancel-business-edit'),
  businessNameList: byId('business-name-list'),
  expenseForm: byId('expense-form'),
  expensesTableBody: byId('expenses-table-body'),
  importQueueInfo: document.createElement('div'),
  expenseImportInfo: document.createElement('div'),
  createClientModal: byId('create-client-modal'),
  quickClientForm: byId('quick-client-form'),
  quickClientName: byId('quickClientName'),
  quickClientContactName: byId('quickClientContactName'),
  quickClientDisplayId: byId('quickClientDisplayId'),
  quickClientEmail: byId('quickClientEmail'),
  quickClientVatNumber: byId('quickClientVatNumber'),
  quickClientAddress: byId('quickClientAddress'),
  quickClientDefaultVat: byId('quickClientDefaultVat'),
  quickClientDefaultCurrency: byId('quickClientDefaultCurrency'),
  quickClientStatus: byId('quickClientStatus'),
  quickClientCancel: byId('quick-client-cancel'),
  markPaidModal: byId('mark-paid-modal'),
  markPaidForm: byId('mark-paid-form'),
  markPaidCancel: byId('mark-paid-cancel'),
  markPaidDateInput: byId('markPaidDate'),
  changeStatusModal: byId('change-status-modal'),
  changeStatusForm: byId('change-status-form'),
  changeStatusSelect: byId('changeStatusSelect'),
  changeStatusPaidDateField: byId('change-status-paid-date-field'),
  changeStatusPaidDate: byId('changeStatusPaidDate'),
  changeStatusAbortedNumberField: byId('change-status-aborted-number-field'),
  changeStatusAbortedNumberHandling: byId('changeStatusAbortedNumberHandling'),
  invoicePreviewModal: byId('invoice-preview-modal'),
  invoicePreviewContent: byId('invoice-preview-content'),
  invoicePreviewEyebrow: byId('invoice-preview-eyebrow'),
  invoicePreviewTitle: byId('invoice-preview-title'),
  invoicePreviewCloseBtn: byId('invoice-preview-close'),
  invoicePreviewEditBtn: byId('invoice-preview-edit'),
  invoicePreviewDownloadBtn: byId('invoice-preview-download'),
  invoiceSubtotal: byId('invoiceSubtotal'),
  invoiceVatRate: byId('invoiceVatRate'),
  invoiceStatus: byId('invoiceStatus'),
  invoiceClient: byId('invoiceClient'),
  invoicePaymentMethod: byId('invoicePaymentMethod'),
  invoicePaidDateField: byId('invoice-paid-date-field'),
  invoicePaidDate: byId('invoicePaidDate'),
  invoiceIssueDate: byId('invoiceIssueDate'),
  invoiceDueDate: byId('invoiceDueDate'),
  invoiceNumber: byId('invoiceNumber'),
  invoiceDescription: byId('invoiceDescription'),
  invoiceTotalPreview: byId('invoiceTotalPreview'),
  invoiceClientSecondaryTotalField: byId('invoice-client-secondary-total-field'),
  invoiceClientSecondaryTotalLabel: byId('invoice-client-secondary-total-label'),
  invoiceClientSecondaryTotal: byId('invoiceClientSecondaryTotal'),
  invoiceClientSecondaryTotalPreview: byId('invoice-client-secondary-total-preview'),
  invoiceDefaultCurrencyReceivedField: byId('invoice-default-currency-received-field'),
  invoiceDefaultCurrencyReceivedLabel: byId('invoice-default-currency-received-label'),
  invoiceDefaultCurrencyReceived: byId('invoiceDefaultCurrencyReceived'),
  invoiceDefaultCurrencyReceivedPreview: byId('invoice-default-currency-received-preview'),
  expenseDate: byId('expenseDate'),
  expenseAmount: byId('expenseAmount'),
  expenseCategory: byId('expenseCategory'),
  expenseDeductible: byId('expenseDeductible'),
  expenseNote: byId('expenseNote'),
  expenseSubmitBtn: byId('expense-submit-btn'),
  expenseEditCancelBtn: byId('expense-edit-cancel-btn'),
  invoiceSortToggle: byId('invoice-sort-toggle'),
  runQuarterReportBtn: byId('run-quarter-report'),
  invoicesTableBody: byId('invoices-table-body'),
  clientsTableBody: byId('clients-table-body'),
  overdueTableBody: byId('overdue-table-body'),
  statusSummary: byId('status-summary'),
  dashboardPeriodLabel: byId('dashboard-period-label'),
  exportInvoicesCsvBtn: byId('export-invoices-csv'),
  exportExpensesCsvBtn: byId('export-expenses-csv'),
  exportReportCsvBtn: byId('export-report-csv'),
  changeStatusCancel: byId('change-status-cancel'),
  clientPreferredPaymentMethod: byId('clientPreferredPaymentMethod'),
  quickClientPreferredPaymentMethod: byId('quickClientPreferredPaymentMethod'),
  checkUpdatesBtn: byId('check-updates-btn'),
  updateBanner: byId('update-banner'),
  updateBannerTitle: byId('update-banner-title'),
  updateBannerMessage: byId('update-banner-message'),
  updateDownloadBtn: byId('update-download-btn'),
  updateDismissBtn: byId('update-dismiss-btn'),
  exportBackupBtn: byId('export-backup-btn'),
  restoreBackupBtn: byId('restore-backup-btn'),
  backupStatus: byId('backup-status'),
  expenseReceiptModal: byId('expense-receipt-modal'),
  expenseReceiptTitle: byId('expense-receipt-title'),
  expenseReceiptContent: byId('expense-receipt-content'),
  expenseReceiptCloseBtn: byId('expense-receipt-close'),
  expenseReceiptDownloadBtn: byId('expense-receipt-download'),
};

function normalizePaymentMethod(method) {
  return {
    id: method?.id || crypto.randomUUID(),
    label: String(method?.label || '').trim(),
    type: String(method?.type || '').trim(),
    details: String(method?.details || '').trim(),
    includeByDefault: Boolean(method?.includeByDefault),
  };
}

export async function readPersistedStateRaw() {
  if (!isDesktopApp) {
    return '';
  }

  if (typeof window.desktopStore?.readState !== 'function') {
    return '';
  }

  try {
    return await window.desktopStore.readState() || '';
  } catch {
    return '';
  }
}

function readLegacyBrowserStateRaw() {
  if (typeof window.localStorage === 'undefined') {
    return '';
  }

  return (
    window.localStorage.getItem(STORAGE_KEY)
    || window.localStorage.getItem(PREVIOUS_STORAGE_KEY)
    || window.localStorage.getItem(LEGACY_STORAGE_KEY)
    || ''
  );
}

function parseStateRaw(raw) {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    const payload = parsed?.state && typeof parsed.state === 'object' ? parsed.state : parsed;
    return {
      clients: Array.isArray(payload.clients) ? payload.clients : [],
      invoices: Array.isArray(payload.invoices) ? payload.invoices : [],
      expenses: Array.isArray(payload.expenses) ? payload.expenses : [],
      profile: payload.profile || createDefaultProfile(),
    };
  } catch (error) {
    console.error('Could not parse state', error);
    return null;
  }
}

function assignLoadedState(nextState) {
  state.clients = Array.isArray(nextState.clients)
    ? nextState.clients.map((client) => ({
        ...client,
        contactName: String(client?.contactName || '').trim(),
        status: normalizeClientStatus(client?.status),
      }))
    : [];
  state.invoices = nextState.invoices;
  state.expenses = nextState.expenses;
  state.profile = nextState.profile;
  normalizeProfile();
}

export async function loadState() {
  const desktopRaw = await readPersistedStateRaw();
  const desktopState = parseStateRaw(desktopRaw);
  if (desktopState) {
    assignLoadedState(desktopState);
    return;
  }

  const legacyRaw = readLegacyBrowserStateRaw();
  const legacyState = parseStateRaw(legacyRaw);
  if (!legacyState) {
    return;
  }

  assignLoadedState(legacyState);

  // One-time migration path for users moving from browser storage to desktop storage.
  if (isDesktopApp && typeof window.desktopStore?.writeState === 'function') {
    const result = await window.desktopStore.writeState(JSON.stringify(state));
    if (!result?.ok) {
      console.error('Could not migrate legacy state to desktop file', result?.error || 'Unknown error');
    }
  }
}

export function normalizeProfile() {
  if (!state.profile || typeof state.profile !== 'object') {
    state.profile = createDefaultProfile();
  }

  state.profile.personalName = String(state.profile.personalName || '').trim();
  state.profile.legalName = String(state.profile.legalName || '').trim();
  state.profile.email = String(state.profile.email || '').trim();
  state.profile.phone = String(state.profile.phone || '').trim();
  state.profile.vatNumber = String(state.profile.vatNumber || '').trim();
  state.profile.address = String(state.profile.address || '').trim();
  state.profile.reportingCurrency = normalizeReportingCurrency(state.profile.reportingCurrency);
  state.profile.themePreset = normalizeThemePreset(state.profile.themePreset);

  const businesses = Array.isArray(state.profile.businesses) ? state.profile.businesses : [];
  state.profile.businesses = businesses
    .map((business) => {
      if (typeof business === 'string') {
        return {
          id: crypto.randomUUID(),
          name: business.trim(),
          website: '',
          contactEmail: '',
          logoDataUrl: '',
          logoMimeType: '',
          logoFileName: '',
        };
      }

      return {
        id: business?.id || crypto.randomUUID(),
        name: String(business?.name || '').trim(),
        website: String(business?.website || '').trim(),
        contactEmail: String(business?.contactEmail || '').trim(),
        logoDataUrl: String(business?.logoDataUrl || '').trim(),
        logoMimeType: String(business?.logoMimeType || '').trim(),
        logoFileName: String(business?.logoFileName || '').trim(),
      };
    })
    .filter((business) => business.name);

  const paymentMethods = Array.isArray(state.profile.paymentMethods) ? state.profile.paymentMethods : [];
  state.profile.paymentMethods = paymentMethods
    .map((method) => normalizePaymentMethod(method))
    .filter((method) => method.label || method.details);
}

export function getPaymentMethodById(paymentMethodId) {
  const id = String(paymentMethodId || '').trim();
  if (!id) return null;
  return state.profile.paymentMethods.find((method) => method.id === id) || null;
}

export function defaultPaymentMethods() {
  const defaults = state.profile.paymentMethods.filter((method) => method.includeByDefault);
  return defaults.length ? defaults : [];
}

export function serializeStateForBackup() {
  normalizeProfile();
  return JSON.stringify({
    app: 'muriel-myfinancialadmin',
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    state,
  }, null, 2);
}

export async function restoreStateFromRaw(raw) {
  const parsed = parseStateRaw(raw);
  if (!parsed) {
    return { ok: false, error: 'This backup file could not be read.' };
  }

  assignLoadedState(parsed);
  await saveState();
  return { ok: true };
}

export async function saveState() {
  const serialized = JSON.stringify(state);
  if (!isDesktopApp || typeof window.desktopStore?.writeState !== 'function') {
    return;
  }

  try {
    const result = await window.desktopStore.writeState(serialized);
    if (!result?.ok) {
      console.error('Could not save desktop state file', result?.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Could not save desktop state file', error?.message || 'Unknown error');
  }
}

export function renderDesktopOnlyScreen() {
  document.body.innerHTML = `
    <main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at top left, rgba(242,104,181,0.2), transparent 24%), radial-gradient(circle at top right, rgba(243,207,104,0.24), transparent 30%), linear-gradient(180deg, #22105f 0%, #12063d 100%);color:#fdf4ff;font-family:Inter,Arial,sans-serif;">
      <section style="width:min(760px,100%);background:linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06));border:1px solid rgba(255,255,255,0.18);border-radius:22px;padding:28px 28px 22px;box-shadow:0 20px 50px rgba(23,8,75,0.38);backdrop-filter:blur(8px);">
        <p style="margin:0;color:#f3cf68;letter-spacing:.08em;text-transform:uppercase;font-size:.75rem;font-weight:700;">Desktop App Required</p>
        <h1 style="margin:10px 0 10px;font-size:1.7rem;line-height:1.3;color:#ffffff;">Muriel - myFinancialAdmin runs in desktop mode only.</h1>
        <p style="margin:0 0 12px;color:#f5dff2;line-height:1.6;">To prevent data loss and confusion, browser mode is disabled. Open the installed Linux app, or run it locally with Electron.</p>
        <div style="margin-top:18px;padding:14px 16px;border:1px solid rgba(243,207,104,0.28);border-radius:14px;background:linear-gradient(135deg, rgba(242,104,181,0.16), rgba(244,160,111,0.12));">
          <p style="margin:0;color:#fff7fb;line-height:1.6;">From this project folder run: <strong style="color:#f3cf68;">npm run start</strong></p>
        </div>
      </section>
    </main>
  `;
}

export function downloadFile(filename, content, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function escapeCsv(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

export function euro(value) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(value || 0));
}

export function formatCurrency(value, currencyCode = 'EUR') {
  const code = normalizeReportingCurrency(currencyCode);
  return new Intl.NumberFormat('en', { style: 'currency', currency: code }).format(Number(value || 0));
}

export function reportingCurrency() {
  return normalizeReportingCurrency(state.profile?.reportingCurrency || 'EUR');
}

export function normalizeCurrencyCode(value) {
  return normalizeReportingCurrency(value);
}

export function clientCurrencyFor(client) {
  return normalizeReportingCurrency(client?.defaultCurrency || reportingCurrency());
}

export function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export function quarterFromDate(dateString) {
  const date = new Date(dateString);
  return Math.floor(date.getMonth() / 3) + 1;
}

export function yearFromDate(dateString) {
  return new Date(dateString).getFullYear();
}

export function computedStatus(invoice) {
  if (invoice.status === 'paid') return 'paid';
  if (invoice.status === 'draft') return 'draft';
  if (invoice.status === 'delinquent') return 'delinquent';
  if (invoice.status === 'aborted') return 'aborted';
  const due = new Date(invoice.dueDate);
  const now = new Date();
  due.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return due < now ? 'overdue' : 'sent';
}

export function invoiceReservesNumber(invoice) {
  return !(invoice.status === 'aborted' && invoice.abortedNumberHandling === 'reuse');
}

export function canUseInvoiceNumber(invoiceNumber, currentInvoiceId = '') {
  return !state.invoices.some((invoice) => (
    invoice.id !== currentInvoiceId
    && invoice.invoiceNumber === invoiceNumber
    && invoiceReservesNumber(invoice)
  ));
}

export function displayInvoiceNumber(invoice) {
  if (invoice.status !== 'aborted') return invoice.invoiceNumber;
  if (invoice.abortedNumberHandling === 'reuse') {
    return 'Cancelled';
  }
  return `${invoice.invoiceNumber} (cancelled)`;
}

export function buildInvoiceNumber(issueDate) {
  const year = yearFromDate(issueDate);
  const month = issueDate
    ? String(new Date(`${issueDate}T00:00:00`).getMonth() + 1).padStart(2, '0')
    : String(new Date().getMonth() + 1).padStart(2, '0');
  const pattern = new RegExp(`^INV-${year}-${month}-(\\d{3})$`);
  const reserved = new Set();

  state.invoices.forEach((invoice) => {
    if (!invoice.issueDate || !invoiceReservesNumber(invoice)) return;
    const sameYear = yearFromDate(invoice.issueDate) === year;
    const sameMonth = String(new Date(`${invoice.issueDate}T00:00:00`).getMonth() + 1).padStart(2, '0') === month;
    if (!sameYear || !sameMonth) return;
    const match = String(invoice.invoiceNumber || '').match(pattern);
    if (match) {
      reserved.add(Number(match[1]));
    }
  });

  let nextSequence = 1;
  while (reserved.has(nextSequence)) {
    nextSequence += 1;
  }

  return `INV-${year}-${month}-${String(nextSequence).padStart(3, '0')}`;
}

export function generateClientDisplayId() {
  const highestExistingId = state.clients.reduce((highest, client) => {
    const match = String(client?.displayId || '').trim().match(/(\d+)$/);
    if (!match) return highest;
    return Math.max(highest, Number(match[1]) || 0);
  }, 0);

  return String(highestExistingId + 1).padStart(4, '0');
}

export function currentQuarterInfo() {
  const now = new Date();
  return { year: now.getFullYear(), quarter: Math.floor(now.getMonth() / 3) + 1 };
}

export function selectedDashboardPeriod() {
  const fallback = currentQuarterInfo();
  const year = Number(elements.dashboardYear.value);
  const period = elements.dashboardPeriod.value;
  const validQuarter = /^q[1-4]$/.test(period);

  return {
    year: Number.isFinite(year) && year >= 2020 ? year : fallback.year,
    period: period === 'year' || validQuarter ? period : `q${fallback.quarter}`,
  };
}

export function matchesDashboardPeriod(dateString) {
  const { year, period } = selectedDashboardPeriod();
  if (yearFromDate(dateString) !== year) return false;
  if (period === 'year') return true;
  return quarterFromDate(dateString) === Number(period.slice(1));
}

export function formatDashboardPeriodLabel() {
  const { year, period } = selectedDashboardPeriod();
  if (period === 'year') {
    return `Reporting period: Full year ${year}`;
  }
  return `Reporting period: ${period.toUpperCase()} ${year}`;
}

export function getClient(clientId) {
  return state.clients.find((client) => client.id === clientId);
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
