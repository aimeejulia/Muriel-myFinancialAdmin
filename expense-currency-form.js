import {
  elements,
  SUPPORTED_CURRENCIES,
  expenseCurrency,
  reportingCurrency,
  roundMoney,
  readDecimal,
  bookCurrencyOn,
  todayISO,
  formatDate,
  formatDecimalInput,
} from './state.js';
import { canGetExchangeRates, getBookExchangeRate } from './book-rate.js';

// The source of the rate in the form. It changes to "entered by hand" when the user types a rate.
let rateDetails = { rateDate: '', source: '', manual: false };
// Only the answer to the last rate request may fill the form.
let rateRequest = 0;
// The amount paid follows the amount and the rate until the user types the amount paid.
let paidByHand = false;

function currentCurrency() {
  return elements.expenseCurrency.value || reportingCurrency();
}

// The book currency in force on the date of the expense.
function currentBookCurrency() {
  return bookCurrencyOn(elements.expenseDate.value || todayISO());
}

export function fillExpenseCurrencyOptions() {
  elements.expenseCurrency.innerHTML = '';
  SUPPORTED_CURRENCIES.forEach((code) => {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = code;
    elements.expenseCurrency.appendChild(option);
  });
  elements.expenseCurrency.value = reportingCurrency();
}

// Shows the labels and the fields for the selected currency, and calculates the amount paid from the rate.
export function syncExpenseCurrencyFields() {
  const currency = currentCurrency();
  const bookCurrency = currentBookCurrency();
  const needsRate = currency !== bookCurrency;

  elements.expenseAmountLabel.textContent = `Amount (${currency})`;
  elements.expenseExchangeRateField.hidden = !needsRate;
  elements.expenseExchangeRateLabel.textContent = `Exchange rate (${currency} for 1 ${bookCurrency})`;
  elements.expensePaidField.hidden = !needsRate;
  elements.expensePaid.required = needsRate;
  elements.expensePaidLabel.textContent = `Amount paid in ${bookCurrency} (after bank charges)`;

  if (!needsRate || paidByHand) return;
  const rate = readDecimal(elements.expenseExchangeRate.value, { amount: false });
  const amount = readDecimal(elements.expenseAmount.value);
  elements.expensePaid.value = rate > 0 && elements.expenseAmount.value !== '' ? formatDecimalInput(roundMoney(amount / rate)) : '';
}

function showRateHint() {
  if (!rateDetails.source) {
    elements.expenseExchangeRateHint.textContent = '';
    return;
  }
  elements.expenseExchangeRateHint.textContent = rateDetails.manual
    ? `Entered by hand for ${formatDate(rateDetails.rateDate)}.`
    : `${rateDetails.source}.`;
}

// Gets the ECB rate for the date of the expense.
export async function refreshExpenseExchangeRate() {
  const currency = currentCurrency();
  const bookCurrency = currentBookCurrency();
  const date = elements.expenseDate.value;
  syncExpenseCurrencyFields();
  if (currency === bookCurrency || !date || !canGetExchangeRates()) return;

  rateRequest += 1;
  const request = rateRequest;
  elements.expenseExchangeRateHint.textContent = 'Getting the exchange rate from the ECB…';
  const result = await getBookExchangeRate(currency, bookCurrency, date);
  if (request !== rateRequest) return;

  if (!result.ok) {
    elements.expenseExchangeRate.value = '';
    rateDetails = { rateDate: date, source: '', manual: true };
    elements.expenseExchangeRateHint.textContent = result.error;
    syncExpenseCurrencyFields();
    return;
  }

  elements.expenseExchangeRate.value = formatDecimalInput(result.rate, null);
  rateDetails = { rateDate: result.rateDate, source: result.source, manual: false };
  showRateHint();
  syncExpenseCurrencyFields();
}

export function attachExpenseCurrencyHandlers() {
  elements.expenseCurrency.addEventListener('change', () => {
    paidByHand = false;
    refreshExpenseExchangeRate();
  });
  elements.expenseDate.addEventListener('change', refreshExpenseExchangeRate);
  elements.expenseAmount.addEventListener('input', syncExpenseCurrencyFields);
  elements.expenseExchangeRate.addEventListener('input', () => {
    rateRequest += 1;
    rateDetails = { rateDate: elements.expenseDate.value, source: 'Entered by hand', manual: true };
    showRateHint();
    syncExpenseCurrencyFields();
  });
  elements.expensePaid.addEventListener('input', () => {
    paidByHand = elements.expensePaid.value !== '';
  });
}

export function resetExpenseCurrencyFields() {
  rateRequest += 1;
  rateDetails = { rateDate: '', source: '', manual: false };
  paidByHand = false;
  elements.expenseCurrency.value = currentBookCurrency();
  elements.expenseExchangeRate.value = '';
  elements.expenseExchangeRateHint.textContent = '';
  elements.expensePaid.value = '';
  syncExpenseCurrencyFields();
}

// Shows the currency, the rate and the amount paid of an expense that is edited. The rate is not fetched again.
export function loadExpenseCurrencyFields(expense) {
  const currency = expenseCurrency(expense);
  if (currency === currentBookCurrency()) {
    resetExpenseCurrencyFields();
    return;
  }

  rateRequest += 1;
  elements.expenseCurrency.value = currency;
  elements.expenseAmount.value = formatDecimalInput(expense.originalAmount ?? expense.amount ?? 0);
  elements.expenseExchangeRate.value = expense.exchangeRate?.rate ? formatDecimalInput(expense.exchangeRate.rate, null) : '';
  elements.expensePaid.value = formatDecimalInput(expense.amount || 0);
  paidByHand = true;
  rateDetails = {
    rateDate: expense.exchangeRate?.rateDate || '',
    source: expense.exchangeRate?.source || '',
    manual: Boolean(expense.exchangeRate?.manual),
  };
  showRateHint();
  syncExpenseCurrencyFields();
}

// The money fields of the form, ready to save on the expense. The amount is always in the book currency.
export function readExpenseCurrencyFields() {
  const currency = currentCurrency();
  const bookCurrency = currentBookCurrency();
  if (currency === bookCurrency) {
    return {
      amount: readDecimal(elements.expenseAmount.value),
      currency,
      bookCurrency,
      originalAmount: null,
      exchangeRate: null,
    };
  }

  const rate = readDecimal(elements.expenseExchangeRate.value, { amount: false });
  return {
    amount: roundMoney(readDecimal(elements.expensePaid.value)),
    currency,
    bookCurrency,
    originalAmount: roundMoney(readDecimal(elements.expenseAmount.value)),
    exchangeRate: rate > 0
      ? {
          rate: Number(rate.toPrecision(8)),
          rateDate: rateDetails.rateDate || elements.expenseDate.value,
          source: rateDetails.manual ? 'Entered by hand' : rateDetails.source,
          manual: rateDetails.manual,
        }
      : null,
  };
}

