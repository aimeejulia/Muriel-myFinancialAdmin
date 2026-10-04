// The locales of the desktop for numbers and dates. On Linux, the region settings set LC_NUMERIC and LC_TIME, and
// LC_ALL overrides both. LANG is the default for all of them, for example LANG=en_GB.UTF-8 with LC_TIME=es_ES.UTF-8.

// Changes a POSIX locale such as es_ES.UTF-8 or ca_ES@valencia into a BCP 47 tag such as es-ES. The C and POSIX
// locales have no region formats, so they give an empty text.
function localeTag(value) {
  const name = String(value || '').trim().split('.')[0].split('@')[0];
  if (!name || name === 'C' || name === 'POSIX') return '';
  try {
    return Intl.getCanonicalLocales(name.replace(/_/g, '-'))[0] || '';
  } catch {
    return '';
  }
}

function firstLocale(...values) {
  for (const value of values) {
    const tag = localeTag(value);
    if (tag) return tag;
  }
  return '';
}

function systemLocales(env = process.env, fallback = 'en-GB') {
  return {
    number: firstLocale(env.LC_ALL, env.LC_NUMERIC, env.LANG) || localeTag(fallback) || 'en-GB',
    date: firstLocale(env.LC_ALL, env.LC_TIME, env.LANG) || localeTag(fallback) || 'en-GB',
  };
}

module.exports = {
  localeTag,
  systemLocales,
};
