const { execFile } = require('child_process');

// Runs a command in the app folder and returns its output. On failure the error message includes the command output.
function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd, timeout: 10 * 60 * 1000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const output = String(stderr || stdout || '').trim().split('\n').slice(-5).join('\n');
        reject(new Error(output || error.message));
        return;
      }
      resolve(String(stdout));
    });
  });
}

// Updates a source checkout with git pull --ff-only, and runs npm ci when package-lock.json changed.
// It refuses to update when the checkout is not on main or has changes that are not committed,
// so it never overwrites local work.
async function updateSourceCheckout({ appPath, run = runCommand }) {
  const git = (...args) => run('git', args, appPath);

  let branch;
  try {
    branch = (await git('rev-parse', '--abbrev-ref', 'HEAD')).trim();
  } catch {
    return { ok: false, error: 'The Muriel folder is not a git checkout.' };
  }

  if (branch !== 'main') {
    return { ok: false, error: `The Muriel folder is on the branch "${branch}". Switch to main, then try again.` };
  }

  const changes = (await git('status', '--porcelain', '--untracked-files=no')).trim();
  if (changes) {
    return { ok: false, error: 'The Muriel folder has changes that are not committed. Commit or remove them, then try again.' };
  }

  const before = (await git('rev-parse', 'HEAD')).trim();
  try {
    await git('pull', '--ff-only');
  } catch (error) {
    return { ok: false, error: `git pull did not work: ${error.message}` };
  }
  const after = (await git('rev-parse', 'HEAD')).trim();

  if (before === after) {
    return { ok: false, error: 'git pull found no new changes for this folder.' };
  }

  const changedFiles = (await git('diff', '--name-only', before, after)).split('\n');
  if (changedFiles.includes('package-lock.json')) {
    try {
      await run('npm', ['ci', '--no-audit', '--no-fund'], appPath);
    } catch (error) {
      return {
        ok: false,
        error: `The code is updated, but npm ci did not work: ${error.message} Run npm ci in the Muriel folder, then start Muriel again.`,
      };
    }
  }

  return { ok: true, from: before, to: after };
}

module.exports = {
  runCommand,
  updateSourceCheckout,
};
