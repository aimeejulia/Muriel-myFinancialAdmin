const fs = require('fs');

function writeFileAtomic(filePath, content) {
  // Write to a temporary file first, so a crash never leaves a half-written state file.
  const tempPath = `${filePath}.tmp`;
  const fileDescriptor = fs.openSync(tempPath, 'w', 0o600);
  try {
    // Only the current user can read the saved data.
    fs.fchmodSync(fileDescriptor, 0o600);
    fs.writeFileSync(fileDescriptor, content, 'utf8');
    fs.fsyncSync(fileDescriptor);
  } finally {
    fs.closeSync(fileDescriptor);
  }
  fs.renameSync(tempPath, filePath);
}

function isStateJson(text) {
  try {
    const parsed = JSON.parse(text);
    return Boolean(parsed) && typeof parsed === 'object' && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

// Reads the first candidate file that exists and holds readable state.
// decrypt(raw) returns the plain text, or throws when the file cannot be decrypted.
function readFirstValidStateFile(candidatePaths, decrypt) {
  const failedPaths = [];

  for (const candidatePath of candidatePaths) {
    if (!fs.existsSync(candidatePath)) continue;

    try {
      const raw = fs.readFileSync(candidatePath, 'utf8');
      const plainText = decrypt(raw);
      if (isStateJson(plainText)) {
        return { path: candidatePath, raw, plainText, failedPaths };
      }
    } catch {
      // Unreadable or undecryptable, try the next candidate.
    }

    failedPaths.push(candidatePath);
  }

  return { path: '', raw: '', plainText: '', failedPaths };
}

// Decrypts a saved state payload. Returns null when the text is not an encrypted payload.
// Older versions of the app had other names, and the key can belong to such a name,
// so each known name is tried. The app name is always set back afterwards.
function decryptStatePayload(raw, { app, safeStorage }) {
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
  const originalName = app.getName();
  const candidateNames = Array.from(new Set([
    originalName,
    'muriel-myfinancialadmin',
    'darwin-myfinancialadmin',
  ])).filter(Boolean);

  try {
    for (const candidateName of candidateNames) {
      try {
        app.setName(candidateName);
        return safeStorage.decryptString(encryptedBuffer);
      } catch {
        // Try the next known app name to remain compatible with older encrypted state.
      }
    }
  } finally {
    if (originalName) app.setName(originalName);
  }

  throw new Error('Unable to decrypt stored state for the current or legacy app name.');
}

module.exports = {
  decryptStatePayload,
  writeFileAtomic,
  isStateJson,
  readFirstValidStateFile,
};
