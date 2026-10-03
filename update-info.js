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

// An AppImage can replace itself when the release has the new AppImage and the
// latest-linux.yml file, which electron-updater needs to find and verify it.
// A source checkout can update itself when it is a git checkout.
function canUpdateInApp(installType, assets, { isGitCheckout = false } = {}) {
  if (installType === 'source') return isGitCheckout;
  if (installType !== 'appimage' || !Array.isArray(assets)) return false;
  const names = assets.map((asset) => String(asset?.name || ''));
  return names.includes('latest-linux.yml') && names.some((name) => ASSET_PATTERNS.appimage.test(name));
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

function normalizeVersion(version) {
  return String(version || '').trim().replace(/^v/i, '');
}

function compareIdentifiers(left, right) {
  const leftIsNumber = /^\d+$/.test(left);
  const rightIsNumber = /^\d+$/.test(right);
  if (leftIsNumber && rightIsNumber) return Math.sign(Number(left) - Number(right));
  if (leftIsNumber) return -1;
  if (rightIsNumber) return 1;
  return left < right ? -1 : left > right ? 1 : 0;
}

// Compares versions like semantic versioning: 1.2.0-rc.1 comes before 1.2.0. Build data after + does not count.
function compareVersions(a, b) {
  const [aCore, aPre = ''] = normalizeVersion(a).split('+')[0].split(/-(.*)/s);
  const [bCore, bPre = ''] = normalizeVersion(b).split('+')[0].split(/-(.*)/s);
  const aParts = aCore.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const bParts = bCore.split('.').map((part) => Number.parseInt(part, 10) || 0);

  for (let index = 0; index < Math.max(aParts.length, bParts.length); index += 1) {
    const difference = (aParts[index] || 0) - (bParts[index] || 0);
    if (difference !== 0) return Math.sign(difference);
  }

  if (aPre === bPre) return 0;
  if (!aPre) return 1;
  if (!bPre) return -1;

  const aIds = aPre.split('.');
  const bIds = bPre.split('.');
  for (let index = 0; index < Math.max(aIds.length, bIds.length); index += 1) {
    if (aIds[index] === undefined) return -1;
    if (bIds[index] === undefined) return 1;
    const result = compareIdentifiers(aIds[index], bIds[index]);
    if (result !== 0) return result;
  }
  return 0;
}

module.exports = {
  canUpdateInApp,
  compareVersions,
  normalizeVersion,
  detectInstallType,
  findReleaseAsset,
  updateCommand,
};
