import {
  state,
  elements,
  computedStatus,
  formatCurrency,
  reportingCurrency,
  quarterFromDate,
  yearFromDate,
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

export function renderReportCharts({ filteredInvoices, financialInvoices, filteredExpenses, period }) {
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
    .reduce((sum, invoice) => sum + Number(invoice.total), 0);
  const openTotal = financialInvoices
    .filter((invoice) => ['draft', 'sent'].includes(computedStatus(invoice)))
    .reduce((sum, invoice) => sum + Number(invoice.total), 0);
  const overdueTotal = financialInvoices
    .filter((invoice) => computedStatus(invoice) === 'overdue')
    .reduce((sum, invoice) => sum + Number(invoice.total), 0);
  const delinquentTotal = financialInvoices
    .filter((invoice) => computedStatus(invoice) === 'delinquent')
    .reduce((sum, invoice) => sum + Number(invoice.total), 0);
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

  const currencyCode = reportingCurrency();
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
    invoicedByMonth[bucket] += Number(invoice.subtotal || 0);
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

export function runReport() {
  const year = Number(elements.reportYear.value);
  const period = elements.reportQuarter.value;

  const filteredInvoices = state.invoices.filter((invoice) => (
    yearFromDate(invoice.issueDate) === year
    && (period === 'year' || quarterFromDate(invoice.issueDate) === Number(period))
  ));
  const financialInvoices = filteredInvoices.filter((invoice) => computedStatus(invoice) !== 'aborted');

  const filteredExpenses = state.expenses.filter((expense) => (
    yearFromDate(expense.date) === year
    && (period === 'year' || quarterFromDate(expense.date) === Number(period))
  ));

  const net = financialInvoices.reduce((sum, invoice) => sum + Number(invoice.subtotal), 0);
  const vat = financialInvoices.reduce((sum, invoice) => sum + Number(invoice.vatAmount), 0);
  const gross = financialInvoices.reduce((sum, invoice) => sum + Number(invoice.total), 0);
  const paid = financialInvoices
    .filter((invoice) => computedStatus(invoice) === 'paid')
    .reduce((sum, invoice) => sum + Number(invoice.total), 0);
  const outstanding = financialInvoices
    .filter((invoice) => !['paid', 'delinquent'].includes(computedStatus(invoice)))
    .reduce((sum, invoice) => sum + Number(invoice.total), 0);
  const overdue = financialInvoices
    .filter((invoice) => computedStatus(invoice) === 'overdue')
    .reduce((sum, invoice) => sum + Number(invoice.total), 0);
  const delinquent = financialInvoices
    .filter((invoice) => computedStatus(invoice) === 'delinquent')
    .reduce((sum, invoice) => sum + Number(invoice.total), 0);
  const vatExposure = financialInvoices
    .filter((invoice) => computedStatus(invoice) !== 'paid')
    .reduce((sum, invoice) => sum + Number(invoice.vatAmount), 0);
  const deductibleExpenses = filteredExpenses
    .filter((expense) => expense.deductible === 'yes')
    .reduce((sum, expense) => sum + Number(expense.amount), 0);
  const allExpenses = filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const estimatedNet = net - deductibleExpenses;

  const currencyCode = reportingCurrency();
  const reportMoney = (value) => formatCurrency(value, currencyCode);

  const cards = [
    ['Reporting period', period === 'year' ? `Full year ${year}` : `Q${period} ${year}`],
    ['Reporting currency', currencyCode],
    ['Net invoiced', reportMoney(net)],
    ['VAT invoiced', reportMoney(vat)],
    ['Gross invoiced', reportMoney(gross)],
    ['Marked paid', reportMoney(paid)],
    ['Outstanding', reportMoney(outstanding)],
    ['Overdue', reportMoney(overdue)],
    ['Delinquent', reportMoney(delinquent)],
    ['VAT exposure', reportMoney(vatExposure)],
    ['All expenses', reportMoney(allExpenses)],
    ['Deductible expenses', reportMoney(deductibleExpenses)],
    ['Estimated net', reportMoney(estimatedNet)],
    ['Invoice count', String(financialInvoices.length)],
  ];

  elements.reportCards.innerHTML = cards.map(([label, value]) => `
    <article class="report-card">
      <span>${label}</span>
      <strong>${value}</strong>
    </article>
  `).join('');

  renderReportCharts({ filteredInvoices, financialInvoices, filteredExpenses, period });
}
