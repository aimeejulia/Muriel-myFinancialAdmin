import { elements, isDesktopApp } from './state.js';

const PACKAGE_LABELS = {
  snap: 'Snap',
  flatpak: 'Flatpak',
};

let latestUpdateUrl = '';
let latestUpdateCommand = '';
let latestDownloadLabel = '';
let latestBusyLabel = '';

// Decides what the update banner shows for the way this copy of the app was installed.
export function describeUpdate(result) {
  const title = `Version ${result.latestVersion} is available`;
  const current = `You are using version ${result.currentVersion}.`;
  const keepsData = 'Your saved data stays on this device.';
  const packageLabel = PACKAGE_LABELS[result.installType];

  if (packageLabel && result.assetUrl && result.updateCommand) {
    return {
      title,
      tone: 'success',
      message: `${current} Download the ${packageLabel} file, then run this command in a terminal. ${keepsData}`,
      downloadUrl: result.assetUrl,
      downloadLabel: `Download ${packageLabel} file`,
      command: result.updateCommand,
    };
  }

  if (result.installType === 'source' && result.updateCommand && result.canUpdateInApp) {
    return {
      title,
      tone: 'success',
      message: `${current} Muriel can update this folder with git and restart. You can also run this command in a terminal. ${keepsData}`,
      downloadUrl: '',
      downloadLabel: '',
      installLabel: 'Update and restart',
      busyLabel: 'Updating…',
      command: result.updateCommand,
    };
  }

  if (result.installType === 'source' && result.updateCommand) {
    return {
      title,
      tone: 'success',
      message: `${current} Run this command in a terminal, then start Muriel again. ${keepsData}`,
      downloadUrl: '',
      downloadLabel: '',
      command: result.updateCommand,
    };
  }

  if (result.installType === 'appimage' && result.assetUrl && result.canUpdateInApp) {
    return {
      title,
      tone: 'success',
      message: `${current} Muriel can download the update and restart. ${keepsData}`,
      downloadUrl: result.assetUrl,
      downloadLabel: 'Download AppImage',
      installLabel: 'Download and restart',
      busyLabel: 'Downloading…',
      command: '',
    };
  }

  if (result.installType === 'appimage' && result.assetUrl) {
    return {
      title,
      tone: 'success',
      message: `${current} Download the new AppImage and use it in place of the old file. ${keepsData}`,
      downloadUrl: result.assetUrl,
      downloadLabel: 'Download AppImage',
      command: '',
    };
  }

  return {
    title,
    tone: 'success',
    message: `${current} Download the latest release to update the app while keeping saved data.`,
    downloadUrl: result.releaseUrl || '',
    downloadLabel: 'Open download page',
    command: '',
  };
}

export function getLatestUpdateUrl() {
  return latestUpdateUrl;
}

export function getLatestUpdateCommand() {
  return latestUpdateCommand;
}

export function hideUpdateBanner() {
  if (!elements.updateBanner) return;
  elements.updateBanner.hidden = true;
  elements.updateBanner.dataset.tone = 'info';
  latestUpdateUrl = '';
  latestUpdateCommand = '';
  if (elements.updateInstallBtn) {
    elements.updateInstallBtn.hidden = true;
  }
  if (elements.updateDownloadBtn) {
    elements.updateDownloadBtn.hidden = true;
  }
  if (elements.updateBannerCommand) {
    elements.updateBannerCommand.hidden = true;
  }
  if (elements.updateCopyBtn) {
    elements.updateCopyBtn.hidden = true;
  }
}

export function showUpdateBanner({
  title,
  message,
  tone = 'info',
  downloadUrl = '',
  downloadLabel = 'Open download page',
  installLabel = '',
  busyLabel = 'Updating…',
  command = '',
}) {
  if (!elements.updateBanner || !elements.updateBannerTitle || !elements.updateBannerMessage) return;

  elements.updateBanner.hidden = false;
  elements.updateBanner.dataset.tone = tone;
  elements.updateBannerTitle.textContent = title;
  elements.updateBannerMessage.textContent = message;
  latestUpdateUrl = downloadUrl;
  latestUpdateCommand = command;
  latestDownloadLabel = downloadLabel;
  latestBusyLabel = busyLabel;

  if (elements.updateInstallBtn) {
    elements.updateInstallBtn.hidden = !installLabel;
    elements.updateInstallBtn.disabled = false;
    elements.updateInstallBtn.textContent = installLabel;
  }
  if (elements.updateDownloadBtn) {
    elements.updateDownloadBtn.hidden = !downloadUrl;
    elements.updateDownloadBtn.textContent = downloadLabel;
  }
  if (elements.updateBannerCommand) {
    elements.updateBannerCommand.hidden = !command;
    elements.updateBannerCommand.textContent = command;
  }
  if (elements.updateCopyBtn) {
    elements.updateCopyBtn.hidden = !command;
    elements.updateCopyBtn.textContent = 'Copy command';
  }
}

// Gets the update (a new AppImage, or the new code of a source checkout), then restarts into it.
// If anything fails, the banner keeps the manual way to update.
export async function downloadAndRestart(desktopStore) {
  const button = elements.updateInstallBtn;
  const fallback = { downloadUrl: latestUpdateUrl, downloadLabel: latestDownloadLabel, command: latestUpdateCommand };
  button.disabled = true;
  button.textContent = latestBusyLabel;
  desktopStore.onUpdateProgress((percent) => {
    button.textContent = `Downloading… ${percent}%`;
  });

  const download = await desktopStore.downloadUpdate();
  if (!download?.ok) {
    const manualStep = fallback.command
      ? 'Run this command in a terminal to update.'
      : 'Download the new AppImage and use it in place of the old file.';
    showUpdateBanner({
      title: 'Could not update',
      message: `${download?.error || 'The update failed.'} ${manualStep}`,
      tone: 'warning',
      ...fallback,
    });
    return download;
  }

  button.textContent = 'Restarting…';
  return desktopStore.installUpdate();
}

export async function checkForUpdates({ manual = false } = {}) {
  if (!isDesktopApp || typeof window.desktopStore?.checkForUpdates !== 'function') {
    return;
  }

  if (manual && elements.checkUpdatesBtn) {
    elements.checkUpdatesBtn.disabled = true;
    elements.checkUpdatesBtn.textContent = 'Checking…';
  }

  try {
    const result = await window.desktopStore.checkForUpdates();

    if (!result?.configured) {
      if (manual) {
        showUpdateBanner({
          title: 'Update checks are ready',
          message: result?.message || 'Connect the GitHub releases URL and users will see update alerts here.',
        });
      }
      return;
    }

    if (result?.ok === false) {
      if (manual) {
        showUpdateBanner({
          title: 'Could not check for updates',
          message: result?.message || 'Please try again later.',
          tone: 'warning',
        });
      }
      return;
    }

    if (result?.updateAvailable) {
      showUpdateBanner(describeUpdate(result));
      return;
    }

    if (manual) {
      showUpdateBanner({
        title: 'You are up to date',
        message: `This device is already running the latest version, ${result.currentVersion}.`,
      });
    }
  } catch (error) {
    if (manual) {
      showUpdateBanner({
        title: 'Could not check for updates',
        message: error?.message || 'Please try again later.',
        tone: 'warning',
      });
    }
  } finally {
    if (manual && elements.checkUpdatesBtn) {
      elements.checkUpdatesBtn.disabled = false;
      elements.checkUpdatesBtn.textContent = 'Check for updates';
    }
  }
}

export function attachUpdateHandlers() {
  if (elements.checkUpdatesBtn) {
    elements.checkUpdatesBtn.addEventListener('click', () => {
      checkForUpdates({ manual: true });
    });
  }

  if (elements.updateDismissBtn) {
    elements.updateDismissBtn.addEventListener('click', () => {
      hideUpdateBanner();
    });
  }

  if (elements.updateDownloadBtn) {
    elements.updateDownloadBtn.addEventListener('click', async () => {
      const updateUrl = getLatestUpdateUrl();
      if (!updateUrl || typeof window.desktopStore?.openExternalUrl !== 'function') return;
      await window.desktopStore.openExternalUrl(updateUrl);
    });
  }

  if (elements.updateInstallBtn) {
    elements.updateInstallBtn.addEventListener('click', () => {
      if (typeof window.desktopStore?.downloadUpdate !== 'function') return;
      downloadAndRestart(window.desktopStore);
    });
  }

  if (elements.updateCopyBtn) {
    elements.updateCopyBtn.addEventListener('click', () => {
      const command = getLatestUpdateCommand();
      if (!command) return;
      navigator.clipboard.writeText(command)
        .then(() => {
          elements.updateCopyBtn.textContent = 'Copied';
        })
        .catch(() => {
          elements.updateCopyBtn.textContent = 'Could not copy';
        });
    });
  }
}
