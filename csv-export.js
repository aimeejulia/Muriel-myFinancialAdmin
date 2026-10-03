import {
  state,
  elements,
  computedStatus,
  countsAsInvoiced,
  getClient,
  downloadFile,
  escapeCsv,
  quarterFromDate,
  yearFromDate,
} from './state.js';

export function exportInvoicesCsv() {
  const rows = [
    ['Invoice Number', 'Client ID', 'Client Name', 'Issue Date', 'Due Date', 'Status', 'Subtotal', 'VAT Rate', 'VAT Amount', 'Total', 'Paid Date'],
  ];

  state.invoices.forEach((invoice) => {
    const client = getClient(invoice.clientId);
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
    ]);
  });

  const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
  downloadFile('invoices_export.csv', csv, 'text/csv;charset=utf-8');
}

export function exportExpensesCsv() {
  const rows = [
    ['Date', 'Category', 'Amount', 'Deductible', 'Note'],
  ];

  state.expenses.forEach((expense) => {
    rows.push([
      expense.date,
      expense.category,
      expense.amount,
      expense.deductible,
      expense.note || '',
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

  const netInvoiced = financialReportInvoices.reduce((sum, invoice) => sum + Number(invoice.subtotal), 0);
  const vatInvoiced = financialReportInvoices.reduce((sum, invoice) => sum + Number(invoice.vatAmount), 0);
  const grossInvoiced = financialReportInvoices.reduce((sum, invoice) => sum + Number(invoice.total), 0);
  const paid = financialReportInvoices.filter((invoice) => computedStatus(invoice) === 'paid').reduce((sum, invoice) => sum + Number(invoice.total), 0);
  const outstanding = financialReportInvoices.filter((invoice) => !['paid', 'delinquent'].includes(computedStatus(invoice))).reduce((sum, invoice) => sum + Number(invoice.total), 0);
  const delinquent = financialReportInvoices.filter((invoice) => computedStatus(invoice) === 'delinquent').reduce((sum, invoice) => sum + Number(invoice.total), 0);
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
    ['Marked paid', paid],
    ['Outstanding', outstanding],
    ['Delinquent', delinquent],
    ['Deductible expenses', deductibleExpenses],
    ['Estimated net after deductible expenses', netInvoiced - deductibleExpenses],
  ];

  const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
  downloadFile(`report_${fileSuffix}.csv`, csv, 'text/csv;charset=utf-8');
}
