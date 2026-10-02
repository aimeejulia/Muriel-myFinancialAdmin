import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// state.js looks up DOM elements when it loads, so give it an empty document
globalThis.window = {};
globalThis.document = {
  getElementById: () => null,
  querySelectorAll: () => [],
  createElement: () => ({}),
};

const {
  state,
  todayISO,
  addDaysISO,
  yearFromDate,
  quarterFromDate,
  computedStatus,
  buildInvoiceNumber,
} = await import('../state.js');

const TIME_ZONES = ['UTC', 'Europe/Madrid', 'America/New_York', 'Pacific/Auckland'];
const originalTimeZone = process.env.TZ;

afterEach(() => {
  mock.timers.reset();
  process.env.TZ = originalTimeZone;
  state.invoices = [];
});

function atLocalTime(timeZone, localDateTime) {
  process.env.TZ = timeZone;
  mock.timers.enable({ apis: ['Date'], now: new Date(localDateTime).getTime() });
}

for (const timeZone of TIME_ZONES) {
  test(`today is the local date just after midnight (${timeZone})`, () => {
    atLocalTime(timeZone, '2026-10-02T00:30:00');

    assert.equal(todayISO(), '2026-10-02');
  });

  test(`today is the local date just before midnight (${timeZone})`, () => {
    atLocalTime(timeZone, '2026-10-02T23:30:00');

    assert.equal(todayISO(), '2026-10-02');
  });

  test(`year and quarter come from the date as written (${timeZone})`, () => {
    process.env.TZ = timeZone;

    assert.equal(yearFromDate('2026-01-01'), 2026);
    assert.equal(yearFromDate('2025-12-31'), 2025);
    assert.equal(quarterFromDate('2026-04-01'), 2);
    assert.equal(quarterFromDate('2026-03-31'), 1);
    assert.equal(quarterFromDate('2026-12-31'), 4);
  });

  test(`invoice numbers use the year and month of the issue date (${timeZone})`, () => {
    process.env.TZ = timeZone;

    assert.equal(buildInvoiceNumber('2026-01-01'), 'INV-2026-01-001');
    assert.equal(buildInvoiceNumber('2025-12-31'), 'INV-2025-12-001');
  });

  test(`an invoice is overdue only after its due date (${timeZone})`, () => {
    atLocalTime(timeZone, '2026-03-10T00:30:00');

    assert.equal(computedStatus({ status: 'sent', dueDate: '2026-03-10' }), 'sent');
    assert.equal(computedStatus({ status: 'sent', dueDate: '2026-03-09' }), 'overdue');
  });

  test(`adding days keeps the date across daylight saving changes (${timeZone})`, () => {
    process.env.TZ = timeZone;

    assert.equal(addDaysISO('2026-10-20', 14), '2026-11-03');
    assert.equal(addDaysISO('2026-03-20', 14), '2026-04-03');
    assert.equal(addDaysISO('2026-12-25', 14), '2027-01-08');
  });
}

test('the invoice sequence counts only invoices from the same month', () => {
  process.env.TZ = 'America/New_York';
  state.invoices = [
    { id: '1', invoiceNumber: 'INV-2026-01-001', issueDate: '2026-01-01', status: 'sent' },
    { id: '2', invoiceNumber: 'INV-2025-12-001', issueDate: '2025-12-31', status: 'sent' },
  ];

  assert.equal(buildInvoiceNumber('2026-01-15'), 'INV-2026-01-002');
  assert.equal(buildInvoiceNumber('2025-12-01'), 'INV-2025-12-002');
});

test('an invoice without a due date is not overdue', () => {
  assert.equal(computedStatus({ status: 'sent', dueDate: '' }), 'sent');
});
