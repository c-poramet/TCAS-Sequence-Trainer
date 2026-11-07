/**
 * Export / import of settings and attempt records.
 * @module core/dataIO
 */
import { SCHEMA, STORAGE_KEYS, coerceValue, defaultOf, valuesEqual } from './schema.js';
import { getStorage } from './storage.js';
import { getAllSettings, getSetting, resetSettings, setSetting } from './settings.js';
import { isQuestionId } from './ids.js';

const APP_NAME = 'tcas-seq-trainer';
const FORMAT_VERSION = 1;
const BAD_IMPORT = 'core.error.badImport';
const STORAGE_ERROR = 'core.error.storage';
const MODES = ['merge', 'replace'];
const ATTEMPT_MODES = ['N', 'H'];
const ATTEMPT_SOURCES = ['set', 'trainer'];
const ATTEMPT_ANSWER_MODES = ['typed', 'mc'];
const FILE_NAME_PREFIX = 'tcas-seq-trainer-';
const FILE_NAME_EXTENSION = '.json';
const DATE_PREFIX_LENGTH = 10;
const JSON_INDENT = 2;

/**
 * @param {any} x
 * @returns {boolean}
 */
function isPlainObject(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

/**
 * Validate one attempt record and return a normalized copy, or null when invalid.
 * @param {any} r
 * @returns {Record<string, any>|null}
 */
function normalizeRecord(r) {
  if (!isPlainObject(r)) return null;
  const okAns = r.ans === null || Number.isSafeInteger(r.ans);
  const ok =
    typeof r.t === 'number' && Number.isFinite(r.t) &&
    typeof r.qid === 'string' && isQuestionId(r.qid) &&
    typeof r.ms === 'number' && Number.isFinite(r.ms) && r.ms >= 0 &&
    typeof r.ok === 'boolean' && okAns &&
    Array.isArray(r.fns) && r.fns.every((f) => typeof f === 'string') &&
    ATTEMPT_MODES.includes(r.mode) && ATTEMPT_SOURCES.includes(r.src) && ATTEMPT_ANSWER_MODES.includes(r.am);
  if (!ok) return null;
  return { t: r.t, qid: r.qid, ms: r.ms, ok: r.ok, ans: r.ans, fns: r.fns.slice(), mode: r.mode, src: r.src, am: r.am };
}

/**
 * @returns {Record<string, any>[]} valid records currently in storage
 */
function readRecords() {
  try {
    const text = getStorage().getItem(STORAGE_KEYS.stats);
    const parsed = text ? JSON.parse(text) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeRecord).filter((r) => r !== null);
  } catch {
    return [];
  }
}

/**
 * @param {Record<string, any>[]} records
 * @returns {void}
 */
function writeRecords(records) {
  try {
    getStorage().setItem(STORAGE_KEYS.stats, JSON.stringify(records));
  } catch {
    throw new Error(STORAGE_ERROR);
  }
}

/**
 * @returns {Record<string, any>} only the settings that differ from their defaults
 */
function nonDefaultSettings() {
  const all = getAllSettings();
  /** @type {Record<string, any>} */
  const out = {};
  for (const e of SCHEMA) if (!valuesEqual(all[e.key], defaultOf(e))) out[e.key] = all[e.key];
  return out;
}

/**
 * Build the export object.
 * @returns {{app:string, format:number, exportedAt:string, settings:Record<string, any>, records:Record<string, any>[]}}
 */
export function exportData() {
  return {
    app: APP_NAME,
    format: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    settings: nonDefaultSettings(),
    records: readRecords(),
  };
}

/**
 * Trigger a browser download of the export file (no-op outside a browser).
 * @returns {void}
 */
export function downloadExport() {
  if (typeof document === 'undefined' || typeof Blob === 'undefined' || !globalThis.URL?.createObjectURL) return;
  const data = exportData();
  const blob = new Blob([JSON.stringify(data, null, JSON_INDENT)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${FILE_NAME_PREFIX}${data.exportedAt.slice(0, DATE_PREFIX_LENGTH)}${FILE_NAME_EXTENSION}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Import an export file.
 * `replace` resets settings and overwrites records; `merge` applies only the imported
 * setting keys and unions records by (qid, t).
 * @param {object|string} objOrString
 * @param {{mode:'replace'|'merge'}} [opts]
 * @returns {{settings:number, records:number}} settings = imported keys applied; records = attempts stored afterwards
 * @throws {Error} message `core.error.badImport` for an invalid file
 */
export function importData(objOrString, { mode = 'merge' } = {}) {
  if (!MODES.includes(mode)) throw new TypeError('importData: mode must be "merge" or "replace"');
  let data = objOrString;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      throw new Error(BAD_IMPORT);
    }
  }
  if (!isPlainObject(data) || data.app !== APP_NAME || data.format !== FORMAT_VERSION ||
      !isPlainObject(data.settings) || !Array.isArray(data.records)) {
    throw new Error(BAD_IMPORT);
  }
  const imported = [];
  for (const rec of data.records) {
    const n = normalizeRecord(rec);
    if (!n) throw new Error(BAD_IMPORT);
    imported.push(n);
  }

  if (mode === 'replace') resetSettings();
  let applied = 0;
  for (const e of SCHEMA) {
    if (!Object.prototype.hasOwnProperty.call(data.settings, e.key)) continue;
    if (!coerceValue(e, data.settings[e.key]).ok) continue;
    setSetting(e.key, data.settings[e.key]);
    applied++;
  }

  let merged = imported;
  if (mode === 'merge') {
    const seen = new Set();
    merged = [];
    for (const rec of [...readRecords(), ...imported]) {
      const id = `${rec.t}|${rec.qid}`;
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push(rec);
    }
    merged.sort((a, b) => a.t - b.t);
  }
  const maxRecords = getSetting('stats.maxRecords');
  if (merged.length > maxRecords) merged = merged.slice(merged.length - maxRecords);
  writeRecords(merged);
  return { settings: applied, records: merged.length };
}

/**
 * Delete every stored attempt record.
 * @returns {void}
 */
export function clearRecordsData() {
  getStorage().removeItem(STORAGE_KEYS.stats);
}
