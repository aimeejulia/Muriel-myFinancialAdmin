import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDataDir, removeDataDir, writeStateFile, sampleState, sampleClient, launchApp, waitFor, assertRealDataUntouched,
} from './helpers.mjs';

let dataDir;
const panel = `(() => ({
  visible: !document.getElementById('setup-panel').hidden,
  steps: [...document.querySelectorAll('#setup-steps li')].map((item) => ({
    done: item.classList.contains('done'),
    action: item.querySelector('button')?.textContent || '',
  })),
}))()`;

beforeEach(() => {
  dataDir = createDataDir();
  writeStateFile(dataDir, { clients: [], invoices: [], expenses: [] });
});

afterEach(async () => {
  await removeDataDir(dataDir);
  assertRealDataUntouched();
});

test('a new user sees the first steps, and each step opens its page', async () => {
  const app = await launchApp(dataDir);
  try {
    assert.deepEqual(await app.evaluate(panel), {
      visible: true,
      steps: [
        { done: false, action: 'Open Profile' },
        { done: false, action: 'Add payment method' },
        { done: false, action: 'Add client' },
        { done: false, action: 'New invoice' },
      ],
    });

    const opened = await app.evaluate(`(() => {
      document.querySelector('#setup-steps button[data-setup-step="client"]').click();
      return { view: document.querySelector('.nav-link.active').dataset.view, focus: document.activeElement.id };
    })()`);
    assert.deepEqual(opened, { view: 'clients', focus: 'clientName' });

    await app.evaluate(`(() => {
      document.getElementById('clientName').value = 'First client';
      document.getElementById('client-form').requestSubmit();
      document.querySelector('.nav-link[data-view="dashboard"]').click();
      return true;
    })()`);
    const after = await waitFor(async () => {
      const state = await app.evaluate(panel);
      return state.steps[2].done && state;
    });
    assert.deepEqual(after.steps.map((step) => step.done), [false, false, true, false]);
  } finally {
    await app.stop();
  }
});

test('the first steps go away when they are done, or when the user hides them', async () => {
  writeStateFile(dataDir, sampleState({
    profile: { legalName: 'Ana García', address: 'Calle Mayor 1', businesses: [], paymentMethods: [{ id: 'pm1', label: 'Bank', details: 'ES91' }] },
    clients: [sampleClient],
  }));
  let app = await launchApp(dataDir);
  try {
    assert.equal((await app.evaluate(panel)).visible, false, 'all steps are done');
  } finally {
    await app.stop();
  }

  writeStateFile(dataDir, { clients: [], invoices: [], expenses: [] });
  app = await launchApp(dataDir);
  try {
    await app.evaluate(`document.getElementById('setup-hide').click(); true`);
    assert.equal((await app.evaluate(panel)).visible, false);
    await waitFor(() => app.evaluate(`import('./state.js').then((module) => module.state.profile.setupGuideHidden)`));
  } finally {
    await app.stop();
  }
  app = await launchApp(dataDir);
  try {
    assert.equal((await app.evaluate(panel)).visible, false, 'the panel stays hidden after a restart');
  } finally {
    await app.stop();
  }
});
