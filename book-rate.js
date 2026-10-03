// Gets the ECB rate of a currency for the books: units of the currency for one unit of the book currency.
// For two currencies that are not the euro, the rate is the cross rate of their euro rates.
export async function getBookExchangeRate(currency, bookCurrency, date) {
  const [currencyRate, bookRate] = await Promise.all([
    window.desktopStore.getExchangeRate(currency, date),
    window.desktopStore.getExchangeRate(bookCurrency, date),
  ]);

  const failed = [currencyRate, bookRate].find((result) => !result?.ok);
  if (failed) {
    return { ok: false, error: failed?.error || 'Could not get the exchange rate. Enter the rate by hand.' };
  }

  return {
    ok: true,
    rate: Number((currencyRate.rate / bookRate.rate).toPrecision(8)),
    rateDate: currencyRate.rateDate,
    source: bookCurrency === 'EUR' || currency === 'EUR'
      ? (currency === 'EUR' ? bookRate.source : currencyRate.source)
      : `Cross rate of the ECB reference rates of ${currencyRate.rateDate}`,
  };
}

export function canGetExchangeRates() {
  return typeof window.desktopStore?.getExchangeRate === 'function';
}
