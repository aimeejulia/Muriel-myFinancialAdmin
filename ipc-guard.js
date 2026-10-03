const { pathToFileURL } = require('url');

// True when a frame URL is the app page itself, the only page that may call the desktop-store handlers.
// The query and the hash of the URL do not matter.
function isAppPageUrl(frameUrl, indexFilePath) {
  try {
    const url = new URL(frameUrl);
    return url.protocol === 'file:' && url.pathname === pathToFileURL(indexFilePath).pathname;
  } catch {
    return false;
  }
}

module.exports = {
  isAppPageUrl,
};
