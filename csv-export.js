import {
  state,
  elements,
  computedStatus,
  countsAsInvoiced,
  invoiceBookAmounts,
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
  groupByBookCurrency,
} from './state.js';
import { reportFigures } from './reports.js';

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

  const periodLabel = period === 'year' ? `Full year ${year}` : `Q${period} ${year}`;
  const fileSuffix = period === 'year' ? `${year}_full_year` : `${year}_Q${period}`;
  // Amounts in two book currencies cannot be added, so each book currency gets its own figures.
  const groups = groupByBookCurrency(financialReportInvoices, reportExpenses);

  const rows = [
    ['Metric', 'Value'],
    ['Year', year],
    ['Period', periodLabel],
  ];
  groups.forEach((group) => {
    const figures = reportFigures(group.invoices, group.expenses);
    rows.push(
      ['Book currency', group.currency],
      ['Net invoiced', figures.net],
      ['VAT invoiced', figures.vat],
      ['Gross invoiced', figures.gross],
      ['Received', figures.paid],
      ['Income', figures.income],
      ['Outstanding', figures.outstanding],
      ['Delinquent', figures.delinquent],
      ['Deductible expenses', figures.deductibleExpenses],
      ['Estimated net after deductible expenses', figures.estimatedNet],
    );
  });

  const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
  downloadFile(`report_${fileSuffix}.csv`, csv, 'text/csv;charset=utf-8');
}
