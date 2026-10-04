import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createDataDir, removeDataDir, writeStateFile, sampleState, launchApp, waitFor, assertRealDataUntouched,
} from './helpers.mjs';

let dataDir;
let env;

beforeEach(() => {
  dataDir = createDataDir();
  writeStateFile(dataDir, sampleState());
  // A GTK theme of the test, so the test does not depend on the theme of the computer.
  const themesHome = path.join(path.dirname(dataDir), 'share');
  const themeDir = path.join(themesHome, 'themes', 'Muriel-Test', 'gtk-3.0');
  fs.mkdirSync(themeDir, { recursive: true });
  fs.writeFileSync(path.join(themeDir, 'gtk.css'), [
    '@define-color theme_fg_color #4FFEC3;',
    '@define-color theme_bg_color #0F1A16;',
    '@define-color theme_base_color #0D1512;',
    '@define-color theme_selected_bg_color #158F5F;',
    '@define-color theme_selected_fg_color #0D1512;',
  ].join('\n'));
  env = { GTK_THEME: 'Muriel-Test', XDG_DATA_HOME: themesHome };
});

afterEach(async () => {
  await removeDataDir(dataDir);
  assertRealDataUntouched();
});

const look = `(() => ({
  theme: document.documentElement.dataset.theme,
  page: getComputedStyle(document.body).backgroundColor,
  text: getComputedStyle(document.body).color,
  activePage: getComputedStyle(document.querySelector('.nav-link.active')).backgroundColor,
}))()`;

// The colors change with a short transition, so the test waits until it is done.
const waitForColors = (app) => app.evaluate('new Promise((resolve) => setTimeout(() => resolve(true), 400))');

test('the desktop theme uses the colors of the GTK theme, and stays after a restart', async () => {
  let app = await launchApp(dataDir, { env });
  try {
    assert.match(await app.evaluate(`document.querySelector('.theme-option[data-theme="desktop"]').title`), /\(Muriel-Test\)$/);
    await app.evaluate(`document.querySelector('.theme-option[data-theme="desktop"]').click(); true`);
    await waitForColors(app);
    assert.deepEqual(await app.evaluate(look), {
      theme: 'desktop',
      page: 'rgb(15, 26, 22)',
      text: 'rgb(79, 254, 195)',
      activePage: 'rgb(21, 143, 95)',
    });
    await waitFor(() => app.evaluate(`import('./state.js').then((module) => module.state.profile.themePreset === 'desktop')`));
  } finally {
    await app.stop();
  }

  app = await launchApp(dataDir, { env });
  try {
    await waitForColors(app);
    assert.equal((await app.evaluate(look)).page, 'rgb(15, 26, 22)', 'the theme is the same after a restart');

    await app.evaluate(`document.querySelector('.theme-option[data-theme="muriel"]').click(); true`);
    await waitForColors(app);
    const muriel = await app.evaluate(look);
    assert.equal(muriel.theme, 'muriel');
    assert.notEqual(muriel.text, 'rgb(79, 254, 195)', 'the colors of the GTK theme go away');
  } finally {
    await app.stop();
  }
});

test('without a GTK theme that the app can read, the desktop theme button is off', async () => {
  const app = await launchApp(dataDir, { env: { GTK_THEME: 'Does-Not-Exist', XDG_DATA_HOME: path.dirname(dataDir) } });
  try {
    const button = await app.evaluate(`(() => {
      const button = document.querySelector('.theme-option[data-theme="desktop"]');
      return { disabled: button.disabled, title: button.title };
    })()`);
    assert.deepEqual(button, { disabled: true, title: 'The colors of the GTK theme "Does-Not-Exist" were not found.' });
  } finally {
    await app.stop();
  }
});
