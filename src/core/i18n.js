/**
 * Minimal i18n: per-module string registration, `{name}` interpolation, English fallback.
 * @module core/i18n
 */
import { getSetting, onSettingsChange, setSetting } from './settings.js';

const LANGS = ['en', 'th'];
const FALLBACK_LANG = 'en';
const PLACEHOLDER = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

/** @type {Record<string, Record<string, string>>} */
const dictionaries = { en: {}, th: {} };
/** @type {Set<string>} */
const warned = new Set();
/** @type {Set<(lang:string)=>void>} */
const langListeners = new Set();
let wired = false;

/**
 * Merge strings into a language dictionary.
 * @param {'en'|'th'} lang
 * @param {Record<string, string>} dict
 * @returns {void}
 */
export function registerStrings(lang, dict) {
  if (!LANGS.includes(lang)) throw new RangeError(`Unsupported language: ${lang}`);
  Object.assign(dictionaries[lang], dict);
}

/**
 * Subscribe once to settings changes so `lang` changes reach language listeners.
 * @returns {void}
 */
function wire() {
  if (wired) return;
  wired = true;
  // settings only emit when the effective value really changed, so every `lang` event is a change
  onSettingsChange((key, value) => {
    if (key !== 'lang') return;
    for (const cb of Array.from(langListeners)) {
      try {
        cb(value);
      } catch (err) {
        console.error(err);
      }
    }
  });
}

/**
 * @returns {'en'|'th'}
 */
export function getLang() {
  wire();
  return getSetting('lang');
}

/**
 * Switch language (persisted through settings) and notify listeners.
 * @param {'en'|'th'} lang
 * @returns {void}
 */
export function setLang(lang) {
  if (!LANGS.includes(lang)) throw new RangeError(`Unsupported language: ${lang}`);
  wire();
  setSetting('lang', lang);
}

/**
 * @param {(lang:'en'|'th')=>void} cb
 * @returns {() => void} unsubscribe
 */
export function onLangChange(cb) {
  wire();
  langListeners.add(cb);
  return () => {
    langListeners.delete(cb);
  };
}

/**
 * @param {'en'|'th'} lang
 * @param {string} key
 * @returns {boolean}
 */
export function hasKey(lang, key) {
  const dict = dictionaries[lang];
  return !!dict && Object.prototype.hasOwnProperty.call(dict, key);
}

/**
 * Translate a key. Missing everywhere: returns the key and warns once.
 * @param {string} key
 * @param {Record<string, string|number>} [params]
 * @returns {string}
 */
export function t(key, params) {
  const lang = getLang();
  let text = hasKey(lang, key) ? dictionaries[lang][key] : undefined;
  if (text === undefined && hasKey(FALLBACK_LANG, key)) text = dictionaries[FALLBACK_LANG][key];
  if (text === undefined) {
    if (!warned.has(key)) {
      warned.add(key);
      console.warn(`[i18n] missing key: ${key}`);
    }
    return key;
  }
  if (!params) return text;
  return text.replace(PLACEHOLDER, (match, name) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match);
}

/**
 * Keys present in one language but absent in the other.
 * @returns {{en:string[], th:string[]}} `en` = keys missing from English, `th` = keys missing from Thai
 */
export function missingKeys() {
  const all = new Set([...Object.keys(dictionaries.en), ...Object.keys(dictionaries.th)]);
  const gaps = (/** @type {string} */ lang) =>
    Array.from(all).filter((k) => !hasKey(/** @type {'en'|'th'} */ (lang), k)).sort();
  return { en: gaps('en'), th: gaps('th') };
}
