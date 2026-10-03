import {
  state,
  elements,
  computedStatus,
  countsAsInvoiced,
  invoiceBookAmounts,
  invoiceIncome,
  invoiceReceivedAmount,
  invoiceBookCurrency,
  invoiceCurrency,
  getClient,
  downloadFile,
  escapeCsv,
  quarterFromDate,
  yearFromDate,
  expenseBookCurrency,
  expenseCurrency,
} from './state.js';

export function exportInvoicesCsv() {
  const rows = [
    [
      'Invoice Number', 'Client ID', 'Client Name', 'Issue Date', 'Due Date', 'Status', 'Subtotal', 'VAT Rate', 'VAT Amount', 'Total', 'Paid Date',
      'Currency', 'Book Currency', 'Exchange Rate', 'Rate Date', 'Book Subtotal', 'Book VAT Amount', 'Book Total', 'Received',
    ],
  ];

  state.invoices.forEach((invoice) => {
    const client = getClient(invoice.clientId);
    const bookAmounts = invoiceBookAmounts(invoice);
    rows.push([
      invoice.invoiceNumber,
      client?.displayId || '',
      client?.name || '',
      invoice.issueDate,
      invoice.dueDate,
      computedStatus(invoice),
      invoice.subtotal,
      invoice.vatRate,
      invoice.vatAmount,
      invoice.total,
      invoice.paidDate || '',
      invoiceCurrency(invoice),
      invoiceBookCurrency(invoice),
      invoice.exchangeRate?.rate ?? 1,
      invoice.exchangeRate?.rateDate || '',
      bookAmounts.subtotal,
      bookAmounts.vatAmount,
      bookAmounts.total,
      computedStatus(invoice) === 'paid' ? invoiceReceivedAmount(invoice) : '',
    ]);
  });

  const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
  downloadFile('invoices_export.csv', csv, 'text/csv;charset=utf-8');
}

export function exportExpensesCsv() {
  const rows = [
    ['Date', 'Category', 'Amount', 'Deductible', 'Note', 'Currency', 'Book Currency', 'Original Amount', 'Exchange Rate', 'Rate Date'],
  ];

  state.expenses.forEach((expense) => {
    rows.push([
      expense.date,
      expense.category,
      expense.amount,
      expense.deductible,
      expense.note || '',
      expenseCurrency(expense),
      expenseBookCurrency(expense),
      expense.originalAmount ?? expense.amount,
      expense.exchangeRate?.rate ?? 1,
      expense.exchangeRate?.rateDate || '',
    ]);
  });

  const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
  downloadFile('expenses_export.csv', csv, 'text/csv;charset=utf-8');
}

export function exportReportCsv() {
  const year = Number(elements.reportYear.value);
  const period = elements.reportQuarter.value;

  const reportInvoices = state.invoices.filter((invoice) => (
    yearFromDate(invoice.issueDate) === year
    && (period === 'year' || quarterFromDate(invoice.issueDate) === Number(period))
  ));
  const financialReportInvoices = reportInvoices.filter(countsAsInvoiced);

  const reportExpenses = state.expenses.filter((expense) => (
    yearFromDate(expense.date) === year
    && (period === 'year' || quarterFromDate(expense.date) === Number(period))
  ));

  const netInvoiced = financialReportInvoices.reduce((sum, invoice) => sum + Number(invoiceBookAmounts(invoice).subtotal), 0);
  const vatInvoiced = financialReportInvoices.reduce((sum, invoice) => sum + Number(invoiceBookAmounts(invoice).vatAmount), 0);
  const grossInvoiced = financialReportInvoices.reduce((sum, invoice) => sum + Number(invoiceBookAmounts(invoice).total), 0);
  const paid = financialReportInvoices.filter((invoice) => computedStatus(invoice) === 'paid').reduce((sum, invoice) => sum + invoiceReceivedAmount(invoice), 0);
  const income = financialReportInvoices.reduce((sum, invoice) => sum + invoiceIncome(invoice), 0);
  const outstanding = financialReportInvoices.filter((invoice) => !['paid', 'delinquent'].includes(computedStatus(invoice))).reduce((sum, invoice) => sum + Number(invoiceBookAmounts(invoice).total), 0);
  const delinquent = financialReportInvoices.filter((invoice) => computedStatus(invoice) === 'delinquent').reduce((sum, invoice) => sum + Number(invoiceBookAmounts(invoice).total), 0);
  const deductibleExpenses = reportExpenses.filter((expense) => expense.deductible === 'yes').reduce((sum, expense) => sum + Number(expense.amount), 0);
  const periodLabel = period === 'year' ? `Full year ${year}` : `Q${period} ${year}`;
  const fileSuffix = period === 'year' ? `${year}_full_year` : `${year}_Q${period}`;

  const rows = [
    ['Metric', 'Value'],
    ['Year', year],
    ['Period', periodLabel],
    ['Net invoiced', netInvoiced],
    ['VAT invoiced', vatInvoiced],
    ['Gross invoiced', grossInvoiced],
    ['Received', paid],
    ['Income', income],
    ['Outstanding', outstanding],
    ['Delinquent', delinquent],
    ['Deductible expenses', deductibleExpenses],
    ['Estimated net after deductible expenses', income - deductibleExpenses],
  ];

  const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
  downloadFile(`report_${fileSuffix}.csv`, csv, 'text/csv;charset=utf-8');
}
