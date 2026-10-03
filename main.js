const { app, BrowserWindow, ipcMain, shell, safeStorage, dialog } = require('electron');
const fs = require('fs');
const https = require('https');
const path = require('path');
const {
  writeFileAtomic,
  isStateJson,
  readFirstValidStateFile,
  decryptStatePayload,
} = require('./state-file');
const {
  canUpdateInApp,
  compareVersions,
  detectInstallType,
  findReleaseAsset,
  normalizeVersion,
  updateCommand,
} = require('./update-info');
const { updateSourceCheckout } = require('./source-update');
const { isAppPageUrl } = require('./ipc-guard');

let mainWindow = null;
let lastKnownSerializedState = '';
let stateLoadFailed = false;
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
  const result = readFirstValidStateFile(candidatePaths, (raw) => decryptStatePayload(raw, { app, safeStorage }) ?? raw);

  if (!result.path) {
    if (result.failedPaths.length > 0) {
      // Saving now would overwrite files that may still be recoverable.
      stateLoadFailed = true;
      throw new Error(`Could not read saved state from ${result.failedPaths.join(', ')}`);
    }
    return '';
  }

  if (result.path !== statePath && result.path !== backupStatePath) {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    writeFileAtomic(statePath, result.raw);
  }

  lastKnownSerializedState = result.plainText;
  return lastKnownSerializedState;
}

function writeStateFile(serializedState) {
  if (stateLoadFailed) {
    throw new Error('Saved state could not be read, so changes are not saved to protect the existing files.');
  }

  if (!isStateJson(serializedState)) {
    throw new Error('Refusing to save state that is not valid JSON.');
  }

  const statePath = getStateFilePath();
  const backupStatePath = getBackupStateFilePath();
  lastKnownSerializedState = String(serializedState);
  fs.mkdirSync(path.dirname(statePath), { recursive: true });

  // Fallback keeps app functional on systems without an available keyring.
  const payload = buildEncryptedPayload(serializedState) || serializedState;
  writeFileAtomic(backupStatePath, payload);
  writeFileAtomic(statePath, payload);

  return { ok: true, path: statePath };
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

function currentInstallType() {
  return detectInstallType({
    env: process.env,
    isPackaged: app.isPackaged,
    flatpakInfoExists: fs.existsSync('/.flatpak-info'),
  });
}

let appImageUpdater = null;
let sourceUpdateReady = false;

// electron-updater is only loaded for AppImage installs, the only type that can replace itself.
function getAppImageUpdater() {
  if (!appImageUpdater) {
    appImageUpdater = require('electron-updater').autoUpdater;
    appImageUpdater.autoDownload = false;
    appImageUpdater.autoInstallOnAppQuit = false;
  }
  return appImageUpdater;
}

// The app opens no windows of its own. Receipts and invoices show in modals and download as files.
function denyPopup() {
  return { action: 'deny' };
}

const APP_PAGE_PATH = path.join(__dirname, 'index.html');

// Registers an IPC handler that only the top frame of the app page can call.
function handleFromApp(channel, handler) {
  ipcMain.handle(channel, (event, ...args) => {
    const frame = event.senderFrame;
    if (!frame || frame.parent || !isAppPageUrl(frame.url, APP_PAGE_PATH)) {
      throw new Error(`Refused ${channel}: the request did not come from the Muriel page.`);
    }
    return handler(event, ...args);
  });
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

  mainWindow.webContents.setWindowOpenHandler(denyPopup);
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const currentUrl = mainWindow.webContents.getURL();
    if (url !== currentUrl) {
      event.preventDefault();
    }
  });

  mainWindow.loadFile(APP_PAGE_PATH);
}

app.whenReady().then(() => {
  app.on('web-contents-created', (_, contents) => {
    contents.setWindowOpenHandler(denyPopup);
  });

  const { session } = require('electron');
  session.defaultSession.setPermissionRequestHandler((_, permission, callback) => {
    // Copy buttons need to write to the clipboard. All other permissions stay blocked.
    callback(permission === 'clipboard-sanitized-write');
  });

  handleFromApp('desktop-store:read-state', () => {
    try {
      return readStateFile();
    } catch (error) {
      console.error('Failed to read state file', error);
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Saved data could not be read',
        message: 'Muriel cannot read your saved data.',
        detail: `To protect your data files, Muriel will not save changes until it can read them. Make a copy of this folder before you try again:\n\n${app.getPath('userData')}`,
      });
      return '';
    }
  });

  handleFromApp('desktop-store:write-state', (_, serializedState) => {
    try {
      const result = writeStateFile(serializedState);
      stateSavedThisSession = true;
      return result;
    } catch (error) {
      console.error('Failed to write state file', error);
      return { ok: false, error: error.message };
    }
  });

  handleFromApp('desktop-store:get-state-file-path', () => {
    return getStateFilePath();
  });

  handleFromApp('desktop-store:get-app-version', () => {
    return app.getVersion();
  });

  handleFromApp('desktop-store:check-for-updates', async () => {
    const currentVersion = app.getVersion();
    const repo = extractGithubRepo(getPackageJson());
    const installType = currentInstallType();

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
      const asset = findReleaseAsset(release.assets, installType);
      return {
        ok: true,
        configured: true,
        currentVersion,
        latestVersion,
        updateAvailable,
        installType,
        canUpdateInApp: canUpdateInApp(installType, release.assets, {
          isGitCheckout: fs.existsSync(path.join(app.getAppPath(), '.git')),
        }),
        assetName: asset?.name || '',
        assetUrl: asset?.url || '',
        updateCommand: updateCommand(installType, { assetName: asset?.name, appPath: app.getAppPath() }),
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

  handleFromApp('desktop-store:download-update', async () => {
    const installType = currentInstallType();
    if (installType === 'source') {
      const result = await updateSourceCheckout({ appPath: app.getAppPath() });
      sourceUpdateReady = result.ok;
      return result;
    }

    if (installType !== 'appimage') {
      return { ok: false, error: 'Only the AppImage and source checkouts can update themselves.' };
    }

    try {
      const updater = getAppImageUpdater();
      updater.removeAllListeners('download-progress');
      updater.on('download-progress', (progress) => {
        mainWindow?.webContents.send('desktop-store:update-progress', Math.round(progress.percent || 0));
      });

      const check = await updater.checkForUpdates();
      if (!check?.isUpdateAvailable) {
        return { ok: false, error: 'No newer version was found.' };
      }

      // electron-updater checks the downloaded file against the sha512 in latest-linux.yml.
      await updater.downloadUpdate();
      return { ok: true, version: check.updateInfo?.version || '' };
    } catch (error) {
      return { ok: false, error: error.message || 'Could not download the update.' };
    }
  });

  handleFromApp('desktop-store:install-update', () => {
    if (currentInstallType() === 'source' && sourceUpdateReady) {
      // Start the updated code. The quit handlers save the data first.
      setImmediate(() => {
        app.relaunch();
        app.quit();
      });
      return { ok: true };
    }

    if (currentInstallType() !== 'appimage' || !appImageUpdater) {
      return { ok: false, error: 'There is no downloaded update to install.' };
    }

    // Replace the AppImage and start the new version. The quit handlers save the data first.
    setImmediate(() => appImageUpdater.quitAndInstall(true, true));
    return { ok: true };
  });

  handleFromApp('desktop-store:open-external-url', async (_, url) => {
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

  handleFromApp('desktop-store:export-backup', async (_, serializedState) => {
    try {
      const now = new Date();
      const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const defaultPath = path.join(app.getPath('documents'), `muriel-backup-${localDate}.json`);
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

  handleFromApp('desktop-store:import-backup', async () => {
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

  handleFromApp('desktop-store:get-encryption-status', () => {
    return {
      ok: true,
      available: safeStorage.isEncryptionAvailable(),
    };
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Only write again on quit when the app saved something, so data that was not loaded is never rewritten.
let stateSavedThisSession = false;

app.on('before-quit', () => {
  if (!lastKnownSerializedState || !stateSavedThisSession) return;

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
