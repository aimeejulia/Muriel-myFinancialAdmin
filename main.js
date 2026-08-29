const { app, BrowserWindow, ipcMain, shell, safeStorage, dialog } = require('electron');
const fs = require('fs');
const https = require('https');
const path = require('path');

let mainWindow = null;
let lastKnownSerializedState = '';
const ENCRYPTED_STATE_VERSION = 1;

function buildEncryptedPayload(plainText) {
  if (!safeStorage.isEncryptionAvailable()) {
    return null;
  }

  const encrypted = safeStorage.encryptString(String(plainText || ''));
  return JSON.stringify({
    version: ENCRYPTED_STATE_VERSION,
    encrypted: true,
    data: encrypted.toString('base64'),
  });
}

function tryDecryptPayload(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || parsed.encrypted !== true || typeof parsed.data !== 'string') {
    return null;
  }

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption is unavailable on this system, cannot decrypt stored state.');
  }

  const encryptedBuffer = Buffer.from(parsed.data, 'base64');
  const candidateNames = Array.from(new Set([
    typeof app.getName === 'function' ? app.getName() : '',
    'muriel-myfinancialadmin',
    'darwin-myfinancialadmin',
  ])).filter(Boolean);

  const originalName = typeof app.getName === 'function' ? app.getName() : '';

  for (const candidateName of candidateNames) {
    try {
      if (typeof app.setName === 'function') {
        app.setName(candidateName);
      }
      return safeStorage.decryptString(encryptedBuffer);
    } catch {
      // Try the next known app name to remain compatible with older encrypted state.
    }
  }

  if (originalName && typeof app.setName === 'function') {
    app.setName(originalName);
  }

  throw new Error('Unable to decrypt stored state for the current or legacy app name.');
}

function getStateFilePath() {
  return path.join(app.getPath('userData'), 'muriel-myfinancialadmin-state.json');
}

function getBackupStateFilePath() {
  return path.join(app.getPath('userData'), 'muriel-myfinancialadmin-state.backup.json');
}

function getLegacyStateFilePaths() {
  const appDataPath = app.getPath('appData');
  const appNames = ['muriel-myfinancialadmin', 'darwin-myfinancialadmin'];
  const uniquePaths = [];

  for (const appName of appNames) {
    uniquePaths.push(path.join(app.getPath('userData'), `${appName}-state.json`));
    uniquePaths.push(path.join(appDataPath, appName, `${appName}-state.json`));
  }

  return [...new Set(uniquePaths)];
}

function readStateFile() {
  const statePath = getStateFilePath();
  const backupStatePath = getBackupStateFilePath();
  const candidatePaths = [statePath, backupStatePath, ...getLegacyStateFilePaths()];
  const pathToRead = candidatePaths.find((candidatePath) => fs.existsSync(candidatePath)) || '';

  if (!pathToRead) {
    return '';
  }

  const raw = fs.readFileSync(pathToRead, 'utf8');

  if (pathToRead !== statePath && pathToRead !== backupStatePath) {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, raw, 'utf8');
  }

  try {
    const decrypted = tryDecryptPayload(raw);
    lastKnownSerializedState = decrypted ?? raw;
    return lastKnownSerializedState;
  } catch (error) {
    if (fs.existsSync(backupStatePath)) {
      lastKnownSerializedState = fs.readFileSync(backupStatePath, 'utf8');
      return lastKnownSerializedState;
    }
    throw error;
  }
}

function writeStateFile(serializedState) {
  const statePath = getStateFilePath();
  const backupStatePath = getBackupStateFilePath();
  lastKnownSerializedState = String(serializedState || '');
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(backupStatePath, lastKnownSerializedState, 'utf8');

  const encryptedPayload = buildEncryptedPayload(serializedState);
  if (encryptedPayload) {
    fs.writeFileSync(statePath, encryptedPayload, 'utf8');
  } else {
    // Fallback keeps app functional on systems without an available keyring.
    fs.writeFileSync(statePath, serializedState, 'utf8');
  }

  return { ok: true, path: statePath };
}

function getReadmePath() {
  return path.join(__dirname, 'README.md');
}

function getPackageJson() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  } catch {
    return {};
  }
}

function extractGithubRepo(metadata = {}) {
  const repository = metadata?.repository;
  const repositoryUrl = typeof repository === 'string' ? repository : repository?.url;
  const publishConfig = Array.isArray(metadata?.build?.publish)
    ? metadata.build.publish[0]
    : metadata?.build?.publish;
  const publishOwnerRepo = publishConfig?.owner && publishConfig?.repo
    ? `${publishConfig.owner}/${publishConfig.repo}`
    : '';
  const publishRepo = publishConfig?.repo;
  const homepage = metadata?.homepage;
  const candidates = [
    process.env.MURIEL_UPDATE_REPO,
    publishOwnerRepo,
    publishRepo,
    repositoryUrl,
    homepage,
  ];

  for (const candidate of candidates) {
    const text = String(candidate || '').trim();
    if (!text) continue;

    const githubMatch = text.match(/github\.com[/:]([^/\s]+)\/([^/\s#]+?)(?:\.git)?(?:\/|$|#)/i);
    if (githubMatch) {
      return `${githubMatch[1]}/${githubMatch[2]}`.replace(/\.git$/i, '');
    }

    const slugMatch = text.match(/^([^/\s]+)\/([^/\s]+)$/);
    if (slugMatch) {
      return `${slugMatch[1]}/${slugMatch[2]}`.replace(/\.git$/i, '');
    }
  }

  return '';
}

function normalizeVersion(version) {
  return String(version || '').trim().replace(/^v/i, '');
}

function compareVersions(a, b) {
  const aParts = normalizeVersion(a).split('.').map((part) => Number.parseInt(part, 10) || 0);
  const bParts = normalizeVersion(b).split('.').map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(aParts.length, bParts.length);

  for (let index = 0; index < length; index += 1) {
    const left = aParts[index] || 0;
    const right = bParts[index] || 0;
    if (left > right) return 1;
    if (left < right) return -1;
  }

  return 0;
}

function fetchLatestGitHubRelease(repo) {
  const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;

  return new Promise((resolve, reject) => {
    const request = https.get(apiUrl, {
      headers: {
        'User-Agent': 'Muriel-myFinancialAdmin',
        Accept: 'application/vnd.github+json',
      },
    }, (response) => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        raw += chunk;
      });
      response.on('end', () => {
        if (response.statusCode && response.statusCode >= 400) {
          reject(new Error(`GitHub update check failed with status ${response.statusCode}.`));
          return;
        }

        try {
          resolve(JSON.parse(raw));
        } catch {
          reject(new Error('Could not parse update information from GitHub.'));
        }
      });
    });

    request.on('error', (error) => {
      reject(error);
    });

    request.setTimeout(8000, () => {
      request.destroy(new Error('Update check timed out.'));
    });
  });
}

function isAllowedPopupUrl(url) {
  if (typeof url !== 'string') return false;
  // Allow only local receipt previews; block web/content popups.
  return url === 'about:blank' || url.startsWith('data:application/pdf') || url.startsWith('blob:');
}

function popupPolicy(url) {
  if (!isAllowedPopupUrl(url)) {
    return { action: 'deny' };
  }

  return {
    action: 'allow',
    overrideBrowserWindowOptions: {
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      },
    },
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 980,
    minWidth: 1120,
    minHeight: 760,
    backgroundColor: '#eff6ff',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => popupPolicy(url));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const currentUrl = mainWindow.webContents.getURL();
    if (url !== currentUrl) {
      event.preventDefault();
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  app.on('web-contents-created', (_, contents) => {
    contents.setWindowOpenHandler(({ url }) => popupPolicy(url));
  });

  const { session } = require('electron');
  session.defaultSession.setPermissionRequestHandler((_, __, callback) => {
    callback(false);
  });

  ipcMain.handle('desktop-store:read-state', () => {
    try {
      return readStateFile();
    } catch (error) {
      console.error('Failed to read state file', error);
      return '';
    }
  });

  ipcMain.handle('desktop-store:write-state', (_, serializedState) => {
    try {
      return writeStateFile(serializedState);
    } catch (error) {
      console.error('Failed to write state file', error);
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle('desktop-store:get-state-file-path', () => {
    return getStateFilePath();
  });

  ipcMain.handle('desktop-store:get-app-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('desktop-store:check-for-updates', async () => {
    const currentVersion = app.getVersion();
    const repo = extractGithubRepo(getPackageJson());

    if (!repo) {
      return {
        ok: true,
        configured: false,
        currentVersion,
        message: 'Update checking will activate once the GitHub repository URL is configured in the app metadata.',
      };
    }

    try {
      const release = await fetchLatestGitHubRelease(repo);
      const latestVersion = normalizeVersion(release.tag_name || release.name || currentVersion);
      const updateAvailable = compareVersions(latestVersion, currentVersion) > 0;
      return {
        ok: true,
        configured: true,
        currentVersion,
        latestVersion,
        updateAvailable,
        releaseUrl: release.html_url || '',
        publishedAt: release.published_at || '',
        notes: String(release.body || '').slice(0, 800),
      };
    } catch (error) {
      return {
        ok: false,
        configured: true,
        currentVersion,
        message: error.message || 'Could not check for updates.',
      };
    }
  });

  ipcMain.handle('desktop-store:open-external-url', async (_, url) => {
    if (typeof url !== 'string' || !/^https:\/\//i.test(url)) {
      return { ok: false, error: 'Only secure external URLs are allowed.' };
    }

    try {
      await shell.openExternal(url);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle('desktop-store:export-backup', async (_, serializedState) => {
    try {
      const defaultPath = path.join(app.getPath('documents'), `muriel-backup-${new Date().toISOString().slice(0, 10)}.json`);
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Export backup',
        defaultPath,
        filters: [{ name: 'JSON backup', extensions: ['json'] }],
      });

      if (result.canceled || !result.filePath) {
        return { ok: false, canceled: true };
      }

      fs.writeFileSync(result.filePath, String(serializedState || ''), 'utf8');
      return { ok: true, path: result.filePath };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle('desktop-store:import-backup', async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Restore backup',
        properties: ['openFile'],
        filters: [{ name: 'JSON backup', extensions: ['json'] }],
      });

      if (result.canceled || !result.filePaths?.[0]) {
        return { ok: false, canceled: true };
      }

      const filePath = result.filePaths[0];
      const raw = fs.readFileSync(filePath, 'utf8');
      return { ok: true, path: filePath, raw };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle('desktop-store:get-encryption-status', () => {
    return {
      ok: true,
      available: safeStorage.isEncryptionAvailable(),
    };
  });

  ipcMain.handle('desktop-store:open-readme', () => {
    try {
      const readmePath = getReadmePath();
      shell.openPath(readmePath);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  if (!lastKnownSerializedState) return;

  try {
    writeStateFile(lastKnownSerializedState);
  } catch (error) {
    console.error('Failed to write final backup on quit', error);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
