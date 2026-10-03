import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDataDir, removeDataDir, writeStateFile, sampleState, sampleClient, sampleInvoice, launchApp, waitFor, assertRealDataUntouched,
} from './helpers.mjs';

let dataDir;

beforeEach(() => {
  dataDir = createDataDir();
  writeStateFile(dataDir, sampleState({
    clients: [{ ...sampleClient, preferredPaymentMethodId: 'method-1' }],
    invoices: [{ ...sampleInvoice, issuerType: 'business', issuerBusinessId: 'business-1', paymentMethodId: 'method-1' }],
    profile: {
      legalName: 'Ann Example',
      businesses: [{ id: 'business-1', name: 'Studio Example', website: '', contactEmail: '' }],
      paymentMethods: [{ id: 'method-1', label: 'Bank transfer', type: 'IBAN', details: 'ES00 0000', includeByDefault: true }],
    },
  }));
});

afterEach(async () => {
  await removeDataDir(dataDir);
  assertRealDataUntouched();
});

// Answers the confirm question with the given answer and keeps the questions.
const answerConfirm = (answer) => `window.questions = []; window.confirm = (question) => { window.questions.push(question); return ${answer}; }; true`;
const savedProfile = `import('./state.js').then((module) => ({
  businesses: module.state.profile.businesses.map((business) => business.id),
  methods: module.state.profile.paymentMethods.map((method) => method.id),
}))`;

test('removing a business asks first and names what changes', async () => {
  const app = await launchApp(dataDir);
  try {
    await app.evaluate(answerConfirm(false));
    await app.evaluate(`document.querySelector('#business-name-list button[data-action="remove-business"]').click(); true`);
    assert.deepEqual(await app.evaluate('window.questions'), [
      'Remove the business "Studio Example"? 1 invoice(s) use it as the sender. Their PDFs will show your legal name instead.',
    ]);
    assert.deepEqual((await app.evaluate(savedProfile)).businesses, ['business-1']);

    await app.evaluate(answerConfirm(true));
    await app.evaluate(`document.querySelector('#business-name-list button[data-action="remove-business"]').click(); true`);
    assert.deepEqual(await waitFor(async () => (await app.evaluate(savedProfile)).businesses.length === 0 && []), []);
  } finally {
    await app.stop();
  }
});

test('removing a payment method asks first and names what changes', async () => {
  const app = await launchApp(dataDir);
  try {
    await app.evaluate(answerConfirm(false));
    await app.evaluate(`document.querySelector('#payment-method-list button[data-action="remove-payment-method"]').click(); true`);
    assert.deepEqual(await app.evaluate('window.questions'), [
      'Remove the payment method "Bank transfer"? 1 client(s) and 1 invoice(s) use it. They will use the default methods instead.',
    ]);
    assert.deepEqual((await app.evaluate(savedProfile)).methods, ['method-1']);

    await app.evaluate(answerConfirm(true));
    await app.evaluate(`document.querySelector('#payment-method-list button[data-action="remove-payment-method"]').click(); true`);
    assert.deepEqual(await waitFor(async () => (await app.evaluate(savedProfile)).methods.length === 0 && []), []);
  } finally {
    await app.stop();
  }
});
