/**
 * Question ID and Set ID codecs (contract section 5). Hand-written strict parser,
 * canonical encoding: decode(encode(x)) deep-equals x and encode(decode(s)) === s.
 * @module core/ids
 */
import { getSchemaEntry } from './schema.js';

/** Version of the generation algorithm baked into new Set IDs. */
export const ALGO_VERSION = 1;

/** Order of the values inside a Set ID payload. */
export const GEN_KEYS = Object.freeze([
  'seed', 'count', 'hardRatio', 'mixedChance', 'cap', 'maxAttempts', 'poolVersion',
  'normalTiers', 'composeTiers', 'rareTiers', 'composeChance', 'minDistinct', 'allowNegative',
]);

const MISSING_MIN = 1;
const MISSING_MAX = 6;
const MAX_RULES = 2;
const SEED_MIN_LENGTH = 1;
const SEED_MAX_LENGTH = 64;
const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64_LOOKUP = new Map(Array.from(B64_ALPHABET, (ch, i) => [ch, i]));

/** Error thrown for every malformed question / set ID. */
export class IdError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'IdError';
  }
}

/**
 * @param {string|undefined} c
 * @returns {boolean}
 */
function isDigit(c) {
  return c !== undefined && c >= '0' && c <= '9';
}

/**
 * @param {string|undefined} c
 * @returns {boolean}
 */
function isFnChar(c) {
  return c !== undefined && ((c >= 'a' && c <= 'z') || isDigit(c) || c === '.' || c === '_');
}

/**
 * @param {any} f
 * @returns {boolean}
 */
function isFnId(f) {
  if (typeof f !== 'string' || f.length === 0) return false;
  for (const c of f) if (!isFnChar(c)) return false;
  return true;
}

/**
 * @param {any} x
 * @returns {boolean}
 */
function isPlainObject(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

// ---------------------------------------------------------------- question IDs

/**
 * @param {any} leaf
 * @param {string} where
 * @returns {string}
 */
function encodeLeaf(leaf, where) {
  if (!isPlainObject(leaf) || !isFnId(leaf.f) || !Array.isArray(leaf.p)) {
    throw new IdError(`Invalid leaf in ${where}`);
  }
  for (const p of leaf.p) {
    if (!Number.isSafeInteger(p)) throw new IdError(`Non-integer parameter in ${where}`);
  }
  return `${leaf.f}(${leaf.p.map((p) => String(p === 0 ? 0 : p)).join(',')})`;
}

/**
 * @param {any} expr
 * @param {number} index
 * @returns {string}
 */
function encodeExpr(expr, index) {
  const where = `rule ${index + 1}`;
  if (isPlainObject(expr) && 'o' in expr && 'i' in expr) {
    return `${encodeLeaf(expr.o, where)}@${encodeLeaf(expr.i, where)}`;
  }
  return encodeLeaf(expr, where);
}

/**
 * Encode a descriptor as a question ID.
 * @param {{v:number, mode:'N'|'H', missing:number, rules:any[]}} descriptor
 * @returns {string}
 * @throws {IdError}
 */
export function encodeQuestionId(descriptor) {
  const d = descriptor;
  if (!isPlainObject(d)) throw new IdError('Descriptor must be an object');
  if (!Number.isSafeInteger(d.v) || d.v < 1) throw new IdError('Descriptor version must be an integer >= 1');
  if (d.mode !== 'N' && d.mode !== 'H') throw new IdError('Descriptor mode must be N or H');
  if (!Number.isInteger(d.missing) || d.missing < MISSING_MIN || d.missing > MISSING_MAX) {
    throw new IdError('Descriptor missing must be an integer 1..6');
  }
  if (!Array.isArray(d.rules) || d.rules.length < 1 || d.rules.length > MAX_RULES) {
    throw new IdError('Descriptor must have 1 or 2 rules');
  }
  return `Q${d.v}:${d.mode}${d.missing}:${d.rules.map(encodeExpr).join('|')}`;
}

/**
 * Decode a question ID into a descriptor.
 * @param {string} id
 * @returns {{v:number, mode:'N'|'H', missing:number, rules:any[]}}
 * @throws {IdError}
 */
export function decodeQuestionId(id) {
  if (typeof id !== 'string') throw new IdError('Question ID must be a string');
  const s = id;
  let i = 0;

  /** @param {string} msg @returns {never} */
  const fail = (msg) => {
    throw new IdError(`Invalid question ID (position ${i}): ${msg}`);
  };
  /** @param {string} ch */
  const expect = (ch) => {
    if (s[i] !== ch) fail(`expected "${ch}"`);
    i++;
  };
  /** @param {boolean} allowSign @returns {number} */
  const parseInteger = (allowSign) => {
    const negative = allowSign && s[i] === '-';
    if (negative) i++;
    const start = i;
    while (isDigit(s[i])) i++;
    if (i === start) fail('expected digits');
    const digits = s.slice(start, i);
    if (digits.length > 1 && digits[0] === '0') fail('leading zero');
    if (negative && digits === '0') fail('negative zero');
    const n = Number(digits);
    if (!Number.isSafeInteger(n)) fail('integer too large');
    return negative ? -n : n;
  };
  const parseLeaf = () => {
    const start = i;
    while (isFnChar(s[i])) i++;
    if (i === start) fail('expected function id');
    const f = s.slice(start, i);
    expect('(');
    const p = [];
    if (s[i] !== ')') {
      p.push(parseInteger(true));
      while (s[i] === ',') {
        i++;
        p.push(parseInteger(true));
      }
    }
    expect(')');
    return { f, p };
  };
  const parseExpr = () => {
    const outer = parseLeaf();
    if (s[i] !== '@') return outer;
    i++;
    const inner = parseLeaf();
    if (s[i] === '@') fail('composition chains longer than 2 are not allowed');
    return { o: outer, i: inner };
  };

  expect('Q');
  const v = parseInteger(false);
  if (v < 1) fail('version must be >= 1');
  expect(':');
  const mode = s[i];
  if (mode !== 'N' && mode !== 'H') fail('mode must be N or H');
  i++;
  const missingChar = s[i];
  if (!isDigit(missingChar)) fail('missing must be a digit');
  const missing = Number(missingChar);
  if (missing < MISSING_MIN || missing > MISSING_MAX) fail('missing must be 1..6');
  i++;
  expect(':');
  const rules = [parseExpr()];
  if (s[i] === '|') {
    i++;
    rules.push(parseExpr());
    if (s[i] === '|') fail('more than 2 rules');
  }
  if (i !== s.length) fail('unexpected trailing characters');
  return { v, mode, missing, rules };
}

/**
 * @param {any} s
 * @returns {boolean}
 */
export function isQuestionId(s) {
  if (typeof s !== 'string') return false;
  try {
    decodeQuestionId(s);
    return true;
  } catch (err) {
    if (err instanceof IdError) return false;
    throw err;
  }
}

// ---------------------------------------------------------------------- set IDs

/**
 * @param {Uint8Array} bytes
 * @returns {string} unpadded base64url
 */
function bytesToBase64Url(bytes) {
  let out = '';
  const len = bytes.length;
  let k = 0;
  for (; k + 2 < len; k += 3) {
    const n = (bytes[k] << 16) | (bytes[k + 1] << 8) | bytes[k + 2];
    out += B64_ALPHABET[(n >> 18) & 63] + B64_ALPHABET[(n >> 12) & 63] + B64_ALPHABET[(n >> 6) & 63] + B64_ALPHABET[n & 63];
  }
  const rest = len - k;
  if (rest === 1) {
    const n = bytes[k] << 16;
    out += B64_ALPHABET[(n >> 18) & 63] + B64_ALPHABET[(n >> 12) & 63];
  } else if (rest === 2) {
    const n = (bytes[k] << 16) | (bytes[k + 1] << 8);
    out += B64_ALPHABET[(n >> 18) & 63] + B64_ALPHABET[(n >> 12) & 63] + B64_ALPHABET[(n >> 6) & 63];
  }
  return out;
}

/**
 * @param {string} text base64url without padding
 * @returns {Uint8Array|null} null when the text is not valid base64url
 */
function base64UrlToBytes(text) {
  if (text.length % 4 === 1) return null;
  const values = [];
  for (const ch of text) {
    const v = B64_LOOKUP.get(ch);
    if (v === undefined) return null;
    values.push(v);
  }
  const bytes = [];
  for (let k = 0; k < values.length; k += 4) {
    const a = values[k];
    const b = values[k + 1];
    const c = values[k + 2];
    const d = values[k + 3];
    bytes.push(((a << 2) | (b >> 4)) & 255);
    if (c !== undefined) bytes.push(((b << 4) | (c >> 2)) & 255);
    if (d !== undefined) bytes.push(((c << 6) | d) & 255);
  }
  return Uint8Array.from(bytes);
}

/**
 * @param {string} key schema key
 * @param {any} v
 * @param {'int'|'float'} kind
 * @returns {boolean}
 */
function inSchemaRange(key, v, kind) {
  const e = getSchemaEntry(key);
  if (!e || typeof v !== 'number' || !Number.isFinite(v)) return false;
  if (kind === 'int' && !Number.isInteger(v)) return false;
  if (e.min !== undefined && v < e.min) return false;
  if (e.max !== undefined && v > e.max) return false;
  return true;
}

/**
 * @param {string} key schema key
 * @param {any} list
 * @returns {boolean}
 */
function isValidTierList(key, list) {
  return Array.isArray(list) && list.length > 0 && list.every((x) => inSchemaRange(key, x, 'int'));
}

/**
 * Validate generation settings strictly and return a normalized copy in GEN_KEYS order.
 * @param {any} s
 * @returns {Record<string, any>}
 * @throws {IdError}
 */
function normalizeGenSettings(s) {
  if (!isPlainObject(s)) throw new IdError('Generation settings must be an object');
  /** @type {Array<[string, boolean]>} */
  const checks = [
    ['seed', typeof s.seed === 'string' && s.seed.length >= SEED_MIN_LENGTH && s.seed.length <= SEED_MAX_LENGTH],
    ['count', inSchemaRange('gen.maxSetSize', s.count, 'int') && s.count >= 1],
    ['hardRatio', inSchemaRange('gen.hardRatio', s.hardRatio, 'float')],
    ['mixedChance', inSchemaRange('gen.mixedChance', s.mixedChance, 'float')],
    ['cap', inSchemaRange('gen.cap', s.cap, 'int')],
    ['maxAttempts', inSchemaRange('gen.maxAttempts', s.maxAttempts, 'int')],
    ['poolVersion', inSchemaRange('gen.poolVersion', s.poolVersion, 'int')],
    ['normalTiers', isValidTierList('gen.normalTiers', s.normalTiers)],
    ['composeTiers', isValidTierList('gen.composeTiers', s.composeTiers)],
    ['rareTiers', isValidTierList('gen.rareTiers', s.rareTiers)],
    ['composeChance', inSchemaRange('gen.composeChance', s.composeChance, 'float')],
    ['minDistinct', inSchemaRange('gen.minDistinct', s.minDistinct, 'int')],
    ['allowNegative', typeof s.allowNegative === 'boolean'],
  ];
  for (const [key, ok] of checks) if (!ok) throw new IdError(`Invalid generation setting: ${key}`);
  /** @type {Record<string, any>} */
  const out = {};
  for (const key of GEN_KEYS) out[key] = Array.isArray(s[key]) ? s[key].slice() : s[key];
  return out;
}

/**
 * Encode generation settings as a Set ID.
 * @param {Record<string, any>} genSettings
 * @param {number} [algo]
 * @returns {string}
 * @throws {IdError}
 */
export function encodeSetId(genSettings, algo = ALGO_VERSION) {
  if (!Number.isSafeInteger(algo) || algo < 1) throw new IdError('Algorithm version must be an integer >= 1');
  const norm = normalizeGenSettings(genSettings);
  const json = JSON.stringify(GEN_KEYS.map((key) => norm[key]));
  return `S${algo}-${bytesToBase64Url(new TextEncoder().encode(json))}`;
}

/**
 * Decode a Set ID.
 * @param {string} sid
 * @returns {{algo:number, settings:Record<string, any>}}
 * @throws {IdError}
 */
export function decodeSetId(sid) {
  if (typeof sid !== 'string') throw new IdError('Set ID must be a string');
  const fail = (/** @type {string} */ msg) => {
    throw new IdError(`Invalid set ID: ${msg}`);
  };
  if (sid[0] !== 'S') fail('must start with S');
  let i = 1;
  const start = i;
  while (isDigit(sid[i])) i++;
  if (i === start) fail('missing algorithm version');
  const algoText = sid.slice(start, i);
  if (algoText.length > 1 && algoText[0] === '0') fail('leading zero in algorithm version');
  const algo = Number(algoText);
  if (!Number.isSafeInteger(algo) || algo < 1 || algo > ALGO_VERSION) fail('unsupported algorithm version');
  if (sid[i] !== '-') fail('expected "-"');
  i++;
  const payload = sid.slice(i);
  if (payload.length === 0) fail('empty payload');
  const bytes = base64UrlToBytes(payload);
  if (!bytes) fail('payload is not base64url');
  let values;
  try {
    values = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return fail('payload is not valid UTF-8 JSON');
  }
  if (!Array.isArray(values) || values.length !== GEN_KEYS.length) fail('payload has the wrong shape');
  /** @type {Record<string, any>} */
  const raw = {};
  GEN_KEYS.forEach((key, index) => {
    raw[key] = values[index];
  });
  const settings = normalizeGenSettings(raw);
  if (encodeSetId(settings, algo) !== sid) fail('non-canonical encoding');
  return { algo, settings };
}

/**
 * @param {any} s
 * @returns {boolean}
 */
export function isSetId(s) {
  if (typeof s !== 'string') return false;
  try {
    decodeSetId(s);
    return true;
  } catch (err) {
    if (err instanceof IdError) return false;
    throw err;
  }
}
