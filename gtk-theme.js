const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

// Reads the colors and the font of the GTK theme of the desktop, so the app can look like the other apps.
// GTK 3 themes name their colors with @define-color in gtk.css, for example theme_bg_color and
// theme_selected_bg_color. A later definition replaces an earlier one, as in GTK.

// Adwaita is built into GTK and has no gtk.css file, so these are its named colors.
const ADWAITA_COLORS = {
  light: {
    theme_fg_color: '#2e3436', theme_text_color: 'black', theme_bg_color: '#f6f5f4', theme_base_color: 'white',
    theme_selected_bg_color: '#3584e4', theme_selected_fg_color: 'white', insensitive_fg_color: '#929595',
    borders: '#cdc7c2', warning_color: '#f57900', error_color: '#cc0000', success_color: '#33d17a',
  },
  dark: {
    theme_fg_color: '#eeeeec', theme_text_color: 'white', theme_bg_color: '#353535', theme_base_color: '#2d2d2d',
    theme_selected_bg_color: '#3584e4', theme_selected_fg_color: 'white', insensitive_fg_color: '#919190',
    borders: '#1b1b1b', warning_color: '#f57900', error_color: '#cc0000', success_color: '#26a269',
  },
};

const NAMED_COLORS = { black: [0, 0, 0, 1], white: [255, 255, 255, 1], transparent: [0, 0, 0, 0] };

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Splits the arguments of a color function at the commas that are not inside brackets.
function splitArguments(text) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const char of text) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function rgbToHsl([r, g, b]) {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const lightness = (max + min) / 2;
  if (max === min) return [0, 0, lightness];
  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue;
  if (max === rn) hue = (gn - bn) / delta + (gn < bn ? 6 : 0);
  else if (max === gn) hue = (bn - rn) / delta + 2;
  else hue = (rn - gn) / delta + 4;
  return [hue / 6, saturation, lightness];
}

function hslToRgb([hue, saturation, lightness]) {
  if (saturation === 0) return [lightness * 255, lightness * 255, lightness * 255];
  const toChannel = (p, q, t) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  return [toChannel(p, q, hue + 1 / 3), toChannel(p, q, hue), toChannel(p, q, hue - 1 / 3)].map((value) => value * 255);
}

// GTK shade(): multiplies the lightness and the saturation of the color.
function shade(color, factor) {
  const [hue, saturation, lightness] = rgbToHsl(color);
  const [r, g, b] = hslToRgb([hue, clamp(saturation * factor, 0, 1), clamp(lightness * factor, 0, 1)]);
  return [r, g, b, color[3]];
}

function mix(first, second, factor) {
  return first.map((value, index) => value + (second[index] - value) * factor);
}

// Reads a GTK color expression into [red, green, blue, alpha]. Gives null for an expression that it cannot read.
function parseColor(expression, defined, depth = 0) {
  const text = String(expression || '').trim();
  if (depth > 20 || !text) return null;
  if (text.startsWith('@')) return parseColor(defined[text.slice(1)], defined, depth + 1);
  if (NAMED_COLORS[text.toLowerCase()]) return [...NAMED_COLORS[text.toLowerCase()]];

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(text);
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((digit) => digit + digit).join('') : hex[1];
    const channels = digits.match(/../g).map((pair) => parseInt(pair, 16));
    return [channels[0], channels[1], channels[2], channels.length === 4 ? channels[3] / 255 : 1];
  }

  const call = /^([a-z]+)\((.*)\)$/i.exec(text);
  if (!call) return null;
  const name = call[1].toLowerCase();
  const args = splitArguments(call[2]);
  const color = (index) => parseColor(args[index], defined, depth + 1);
  const number = (index) => Number(args[index]);

  if (name === 'rgb' || name === 'rgba') {
    const values = args.map(Number);
    if (values.slice(0, 3).some((value) => !Number.isFinite(value))) return null;
    return [values[0], values[1], values[2], name === 'rgba' && Number.isFinite(values[3]) ? values[3] : 1];
  }
  if (name === 'shade' && color(0)) return shade(color(0), number(1));
  if (name === 'lighter' && color(0)) return shade(color(0), 1.3);
  if (name === 'darker' && color(0)) return shade(color(0), 0.7);
  if (name === 'alpha' && color(0)) return [...color(0).slice(0, 3), clamp(color(0)[3] * number(1), 0, 1)];
  if (name === 'mix' && color(0) && color(1)) return mix(color(0), color(1), number(2));
  return null;
}

function toCss(color) {
  const [r, g, b, a] = color.map((value, index) => (index < 3 ? Math.round(clamp(value, 0, 255)) : clamp(value, 0, 1)));
  return a >= 1 ? `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}` : `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(3))})`;
}

// Reads a theme CSS file with the files that it imports. Each import is read before the rest of the file. Many
// themes, such as Arc, keep their CSS in gtk.gresource and import it as resource:///. The gresource tool of GLib
// extracts it.
function readThemeCss(file, seen = new Set(), run = defaultRun) {
  if (seen.has(file) || !fs.existsSync(file)) return '';
  seen.add(file);
  return expandImports(fs.readFileSync(file, 'utf8'), path.dirname(file), seen, run);
}

function expandImports(css, dir, seen, run) {
  return css.replace(/@import\s+url\(\s*["']?([^"')]+)["']?\s*\)\s*;/g, (_, target) => {
    if (!target.startsWith('resource:')) return readThemeCss(path.resolve(dir, target), seen, run);
    const resource = target.replace(/^resource:\/*/, '/');
    const bundle = path.join(dir, 'gtk.gresource');
    if (seen.has(resource) || !fs.existsSync(bundle)) return '';
    seen.add(resource);
    return expandImports(runQuiet('gresource', ['extract', bundle, resource], run), dir, seen, run);
  });
}

function definedColors(css) {
  const defined = {};
  for (const match of css.matchAll(/@define-color\s+([\w-]+)\s+([^;]+);/g)) {
    defined[match[1]] = match[2].trim();
  }
  return defined;
}

function runQuiet(command, args, run) {
  try {
    return String(run(command, args) || '').trim();
  } catch {
    return '';
  }
}

function settingsIni(home) {
  try {
    return fs.readFileSync(path.join(home, '.config', 'gtk-3.0', 'settings.ini'), 'utf8');
  } catch {
    return '';
  }
}

function iniValue(ini, key) {
  return new RegExp(`^\\s*${key}\\s*=\\s*(.+?)\\s*$`, 'm').exec(ini)?.[1] || '';
}

// The name, the dark preference and the font of the GTK theme. XFCE keeps them in xfconf, GNOME in gsettings, and
// other desktops in settings.ini. GTK_THEME overrides the theme, as it does for GTK apps.
function desktopThemeSettings({ env = process.env, home = os.homedir(), run = defaultRun } = {}) {
  const ini = settingsIni(home);
  const unquote = (value) => value.replace(/^'(.*)'$/, '$1');
  const [envTheme, envVariant] = String(env.GTK_THEME || '').split(':');
  const name = envTheme
    || runQuiet('xfconf-query', ['-c', 'xsettings', '-p', '/Net/ThemeName'], run)
    || unquote(runQuiet('gsettings', ['get', 'org.gnome.desktop.interface', 'gtk-theme'], run))
    || iniValue(ini, 'gtk-theme-name')
    || 'Adwaita';
  // GTK 3 apps use the dark variant of a theme only for GTK_THEME=name:dark or gtk-application-prefer-dark-theme.
  // The color-scheme of GNOME changes only Adwaita, so it counts only for Adwaita.
  const dark = envVariant === 'dark'
    || /^(1|true)$/i.test(iniValue(ini, 'gtk-application-prefer-dark-theme'))
    || (/^adwaita$/i.test(name)
      && unquote(runQuiet('gsettings', ['get', 'org.gnome.desktop.interface', 'color-scheme'], run)) === 'prefer-dark');
  const font = runQuiet('xfconf-query', ['-c', 'xsettings', '-p', '/Gtk/FontName'], run)
    || unquote(runQuiet('gsettings', ['get', 'org.gnome.desktop.interface', 'font-name'], run))
    || iniValue(ini, 'gtk-font-name');
  return { name, dark, font };
}

function defaultRun(command, args) {
  return execFileSync(command, args, { encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] });
}

function themeDirectories(env, home) {
  const dataDirs = String(env.XDG_DATA_DIRS || '/usr/local/share:/usr/share').split(':').filter(Boolean);
  return [
    path.join(home, '.themes'),
    path.join(env.XDG_DATA_HOME || path.join(home, '.local', 'share'), 'themes'),
    ...dataDirs.map((dir) => path.join(dir, 'themes')),
  ];
}

// A GTK font name is a family and a size in points, as in "Sans 10" or "Noto Sans Bold 11".
function cssFontFamily(fontName) {
  const family = String(fontName || '').replace(/\s+\d+(\.\d+)?\s*$/, '').replace(/\s+(Bold|Italic|Regular|Medium|Light)$/gi, '').trim();
  if (!family) return '';
  const generic = { sans: 'sans-serif', 'sans-serif': 'sans-serif', serif: 'serif', monospace: 'monospace' }[family.toLowerCase()];
  return generic ? `${generic}, system-ui` : `"${family.replace(/"/g, '')}", sans-serif`;
}

function luminance([r, g, b]) {
  const channel = (value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(first, second) {
  const [light, darkest] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (darkest + 0.05);
}

// Moves a text color toward black or white until it has a contrast of at least 4.5 to 1 on its background, the WCAG
// level for normal text. A color with enough contrast does not change.
function readableOn(color, background) {
  const target = luminance(background) < 0.5 ? [255, 255, 255, 1] : [0, 0, 0, 1];
  for (let step = 0; step <= 20; step += 1) {
    const candidate = mix(color, target, step / 20);
    if (contrast(candidate, background) >= 4.5) return candidate;
  }
  return target;
}

// Changes the GTK colors into the color variables of the app.
function desktopThemeVariables(colors) {
  const get = (name, fallback) => colors[name] || fallback;
  const bg = get('theme_bg_color', [246, 245, 244, 1]);
  const fg = get('theme_fg_color', [46, 52, 54, 1]);
  const base = get('theme_base_color', bg);
  const accent = get('theme_selected_bg_color', [53, 132, 228, 1]);
  const onAccent = get('theme_selected_fg_color', [255, 255, 255, 1]);
  // Secondary text is the text color, a little toward the background, but still easy to read. The insensitive color of
  // a theme is for controls that are off, and is often too light to read.
  const muted = readableOn(mix(fg, bg, 0.3), mix(base, fg, 0.06));
  const success = get('success_color', [38, 162, 105, 1]);
  const warning = get('warning_color', [245, 121, 0, 1]);
  const danger = get('error_color', [204, 0, 0, 1]);
  const dark = luminance(bg) < 0.25;
  const sidebar = shade(bg, dark ? 0.85 : 0.95);
  const tint = (color, amount) => toCss(mix(base, color, amount));
  const statusText = (color) => toCss(readableOn(shade(color, dark ? 1.4 : 0.65), mix(base, color, 0.15)));

  return {
    'color-scheme': dark ? 'dark' : 'light',
    '--bg': toCss(sidebar),
    '--bg-deep': toCss(sidebar),
    '--surface': toCss(base),
    '--surface-strong': toCss(base),
    '--surface-alt': toCss(mix(base, fg, 0.06)),
    '--surface-tint': toCss(bg),
    '--text': toCss(fg),
    '--muted': toCss(muted),
    '--line': toCss(mix(base, fg, 0.18)),
    '--brand': toCss(accent),
    '--brand-deep': toCss(accent),
    '--brand-soft': toCss(accent),
    '--on-brand': toCss(onAccent),
    '--success': toCss(success),
    '--warning': toCss(warning),
    '--danger': toCss(danger),
    '--shadow': dark ? '0 6px 18px rgba(0, 0, 0, 0.4)' : '0 6px 18px rgba(0, 0, 0, 0.08)',
    '--page-start': toCss(bg),
    '--page-end': toCss(bg),
    '--page-glow-one': 'transparent',
    '--page-glow-two': 'transparent',
    '--sidebar-glow-one': 'transparent',
    '--sidebar-glow-two': 'transparent',
    '--sidebar-text': toCss(fg),
    '--card-start': toCss(base),
    '--card-end': toCss(base),
    '--warning-card-start': tint(warning, 0.12),
    '--warning-card-end': tint(warning, 0.08),
    '--surface-glass': toCss(base),
    '--surface-glass-strong': toCss(base),
    '--placeholder': toCss(muted),
    '--success-surface': tint(success, 0.15),
    '--success-border': tint(success, 0.45),
    '--success-text': statusText(success),
    '--warning-surface': tint(warning, 0.15),
    '--warning-border': tint(warning, 0.45),
    '--warning-text': statusText(warning),
    '--danger-surface': tint(danger, 0.15),
    '--danger-border': tint(danger, 0.45),
    '--danger-text': statusText(danger),
    '--overlay': 'rgba(0, 0, 0, 0.5)',
    '--font-family': cssFontFamily(colors.fontName) || 'system-ui, sans-serif',
  };
}

// The GTK theme of the desktop as app variables, or ok: false when no theme can be read.
function readDesktopTheme(options = {}) {
  const env = options.env || process.env;
  const home = options.home || os.homedir();
  const settings = desktopThemeSettings({ env, home, run: options.run || defaultRun });
  const files = settings.dark ? ['gtk-dark.css', 'gtk.css'] : ['gtk.css'];
  let defined = null;
  for (const dir of themeDirectories(env, home)) {
    for (const file of files) {
      const css = readThemeCss(path.join(dir, settings.name, 'gtk-3.0', file), new Set(), options.run || defaultRun);
      if (css.includes('@define-color')) {
        defined = definedColors(css);
        break;
      }
    }
    if (defined) break;
  }
  if (!defined) {
    const adwaita = /^adwaita(-dark)?$/i.exec(settings.name);
    if (!adwaita) return { ok: false, name: settings.name, error: `The colors of the GTK theme "${settings.name}" were not found.` };
    defined = ADWAITA_COLORS[settings.dark || adwaita[1] ? 'dark' : 'light'];
  }

  const colors = {};
  for (const name of Object.keys(defined)) {
    const color = parseColor(defined[name], defined);
    if (color) colors[name] = color;
  }
  colors.fontName = settings.font;
  return { ok: true, name: settings.name, dark: settings.dark, variables: desktopThemeVariables(colors) };
}

module.exports = {
  parseColor,
  definedColors,
  readThemeCss,
  desktopThemeSettings,
  desktopThemeVariables,
  cssFontFamily,
  readDesktopTheme,
  toCss,
};
