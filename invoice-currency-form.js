import {
  elements,
  SUPPORTED_CURRENCIES,
  calculateInvoiceAmounts,
  convertToBookAmounts,
  formatCurrency,
  getClient,
  clientCurrencyFor,
  reportingCurrency,
  readDecimal,
  bookCurrencyOn,
  todayISO,
} from './state.js';
import { canGetExchangeRates, getBookExchangeRate } from './book-rate.js';

// The source of the rate in the form. It changes to "entered by hand" when the user types a rate.
let rateDetails = { rateDate: '', source: '', manual: false };
// Only the answer to the last rate request may fill the form.
let rateRequest = 0;

function currentCurrency() {
  return elements.invoiceCurrency.value || reportingCurrency();
}

// The book currency in force on the issue date of the invoice.
function currentBookCurrency() {
  return bookCurrencyOn(elements.invoiceIssueDate.value || todayISO());
}

// The book currency of the last rate, so a new issue date gets a new rate when the book currency changes.
let rateBookCurrency = '';

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
  const bookCurrency = currentBookCurrency();
  const needsRate = currency !== bookCurrency;

  elements.invoiceSubtotalLabel.textContent = `Subtotal (${currency})`;
  elements.invoiceExchangeRateField.hidden = !needsRate;
  elements.invoiceExchangeRate.required = needsRate;
  elements.invoiceExchangeRateLabel.textContent = `Exchange rate (${currency} for 1 ${bookCurrency})`;

  const vatRate = readDecimal(elements.invoiceVatRate.value, { amount: false });
  const amounts = calculateInvoiceAmounts(readDecimal(elements.invoiceSubtotal.value), vatRate);
  elements.invoiceTotalPreview.textContent = formatCurrency(amounts.total, currency);

  if (!needsRate) {
    elements.invoiceBookPreview.textContent = '';
    return;
  }

  const rate = readDecimal(elements.invoiceExchangeRate.value, { amount: false });
  if (!(rate > 0)) {
    elements.invoiceBookPreview.textContent = '';
    return;
  }
  const book = convertToBookAmounts(amounts.subtotal, vatRate, rate);
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
export async function refreshInvoiceExchangeRate() {
  const currency = currentCurrency();
  const bookCurrency = currentBookCurrency();
  const date = rateDate();
  syncInvoiceCurrencyFields();
  if (currency === bookCurrency || !date || !canGetExchangeRates()) return;

  rateRequest += 1;
  const request = rateRequest;
  elements.invoiceExchangeRateHint.textContent = 'Getting the exchange rate from the ECB…';
  rateBookCurrency = bookCurrency;
  const result = await getBookExchangeRate(currency, bookCurrency, date);
  if (request !== rateRequest) return;

  if (!result.ok) {
    elements.invoiceExchangeRate.value = '';
    rateDetails = { rateDate: date, source: '', manual: true };
    elements.invoiceExchangeRateHint.textContent = result.error;
    syncInvoiceCurrencyFields();
    return;
  }

  elements.invoiceExchangeRate.value = String(result.rate);
  rateDetails = { rateDate: result.rateDate, source: result.source, manual: false };
  showRateHint();
  syncInvoiceCurrencyFields();
}

export function attachInvoiceCurrencyHandlers() {
  elements.invoiceCurrency.addEventListener('change', refreshInvoiceExchangeRate);
  elements.invoiceServiceDate.addEventListener('change', refreshInvoiceExchangeRate);
  elements.invoiceIssueDate.addEventListener('change', () => {
    if (!elements.invoiceServiceDate.value || rateBookCurrency !== currentBookCurrency()) refreshInvoiceExchangeRate();
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
  rateBookCurrency = currentBookCurrency();
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
  const bookCurrency = currentBookCurrency();
  if (currency === bookCurrency) {
    return { currency, bookCurrency, serviceDate: elements.invoiceServiceDate.value, exchangeRate: null };
  }

  const rate = readDecimal(elements.invoiceExchangeRate.value, { amount: false });
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
