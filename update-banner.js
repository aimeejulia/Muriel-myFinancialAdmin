import { elements } from './state.js';

const PACKAGE_LABELS = {
  snap: 'Snap',
  flatpak: 'Flatpak',
};

let latestUpdateUrl = '';
let latestUpdateCommand = '';

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
  command = '',
}) {
  if (!elements.updateBanner || !elements.updateBannerTitle || !elements.updateBannerMessage) return;

  elements.updateBanner.hidden = false;
  elements.updateBanner.dataset.tone = tone;
  elements.updateBannerTitle.textContent = title;
  elements.updateBannerMessage.textContent = message;
  latestUpdateUrl = downloadUrl;
  latestUpdateCommand = command;

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
