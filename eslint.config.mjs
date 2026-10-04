import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['node_modules/', 'dist/', 'release/'],
  },
  js.configs.recommended,
  {
    // Electron main process, preload and build scripts
    files: ['main.js', 'preload.js', 'state-file.js', 'update-info.js', 'source-update.js', 'ipc-guard.js', 'exchange-rates.js', 'system-locale.js', 'scripts/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: globals.node,
    },
  },
  {
    // Renderer modules loaded by index.html
    files: ['*.js'],
    ignores: ['main.js', 'preload.js', 'state-file.js', 'update-info.js', 'source-update.js', 'ipc-guard.js', 'exchange-rates.js', 'system-locale.js'],
    languageOptions: {
      sourceType: 'module',
      globals: globals.browser,
    },
  },
  {
    files: ['eslint.config.mjs', 'test/**/*.mjs', 'e2e/**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
      globals: globals.node,
    },
  },
];
