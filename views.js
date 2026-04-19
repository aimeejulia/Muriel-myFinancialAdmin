import {
  state,
  uiState,
  elements,
  euro,
  formatCurrency,
  reportingCurrency,
  clientCurrencyFor,
  computedStatus,
  displayInvoiceNumber,
  matchesDashboardPeriod,
  formatDashboardPeriodLabel,
  getClient,
} from './state.js';

function appendTextCell(row, text, className = '') {
  const cell = document.createElement('td');
  if (className) {
    cell.className = className;
  }
  cell.textContent = String(text ?? '');
  row.appendChild(cell);
  return cell;
}

function appendEmptyStateRow(tableBody, colSpan, message) {
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = colSpan;
  cell.className = 'empty-state';
  cell.textContent = message;
  row.appendChild(cell);
  tableBody.appendChild(row);
}

export function viewTitleFor(viewName) {
  const viewTitles = {
    dashboard: 'Dashboard',
    clients: 'Clients',
    invoices: 'Invoices',
    expenses: 'Expenses',
    reports: 'Reports',
    profile: 'Profile',
  };
  return viewTitles[viewName] || (viewName[0].toUpperCase() + viewName.slice(1));
}

export function showView(viewName) {
  const nextView = document.getElementById(`${viewName}-view`);
  const nextLink = document.querySelector(`.nav-link[data-view="${viewName}"]`);
  if (!nextView || !nextLink) {
    console.error('Could not switch view', viewName, { hasView: Boolean(nextView), hasLink: Boolean(nextLink) });
    return;
  }

  elements.views.forEach((view) => view.classList.remove('active'));
  elements.navLinks.forEach((link) => link.classList.remove('active'));
  nextView.classList.add('active');
  nextLink.classList.add('active');
  if (elements.pageTitle) {
    elements.pageTitle.textContent = viewTitleFor(viewName);
  }
}

export function renderClients() {
  elements.clientsTableBody.innerHTML = '';

  if (!state.clients.length) {
    appendEmptyStateRow(elements.clientsTableBody, 6, 'No clients yet.');
    return;
  }

  const sortedClients = [...state.clients].sort((a, b) => {
    const aNumber = Number(String(a?.displayId || '').match(/(\d+)$/)?.[1] || Number.MAX_SAFE_INTEGER);
    const bNumber = Number(String(b?.displayId || '').match(/(\d+)$/)?.[1] || Number.MAX_SAFE_INTEGER);

    if (aNumber !== bNumber) {
      return aNumber - bNumber;
    }

    return String(a?.name || '').localeCompare(String(b?.name || ''));
  });

  sortedClients.forEach((client) => {
    const row = document.createElement('tr');
    appendTextCell(row, client.displayId || '');
    appendTextCell(row, client.name || '');
    appendTextCell(row, client.contactName || '—');
    appendTextCell(row, client.vatNumber || '—');
    appendTextCell(row, `${client.defaultVatRate}%`);
    appendTextCell(row, clientCurrencyFor(client));
    elements.clientsTableBody.appendChild(row);
  });
}

export function renderExpenses() {
  elements.expensesTableBody.innerHTML = '';

  if (!state.expenses.length) {
    appendEmptyStateRow(elements.expensesTableBody, 6, 'No expenses yet.');
    return;
  }

  const sorted = [...state.expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
  sorted.forEach((expense) => {
    const row = document.createElement('tr');

    appendTextCell(row, expense.date || '');
    appendTextCell(row, expense.category || '');
    appendTextCell(row, euro(expense.amount));
    appendTextCell(row, expense.deductible || '');

    const receiptCell = document.createElement('td');
    if (expense.receiptDataUrl) {
      const receiptBtn = document.createElement('button');
      receiptBtn.className = 'chip-btn';
      receiptBtn.dataset.action = 'view-expense-receipt';
      receiptBtn.dataset.id = expense.id;
      receiptBtn.textContent = 'PDF';
      receiptCell.appendChild(receiptBtn);
    } else {
      receiptCell.textContent = '—';
    }
    row.appendChild(receiptCell);

    const actionsCell = document.createElement('td');
    const editBtn = document.createElement('button');
    editBtn.className = 'chip-btn';
    editBtn.dataset.action = 'edit-expense';
    editBtn.dataset.id = expense.id;
    editBtn.textContent = 'Edit';
    actionsCell.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'chip-btn';
    deleteBtn.dataset.action = 'delete-expense';
    deleteBtn.dataset.id = expense.id;
    deleteBtn.textContent = 'Delete';
    actionsCell.appendChild(deleteBtn);
    row.appendChild(actionsCell);

    elements.expensesTableBody.appendChild(row);
  });
}

export function renderInvoices() {
  elements.invoicesTableBody.innerHTML = '';
  const filter = elements.invoiceFilter.value;

  let invoices = [...state.invoices].sort((a, b) => {
    const diff = new Date(a.issueDate) - new Date(b.issueDate);
    return uiState.invoiceSortAsc ? diff : -diff;
  });
  if (filter !== 'all') {
    invoices = invoices.filter((invoice) => computedStatus(invoice) === filter);
  }

  if (!invoices.length) {
    appendEmptyStateRow(elements.invoicesTableBody, 5, 'No invoices in this view.');
    return;
  }

  invoices.forEach((invoice) => {
    const client = getClient(invoice.clientId);
    const status = computedStatus(invoice);
    const row = document.createElement('tr');

    const numberCell = document.createElement('td');
    const numberStrong = document.createElement('strong');
    numberStrong.textContent = displayInvoiceNumber(invoice);
    const numberBreak = document.createElement('br');
    const numberSmall = document.createElement('small');
    numberSmall.textContent = `Client ID ${client?.displayId || '—'}`;
    numberCell.appendChild(numberStrong);
    numberCell.appendChild(numberBreak);
    numberCell.appendChild(numberSmall);
    row.appendChild(numberCell);

    appendTextCell(row, client?.name || 'Unknown');

    const statusCell = document.createElement('td');
    const statusBadge = document.createElement('span');
    statusBadge.classList.add('badge', status);
    statusBadge.textContent = status;
    statusCell.appendChild(statusBadge);
    row.appendChild(statusCell);

    appendTextCell(row, formatCurrency(invoice.total, invoice.defaultCurrency || reportingCurrency()));

    const actionsCell = document.createElement('td');
    const actionsWrap = document.createElement('div');
    actionsWrap.className = 'invoice-actions';

    if (!['paid', 'aborted'].includes(status)) {
      const markPaidBtn = document.createElement('button');
      markPaidBtn.className = 'chip-btn';
      markPaidBtn.dataset.action = 'mark-paid';
      markPaidBtn.dataset.id = invoice.id;
      markPaidBtn.textContent = 'Mark paid';
      actionsWrap.appendChild(markPaidBtn);
    }

    const addActionBtn = (action, label) => {
      const button = document.createElement('button');
      button.className = 'invoice-row-action-btn';
      button.dataset.action = action;
      button.dataset.id = invoice.id;
      button.textContent = label;
      actionsWrap.appendChild(button);
    };

    if (status === 'draft') {
      addActionBtn('edit-invoice', 'Edit');
    }
    if (status !== 'paid') {
      addActionBtn('change-status', 'Status');
      addActionBtn('reminder', 'Reminder');
    }
    addActionBtn('preview-invoice', 'Preview');
    actionsCell.appendChild(actionsWrap);
    row.appendChild(actionsCell);

    elements.invoicesTableBody.appendChild(row);
  });
}

export function renderDashboard() {
  const periodInvoices = state.invoices.filter((invoice) => matchesDashboardPeriod(invoice.issueDate));
  const financialInvoices = periodInvoices.filter((invoice) => computedStatus(invoice) !== 'aborted');
  const periodExpenses = state.expenses
    .filter((expense) => matchesDashboardPeriod(expense.date))
    .reduce((sum, expense) => sum + Number(expense.amount), 0);
  const accruedNetIncome = financialInvoices.reduce((sum, invoice) => sum + Number(invoice.subtotal), 0) - periodExpenses;
  const realisedNetIncome = financialInvoices
    .filter((invoice) => computedStatus(invoice) === 'paid')
    .reduce((sum, invoice) => sum + Number(invoice.subtotal), 0) - periodExpenses;
  const outstanding = financialInvoices
    .filter((invoice) => !['paid', 'delinquent'].includes(computedStatus(invoice)))
    .reduce((sum, invoice) => sum + Number(invoice.subtotal), 0);
  const vatExposure = financialInvoices
    .filter((invoice) => computedStatus(invoice) !== 'paid')
    .reduce((sum, invoice) => sum + Number(invoice.vatAmount), 0);

  if (elements.dashboardPeriodLabel) {
    elements.dashboardPeriodLabel.textContent = formatDashboardPeriodLabel();
  }
  document.getElementById('metric-quarter-invoiced').textContent = euro(realisedNetIncome);
  document.getElementById('metric-received').textContent = euro(accruedNetIncome);
  document.getElementById('metric-outstanding').textContent = euro(outstanding);
  document.getElementById('metric-vat-exposure').textContent = euro(vatExposure);

  elements.overdueTableBody.innerHTML = '';
  const overdue = periodInvoices
    .filter((invoice) => computedStatus(invoice) === 'overdue')
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  if (!overdue.length) {
    appendEmptyStateRow(elements.overdueTableBody, 4, 'No overdue invoices right now.');
  } else {
    overdue.forEach((invoice) => {
      const client = getClient(invoice.clientId);
      const row = document.createElement('tr');
      appendTextCell(row, invoice.invoiceNumber || '');
      appendTextCell(row, client?.name || 'Unknown');
      appendTextCell(row, invoice.dueDate || '');
      appendTextCell(row, formatCurrency(invoice.total, invoice.defaultCurrency || reportingCurrency()));
      elements.overdueTableBody.appendChild(row);
    });
  }

  const statuses = ['draft', 'sent', 'overdue', 'delinquent', 'aborted', 'paid'];
  elements.statusSummary.innerHTML = '';
  statuses.forEach((status) => {
    const count = periodInvoices.filter((invoice) => computedStatus(invoice) === status).length;
    const row = document.createElement('button');
    row.className = 'status-row';
    row.type = 'button';
    row.dataset.status = status;

    const labelWrap = document.createElement('div');
    const label = document.createElement('strong');
    label.className = 'status-label';
    label.textContent = status[0].toUpperCase() + status.slice(1);
    const subtext = document.createElement('p');
    subtext.className = 'status-subtext';
    subtext.textContent = status === 'overdue'
      ? 'Needs follow-up fast.'
      : status === 'delinquent'
        ? 'Payment unlikely without escalation.'
        : status === 'aborted'
          ? 'Stopped before sending.'
          : 'Current invoice count.';
    labelWrap.appendChild(label);
    labelWrap.appendChild(subtext);

    const countSpan = document.createElement('span');
    countSpan.className = 'status-count';
    countSpan.textContent = String(count);

    row.appendChild(labelWrap);
    row.appendChild(countSpan);
    elements.statusSummary.appendChild(row);
  });
}

export function closeInvoiceRowMenus(exceptMenu = null) {
  document.querySelectorAll('.invoice-row-menu[open]').forEach((menu) => {
    if (menu !== exceptMenu) {
      menu.open = false;
    }
  });
}
