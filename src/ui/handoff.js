/** @type {object|null} */
let slot = null;

/**
 * Store an object for the next page (replaces any previous value).
 * @param {object} obj
 * @returns {void}
 */
export function setHandoff(obj) {
  slot = obj;
}

/**
 * Return the stored object (or null) and clear the slot.
 * @returns {object|null}
 */
export function takeHandoff() {
  const value = slot;
  slot = null;
  return value;
}