#!/usr/bin/env node

function parseVersion(version) {
  return String(version || '')
    .replace(/^v/, '')
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
}

function isAtLeast(current, minimum) {
  const maxLen = Math.max(current.length, minimum.length);
  for (let i = 0; i < maxLen; i += 1) {
    const left = current[i] || 0;
    const right = minimum[i] || 0;
    if (left > right) return true;
    if (left < right) return false;
  }
  return true;
}

const minNode = [22, 12, 0];
const currentNode = parseVersion(process.versions.node);

if (!isAtLeast(currentNode, minNode)) {
  const minText = minNode.join('.');
  const currentText = process.versions.node;
  console.error('Unsupported Node.js version.');
  console.error(`Required: >= ${minText}`);
  console.error(`Current: ${currentText}`);
  console.error('Use nvm and run: nvm install 22.12.0 && nvm use 22.12.0');
  process.exit(1);
}
