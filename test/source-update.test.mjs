import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { updateSourceCheckout } = require('../source-update.js');

// A fake command runner. Each answer is the output of one command, or an Error that the command throws.
function fakeRunner(answers) {
  const commands = [];
  const run = async (command, args) => {
    const line = [command, ...args].join(' ');
    commands.push(line);
    const answer = answers[line];
    if (answer instanceof Error) throw answer;
    if (typeof answer === 'function') return answer();
    return answer ?? '';
  };
  return { run, commands };
}

function headSequence(...commits) {
  let index = 0;
  return () => `${commits[Math.min(index++, commits.length - 1)]}\n`;
}

test('a clean checkout on main is pulled, and npm ci runs when package-lock.json changed', async () => {
  const { run, commands } = fakeRunner({
    'git rev-parse --abbrev-ref HEAD': 'main\n',
    'git rev-parse HEAD': headSequence('aaa', 'bbb'),
    'git diff --name-only aaa bbb': 'main.js\npackage-lock.json\npackage.json\n',
  });

  const result = await updateSourceCheckout({ appPath: '/src/muriel', run });

  assert.deepEqual(result, { ok: true, from: 'aaa', to: 'bbb' });
  assert.deepEqual(commands, [
    'git rev-parse --abbrev-ref HEAD',
    'git status --porcelain --untracked-files=no',
    'git rev-parse HEAD',
    'git pull --ff-only',
    'git rev-parse HEAD',
    'git diff --name-only aaa bbb',
    'npm ci --no-audit --no-fund',
    "node -e require('electron')",
  ]);
});

test('npm ci does not run when package-lock.json did not change', async () => {
  const { run, commands } = fakeRunner({
    'git rev-parse --abbrev-ref HEAD': 'main\n',
    'git rev-parse HEAD': headSequence('aaa', 'bbb'),
    'git diff --name-only aaa bbb': 'main.js\n',
  });

  const result = await updateSourceCheckout({ appPath: '/src/muriel', run });

  assert.equal(result.ok, true);
  assert.equal(commands.includes('npm ci --no-audit --no-fund'), false);
});

test('a checkout on another branch is not updated', async () => {
  const { run, commands } = fakeRunner({ 'git rev-parse --abbrev-ref HEAD': 'feat/my-change\n' });

  const result = await updateSourceCheckout({ appPath: '/src/muriel', run });

  assert.equal(result.ok, false);
  assert.match(result.error, /on the branch "feat\/my-change"/);
  assert.equal(commands.some((line) => line.startsWith('git pull')), false);
});

test('a checkout with changes that are not committed is not updated', async () => {
  const { run, commands } = fakeRunner({
    'git rev-parse --abbrev-ref HEAD': 'main\n',
    'git status --porcelain --untracked-files=no': ' M main.js\n',
  });

  const result = await updateSourceCheckout({ appPath: '/src/muriel', run });

  assert.equal(result.ok, false);
  assert.match(result.error, /not committed/);
  assert.equal(commands.some((line) => line.startsWith('git pull')), false);
});

test('a folder that is not a git checkout is reported', async () => {
  const { run } = fakeRunner({ 'git rev-parse --abbrev-ref HEAD': new Error('fatal: not a git repository') });

  const result = await updateSourceCheckout({ appPath: '/opt/muriel', run });

  assert.deepEqual(result, { ok: false, error: 'The Muriel folder is not a git checkout.' });
});

test('a pull that cannot fast-forward is reported', async () => {
  const { run } = fakeRunner({
    'git rev-parse --abbrev-ref HEAD': 'main\n',
    'git rev-parse HEAD': 'aaa\n',
    'git pull --ff-only': new Error('fatal: Not possible to fast-forward, aborting.'),
  });

  const result = await updateSourceCheckout({ appPath: '/src/muriel', run });

  assert.equal(result.ok, false);
  assert.match(result.error, /git pull did not work: fatal: Not possible to fast-forward/);
});

test('a pull without new commits is reported', async () => {
  const { run } = fakeRunner({
    'git rev-parse --abbrev-ref HEAD': 'main\n',
    'git rev-parse HEAD': 'aaa\n',
  });

  const result = await updateSourceCheckout({ appPath: '/src/muriel', run });

  assert.deepEqual(result, { ok: false, error: 'git pull found no new changes for this folder.' });
});

test('a failed npm ci tells the user to run it by hand', async () => {
  const { run } = fakeRunner({
    'git rev-parse --abbrev-ref HEAD': 'main\n',
    'git rev-parse HEAD': headSequence('aaa', 'bbb'),
    'git diff --name-only aaa bbb': 'package-lock.json\n',
    'npm ci --no-audit --no-fund': new Error('npm ERR! network'),
  });

  const result = await updateSourceCheckout({ appPath: '/src/muriel', run });

  assert.equal(result.ok, false);
  assert.match(result.error, /npm ci did not work: npm ERR! network Run npm ci in the Muriel folder/);
});

test('a failed download of the Electron binary after npm ci is reported', async () => {
  const { run } = fakeRunner({
    'git rev-parse --abbrev-ref HEAD': 'main\n',
    'git rev-parse HEAD': headSequence('aaa', 'bbb'),
    'git diff --name-only aaa bbb': 'package-lock.json\n',
    "node -e require('electron')": new Error('Electron failed to install correctly.'),
  });

  const result = await updateSourceCheckout({ appPath: '/src/muriel', run });

  assert.equal(result.ok, false);
  assert.match(result.error, /npm ci did not work: Electron failed to install correctly/);
});

test('a command gives its output, and a failed command gives the end of its output', async () => {
  const { runCommand } = require('../source-update.js');
  assert.equal(await runCommand(process.execPath, ['-e', 'process.stdout.write("done")'], process.cwd()), 'done');

  const script = 'for (let line = 1; line <= 8; line += 1) console.error(`line ${line}`); process.exit(3);';
  await assert.rejects(runCommand(process.execPath, ['-e', script], process.cwd()), {
    message: 'line 4\nline 5\nline 6\nline 7\nline 8',
  });
});
