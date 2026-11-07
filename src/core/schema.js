/**
 * Settings schema (contract section 6) plus the validation helpers that every
 * settings consumer shares. DOM-free and import-safe in Node.
 * @module core/schema
 */

/**
 * @typedef {'int'|'float'|'bool'|'enum'|'enumList'|'intList'|'string'} SettingType
 * @typedef {{key:string, group:string, type:SettingType, default:any, min?:number, max?:number, options?:string[]}} SchemaEntry
 */

/** Storage keys used by the app. */
export const STORAGE_KEYS = Object.freeze({
  settings: 'tcas.settings.v1',
  stats: 'tcas.stats.v1',
});

/** Settings whose effective maximum is another setting's current value. */
export const DYNAMIC_MAX = Object.freeze({ 'gen.count': 'gen.maxSetSize' });

const GENERAL_GROUP = 'general';
const LANGS = Object.freeze(['en', 'th']);
const BUCKETS = Object.freeze(['easy', 'normal', 'hard', 'failed']);
const TIER_MIN = 1;
const TIER_MAX = 4;

/**
 * Group of a settings key: text before the first dot, or `general`.
 * @param {string} key
 * @returns {string}
 */
export function groupOf(key) {
  const dot = key.indexOf('.');
  return dot === -1 ? GENERAL_GROUP : key.slice(0, dot);
}

/** @returns {'en'|'th'} */
export function detectLang() {
  return 'th';
}

/**
 * @param {string} key
 * @param {SettingType} type
 * @param {any} def
 * @param {{min?:number, max?:number, options?:string[]}} [extra]
 * @returns {SchemaEntry}
 */
function entry(key, type, def, extra = {}) {
  const e = { key, group: groupOf(key), type, default: def };
  if (extra.min !== undefined) e.min = extra.min;
  if (extra.max !== undefined) e.max = extra.max;
  if (extra.options !== undefined) e.options = Object.freeze(extra.options.slice());
  return Object.freeze(e);
}

/** `lang` default is resolved lazily through a getter. */
const langEntry = Object.freeze(
  Object.defineProperties(
    { key: 'lang', group: GENERAL_GROUP, type: 'enum', options: LANGS },
    { default: { enumerable: true, get: detectLang } },
  ),
);

/** @type {ReadonlyArray<SchemaEntry>} */
export const SCHEMA = Object.freeze([
  langEntry,
  entry('answerMode', 'enum', 'mc', { options: ['typed', 'mc'] }),
  entry('mcChoices', 'int', 5, { min: 3, max: 8 }),
  entry('showTimer', 'bool', true),
  entry('gen.count', 'int', 20, { min: 1, max: 5000 }),
  entry('gen.maxSetSize', 'int', 2000, { min: 1, max: 5000 }),
  entry('gen.hardRatio', 'float', 0.25, { min: 0, max: 1 }),
  entry('gen.mixedChance', 'float', 0.5, { min: 0, max: 1 }),
  entry('gen.cap', 'int', 2500, { min: 10, max: 1000000 }),
  entry('gen.maxAttempts', 'int', 300, { min: 1, max: 5000 }),
  entry('gen.poolVersion', 'int', null, { min: 1 }),
  entry('gen.normalTiers', 'intList', [1, 2], { min: TIER_MIN, max: TIER_MAX }),
  entry('gen.composeTiers', 'intList', [1, 2, 3], { min: TIER_MIN, max: TIER_MAX }),
  entry('gen.rareTiers', 'intList', [3, 4], { min: TIER_MIN, max: TIER_MAX }),
  entry('gen.composeChance', 'float', 0.5, { min: 0, max: 1 }),
  entry('gen.minDistinct', 'int', 4, { min: 2, max: 6 }),
  entry('gen.allowNegative', 'bool', true),
  entry('trainer.count', 'int', 20, { min: 0, max: 1000 }),
  entry('trainer.buckets', 'enumList', BUCKETS.slice(), { options: BUCKETS.slice() }),
  entry('stats.minAttempts', 'int', 3, { min: 1, max: 50 }),
  entry('stats.fastRatio', 'float', 0.8, { min: 0.1, max: 1 }),
  entry('stats.slowRatio', 'float', 1.25, { min: 1, max: 5 }),
  entry('stats.failedRate', 'float', 0.4, { min: 0, max: 1 }),
  entry('stats.maxRecords', 'int', 20000, { min: 100, max: 200000 }),
  entry('print.includeAnswers', 'bool', true),
  entry('print.includeSolutions', 'bool', false),
]);

const BY_KEY = new Map(SCHEMA.map((e) => [e.key, e]));

/**
 * @param {string} key
 * @returns {SchemaEntry|undefined}
 */
export function getSchemaEntry(key) {
  return BY_KEY.get(key);
}

/**
 * A setting accepts `null` only when its default is `null` (gen.poolVersion).
 * @param {SchemaEntry} e
 * @returns {boolean}
 */
export function isNullable(e) {
  return e.default === null;
}

/**
 * Fresh copy of an entry's default (lists are copied).
 * @param {SchemaEntry} e
 * @returns {any}
 */
export function defaultOf(e) {
  const d = e.default;
  return Array.isArray(d) ? d.slice() : d;
}

/**
 * Structural equality for setting values (primitives and flat lists).
 * @param {any} a
 * @param {any} b
 * @returns {boolean}
 */
export function valuesEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * @param {any} raw
 * @returns {number} NaN when not numeric
 */
function toNumber(raw) {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string' && raw.trim() !== '') return Number(raw);
  return NaN;
}

/**
 * @param {number} n
 * @param {number|undefined} min
 * @param {number|undefined} max
 * @returns {number}
 */
function clamp(n, min, max) {
  let out = n;
  if (min !== undefined && out < min) out = min;
  if (max !== undefined && out > max) out = max;
  return out;
}

/**
 * Validate / normalize a raw value for an entry. Numbers are clamped, lists are
 * de-duplicated and sorted, invalid input is rejected.
 * @param {SchemaEntry} e
 * @param {any} raw
 * @param {number} [maxOverride] dynamic maximum (e.g. gen.maxSetSize for gen.count)
 * @returns {{ok:true, value:any}|{ok:false}}
 */
export function coerceValue(e, raw, maxOverride) {
  const max = maxOverride !== undefined ? Math.min(maxOverride, e.max ?? Infinity) : e.max;
  switch (e.type) {
    case 'int':
    case 'float': {
      if (isNullable(e) && (raw === null || raw === undefined || raw === '')) return { ok: true, value: null };
      const n = toNumber(raw);
      if (!Number.isFinite(n)) return { ok: false };
      const v = e.type === 'int' ? Math.round(n) : n;
      return { ok: true, value: clamp(v, e.min, max) };
    }
    case 'bool': {
      if (typeof raw === 'boolean') return { ok: true, value: raw };
      if (raw === 'true') return { ok: true, value: true };
      if (raw === 'false') return { ok: true, value: false };
      return { ok: false };
    }
    case 'enum':
      return typeof raw === 'string' && e.options.includes(raw) ? { ok: true, value: raw } : { ok: false };
    case 'enumList': {
      const items = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',').map((s) => s.trim()) : null;
      if (!items) return { ok: false };
      const kept = e.options.filter((opt) => items.includes(opt));
      return kept.length > 0 ? { ok: true, value: kept } : { ok: false };
    }
    case 'intList': {
      const items = Array.isArray(raw)
        ? raw
        : typeof raw === 'string'
          ? raw.split(',').map((s) => s.trim()).filter((s) => s !== '')
          : null;
      if (!items) return { ok: false };
      const nums = [];
      for (const item of items) {
        const n = toNumber(item);
        if (!Number.isFinite(n)) return { ok: false };
        nums.push(clamp(Math.round(n), e.min, e.max));
      }
      const unique = Array.from(new Set(nums)).sort((x, y) => x - y);
      return unique.length > 0 ? { ok: true, value: unique } : { ok: false };
    }
    case 'string':
      return typeof raw === 'string' ? { ok: true, value: raw } : { ok: false };
    default:
      return { ok: false };
  }
}
