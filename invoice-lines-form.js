import {
  elements,
  attachDecimalInputs,
  formatCurrency,
  formatDecimalInput,
  lineAmount,
  readDecimal,
  reportingCurrency,
} from './state.js';

// Called when a line changes, so the form can show the new totals.
let onLinesChange = () => {};

function currentCurrency() {
  return elements.invoiceCurrency.value || reportingCurrency();
}

function lineRows() {
  return [...elements.invoiceLinesBody.querySelectorAll('tr')];
}

function readRow(row) {
  return {
    description: row.querySelector('[name="lineDescription"]').value.trim(),
    quantity: readDecimal(row.querySelector('[name="lineQuantity"]').value, { amount: false }),
    unitPrice: readDecimal(row.querySelector('[name="lineUnitPrice"]').value),
  };
}

function cellWithInput(name, label, attributes) {
  const cell = document.createElement('td');
  const input = document.createElement('input');
  input.name = name;
  input.setAttribute('aria-label', label);
  Object.entries(attributes).forEach(([key, value]) => input.setAttribute(key, value));
  cell.appendChild(input);
  return cell;
}

// Shows the amount of each line and the right labels. One line cannot be removed.
export function syncInvoiceLines() {
  const currency = currentCurrency();
  elements.invoiceUnitPriceLabel.textContent = `Unit price (${currency})`;
  const rows = lineRows();
  rows.forEach((row, index) => {
    const line = readRow(row);
    const amount = Number.isFinite(line.quantity) && Number.isFinite(line.unitPrice) ? lineAmount(line) : 0;
    row.querySelector('.invoice-line-amount').textContent = formatCurrency(amount, currency);
    const remove = row.querySelector('.invoice-line-remove');
    remove.disabled = rows.length === 1;
    remove.setAttribute('aria-label', `Remove line ${index + 1}`);
  });
}

function addLineRow({ description = '', quantity = 1, unitPrice = '' } = {}) {
  const row = document.createElement('tr');
  row.appendChild(cellWithInput('lineDescription', 'Description', {
    type: 'text', required: '', placeholder: 'e.g. Website maintenance for April 2026', value: description,
  }));
  row.appendChild(cellWithInput('lineQuantity', 'Quantity', {
    type: 'text', inputmode: 'decimal', 'data-decimal': 'number', required: '', value: formatDecimalInput(quantity, null),
  }));
  row.appendChild(cellWithInput('lineUnitPrice', 'Unit price', {
    type: 'text', inputmode: 'decimal', 'data-decimal': 'amount', required: '',
    value: unitPrice === '' ? '' : formatDecimalInput(unitPrice),
  }));

  const amountCell = document.createElement('td');
  amountCell.className = 'invoice-line-amount nowrap-cell';
  row.appendChild(amountCell);

  const removeCell = document.createElement('td');
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'invoice-row-action-btn invoice-line-remove';
  remove.textContent = 'Remove';
  removeCell.appendChild(remove);
  row.appendChild(removeCell);

  attachDecimalInputs(row);
  elements.invoiceLinesBody.appendChild(row);
  return row;
}

// Fills the form with the lines of an invoice, or with one empty line.
export function setInvoiceLines(lines = []) {
  elements.invoiceLinesBody.innerHTML = '';
  (lines.length ? lines : [{}]).forEach((line) => addLineRow(line));
  syncInvoiceLines();
}

// The lines of the form, ready to save on the invoice.
export function readInvoiceLines() {
  return lineRows().map(readRow);
}

export function attachInvoiceLineHandlers(onChange) {
  onLinesChange = onChange;
  elements.addInvoiceLineBtn.addEventListener('click', () => {
    const row = addLineRow();
    syncInvoiceLines();
    row.querySelector('[name="lineDescription"]').focus();
  });
  elements.invoiceLinesBody.addEventListener('input', () => {
    syncInvoiceLines();
    onLinesChange();
  });
  elements.invoiceLinesBody.addEventListener('click', (event) => {
    const remove = event.target.closest('.invoice-line-remove');
    if (!remove || lineRows().length === 1) return;
    const row = remove.closest('tr');
    const next = row.nextElementSibling || row.previousElementSibling;
    row.remove();
    syncInvoiceLines();
    onLinesChange();
    next?.querySelector('[name="lineDescription"]').focus();
  });
}
