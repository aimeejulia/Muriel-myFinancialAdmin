import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { localeTag, systemLocales } = require('../system-locale.js');

// state.js looks up DOM elements when it loads
globalThis.window = {};
globalThis.document = {
  getElementById: () => null,
  querySelectorAll: () => [],
  createElement: () => ({}),
};
const { setDisplayLocales, formatCurrency, formatDate, formatDecimalInput } = await import('../state.js');

after(() => setDisplayLocales());

test('a POSIX locale becomes a locale tag', () => {
  assert.equal(localeTag('es_ES.UTF-8'), 'es-ES');
  assert.equal(localeTag('ca_ES@valencia'), 'ca-ES');
  assert.equal(localeTag('en_GB'), 'en-GB');
  assert.equal(localeTag('C'), '');
  assert.equal(localeTag('POSIX'), '');
  assert.equal(localeTag(''), '');
  assert.equal(localeTag('not a locale!'), '');
});

test('numbers use LC_NUMERIC and dates use LC_TIME, after LC_ALL and before LANG', () => {
  assert.deepEqual(systemLocales({ LANG: 'en_GB.UTF-8', LC_NUMERIC: 'es_ES.UTF-8', LC_TIME: 'de_DE.UTF-8' }), { number: 'es-ES', date: 'de-DE' });
  assert.deepEqual(systemLocales({ LANG: 'en_GB.UTF-8' }), { number: 'en-GB', date: 'en-GB' });
  assert.deepEqual(systemLocales({ LANG: 'en_GB.UTF-8', LC_ALL: 'fr_FR.UTF-8', LC_TIME: 'de_DE.UTF-8' }), { number: 'fr-FR', date: 'fr-FR' });
  assert.deepEqual(systemLocales({ LANG: 'C' }, 'en-US'), { number: 'en-US', date: 'en-US' });
  assert.deepEqual(systemLocales({}, ''), { number: 'en-GB', date: 'en-GB' });
});

test('amounts and dates use the formats of the desktop', () => {
  setDisplayLocales({ number: 'es-ES', date: 'es-ES' });
  assert.equal(formatCurrency(1234.5, 'EUR'), '1234,50\u00a0€');
  assert.equal(formatCurrency(12345.5, 'EUR'), '12.345,50\u00a0€');
  assert.equal(formatDate('2026-10-04'), '04/10/2026');
  assert.equal(formatDecimalInput(145.2), '145,20');
  assert.equal(formatDecimalInput(1.1403, null), '1,1403');

  setDisplayLocales({ number: 'en-US', date: 'en-US' });
  assert.equal(formatCurrency(1234.5, 'EUR'), '€1,234.50');
  assert.equal(formatDate('2026-10-04'), '10/04/2026');
  assert.equal(formatDecimalInput(145.2), '145.20');

  setDisplayLocales({ number: 'de-DE', date: 'de-DE' });
  assert.equal(formatDate('2026-10-04'), '04.10.2026');
});

test('without desktop locales, dates stay as YYYY-MM-DD and text that is not a date stays', () => {
  setDisplayLocales();
  assert.equal(formatDate('2026-10-04'), '2026-10-04');
  setDisplayLocales({ number: 'en-GB', date: 'en-GB' });
  assert.equal(formatDate(''), '');
  assert.equal(formatDate(undefined), '');
  assert.equal(formatDate('soon'), 'soon');
});
