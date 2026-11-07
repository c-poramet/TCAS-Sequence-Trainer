/**
 * Storage adapter with graceful fallback to memory.
 * `localStorage` is only touched lazily (never at import time).
 * @module core/storage
 */

/**
 * @typedef {{getItem:(key:string)=>string|null, setItem:(key:string,value:string)=>void, removeItem:(key:string)=>void}} StorageAdapter
 */

const PROBE_KEY = 'tcas.probe';

/** @type {StorageAdapter|null} */
let override = null;
/** @type {StorageAdapter|null} */
let auto = null;

/**
 * In-memory adapter (also used by tests).
 * @returns {StorageAdapter}
 */
export function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

/**
 * @returns {StorageAdapter|null} adapter over `localStorage`, or null when unavailable
 */
function detectLocalStorage() {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    ls.setItem(PROBE_KEY, '1');
    ls.removeItem(PROBE_KEY);
    return {
      getItem: (key) => ls.getItem(key),
      setItem: (key, value) => ls.setItem(key, value),
      removeItem: (key) => ls.removeItem(key),
    };
  } catch {
    return null;
  }
}

/**
 * Current adapter: the one set by `setStorage`, else `localStorage`, else memory.
 * @returns {StorageAdapter}
 */
export function getStorage() {
  if (override) return override;
  if (!auto) auto = detectLocalStorage() ?? createMemoryStorage();
  return auto;
}

/**
 * Install an adapter (pass `null` to return to automatic detection).
 * @param {StorageAdapter|null} adapter
 * @returns {void}
 */
export function setStorage(adapter) {
  if (adapter !== null && (typeof adapter?.getItem !== 'function' || typeof adapter.setItem !== 'function' || typeof adapter.removeItem !== 'function')) {
    throw new TypeError('Storage adapter needs getItem, setItem and removeItem');
  }
  override = adapter;
}
