import {
  state,
  elements,
  computedStatus,
  countsAsInvoiced,
  invoiceBookAmounts,
  invoiceIncome,
  invoiceReceivedAmount,
  formatCurrency,
  bookCurrencyOn,
  bookCurrencyPeriods,
  groupByBookCurrency,
  addDaysISO,
  quarterFromDate,
  yearFromDate,
  formatDate,
} from './state.js';

let reportStatusChart = null;
let reportCashflowChart = null;
let reportIncomeChart = null;

export function destroyReportCharts() {
  if (reportStatusChart) {
    reportStatusChart.destroy();
    reportStatusChart = null;
  }
  if (reportCashflowChart) {
    reportCashflowChart.destroy();
    reportCashflowChart = null;
  }
  if (reportIncomeChart) {
    reportIncomeChart.destroy();
    reportIncomeChart = null;
  }
}

export function setReportChartsEmpty(message = '') {
  if (!message) {
    elements.reportChartsEmpty.hidden = true;
    elements.reportChartsEmpty.textContent = '';
    return;
  }
  elements.reportChartsEmpty.hidden = false;
  elements.reportChartsEmpty.textContent = message;
}

export function renderReportCharts({ filteredInvoices, financialInvoices, filteredExpenses, period, currencyCode }) {
  if (!elements.reportStatusChartCanvas || !elements.reportCashflowChartCanvas || !elements.reportIncomeChartCanvas) return;

  const ChartLib = globalThis.Chart;
  if (!ChartLib) {
    destroyReportCharts();
    setReportChartsEmpty('Charts could not load right now. Please reopen the app and try again.');
    return;
  }

  const statusLabels = ['Draft', 'Sent', 'Overdue', 'Delinquent', 'Paid', 'Aborted'];
  const statusKeys = ['draft', 'sent', 'overdue', 'delinquent', 'paid', 'aborted'];
  const statusCounts = statusKeys.map((status) => filteredInvoices.filter((invoice) => computedStatus(invoice) === status).length);

  const paidTotal = financialInvoices
    .filter((invoice) => computedStatus(invoice) === 'paid')
    .reduce((sum, invoice) => sum + invoiceReceivedAmount(invoice), 0);
  const openTotal = financialInvoices
    .filter((invoice) => computedStatus(invoice) === 'sent')
    .reduce((sum, invoice) => sum + Number(invoiceBookAmounts(invoice).total), 0);
  const overdueTotal = financialInvoices
    .filter((invoice) => computedStatus(invoice) === 'overdue')
    .reduce((sum, invoice) => sum + Number(invoiceBookAmounts(invoice).total), 0);
  const delinquentTotal = financialInvoices
    .filter((invoice) => computedStatus(invoice) === 'delinquent')
    .reduce((sum, invoice) => sum + Number(invoiceBookAmounts(invoice).total), 0);
  const allExpenses = filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

  const hasData = statusCounts.some((count) => count > 0)
    || [paidTotal, openTotal, overdueTotal, delinquentTotal, allExpenses].some((value) => value > 0);
  if (!hasData) {
    destroyReportCharts();
    setReportChartsEmpty('No data for this reporting period yet. Add invoices or expenses to see charts.');
    return;
  }

  setReportChartsEmpty('');
  destroyReportCharts();

  const reportMoney = (value) => formatCurrency(value, currencyCode);

  reportStatusChart = new ChartLib(elements.reportStatusChartCanvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: statusLabels,
      datasets: [{
        label: 'Invoices',
        data: statusCounts,
        backgroundColor: ['#94a3b8', '#60a5fa', '#f59e0b', '#ef4444', '#34d399', '#d1d5db'],
        borderRadius: 10,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0, color: '#64748b' },
          grid: { color: '#e2e8f0' },
        },
        x: {
          ticks: { color: '#64748b' },
          grid: { display: false },
        },
      },
    },
  });

  reportCashflowChart = new ChartLib(elements.reportCashflowChartCanvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['Paid', 'Open', 'Overdue', 'Delinquent', 'Expenses'],
      datasets: [{
        data: [paidTotal, openTotal, overdueTotal, delinquentTotal, allExpenses],
        backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a78bfa'],
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 12,
            color: '#475569',
          },
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.label}: ${reportMoney(context.parsed)}`,
          },
        },
      },
    },
  });

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const quarterMonths = {
    1: [0, 1, 2],
    2: [3, 4, 5],
    3: [6, 7, 8],
    4: [9, 10, 11],
  };
  const monthIndexes = period === 'year'
    ? Array.from({ length: 12 }, (_, index) => index)
    : (quarterMonths[String(period)] || [0, 1, 2]);
  const labels = monthIndexes.map((index) => monthNames[index]);
  const invoicedByMonth = monthIndexes.map(() => 0);
  const expensesByMonth = monthIndexes.map(() => 0);
  const monthToIndexMap = new Map(monthIndexes.map((monthIndex, position) => [monthIndex, position]));

  financialInvoices.forEach((invoice) => {
    const monthIndex = new Date(`${invoice.issueDate}T00:00:00`).getMonth();
    const bucket = monthToIndexMap.get(monthIndex);
    if (bucket === undefined) return;
    invoicedByMonth[bucket] += Number(invoiceBookAmounts(invoice).subtotal || 0);
  });

  filteredExpenses.forEach((expense) => {
    const monthIndex = new Date(`${expense.date}T00:00:00`).getMonth();
    const bucket = monthToIndexMap.get(monthIndex);
    if (bucket === undefined) return;
    expensesByMonth[bucket] += Number(expense.amount || 0);
  });

  const netByMonth = invoicedByMonth.map((value, index) => value - expensesByMonth[index]);

  reportIncomeChart = new ChartLib(elements.reportIncomeChartCanvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Net invoiced',
          data: invoicedByMonth,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.18)',
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.35,
        },
        {
          label: 'Expenses',
          data: expensesByMonth,
          borderColor: '#a855f7',
          backgroundColor: 'rgba(168, 85, 247, 0.18)',
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.35,
        },
        {
          label: 'Estimated net',
          data: netByMonth,
          borderColor: '#16a34a',
          backgroundColor: 'rgba(22, 163, 74, 0.16)',
          borderDash: [6, 4],
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.35,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 12,
            color: '#475569',
          },
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.dataset.label}: ${reportMoney(context.parsed.y)}`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: '#64748b',
            callback: (value) => reportMoney(value),
          },
          grid: { color: '#e2e8f0' },
        },
        x: {
          ticks: { color: '#64748b' },
          grid: { display: false },
        },
      },
    },
  });
}

// The report figures of invoices and expenses in one book currency.
// The figures of invoices and expenses in one book currency. Received is the money that arrived in the period, so
// it counts the payments by payment date. Without payments, it counts the paid invoices of the list.
export function reportFigures(financialInvoices, expenses, payments = null) {
  const bookTotal = (status) => financialInvoices
    .filter((invoice) => computedStatus(invoice) === status)
    .reduce((sum, invoice) => sum + Number(invoiceBookAmounts(invoice).total), 0);
  const net = financialInvoices.reduce((sum, invoice) => sum + Number(invoiceBookAmounts(invoice).subtotal), 0);
  const vat = financialInvoices.reduce((sum, invoice) => sum + Number(invoiceBookAmounts(invoice).vatAmount), 0);
  const gross = financialInvoices.reduce((sum, invoice) => sum + Number(invoiceBookAmounts(invoice).total), 0);
  const paid = (payments ?? financialInvoices.filter((invoice) => computedStatus(invoice) === 'paid'))
    .reduce((sum, invoice) => sum + invoiceReceivedAmount(invoice), 0);
  // Paid invoices count the euros that arrived, less VAT. Invoices that are not paid count the estimate.
  const income = financialInvoices.reduce((sum, invoice) => sum + invoiceIncome(invoice), 0);
  const outstanding = financialInvoices
    .filter((invoice) => !['paid', 'delinquent'].includes(computedStatus(invoice)))
    .reduce((sum, invoice) => sum + Number(invoiceBookAmounts(invoice).total), 0);
  const vatExposure = financialInvoices
    .filter((invoice) => computedStatus(invoice) !== 'paid')
    .reduce((sum, invoice) => sum + Number(invoiceBookAmounts(invoice).vatAmount), 0);
  const deductibleExpenses = expenses
    .filter((expense) => expense.deductible === 'yes')
    .reduce((sum, expense) => sum + Number(expense.amount), 0);
  const allExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  return {
    net,
    vat,
    gross,
    paid,
    income,
    outstanding,
    overdue: bookTotal('overdue'),
    delinquent: bookTotal('delinquent'),
    vatExposure,
    deductibleExpenses,
    allExpenses,
    estimatedNet: income - deductibleExpenses,
  };
}

function periodStart(year, period) {
  return period === 'year' ? `${year}-01-01` : `${year}-${String((Number(period) - 1) * 3 + 1).padStart(2, '0')}-01`;
}

function periodEnd(year, period) {
  return period === 'year' ? `${year}-12-31` : `${year}-${String(Number(period) * 3).padStart(2, '0')}-${['31', '30', '30', '31'][Number(period) - 1]}`;
}

// The parts of the report period in which a book currency was in force, for example "2026-04-01 to 2026-12-31".
export function bookCurrencyRangesText(currency, year, period) {
  const start = periodStart(year, period);
  const end = periodEnd(year, period);
  const periods = bookCurrencyPeriods();
  const ranges = periods
    .map((bookPeriod, index) => {
      const next = periods[index + 1];
      return {
        currency: bookPeriod.currency,
        from: bookPeriod.from > start ? bookPeriod.from : start,
        to: next && addDaysISO(next.from, -1) < end ? addDaysISO(next.from, -1) : end,
      };
    })
    .filter((range) => range.currency === currency && range.from <= range.to);
  return ranges.map((range) => `${formatDate(range.from)} to ${formatDate(range.to)}`).join(' and ');
}

// The paid invoices with a payment date in the period, whatever their issue date.
export function paymentsInPeriod(year, period) {
  return state.invoices.filter((invoice) => (
    countsAsInvoiced(invoice)
    && computedStatus(invoice) === 'paid'
    && yearFromDate(invoice.paidDate) === year
    && (period === 'year' || quarterFromDate(invoice.paidDate) === Number(period))
  ));
}

export function runReport() {
  const year = Number(elements.reportYear.value);
  const period = elements.reportQuarter.value;

  const filteredInvoices = state.invoices.filter((invoice) => (
    yearFromDate(invoice.issueDate) === year
    && (period === 'year' || quarterFromDate(invoice.issueDate) === Number(period))
  ));
  const financialInvoices = filteredInvoices.filter(countsAsInvoiced);

  const filteredExpenses = state.expenses.filter((expense) => (
    yearFromDate(expense.date) === year
    && (period === 'year' || quarterFromDate(expense.date) === Number(period))
  ));

  const fallbackCurrency = bookCurrencyOn(periodEnd(year, period));
  const groups = groupByBookCurrency(financialInvoices, filteredExpenses, fallbackCurrency, paymentsInPeriod(year, period));
  const periodLabel = period === 'year' ? `Full year ${year}` : `Q${period} ${year}`;
  const cardHtml = ([label, value]) => `
    <article class="report-card">
      <span>${label}</span>
      <strong>${value}</strong>
    </article>
  `;

  const sections = groups.map((group) => {
    const figures = reportFigures(group.invoices, group.expenses, group.payments);
    const reportMoney = (value) => formatCurrency(value, group.currency);
    const cards = [
      ['Reporting currency', group.currency],
      ['Net invoiced', reportMoney(figures.net)],
      ['VAT invoiced', reportMoney(figures.vat)],
      ['Gross invoiced', reportMoney(figures.gross)],
      ['Received', reportMoney(figures.paid)],
      ['Income', reportMoney(figures.income)],
      ['Outstanding', reportMoney(figures.outstanding)],
      ['Overdue', reportMoney(figures.overdue)],
      ['Delinquent', reportMoney(figures.delinquent)],
      ['VAT exposure', reportMoney(figures.vatExposure)],
      ['All expenses', reportMoney(figures.allExpenses)],
      ['Deductible expenses', reportMoney(figures.deductibleExpenses)],
      ['Estimated net', reportMoney(figures.estimatedNet)],
      ['Invoice count', String(group.invoices.length)],
    ];
    const title = groups.length > 1
      ? `<h4 class="report-group-title">${group.currency} books: ${bookCurrencyRangesText(group.currency, year, period)}</h4>`
      : '';
    return title + cards.map(cardHtml).join('');
  });

  elements.reportCards.innerHTML = cardHtml(['Reporting period', periodLabel]) + sections.join('');

  // The charts add up amounts, so they show one book currency: the one at the end of the period.
  const chartGroup = groups[groups.length - 1];
  renderReportCharts({
    filteredInvoices,
    financialInvoices: chartGroup.invoices,
    filteredExpenses: chartGroup.expenses,
    period,
    currencyCode: chartGroup.currency,
  });
  if (groups.length > 1 && !elements.reportChartsEmpty.textContent) {
    setReportChartsEmpty(`The charts show the ${chartGroup.currency} books only. The totals above show each book currency.`);
  }
}
