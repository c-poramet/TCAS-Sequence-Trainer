/**
 * Persistent settings: validation, clamping, change notification and the
 * config views handed to the pure generator / stats modules.
 * @module core/settings
 */
import {
  DYNAMIC_MAX, SCHEMA, STORAGE_KEYS, coerceValue, defaultOf, getSchemaEntry, valuesEqual,
} from './schema.js';
import { GEN_KEYS } from './ids.js';
import { getStorage } from './storage.js';

/** @type {Record<string, any>|null} */
let stored = null;
/** @type {any} */
let storedFor = null;
/** @type {Set<(key:string, value:any)=>void>} */
const listeners = new Set();

/**
 * @param {string} key
 * @returns {import('./schema.js').SchemaEntry}
 */
function requireEntry(key) {
  const e = getSchemaEntry(key);
  if (!e) throw new Error(`Unknown setting: ${key}`);
  return e;
}

/**
 * @param {any} adapter
 * @returns {Record<string, any>} valid non-default values found in storage
 */
function loadStored(adapter) {
  let parsed = null;
  try {
    const text = adapter.getItem(STORAGE_KEYS.settings);
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  /** @type {Record<string, any>} */
  const out = {};
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    for (const e of SCHEMA) {
      if (!Object.prototype.hasOwnProperty.call(parsed, e.key)) continue;
      const r = coerceValue(e, parsed[e.key]);
      if (r.ok && !valuesEqual(r.value, defaultOf(e))) out[e.key] = r.value;
    }
  }
  return out;
}

/** @returns {Record<string, any>} the (cached) non-default values for the current storage adapter */
function state() {
  const adapter = getStorage();
  if (stored === null || storedFor !== adapter) {
    stored = loadStored(adapter);
    storedFor = adapter;
  }
  return stored;
}

function persist() {
  const adapter = getStorage();
  try {
    if (Object.keys(state()).length === 0) adapter.removeItem(STORAGE_KEYS.settings);
    else adapter.setItem(STORAGE_KEYS.settings, JSON.stringify(state()));
  } catch (err) {
    console.warn('Could not persist settings', err);
  }
}

/**
 * Effective value of an entry (dynamic maxima applied).
 * @param {import('./schema.js').SchemaEntry} e
 * @returns {any}
 */
function effective(e) {
  const vals = state();
  let v = Object.prototype.hasOwnProperty.call(vals, e.key) ? vals[e.key] : defaultOf(e);
  const maxKey = DYNAMIC_MAX[e.key];
  if (maxKey && typeof v === 'number') v = Math.min(v, effective(requireEntry(maxKey)));
  return Array.isArray(v) ? v.slice() : v;
}

/** @returns {Record<string, string>} JSON snapshot of every effective value */
function snapshot() {
  /** @type {Record<string, string>} */
  const out = {};
  for (const e of SCHEMA) out[e.key] = JSON.stringify(effective(e));
  return out;
}

/**
 * @param {Record<string, string>} before
 * @returns {void}
 */
function emitChanges(before) {
  const after = snapshot();
  for (const e of SCHEMA) {
    if (before[e.key] === after[e.key]) continue;
    const value = getSetting(e.key);
    for (const cb of Array.from(listeners)) {
      try {
        cb(e.key, value);
      } catch (err) {
        console.error(err);
      }
    }
  }
}

/**
 * @param {string} key
 * @returns {any}
 */
export function getSetting(key) {
  return effective(requireEntry(key));
}

/**
 * Validate, clamp and store a setting. Invalid input leaves the setting unchanged.
 * @param {string} key
 * @param {any} val
 * @returns {any} the value now stored
 */
export function setSetting(key, val) {
  const e = requireEntry(key);
  const maxKey = DYNAMIC_MAX[key];
  const r = coerceValue(e, val, maxKey ? getSetting(maxKey) : undefined);
  if (!r.ok) return getSetting(key);
  const before = snapshot();
  const vals = state();
  if (valuesEqual(r.value, defaultOf(e))) delete vals[key];
  else vals[key] = r.value;
  persist();
  emitChanges(before);
  return getSetting(key);
}

/**
 * @returns {Record<string, any>} every setting with its effective value
 */
export function getAllSettings() {
  /** @type {Record<string, any>} */
  const out = {};
  for (const e of SCHEMA) out[e.key] = effective(e);
  return out;
}

/**
 * Reset the given keys (all when omitted) to their defaults.
 * @param {string[]} [keys]
 * @returns {void}
 */
export function resetSettings(keys) {
  const targets = keys === undefined ? SCHEMA.map((e) => e.key) : keys;
  for (const key of targets) requireEntry(key);
  const before = snapshot();
  const vals = state();
  for (const key of targets) delete vals[key];
  persist();
  emitChanges(before);
}

/**
 * Subscribe to changes; the callback receives `(key, value)` once per changed key.
 * @param {(key:string, value:any)=>void} cb
 * @returns {() => void} unsubscribe
 */
export function onSettingsChange(cb) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Generator configuration. A pinned `gen.poolVersion` is capped at `latest`.
 * @param {{poolVersion:number}} latest
 * @returns {Record<string, any>} GenCfg
 */
export function getGenConfig({ poolVersion }) {
  if (!Number.isSafeInteger(poolVersion) || poolVersion < 1) {
    throw new RangeError('getGenConfig: poolVersion must be an integer >= 1');
  }
  const pinned = getSetting('gen.poolVersion');
  return {
    hardRatio: getSetting('gen.hardRatio'),
    mixedChance: getSetting('gen.mixedChance'),
    cap: getSetting('gen.cap'),
    maxAttempts: getSetting('gen.maxAttempts'),
    poolVersion: pinned === null ? poolVersion : Math.min(pinned, poolVersion),
    normalTiers: getSetting('gen.normalTiers'),
    composeTiers: getSetting('gen.composeTiers'),
    rareTiers: getSetting('gen.rareTiers'),
    composeChance: getSetting('gen.composeChance'),
    minDistinct: getSetting('gen.minDistinct'),
    allowNegative: getSetting('gen.allowNegative'),
  };
}

/**
 * Stats configuration (`stats.` prefix stripped).
 * @returns {{minAttempts:number, fastRatio:number, slowRatio:number, failedRate:number, maxRecords:number}}
 */
export function getStatsConfig() {
  return {
    minAttempts: getSetting('stats.minAttempts'),
    fastRatio: getSetting('stats.fastRatio'),
    slowRatio: getSetting('stats.slowRatio'),
    failedRate: getSetting('stats.failedRate'),
    maxRecords: getSetting('stats.maxRecords'),
  };
}

/**
 * Combine a generator config with a seed and count into GenSettings (Set ID payload).
 * @param {Record<string, any>} genCfg
 * @param {{seed:string, count:number}} extra
 * @returns {Record<string, any>}
 */
export function toGenSettings(genCfg, { seed, count }) {
  /** @type {Record<string, any>} */
  const out = {};
  for (const key of GEN_KEYS) {
    const v = key === 'seed' ? seed : key === 'count' ? count : genCfg[key];
    out[key] = Array.isArray(v) ? v.slice() : v;
  }
  const termCount = getSetting('gen.termCount') ?? 6;
  if (termCount !== 6) out.termCount = termCount;
  return out;
}
