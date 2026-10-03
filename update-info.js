const ASSET_PATTERNS = {
  appimage: /\.AppImage$/i,
  snap: /\.snap$/i,
  flatpak: /\.flatpak$/i,
};

// How this copy of the app was installed. The AppImage, Snap and Flatpak runtimes each set their own variables.
function detectInstallType({ env = {}, isPackaged = true, flatpakInfoExists = false } = {}) {
  if (env.APPIMAGE) return 'appimage';
  if (env.SNAP) return 'snap';
  if (env.FLATPAK_ID || flatpakInfoExists) return 'flatpak';
  if (!isPackaged) return 'source';
  return 'other';
}

function findReleaseAsset(assets, installType) {
  const pattern = ASSET_PATTERNS[installType];
  if (!pattern || !Array.isArray(assets)) return null;

  const asset = assets.find((item) => pattern.test(String(item?.name || '')));
  return asset ? { name: asset.name, url: asset.browser_download_url || '' } : null;
}

// Quotes text for a shell command, but only when it needs quotes, so simple commands stay easy to read.
function shellQuote(text) {
  const value = String(text);
  if (/^[A-Za-z0-9._/-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

// The command that installs the update, for install types that the app cannot update by itself.
function updateCommand(installType, { assetName = '', appPath = '' } = {}) {
  if (installType === 'snap' && assetName) {
    return `sudo snap install --dangerous ~/Downloads/${shellQuote(assetName)}`;
  }
  if (installType === 'flatpak' && assetName) {
    return `flatpak install --user ~/Downloads/${shellQuote(assetName)}`;
  }
  if (installType === 'source' && appPath) {
    return `cd ${shellQuote(appPath)} && git pull --ff-only && npm ci`;
  }
  return '';
}

module.exports = {
  detectInstallType,
  findReleaseAsset,
  updateCommand,
};
