#!/usr/bin/env node

/**
 * Validation script to ensure AppImage build configuration includes proper
 * desktop integration metadata. This prevents the issue where AppImage files
 * cannot be executed by double-clicking from a file manager.
 *
 * Run: node scripts/validate-appimage-config.js
 */

const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '../package.json');

try {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const buildConfig = packageJson.build || {};
  const linuxConfig = buildConfig.linux || {};
  const desktopConfig = linuxConfig.desktop || {};
  const desktopEntry = desktopConfig.entry || {};

  const errors = [];
  const warnings = [];

  // Required fields for desktop integration
  const requiredFields = {
    'Name': 'Application display name',
    'Comment': 'Application description',
  };

  const recommendedFields = {
    'Categories': 'For proper categorization in application menus',
    'StartupWMClass': 'For window manager integration',
  };

  // Check required fields
  for (const [field, description] of Object.entries(requiredFields)) {
    if (!desktopEntry[field]) {
      errors.push(`Missing required desktop entry field: "${field}" (${description})`);
    }
  }

  // Check recommended fields
  for (const [field, description] of Object.entries(recommendedFields)) {
    if (!desktopEntry[field]) {
      warnings.push(`Missing recommended desktop entry field: "${field}" (${description})`);
    }
  }

  // Print results
  console.log('\n=== AppImage Build Configuration Validation ===\n');

  if (errors.length === 0 && warnings.length === 0) {
    console.log('✓ All desktop integration checks passed!\n');
    console.log('Desktop configuration found:');
    console.log(JSON.stringify(desktopEntry, null, 2));
    console.log(
      '\nYour AppImage builds will include proper .desktop file metadata.\n'
    );
    process.exit(0);
  }

  if (errors.length > 0) {
    console.log('✗ ERRORS - Build will not support desktop double-click execution:\n');
    errors.forEach((error) => {
      console.log(`  • ${error}`);
    });
    console.log();
  }

  if (warnings.length > 0) {
    console.log('⚠ WARNINGS - Desktop integration may be incomplete:\n');
    warnings.forEach((warning) => {
      console.log(`  • ${warning}`);
    });
    console.log();
  }

  if (errors.length > 0) {
    console.log('HOW TO FIX:');
    console.log('  Update package.json build.linux.desktop.entry to include:');
    console.log('  {');
    console.log('    "Name": "Muriel - myFinancialAdmin",');
    console.log('    "Comment": "Local-first financial admin desktop app",');
    console.log('    "Categories": "Office;Finance;",');
    console.log('    "StartupWMClass": "Muriel - myFinancialAdmin"');
    console.log('  }\n');
    process.exit(1);
  }

  process.exit(0);
} catch (error) {
  console.error('Validation script error:', error.message);
  process.exit(1);
}
