/**
 * Deterministic seeded RNG: xmur3(seed) -> sfc32, first 15 outputs discarded.
 * All integer math is 32-bit (`>>> 0`, `| 0`, `Math.imul`), so output is bit-exact everywhere.
 * `randomSeed()` is the ONLY function in the app allowed to use crypto / Math.random.
 * @module core/rng
 */

/**
 * @typedef {Object} Rng
 * @property {() => number} next                         float in [0, 1)
 * @property {(min:number, max:number) => number} int    integer in [min, max] inclusive
 * @property {(p:number) => boolean} chance              true with probability p (always consumes one draw)
 * @property {<T>(arr:ArrayLike<T>) => T} pick           uniform element
 * @property {<T>(items:T[], weightFn:(item:T)=>number) => T} weighted  weighted element (one draw)
 * @property {<T>(arr:T[]) => T[]} shuffle               NEW array (Fisher-Yates)
 * @property {(label:string) => Rng} fork                createRng(seed + '/' + label)
 */

const WARMUP_DISCARDS = 15;
const UINT32_RANGE = 4294967296;
const SEED_LENGTH = 8;
const BASE36 = 36;
const FORK_SEPARATOR = '/';

/**
 * xmur3 string hash: returns a generator of 32-bit unsigned integers.
 * @param {string} str
 * @returns {() => number}
 */
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function nextHash() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/**
 * sfc32 generator.
 * @param {number} a
 * @param {number} b
 * @param {number} c
 * @param {number} d
 * @returns {() => number} float in [0, 1)
 */
function sfc32(a, b, c, d) {
  return function nextFloat() {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / UINT32_RANGE;
  };
}

/**
 * Create a deterministic RNG from a string seed.
 * @param {string} seed
 * @returns {Rng}
 */
export function createRng(seed) {
  const seedText = String(seed);
  const hash = xmur3(seedText);
  const gen = sfc32(hash(), hash(), hash(), hash());
  for (let i = 0; i < WARMUP_DISCARDS; i++) gen();

  /** @type {Rng} */
  const rng = {
    next() {
      return gen();
    },
    int(min, max) {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
        throw new RangeError(`rng.int: invalid range [${min}, ${max}]`);
      }
      return min + Math.floor(gen() * (max - min + 1));
    },
    chance(p) {
      return gen() < p;
    },
    pick(arr) {
      if (!arr || arr.length === 0) throw new RangeError('rng.pick: empty collection');
      return arr[Math.floor(gen() * arr.length)];
    },
    weighted(items, weightFn) {
      if (!items || items.length === 0) throw new RangeError('rng.weighted: empty collection');
      const weights = items.map((item, index) => {
        const w = Number(weightFn(item, index));
        return Number.isFinite(w) && w > 0 ? w : 0;
      });
      let total = 0;
      for (const w of weights) total += w;
      if (total <= 0) throw new RangeError('rng.weighted: total weight must be positive');
      const r = gen() * total;
      let cumulative = 0;
      let lastPositive = -1;
      for (let i = 0; i < items.length; i++) {
        if (weights[i] <= 0) continue;
        lastPositive = i;
        cumulative += weights[i];
        if (r < cumulative) return items[i];
      }
      return items[lastPositive];
    },
    shuffle(arr) {
      const out = Array.from(arr);
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(gen() * (i + 1));
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
      }
      return out;
    },
    fork(label) {
      return createRng(seedText + FORK_SEPARATOR + String(label));
    },
  };
  return rng;
}

/**
 * Fresh non-deterministic seed (8 base36 chars). The only non-deterministic function of the app.
 * @returns {string}
 */
export function randomSeed() {
  const cryptoObj = globalThis.crypto;
  let out = '';
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const buf = new Uint32Array(SEED_LENGTH);
    cryptoObj.getRandomValues(buf);
    for (let i = 0; i < SEED_LENGTH; i++) out += (buf[i] % BASE36).toString(BASE36);
    return out;
  }
  for (let i = 0; i < SEED_LENGTH; i++) out += Math.floor(Math.random() * BASE36).toString(BASE36);
  return out;
}
