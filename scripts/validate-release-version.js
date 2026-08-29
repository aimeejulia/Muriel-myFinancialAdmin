#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '../package.json');
const distDir = path.join(__dirname, '../dist');

function readPackageJson() {
  const text = fs.readFileSync(packageJsonPath, 'utf8');
  return JSON.parse(text);
}

function scanForStaleVersionStrings(dir, expectedVersion) {
  const staleFiles = [];

  if (!fs.existsSync(dir)) {
    return staleFiles;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      staleFiles.push(...scanForStaleVersionStrings(fullPath, expectedVersion));
      continue;
    }

    const name = entry.name;
    const isLauncherScript = ['muriel-launch.sh', 'Muriel-myFinancialAdmin'].includes(name);
    const isDistributionMetadata = name === 'latest-linux.yml';
    const isAppImage = name.toLowerCase().includes('.appimage');

    if (isAppImage) {
      const versionMatch = name.match(/(\d+\.\d+\.\d+)/);
      if (versionMatch && versionMatch[1] !== expectedVersion) {
        staleFiles.push({ file: fullPath, reason: `AppImage file version ${versionMatch[1]} does not match package version ${expectedVersion}.` });
      }
    }

    if (isLauncherScript || isDistributionMetadata) {
      const raw = fs.readFileSync(fullPath, 'utf8');
      const versionMatches = [...raw.matchAll(/(\d+\.\d+\.\d+)/g)];
      for (const match of versionMatches) {
        if (match[1] !== expectedVersion) {
          staleFiles.push({ file: fullPath, reason: `Found stale version ${match[1]} in ${name}. Expected ${expectedVersion}.` });
          break;
        }
      }
    }
  }

  return staleFiles;
}

function main() {
  const packageJson = readPackageJson();
  const expectedVersion = String(packageJson.version || '').trim();

  if (!expectedVersion) {
    console.error('No application version found in package.json.');
    process.exit(1);
  }

  const staleFiles = scanForStaleVersionStrings(distDir, expectedVersion);

  if (staleFiles.length > 0) {
    console.error(`Release version mismatch detected. Package version is ${expectedVersion}.`);
    console.error('The following dist artifacts still reference older versions:');
    staleFiles.forEach(({ file, reason }) => {
      console.error(`  • ${path.relative(process.cwd(), file)} - ${reason}`);
    });
    console.error('\nRun the clean build script or delete the dist directory before packaging.');
    process.exit(1);
  }

  console.log(`✓ Release version check passed for v${expectedVersion}.`);
}

try {
  main();
} catch (error) {
  console.error('Release version validation failed:', error.message);
  process.exit(1);
}
