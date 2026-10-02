const fs = require('fs');

function writeFileAtomic(filePath, content) {
  // Write to a temporary file first, so a crash never leaves a half-written state file.
  const tempPath = `${filePath}.tmp`;
  const fileDescriptor = fs.openSync(tempPath, 'w');
  try {
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

module.exports = {
  writeFileAtomic,
  isStateJson,
  readFirstValidStateFile,
};
