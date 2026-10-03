import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { isAppPageUrl } = require('../ipc-guard.js');

const indexPath = '/home/user/My Apps/Muriel/resources/app.asar/index.html';
const indexUrl = pathToFileURL(indexPath).href;

test('the app page may call the handlers, also with a query or a hash', () => {
  assert.equal(isAppPageUrl(indexUrl, indexPath), true);
  assert.equal(isAppPageUrl(`${indexUrl}?view=invoices`, indexPath), true);
  assert.equal(isAppPageUrl(`${indexUrl}#profile`, indexPath), true);
});

test('other pages may not call the handlers', () => {
  assert.equal(isAppPageUrl(pathToFileURL('/home/user/My Apps/Muriel/resources/app.asar/other.html').href, indexPath), false);
  assert.equal(isAppPageUrl(pathToFileURL('/tmp/index.html').href, indexPath), false);
  assert.equal(isAppPageUrl('https://example.test/index.html', indexPath), false);
  assert.equal(isAppPageUrl('about:blank', indexPath), false);
  assert.equal(isAppPageUrl('data:text/html,<p>x</p>', indexPath), false);
  assert.equal(isAppPageUrl('', indexPath), false);
  assert.equal(isAppPageUrl(undefined, indexPath), false);
});
