import {
  elements,
  SUPPORTED_CURRENCIES,
  calculateInvoiceAmounts,
  convertToBookAmounts,
  formatCurrency,
  getClient,
  clientCurrencyFor,
  reportingCurrency,
} from './state.js';

// The source of the rate in the form. It changes to "entered by hand" when the user types a rate.
let rateDetails = { rateDate: '', source: '', manual: false };
// Only the answer to the last rate request may fill the form.
let rateRequest = 0;

function currentCurrency() {
  return elements.invoiceCurrency.value || reportingCurrency();
}

function rateDate() {
  return elements.invoiceServiceDate.value || elements.invoiceIssueDate.value;
}

export function fillInvoiceCurrencyOptions() {
  elements.invoiceCurrency.innerHTML = '';
  SUPPORTED_CURRENCIES.forEach((code) => {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = code;
    elements.invoiceCurrency.appendChild(option);
  });
  elements.invoiceCurrency.value = reportingCurrency();
}

// Shows the labels, the rate field and the preview for the selected currency.
export function syncInvoiceCurrencyFields() {
  const currency = currentCurrency();
  const bookCurrency = reportingCurrency();
  const needsRate = currency !== bookCurrency;

  elements.invoiceSubtotalLabel.textContent = `Subtotal (${currency})`;
  elements.invoiceExchangeRateField.hidden = !needsRate;
  elements.invoiceExchangeRate.required = needsRate;
  elements.invoiceExchangeRateLabel.textContent = `Exchange rate (${currency} for 1 ${bookCurrency})`;

  const amounts = calculateInvoiceAmounts(elements.invoiceSubtotal.value, elements.invoiceVatRate.value);
  elements.invoiceTotalPreview.textContent = formatCurrency(amounts.total, currency);

  if (!needsRate) {
    elements.invoiceBookPreview.textContent = '';
    return;
  }

  const rate = Number(elements.invoiceExchangeRate.value);
  if (!(rate > 0)) {
    elements.invoiceBookPreview.textContent = '';
    return;
  }
  const book = convertToBookAmounts(amounts.subtotal, elements.invoiceVatRate.value, rate);
  elements.invoiceBookPreview.textContent = `In the books: subtotal ${formatCurrency(book.subtotal, bookCurrency)}, VAT ${formatCurrency(book.vatAmount, bookCurrency)}, total ${formatCurrency(book.total, bookCurrency)}.`;
}

function showRateHint() {
  if (!rateDetails.source) {
    elements.invoiceExchangeRateHint.textContent = '';
    return;
  }
  elements.invoiceExchangeRateHint.textContent = rateDetails.manual
    ? `Entered by hand for ${rateDetails.rateDate}.`
    : `${rateDetails.source}.`;
}

// Gets the ECB rate for the service date, or for the issue date when there is no service date.
// For two currencies that are not the euro, the rate is the cross rate of their euro rates.
export async function refreshInvoiceExchangeRate() {
  const currency = currentCurrency();
  const bookCurrency = reportingCurrency();
  const date = rateDate();
  syncInvoiceCurrencyFields();
  if (currency === bookCurrency || !date || typeof window.desktopStore?.getExchangeRate !== 'function') return;

  rateRequest += 1;
  const request = rateRequest;
  elements.invoiceExchangeRateHint.textContent = 'Getting the exchange rate from the ECB…';
  const [invoiceRate, bookRate] = await Promise.all([
    window.desktopStore.getExchangeRate(currency, date),
    window.desktopStore.getExchangeRate(bookCurrency, date),
  ]);
  if (request !== rateRequest) return;

  const failed = [invoiceRate, bookRate].find((result) => !result?.ok);
  if (failed) {
    elements.invoiceExchangeRate.value = '';
    rateDetails = { rateDate: date, source: '', manual: true };
    elements.invoiceExchangeRateHint.textContent = failed?.error || 'Could not get the exchange rate. Enter the rate by hand.';
    syncInvoiceCurrencyFields();
    return;
  }

  const rate = Number((invoiceRate.rate / bookRate.rate).toPrecision(8));
  elements.invoiceExchangeRate.value = String(rate);
  rateDetails = {
    rateDate: invoiceRate.rateDate,
    source: bookCurrency === 'EUR' || currency === 'EUR'
      ? (currency === 'EUR' ? bookRate.source : invoiceRate.source)
      : `Cross rate of the ECB reference rates of ${invoiceRate.rateDate}`,
    manual: false,
  };
  showRateHint();
  syncInvoiceCurrencyFields();
}

export function attachInvoiceCurrencyHandlers() {
  elements.invoiceCurrency.addEventListener('change', refreshInvoiceExchangeRate);
  elements.invoiceServiceDate.addEventListener('change', refreshInvoiceExchangeRate);
  elements.invoiceIssueDate.addEventListener('change', () => {
    if (!elements.invoiceServiceDate.value) refreshInvoiceExchangeRate();
  });
  elements.invoiceExchangeRate.addEventListener('input', () => {
    rateRequest += 1;
    rateDetails = { rateDate: rateDate(), source: 'Entered by hand', manual: true };
    showRateHint();
    syncInvoiceCurrencyFields();
  });
}

// Uses the currency of the client for a new invoice.
export function useClientCurrency(clientId) {
  const client = getClient(clientId);
  if (!client) return;
  elements.invoiceCurrency.value = clientCurrencyFor(client);
  refreshInvoiceExchangeRate();
}

export function resetInvoiceCurrencyFields() {
  rateRequest += 1;
  rateDetails = { rateDate: '', source: '', manual: false };
  elements.invoiceCurrency.value = reportingCurrency();
  elements.invoiceServiceDate.value = '';
  elements.invoiceExchangeRate.value = '';
  elements.invoiceExchangeRateHint.textContent = '';
  syncInvoiceCurrencyFields();
}

// Shows the frozen currency and rate of an invoice that is edited. The rate is not fetched again.
export function loadInvoiceCurrencyFields(invoice, currency) {
  rateRequest += 1;
  elements.invoiceCurrency.value = currency;
  elements.invoiceServiceDate.value = invoice.serviceDate || '';
  elements.invoiceExchangeRate.value = invoice.exchangeRate?.rate ? String(invoice.exchangeRate.rate) : '';
  rateDetails = {
    rateDate: invoice.exchangeRate?.rateDate || '',
    source: invoice.exchangeRate?.source || '',
    manual: Boolean(invoice.exchangeRate?.manual),
  };
  showRateHint();
  syncInvoiceCurrencyFields();
}

// The currency fields of the form, ready to save on the invoice.
export function readInvoiceCurrencyFields() {
  const currency = currentCurrency();
  const bookCurrency = reportingCurrency();
  if (currency === bookCurrency) {
    return { currency, bookCurrency, serviceDate: elements.invoiceServiceDate.value, exchangeRate: null };
  }

  const rate = Number(elements.invoiceExchangeRate.value);
  return {
    currency,
    bookCurrency,
    serviceDate: elements.invoiceServiceDate.value,
    exchangeRate: rate > 0
      ? {
          rate: Number(rate.toPrecision(8)),
          rateDate: rateDetails.rateDate || rateDate(),
          source: rateDetails.manual ? 'Entered by hand' : rateDetails.source,
          manual: rateDetails.manual,
        }
      : null,
  };
}
