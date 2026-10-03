import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const electronPath = require('electron');
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const STATE_FILE = 'muriel-myfinancialadmin-state.json';
export const BACKUP_FILE = 'muriel-myfinancialadmin-state.backup.json';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Waits until check() returns true, or until the time is up. Returns the last result of check().
export async function waitFor(check, { timeout = 5000, interval = 100 } = {}) {
  const end = Date.now() + timeout;
  let result = await check();
  while (!result && Date.now() < end) {
    await sleep(interval);
    result = await check();
  }
  return result;
}

export const sampleClient = {
  id: 'client-1',
  displayId: '0001',
  name: 'Test Client',
  contactName: '',
  email: '',
  vatNumber: '',
  address: '',
  defaultVatRate: 21,
  defaultCurrency: 'EUR',
  preferredPaymentMethodId: '',
  status: 'active',
};

export const sampleInvoice = {
  id: 'invoice-1',
  invoiceNumber: 'INV-2026-09-001',
  clientId: 'client-1',
  issuerType: 'legal',
  issuerBusinessId: '',
  issuerName: '',
  issueDate: '2026-09-01',
  dueDate: '2099-09-15',
  description: 'Original description',
  subtotal: 100,
  vatRate: 21,
  vatAmount: 21,
  total: 121,
  defaultCurrency: 'EUR',
  clientCurrency: 'EUR',
  paymentMethodId: '',
  clientCurrencyTotal: 0,
  status: 'draft',
  paidDate: '',
  abortedNumberHandling: '',
};

export function sampleState(overrides = {}) {
  return { clients: [sampleClient], invoices: [sampleInvoice], expenses: [], ...overrides };
}

// The app also looks for legacy state files in the config folder (appData), so every test
// gets its own config folder. This keeps the tests away from the real saved data.
export function createDataDir() {
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'muriel-e2e-'));
  const dataDir = path.join(configDir, 'muriel-myfinancialadmin');
  fs.mkdirSync(dataDir);
  return dataDir;
}

export async function removeDataDir(dataDir) {
  await stopAllApps();
  const configDir = path.dirname(dataDir);
  if (fs.existsSync(dataDir)) fs.chmodSync(dataDir, 0o700);
  // Electron helper processes can still write a file just after the app exits,
  // so the folder only counts as removed when it stays removed for a second.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    fs.rmSync(configDir, { recursive: true, force: true });
    await sleep(1000);
    if (!fs.existsSync(configDir)) return;
  }
}

export function writeStateFile(dataDir, state, fileName = STATE_FILE) {
  fs.writeFileSync(path.join(dataDir, fileName), typeof state === 'string' ? state : JSON.stringify(state));
}

function realDataSnapshot() {
  const realDataDir = path.join(os.homedir(), '.config', 'muriel-myfinancialadmin');
  if (!fs.existsSync(realDataDir)) return '';
  return fs.readdirSync(realDataDir)
    .filter((fileName) => fileName.includes('-state'))
    .map((fileName) => `${fileName}:${fs.statSync(path.join(realDataDir, fileName)).mtimeMs}`)
    .join('\n');
}

const realDataBefore = realDataSnapshot();

export function assertRealDataUntouched() {
  if (realDataSnapshot() !== realDataBefore) {
    throw new Error('The real saved data in ~/.config/muriel-myfinancialadmin changed during the test');
  }
}

const runningApps = new Set();
process.on('exit', () => {
  for (const child of runningApps) child.kill('SIGKILL');
});

// Called after each test, so a failed assertion never leaves an app running.
export async function stopAllApps() {
  await Promise.all([...runningApps].map((child) => new Promise((resolve) => {
    const forceKill = setTimeout(() => child.kill('SIGKILL'), 5000);
    child.on('exit', () => {
      clearTimeout(forceKill);
      resolve();
    });
    child.kill('SIGTERM');
  })));
}

export async function launchApp(dataDir, { env = {} } = {}) {
  const child = spawn(electronPath, [
    repoRoot,
    `--user-data-dir=${dataDir}`,
    '--remote-debugging-port=0',
  ], {
    stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env, XDG_CONFIG_HOME: path.dirname(dataDir), ...env },
  });
  runningApps.add(child);
  child.on('exit', () => runningApps.delete(child));

  // With port 0 Electron picks a free port and prints it, so a stale app can never answer instead.
  const port = await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error(`Electron did not start:\n${output}`)), 30000);
    child.stderr.on('data', (chunk) => {
      output += chunk;
      const match = output.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//);
      if (match) {
        clearTimeout(timeout);
        resolve(Number(match[1]));
      }
    });
  });

  let page;
  for (let attempt = 0; attempt < 60 && !page; attempt += 1) {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    page = targets.find((target) => target.type === 'page' && target.url.endsWith('index.html'));
    if (!page) await sleep(250);
  }

  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve) => socket.addEventListener('open', resolve));
  let nextId = 0;
  const pending = new Map();
  const dialogs = [];
  const send = (method, params = {}) => {
    nextId += 1;
    const id = nextId;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve) => pending.set(id, resolve));
  };
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Page.javascriptDialogOpening') {
      // Accept alert and confirm dialogs, and keep their text for the test.
      dialogs.push(message.params.message);
      send('Page.handleJavaScriptDialog', { accept: true });
      return;
    }
    pending.get(message.id)?.(message);
  });
  await send('Page.enable');

  const evaluate = async (expression) => {
    // userGesture makes clicks count as user actions, which the clipboard needs.
    const message = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (message.result.exceptionDetails) {
      throw new Error(message.result.exceptionDetails.exception?.description || 'Evaluation failed');
    }
    return message.result.result.value;
  };

  // Wait until the app has loaded its state and rendered.
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await evaluate(`document.readyState === 'complete' && Boolean(document.querySelector('#invoices-table-body tr'))`)) break;
    await sleep(250);
  }
  await evaluate('window.alert = () => {}; window.confirm = () => true; true');

  const stop = async () => {
    socket.close();
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await new Promise((resolve) => child.on('exit', resolve));
    }
  };

  return { evaluate, stop, dialogs };
}

// Reads the saved invoices back through the app, so this also works when the state file is encrypted.
export async function savedInvoices(dataDir) {
  const app = await launchApp(dataDir);
  try {
    return await app.evaluate(`import('./state.js').then((module) => module.state.invoices)`);
  } finally {
    await app.stop();
  }
}

export const forceSave = (theme = 'sunrise') => `document.querySelector('.theme-option[data-theme="${theme}"]').click(); true`;

export function invoiceTableHas(invoiceNumber) {
  return `document.getElementById('invoices-table-body').textContent.includes(${JSON.stringify(invoiceNumber)})`;
}

export function reportCards(year, period) {
  return `(() => {
    document.getElementById('reportYear').value = ${JSON.stringify(String(year))};
    document.getElementById('reportQuarter').value = ${JSON.stringify(String(period))};
    document.getElementById('run-quarter-report').click();
    return Object.fromEntries([...document.querySelectorAll('.report-card')]
      .map((card) => [card.querySelector('span').textContent, card.querySelector('strong').textContent]));
  })()`;
}
