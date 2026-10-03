#!/usr/bin/env node

/**
 * Builds the Linux packages and publishes them as a GitHub release, so every
 * install type can update: the AppImage (with latest-linux.yml for in-app
 * updates), the Snap and the Flatpak.
 *
 * Run: npm run release -- --title "v1.3.0 - short summary"
 *      npm run release -- --dry-run   (builds and checks, but does not publish)
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

const PACKAGE_TYPES = [
  { key: 'appImage', label: 'AppImage', pattern: /\.AppImage$/ },
  { key: 'snap', label: 'Snap', pattern: /\.snap$/ },
  { key: 'flatpak', label: 'Flatpak', pattern: /\.flatpak$/ },
];

function run(command, args, { showOutput = false } = {}) {
  return execFileSync(command, args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: showOutput ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });
}

function commandExists(command) {
  try {
    execFileSync('sh', ['-c', `command -v ${command}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Returns the text of the "## <version>" section of the changelog, without its heading.
function changelogSection(changelog, version) {
  const lines = changelog.split('\n');
  const start = lines.findIndex((line) => line.trim() === `## ${version}`);
  if (start === -1) return '';

  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  return lines.slice(start + 1, end === -1 ? lines.length : end).join('\n').trim();
}

// Finds one file of each package type for the version. GitHub changes spaces in uploaded
// file names, and electron-updater must find the AppImage by its exact name, so names with spaces are errors.
function findArtifacts(fileNames, version) {
  const artifacts = {};
  const errors = [];

  for (const type of PACKAGE_TYPES) {
    const matches = fileNames.filter((name) => type.pattern.test(name) && name.includes(version));
    if (matches.length !== 1) {
      errors.push(`Expected one ${type.label} file for version ${version} in dist, found ${matches.length}.`);
      continue;
    }
    if (/\s/.test(matches[0])) {
      errors.push(`The ${type.label} file name "${matches[0]}" has spaces. Set an artifactName without spaces.`);
      continue;
    }
    artifacts[type.key] = matches[0];
  }

  if (!fileNames.includes('latest-linux.yml')) {
    errors.push('latest-linux.yml is missing in dist. The AppImage cannot update itself without it.');
  }

  return { artifacts, errors };
}

// latest-linux.yml must point to the AppImage file by its exact name and have the right version.
function checkLatestYml(ymlText, appImageName, version) {
  const errors = [];
  const versionLine = ymlText.match(/^version:\s*(.+)$/m);
  if (!versionLine || versionLine[1].trim() !== version) {
    errors.push(`latest-linux.yml has version ${versionLine ? versionLine[1].trim() : '(none)'}, expected ${version}.`);
  }

  const fileNames = [...ymlText.matchAll(/^\s*(?:-\s*url|path):\s*(.+)$/gm)].map((match) => match[1].trim());
  if (fileNames.length === 0) {
    errors.push('latest-linux.yml names no file.');
  }
  for (const name of fileNames) {
    if (name !== appImageName) {
      errors.push(`latest-linux.yml points to "${name}", but the AppImage is "${appImageName}".`);
    }
  }

  return errors;
}

function releaseNotes(changelogText) {
  return `${changelogText}

## Installation

Download the file for your install type below:
- **AppImage**: for most Linux users. The AppImage needs \`libfuse2\`. From this release on, the app can update the AppImage by itself.
- **Snap**: install it with \`sudo snap install --dangerous <file>\`.
- **Flatpak**: install it with \`flatpak install --user <file>\`.

Muriel shows the update steps for your install type when a new version is available.
`;
}

function parseArgs(argv) {
  const options = { dryRun: false, title: '' };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--dry-run') options.dryRun = true;
    else if (argv[index] === '--title') options.title = argv[++index] || '';
    else throw new Error(`Unknown option: ${argv[index]}`);
  }
  return options;
}

function fail(errors) {
  console.error('\nThe release cannot continue:');
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

function checkBeforeBuild({ version, tag, options, changelogText }) {
  const errors = [];

  if (!options.dryRun && !options.title) {
    errors.push('Give a release title, for example: npm run release -- --title "v1.3.0 - short summary"');
  }
  if (!changelogText) {
    errors.push(`CHANGELOG.md has no "## ${version}" section.`);
  }
  for (const tool of ['flatpak', 'flatpak-builder']) {
    if (!commandExists(tool)) errors.push(`${tool} is not installed. The Flatpak build needs it.`);
  }

  const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  if (branch !== 'main') errors.push(`Release from main. This checkout is on "${branch}".`);
  if (run('git', ['status', '--porcelain', '--untracked-files=no']).trim()) {
    errors.push('Commit or remove the changes to tracked files first.');
  }

  run('git', ['fetch', '--quiet', '--tags', 'origin']);
  const head = run('git', ['rev-parse', 'HEAD']).trim();
  if (head !== run('git', ['rev-parse', 'origin/main']).trim()) {
    errors.push('This checkout is not the same as origin/main. Pull or push first.');
  }

  let tagCommit = '';
  try {
    tagCommit = run('git', ['rev-parse', `${tag}^{commit}`]).trim();
  } catch {
    errors.push(`The tag ${tag} does not exist. Create it on the release commit and push it: git tag ${tag} && git push origin ${tag}`);
  }
  if (tagCommit && tagCommit !== head) {
    errors.push(`The tag ${tag} is not on the current commit.`);
  }

  if (!options.dryRun) {
    try {
      run('gh', ['auth', 'status']);
    } catch {
      errors.push('gh is not logged in. Run: gh auth login');
    }
    try {
      run('gh', ['release', 'view', tag]);
      errors.push(`A GitHub release for ${tag} already exists.`);
    } catch {
      // No release yet, which is correct.
    }
  }

  return errors;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const { version } = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const tag = `v${version}`;
  const changelogText = changelogSection(fs.readFileSync(path.join(rootDir, 'CHANGELOG.md'), 'utf8'), version);

  const preflightErrors = checkBeforeBuild({ version, tag, options, changelogText });
  if (preflightErrors.length) fail(preflightErrors);

  console.log(`\nBuilding AppImage, Snap and Flatpak for ${tag}...\n`);
  run('npm', ['run', 'clean:dist'], { showOutput: true });
  run('npm', ['run', 'check:appimage-config'], { showOutput: true });
  run('npm', ['run', 'check:release-version'], { showOutput: true });
  // One target at a time: targets that build at the same time can unpack the same tool into the
  // electron-builder cache at the same time, and then one of them fails.
  // The script uploads the files itself, so electron-builder must never publish.
  for (const target of ['AppImage', 'snap', 'flatpak']) {
    run('npx', ['electron-builder', '--linux', target, '--publish', 'never'], { showOutput: true });
  }

  const { artifacts, errors } = findArtifacts(fs.readdirSync(distDir), version);
  if (errors.length) fail(errors);
  const ymlErrors = checkLatestYml(fs.readFileSync(path.join(distDir, 'latest-linux.yml'), 'utf8'), artifacts.appImage, version);
  if (ymlErrors.length) fail(ymlErrors);

  const files = [artifacts.appImage, artifacts.snap, artifacts.flatpak, 'latest-linux.yml'];
  console.log('\nRelease files:');
  for (const file of files) console.log(`  dist/${file}`);

  if (options.dryRun) {
    console.log(`\nDry run: ${tag} was not published.`);
    return;
  }

  const notesFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'muriel-release-')), 'notes.md');
  fs.writeFileSync(notesFile, releaseNotes(changelogText));
  try {
    run('gh', ['release', 'create', tag, ...files.map((file) => path.join(distDir, file)),
      '--verify-tag', '--title', options.title, '--notes-file', notesFile], { showOutput: true });
  } finally {
    fs.rmSync(path.dirname(notesFile), { recursive: true, force: true });
  }

  const uploaded = JSON.parse(run('gh', ['release', 'view', tag, '--json', 'assets'])).assets.map((asset) => asset.name);
  const missing = files.filter((file) => !uploaded.includes(file));
  if (missing.length) fail(missing.map((file) => `${file} is not in the published release.`));

  console.log(`\n${tag} is published with ${files.length} files.`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    fail([error.message]);
  }
}

module.exports = {
  changelogSection,
  checkLatestYml,
  findArtifacts,
  releaseNotes,
};
