import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  parseColor, definedColors, readThemeCss, desktopThemeSettings, cssFontFamily, readDesktopTheme, toCss,
} = require('../gtk-theme.js');

let home;
const noCommands = () => {
  throw new Error('no command');
};

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'muriel-gtk-'));
});

afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
});

function writeTheme(name, files) {
  const dir = path.join(home, '.themes', name, 'gtk-3.0');
  fs.mkdirSync(dir, { recursive: true });
  Object.entries(files).forEach(([file, css]) => fs.writeFileSync(path.join(dir, file), css));
}

test('GTK color expressions are read', () => {
  const defined = { bg: '#0F1A16', accent: '@bg', half: 'alpha(black, 0.35)' };
  assert.equal(toCss(parseColor('#abc', {})), '#aabbcc');
  assert.equal(toCss(parseColor('#0F1A16', {})), '#0f1a16');
  assert.equal(toCss(parseColor('#11223380', {})), 'rgba(17, 34, 51, 0.502)');
  assert.equal(toCss(parseColor('rgba(79, 254, 195, 0.07)', {})), 'rgba(79, 254, 195, 0.07)');
  assert.equal(toCss(parseColor('rgb(255, 0, 0)', {})), '#ff0000');
  assert.equal(toCss(parseColor('@accent', defined)), '#0f1a16', 'a color can name another color');
  assert.equal(toCss(parseColor('@half', defined)), 'rgba(0, 0, 0, 0.35)');
  assert.equal(toCss(parseColor('shade(#808080, 0.5)', {})), '#404040');
  assert.equal(toCss(parseColor('shade(#808080, 1.5)', {})), '#c0c0c0');
  assert.equal(toCss(parseColor('mix(black, white, 0.5)', {})), '#808080');
  assert.equal(toCss(parseColor('lighter(#808080)', {})), '#a6a6a6');
  assert.equal(parseColor('@missing', defined), null);
  assert.equal(parseColor('url(x.png)', {}), null);
});

test('a later color definition replaces an earlier one, as in GTK', () => {
  assert.deepEqual(definedColors('@define-color a #111;\n@define-color b @a;\n@define-color a #222;'), { a: '#222', b: '@a' });
});

test('imported theme files are read before the rest of the file', () => {
  writeTheme('Imports', { 'gtk.css': '@define-color a #111;', 'gtk-dark.css': '@import url("gtk.css");\n@define-color a #333;' });
  const css = readThemeCss(path.join(home, '.themes', 'Imports', 'gtk-3.0', 'gtk-dark.css'));
  assert.deepEqual(definedColors(css), { a: '#333' });
});

test('the theme name comes from GTK_THEME, then xfconf, then gsettings, then settings.ini', () => {
  const answers = {
    'xfconf-query -c xsettings -p /Net/ThemeName': 'Trinity-Adw\n',
    'xfconf-query -c xsettings -p /Gtk/FontName': 'Sans 10\n',
    'gsettings get org.gnome.desktop.interface color-scheme': "'prefer-dark'\n",
  };
  const run = (command, args) => {
    const answer = answers[[command, ...args].join(' ')];
    if (answer === undefined) throw new Error('not found');
    return answer;
  };
  assert.deepEqual(desktopThemeSettings({ env: {}, home, run }), { name: 'Trinity-Adw', dark: false, font: 'Sans 10' },
    'the color-scheme of GNOME does not change GTK 3 themes other than Adwaita');
  answers['xfconf-query -c xsettings -p /Net/ThemeName'] = 'Adwaita\n';
  assert.equal(desktopThemeSettings({ env: {}, home, run }).dark, true, 'it changes Adwaita');
  assert.deepEqual(desktopThemeSettings({ env: { GTK_THEME: 'Arc:dark' }, home, run: noCommands }), { name: 'Arc', dark: true, font: '' });

  fs.mkdirSync(path.join(home, '.config', 'gtk-3.0'), { recursive: true });
  fs.writeFileSync(path.join(home, '.config', 'gtk-3.0', 'settings.ini'), '[Settings]\ngtk-theme-name=Arc-Lighter\ngtk-font-name=Noto Sans 11\n');
  assert.deepEqual(desktopThemeSettings({ env: {}, home, run: noCommands }), { name: 'Arc-Lighter', dark: false, font: 'Noto Sans 11' });
});

test('a GTK font name becomes a CSS font family', () => {
  assert.equal(cssFontFamily('Sans 10'), 'sans-serif, system-ui');
  assert.equal(cssFontFamily('Noto Sans Bold 11'), '"Noto Sans", sans-serif');
  assert.equal(cssFontFamily(''), '');
});

test('the colors of a theme become the colors of the app', () => {
  writeTheme('Green', {
    'gtk.css': [
      '@define-color theme_fg_color #4FFEC3;', '@define-color theme_bg_color #0F1A16;', '@define-color theme_base_color #0D1512;',
      '@define-color theme_selected_bg_color #169D69;', '@define-color theme_selected_bg_color #158F5F;',
      '@define-color theme_selected_fg_color #0D1512;', '@define-color error_color #CC0000;',
    ].join('\n'),
  });
  const theme = readDesktopTheme({ env: { GTK_THEME: 'Green' }, home, run: noCommands });
  assert.equal(theme.ok, true);
  assert.equal(theme.name, 'Green');
  assert.equal(theme.variables['color-scheme'], 'dark');
  assert.equal(theme.variables['--page-start'], '#0f1a16');
  assert.equal(theme.variables['--surface'], '#0d1512');
  assert.equal(theme.variables['--text'], '#4ffec3');
  assert.equal(theme.variables['--brand'], '#158f5f', 'the last definition of the accent');
  assert.equal(theme.variables['--on-brand'], '#0d1512');
  assert.equal(theme.variables['--danger'], '#cc0000');
});

test('Adwaita has no theme file, so its own colors are used', () => {
  const light = readDesktopTheme({ env: { GTK_THEME: 'Adwaita', XDG_DATA_DIRS: home }, home, run: noCommands });
  assert.equal(light.variables['--page-start'], '#f6f5f4');
  assert.equal(light.variables['color-scheme'], 'light');
  const dark = readDesktopTheme({ env: { GTK_THEME: 'Adwaita:dark', XDG_DATA_DIRS: home }, home, run: noCommands });
  assert.equal(dark.variables['--page-start'], '#353535');
  assert.equal(dark.variables['color-scheme'], 'dark');
});

test('a theme without colors that the app can read gives an error', () => {
  const theme = readDesktopTheme({ env: { GTK_THEME: 'Missing', XDG_DATA_DIRS: home }, home, run: noCommands });
  assert.deepEqual(theme, { ok: false, name: 'Missing', error: 'The colors of the GTK theme "Missing" were not found.' });
});

test('a theme that keeps its CSS in gtk.gresource is read with the gresource tool', () => {
  writeTheme('Bundled', { 'gtk.css': '@import url("resource:///org/example/theme/main.css");', 'gtk.gresource': '' });
  const commands = [];
  const run = (command, args) => {
    commands.push([command, ...args.slice(2)].join(' '));
    if (command === 'gresource') return '@define-color theme_bg_color #F5F6F7;\n@define-color theme_selected_bg_color #5294e2;';
    throw new Error('not found');
  };
  const theme = readDesktopTheme({ env: { GTK_THEME: 'Bundled' }, home, run });
  assert.equal(theme.variables['--page-start'], '#f5f6f7');
  assert.equal(theme.variables['--brand'], '#5294e2');
  assert.ok(commands.includes('gresource /org/example/theme/main.css'));
});

test('secondary and status texts are easy to read, also in a theme with little contrast', () => {
  writeTheme('Pale', {
    'gtk.css': [
      '@define-color theme_fg_color #5c616c;', '@define-color theme_bg_color #f5f6f7;', '@define-color theme_base_color #ffffff;',
      '@define-color theme_selected_bg_color #5294e2;', '@define-color error_color #fc4138;', '@define-color warning_color #F27835;',
    ].join('\n'),
  });
  const v = readDesktopTheme({ env: { GTK_THEME: 'Pale' }, home, run: noCommands }).variables;
  const luminance = (color) => {
    const [r, g, b] = parseColor(color, {}).map((value) => value / 255);
    const channel = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const contrast = (a, b) => {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
  };
  for (const [text, background] of [['--muted', '--surface-alt'], ['--danger-text', '--danger-surface'], ['--warning-text', '--warning-surface']]) {
    assert.ok(contrast(v[text], v[background]) >= 4.5, `${text} on ${background}: ${contrast(v[text], v[background]).toFixed(2)}`);
  }
});
