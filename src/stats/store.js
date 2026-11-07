/**
 * Persistence of AttemptRecords under `tcas.stats.v1` (JSON array) via the core storage adapter.
 * @module stats/store
 */
import { getStorage } from '../core/storage.js';

const STORAGE_KEY = 'tcas.stats.v1';

/**
 * Structural check used to drop corrupted entries.
 * @param {any} r
 * @returns {boolean}
 */
function isRecord(r) {
  return r !== null && typeof r === 'object' && !Array.isArray(r) &&
    Number.isFinite(r.t) && Number.isFinite(r.ms) &&
    typeof r.ok === 'boolean' && Array.isArray(r.fns);
}

/**
 * Load all stored attempts. Never throws: corrupted or missing storage yields `[]`,
 * corrupted individual entries are dropped.
 * @returns {import('./analysis.js').AttemptRecord[]}
 */
export function loadRecords() {
  try {
    const raw = getStorage().getItem(STORAGE_KEY);
    if (raw === null || raw === undefined || raw === '') return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data.filter(isRecord) : [];
  } catch {
    return [];
  }
}

/**
 * Append one attempt, dropping the oldest ones beyond `maxRecords`.
 * A storage write failure (quota, private mode) is swallowed so practice is never interrupted.
 * @param {import('./analysis.js').AttemptRecord} rec
 * @param {{maxRecords:number}} opts
 * @returns {void}
 */
export function recordAttempt(rec, { maxRecords } = /** @type {any} */ ({})) {
  const records = loadRecords();
  records.push(rec);
  const limit = Math.floor(maxRecords);
  if (Number.isFinite(limit) && limit >= 0 && records.length > limit) {
    records.splice(0, records.length - limit);
  }
  try {
    getStorage().setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    /* storage unavailable: keep going */
  }
}

/**
 * Remove every stored attempt.
 * @returns {void}
 */
export function clearRecords() {
  try {
    getStorage().removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}