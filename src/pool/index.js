import { COMMON_ENTRIES } from './common.js';
import { ADVANCED_ENTRIES } from './advanced.js';
import '../i18n/pool_common.js';
import '../i18n/pool_advanced.js';

export const POOL_VERSION = 1;
const all = [...COMMON_ENTRIES, ...ADVANCED_ENTRIES];
const ids = new Set();
for (const entry of all) {
  if (ids.has(entry.id)) throw new Error(`Duplicate pool entry: ${entry.id}`);
  ids.add(entry.id);
  if (!/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/.test(entry.id)) throw new Error(`Invalid pool entry: ${entry.id}`);
  if (!Number.isInteger(entry.since) || entry.since < 1) throw new Error(`Invalid pool since: ${entry.id}`);
  if (![1, 2, 3, 4].includes(entry.tier)) throw new Error(`Invalid pool tier: ${entry.id}`);
  if (typeof entry.composable !== 'boolean') throw new Error(`Invalid pool composable flag: ${entry.id}`);
  if (!Number.isInteger(entry.arity) || entry.arity < 1) throw new Error(`Invalid pool arity: ${entry.id}`);
  if (!Number.isInteger(entry.maxIndex) || entry.maxIndex < 1) throw new Error(`Invalid pool maxIndex: ${entry.id}`);
  for (const method of ['sampleParams', 'evaluate', 'latex', 'definition', 'solve']) {
    if (typeof entry[method] !== 'function') throw new Error(`Invalid pool method ${method}: ${entry.id}`);
  }
}
const map = new Map(all.map((entry) => [entry.id, entry]));

/**
 * Return an entry by stable ID, or null when absent.
 * @param {string} id
 * @returns {object|null}
 */
export function getEntry(id) { return map.get(id) || null; }

/**
 * List entries sorted by ID and filtered by version, tier, and composability.
 * @param {{maxVersion?:number,tiers?:number[],composableOnly?:boolean}} options
 * @returns {object[]}
 */
export function listEntries({ maxVersion = POOL_VERSION, tiers, composableOnly = false } = {}) {
  return all.filter((e) => e.since <= maxVersion && (!tiers || tiers.includes(e.tier)) && (!composableOnly || e.composable))
    .slice().sort((a, b) => a.id.localeCompare(b.id));
}
