/**
 * Pool-B: advanced and rare function families (tiers 3-4) for the TGAT2 sequence trainer.
 *
 * Exports `ADVANCED_ENTRIES` (array of PoolEntry, see contract section 7).
 * Every entry additionally carries a `normalize(p)` helper (used by `latex()` and by tests).
 *
 * Documented limits (maxIndex = largest n that evaluate() supports; evaluate() returns null beyond it
 * and whenever an intermediate or final value is not a safe integer):
 *  - seq.prime / seq.prime_sq : maxIndex 200 in the argument; the prime table holds all primes <= 4000
 *                               (550 primes), so n + m1 must be <= 550.
 *  - recurrences (rec.*)      : maxIndex 30, computed iteratively from the seeds; null on overflow
 *                               (rec.pow_sum overflows from n = 15 on, rec.cum_prod earlier).
 *  - fact.add                 : maxIndex 18 (19! is not a safe integer).
 *  - pow.nn_mod               : maxIndex 13 (14^14 is not a safe integer).
 *  - dig.sum_pow              : maxIndex 30 (BigInt power, never overflows).
 *  - dig.rev_arith, seq.alt_ap, mix.tri_sq_alt : maxIndex 60.
 *
 * Pure module: no DOM, no randomness other than the injected `rng`, no imports.
 */

/** @typedef {{next:()=>number, int:(min:number,max:number)=>number, chance:(p:number)=>boolean, pick:(arr:any[])=>any, weighted:(items:any[],fn:(x:any)=>number)=>any, shuffle:(arr:any[])=>any[], fork:(label:string)=>any}} Rng */
/** @typedef {{key:string, params?:Record<string,string|number>, math?:string[]}} Step */
/** @typedef {{n:number, value:number}} Point */
/** @typedef {{points:Point[], hidden:number|null}} SolveCtx */
/**
 * @typedef {Object} PoolEntry
 * @property {string} id
 * @property {number} since
 * @property {1|2|3|4} tier
 * @property {boolean} composable
 * @property {number} arity
 * @property {number} maxIndex
 * @property {(rng:Rng, ctx:{cap:number, role:'solo'|'outer'|'inner'})=>number[]} sampleParams
 * @property {(p:number[], n:number)=>number|null} evaluate
 * @property {(p:number[], arg?:string)=>string} latex
 * @property {(p:number[])=>string[]} definition
 * @property {(p:number[], ctx:SolveCtx)=>Step[]} solve
 * @property {(p:number[])=>Object} normalize  canonical, parameter-only description of the sequence
 */

// ---------------------------------------------------------------------------
// Constants (pool-internal; nothing here is a user setting)
// ---------------------------------------------------------------------------

const SINCE = 1;
const TERMS = 6;
const REC_MAX_INDEX = 30;
const PRIME_MAX_INDEX = 200;
const PRIME_SIEVE_LIMIT = 4000;
const FACT_MAX_INDEX = 18;
const POWER_MAX_INDEX = 13;
const DIGIT_MAX_INDEX = 30;
const PATTERN_MAX_INDEX = 60;
const INNER_MAX_VALUE = 30;
const SAMPLE_RETRIES = 60;
const DETECT_COUNT = 3;
const VERIFY_COUNT = 2;
const SIMPLE_ARG = /^\d+$|^n$/;
const DIGITS_ONLY = /^\d+$/;
const FIB_GAP_PAIRS = Object.freeze([[1, 2], [1, 3], [2, 3]]);

/** Inclusive [min, max] sampling ranges per entry. */
const RANGE = Object.freeze({
  primeShift: [0, 12],
  primeShiftInner: [0, 2],
  primeSqShift: [0, 4],
  primeSqAdd: [-3, 3],
  factAdd: [-5, 5],
  nnModulus: [5, 30],
  revFirst: [10, 40],
  revStep: [2, 15],
  digBase: [2, 9],
  altFirst: [-5, 20],
  altStep: [-5, 8],
  triSqAdd: [-4, 4],
  triSqAddInner: [0, 3],
  fibSeed: [1, 6],
  linMul: [2, 4],
  linAdd: [-3, 5],
  linSeed: [1, 4],
  tribSeed: [1, 4],
  altOpSeed: [1, 4],
  altOpAdd: [1, 5],
  altOpMul: [2, 3],
  sumPrevSeed: [1, 3],
  sumPrevAdd: [0, 3],
  cumSeed: [1, 3],
  cumAdd: [-1, 0],
  prodSeed: [1, 3],
  lin2Mul1: [1, 3],
  lin2Mul2: [1, 2],
  lin2Seed: [1, 4],
  powSumSeed: [1, 5],
});

// ---------------------------------------------------------------------------
// Safe integer arithmetic (null = overflow / undefined)
// ---------------------------------------------------------------------------

/** @param {number|null} x @returns {number|null} */
function safe(x) {
  return typeof x === 'number' && Number.isSafeInteger(x) ? x : null;
}

/** @param {number|null} a @param {number|null} b @returns {number|null} */
function add(a, b) {
  return a === null || b === null ? null : safe(a + b);
}

/** @param {number|null} a @param {number|null} b @returns {number|null} */
function mul(a, b) {
  return a === null || b === null ? null : safe(a * b);
}

/** @param {number} base @param {number} exp @returns {number|null} */
function ipow(base, exp) {
  let r = 1;
  for (let i = 0; i < exp; i++) {
    r = /** @type {number} */ (mul(r, base));
    if (r === null) return null;
  }
  return r;
}

/** @param {number} n @returns {number|null} */
function factorial(n) {
  let r = 1;
  for (let i = 2; i <= n; i++) {
    r = /** @type {number} */ (mul(r, i));
    if (r === null) return null;
  }
  return r;
}

/** @param {any} n @returns {boolean} */
function isIndex(n) {
  return Number.isInteger(n) && n >= 1;
}

/** @param {number} n @returns {number} */
function triangular(n) {
  return (n * (n + 1)) / 2;
}

/** @param {number} x positive safe integer @returns {number|null} digits reversed */
function reverseDigits(x) {
  const r = Number(String(x).split('').reverse().join(''));
  return safe(r);
}

/** @param {string} digitString @returns {number[]} */
function digitsOf(digitString) {
  return digitString.split('').map(Number);
}

// ---------------------------------------------------------------------------
// Primes (lazy, deterministic)
// ---------------------------------------------------------------------------

/** @type {number[]|null} */
let primeTable = null;

/** @returns {number[]} all primes <= PRIME_SIEVE_LIMIT, ascending */
function primes() {
  if (primeTable === null) {
    const sieve = new Uint8Array(PRIME_SIEVE_LIMIT + 1);
    const out = [];
    for (let i = 2; i <= PRIME_SIEVE_LIMIT; i++) {
      if (sieve[i] === 0) {
        out.push(i);
        for (let j = i * i; j <= PRIME_SIEVE_LIMIT; j += i) sieve[j] = 1;
      }
    }
    primeTable = out;
  }
  return primeTable;
}

/** @param {number} k 1-based index @returns {number|null} the k-th prime */
function primeAt(k) {
  const t = primes();
  return Number.isInteger(k) && k >= 1 && k <= t.length ? t[k - 1] : null;
}

/** @param {number} v @returns {number} 1-based index of prime v, or -1 */
function primeIndex(v) {
  const t = primes();
  let lo = 0;
  let hi = t.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (t[mid] === v) return mid + 1;
    if (t[mid] < v) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// LaTeX helpers
// ---------------------------------------------------------------------------

/** @param {string} arg @returns {string} arg wrapped in \left(\right) unless trivial */
function wrap(arg) {
  return SIMPLE_ARG.test(arg) ? arg : `\\left(${arg}\\right)`;
}

/** @param {string} arg @param {number} k @returns {string} arg + k */
function shift(arg, k) {
  if (k === 0) return arg;
  if (DIGITS_ONLY.test(arg)) return String(Number(arg) + k);
  return k > 0 ? `${arg}+${k}` : `${arg}-${-k}`;
}

/** @param {number} v @returns {string} "+v" or "-v" */
function signed(v) {
  return v < 0 ? `-${-v}` : `+${v}`;
}

/** @param {number} v @returns {string} v, parenthesised when negative */
function numStr(v) {
  return v < 0 ? `(${v})` : String(v);
}

/** @param {number} c @returns {string} "" for 0, else signed(c) */
function constStr(c) {
  return c === 0 ? '' : signed(c);
}

/** @param {number} c @returns {string} "-c" / "+|c|" used after a value to subtract c; "" for 0 */
function minusStr(c) {
  return c === 0 ? '' : c > 0 ? `-${c}` : `+${-c}`;
}

/** @param {string} expr @param {number} c @returns {string} expr + c */
function addConst(expr, c) {
  return c === 0 ? expr : `${expr}${signed(c)}`;
}

/** @param {number} c coefficient @param {string} body @returns {string} c*body (c = 0 gives "") */
function coef(c, body) {
  if (c === 0) return '';
  if (c === 1) return body;
  if (c === -1) return `-${body}`;
  return `${c}${/^\d/.test(body) ? '\\cdot ' : ''}${body}`;
}

/** @param {number} c @param {number} x @returns {string} numeric c*x as LaTeX */
function coefNum(c, x) {
  if (c === 0) return '';
  if (c === 1) return numStr(x);
  if (c === -1) return `-${numStr(x)}`;
  return `${c}\\cdot ${numStr(x)}`;
}

/** @param {string[]} parts @returns {string} parts joined with explicit signs ("0" when empty) */
function joinTerms(parts) {
  const ps = parts.filter((s) => s !== '');
  if (ps.length === 0) return '0';
  return ps.reduce((acc, s, i) => (i === 0 ? s : s.startsWith('-') ? `${acc}${s}` : `${acc}+${s}`), '');
}

/** @param {number[]} xs @returns {string} numeric sum "x+y-z" */
function sumNums(xs) {
  return joinTerms(xs.map((x) => String(x)));
}

/** @param {number[]} xs @returns {string} numeric product "x\cdot y" */
function prodNums(xs) {
  return xs.map(numStr).join('\\cdot ');
}

/** @param {number} a @param {number} c @param {string} body @returns {string} a + c*body */
function affine(a, c, body) {
  return joinTerms([a !== 0 ? String(a) : '', coef(c, body)]);
}

/** @param {string} id @returns {string} */
function aSub(id) {
  return `a_{${id}}`;
}

/** @param {string} first @param {string} second @param {string} condFirst @param {string} condSecond @returns {string} */
function cases(first, second, condFirst, condSecond) {
  return `\\begin{cases}${first}&${condFirst}\\\\${second}&${condSecond}\\end{cases}`;
}

// ---------------------------------------------------------------------------
// Sampling helpers
// ---------------------------------------------------------------------------

/** @param {Rng} rng @param {number[]} range @returns {number} */
function draw(rng, range) {
  return rng.int(range[0], range[1]);
}

/**
 * Draw until `accept` holds (bounded retries), else return the verified `fallback`.
 * @param {()=>number[]} gen @param {(p:number[])=>boolean} accept @param {number[]} fallback @returns {number[]}
 */
function sampleAccepted(gen, accept, fallback) {
  for (let i = 0; i < SAMPLE_RETRIES; i++) {
    const p = gen();
    if (accept(p)) return p;
  }
  return fallback.slice();
}

/**
 * Acceptance test for the inner role: first TERMS values are integers in [1, INNER_MAX_VALUE].
 * @param {(p:number[], n:number)=>number|null} evaluate @returns {(p:number[])=>boolean}
 */
function innerAccept(evaluate) {
  return (p) => {
    for (let n = 1; n <= TERMS; n++) {
      const v = evaluate(p, n);
      if (v === null || v < 1 || v > INNER_MAX_VALUE) return false;
    }
    return true;
  };
}

// ---------------------------------------------------------------------------
// solve() infrastructure
// ---------------------------------------------------------------------------

/**
 * Visible points, sorted by n, without the hidden position.
 * @param {SolveCtx} ctx @returns {Point[]}
 */
function cleanPoints(ctx) {
  const hidden = ctx && typeof ctx.hidden === 'number' ? ctx.hidden : null;
  const pts = ctx && Array.isArray(ctx.points) ? ctx.points : [];
  return pts
    .filter((q) => q && Number.isInteger(q.n) && Number.isFinite(q.value) && q.n !== hidden)
    .map((q) => ({ n: q.n, value: q.value }))
    .sort((x, y) => x.n - y.n);
}

/** @param {string[]} parts @param {number} value @returns {string[]} parts without a trailing duplicate of the final value */
function trimParts(parts, value) {
  const out = parts.filter((s) => s !== '');
  while (out.length > 0 && out[out.length - 1] === String(value)) out.pop();
  return out;
}

/**
 * @typedef {Object} ClosedSpec
 * @property {string} id
 * @property {(p:number[], pts:Point[])=>string[]} detect  LaTeX lines derived from visible points only
 * @property {(p:number[], n:number)=>string[]} chain      intermediate substitution steps for f(n)
 * @property {(p:number[])=>string[]} [extraDefinition]
 * @property {(p:number[])=>Record<string,number>} [ruleParams]
 */

/**
 * Build the PoolEntry methods `definition` and `solve` for a closed-form entry.
 * @param {Omit<PoolEntry,'definition'|'solve'>} base @param {ClosedSpec} spec @returns {PoolEntry}
 */
function closedEntry(base, spec) {
  /** @type {PoolEntry} */
  const entry = /** @type {any} */ ({ ...base });
  entry.definition = (p) => [`f(n)=${entry.latex(p, 'n')}`, ...(spec.extraDefinition ? spec.extraDefinition(p) : [])];
  entry.solve = (p, ctx) => {
    const pts = cleanPoints(ctx);
    const key = (name) => `pool.${spec.id}.${name}`;
    const detect = spec.detect(p, pts);
    const verify = pts.slice(-VERIFY_COUNT).map(({ n, value }) => {
      const mid = trimParts(spec.chain(p, n), value);
      return [`f(${n})`, ...mid, String(value)].join('=');
    });
    /** @type {Step} */
    const rule = { key: key('rule'), math: entry.definition(p) };
    if (spec.ruleParams) rule.params = spec.ruleParams(p);
    return [
      { key: key('observe'), math: pts.length ? [pts.map(({ n, value }) => `f(${n})=${value}`).join(',\\;')] : [] },
      { key: key('detect'), math: detect.length ? detect : [entry.definition(p)[0]] },
      rule,
      { key: key('verify'), math: verify },
    ];
  };
  return entry;
}

/**
 * @typedef {Object} RecSpec
 * @property {string} id
 * @property {1|2|3|4} tier
 * @property {boolean} composable
 * @property {number} arity
 * @property {(p:number[])=>boolean} [valid]
 * @property {(p:number[])=>number[]} seeds         normalized seed values f(1..s) (fresh array)
 * @property {(p:number[], k:number, get:(i:number)=>number)=>number|null} next  term k > seeds.length
 * @property {(p:number[], k:number)=>number[]} deps indices term k depends on
 * @property {(p:number[], k:number, get:(i:number)=>number)=>string[]} parts symbolic then numeric substitution of term k
 * @property {(p:number[])=>string} ruleLine
 * @property {(rng:Rng, ctx:{cap:number, role:string})=>number[]} sample
 * @property {(p:number[])=>Object} normalize
 * @property {(p:number[])=>Record<string,number>} [ruleParams]
 */

/** @param {RecSpec} spec @param {number[]} p @param {number} n @returns {number|null} */
function evalRec(spec, p, n) {
  if (!isIndex(n) || n > REC_MAX_INDEX) return null;
  if (spec.valid && !spec.valid(p)) return null;
  const vals = spec.seeds(p);
  if (!vals.every((v) => Number.isSafeInteger(v))) return null;
  const get = (i) => vals[i - 1];
  for (let k = vals.length + 1; k <= n; k++) {
    const x = spec.next(p, k, get);
    if (x === null || !Number.isSafeInteger(x)) return null;
    vals.push(x);
  }
  return vals[n - 1];
}

/** @param {RecSpec} spec @param {number[]} p @returns {string[]} definition lines (rule, seeds) */
function recDefinition(spec, p) {
  const seeds = spec.seeds(p);
  return [spec.ruleLine(p), seeds.map((v, i) => `${aSub(String(i + 1))}=${v}`).join(',\\;')];
}

/** @param {RecSpec} spec @param {number[]} p @param {SolveCtx} ctx @returns {Step[]} */
function recSolve(spec, p, ctx) {
  const hidden = ctx && typeof ctx.hidden === 'number' ? ctx.hidden : null;
  const pts = cleanPoints(ctx);
  const known = new Map(pts.map((q) => [q.n, q.value]));
  /** value of term i if visible or generated by the rule; undefined for the hidden term */
  const getter = (i) => {
    if (known.has(i)) return known.get(i);
    if (i === hidden) return undefined;
    const v = evalRec(spec, p, i);
    return v === null ? undefined : v;
  };
  const seedCount = spec.seeds(p).length;
  const key = (name) => `pool.${spec.id}.${name}`;

  const checks = [];
  for (const { n: k, value } of pts) {
    if (k <= seedCount) continue;
    const deps = spec.deps(p, k);
    if (!deps.every((i) => i >= 1 && getter(i) !== undefined)) continue;
    checks.push(`${aSub(String(k))}=${trimParts(spec.parts(p, k, getter), value).join('=')}=${value}`);
  }

  let verify = checks.slice(1, 1 + VERIFY_COUNT);
  if (verify.length < VERIFY_COUNT) verify = checks.slice(0, VERIFY_COUNT);
  if (verify.length < VERIFY_COUNT) {
    const filler = pts.slice(0, VERIFY_COUNT - verify.length).map(({ n, value }) => `${aSub(String(n))}=${value}`);
    verify = verify.concat(filler);
  }

  const visibleSeeds = [];
  for (let i = 1; i <= seedCount; i++) if (known.has(i)) visibleSeeds.push(`${aSub(String(i))}=${known.get(i)}`);
  const ruleMath = [spec.ruleLine(p)];
  if (visibleSeeds.length) ruleMath.push(visibleSeeds.join(',\\;'));

  /** @type {Step} */
  const rule = { key: key('rule'), math: ruleMath };
  if (spec.ruleParams) rule.params = spec.ruleParams(p);
  return [
    { key: key('observe'), math: pts.length ? [pts.map(({ n, value }) => `${aSub(String(n))}=${value}`).join(',\\;')] : [] },
    { key: key('detect'), math: checks.length ? [checks[0]] : [spec.ruleLine(p)] },
    rule,
    { key: key('verify'), math: verify },
  ];
}

/** @param {RecSpec} spec @returns {PoolEntry} */
function recEntry(spec) {
  const inner = innerAccept((p, n) => evalRec(spec, p, n));
  /** @type {PoolEntry} */
  const entry = {
    id: spec.id,
    since: SINCE,
    tier: spec.tier,
    composable: spec.composable,
    arity: spec.arity,
    maxIndex: REC_MAX_INDEX,
    normalize: spec.normalize,
    sampleParams: (rng, ctx) => {
      if (ctx && ctx.role === 'inner' && INNER_FALLBACK[spec.id]) {
        return sampleAccepted(() => spec.sample(rng, ctx), inner, INNER_FALLBACK[spec.id]);
      }
      return spec.sample(rng, ctx);
    },
    evaluate: (p, n) => evalRec(spec, p, n),
    latex: (p, arg = 'n') => `a_{${arg}}`,
    definition: (p) => recDefinition(spec, p),
    solve: (p, ctx) => recSolve(spec, p, ctx),
  };
  return entry;
}

/** Verified fallbacks for the inner role (all of the first six terms are in [1, INNER_MAX_VALUE]). */
const INNER_FALLBACK = Object.freeze({
  'rec.fib_gap': [1, 2, 1, 2, 0],
  'rec.lin1': [1, 2, 1],
  'seq.prime': [0],
  'dig.sum_pow': [2],
  'seq.alt_ap': [1, 2, 10, 3],
  'mix.tri_sq_alt': [0, 0],
});

// ---------------------------------------------------------------------------
// Closed-form entries
// ---------------------------------------------------------------------------

/** seq.prime: f(n) = p_(n+m1), p_k the k-th prime. params [m1] */
const SEQ_PRIME = closedEntry(
  {
    id: 'seq.prime',
    since: SINCE,
    tier: 3,
    composable: true,
    arity: 1,
    maxIndex: PRIME_MAX_INDEX,
    normalize: (p) => ({ shift: p[0] }),
    sampleParams: (rng, ctx) => [draw(rng, ctx && ctx.role === 'inner' ? RANGE.primeShiftInner : RANGE.primeShift)],
    evaluate: (p, n) => (isIndex(n) && n <= PRIME_MAX_INDEX ? primeAt(n + p[0]) : null),
    latex: (p, arg = 'n') => `p_{${shift(arg, p[0])}}`,
  },
  {
    id: 'seq.prime',
    ruleParams: (p) => ({ k: p[0] + 1 }),
    extraDefinition: () => ['p_{1}=2,\\;p_{2}=3,\\;p_{3}=5,\\;p_{4}=7,\\;p_{5}=11,\\ldots'],
    detect: (p, pts) =>
      pts.slice(0, DETECT_COUNT).map(({ n, value }) => {
        const k = primeIndex(value);
        return k < 0 ? `f(${n})=${value}` : `f(${n})=${value}=p_{${k}},\\;${k}-${n}=${k - n}`;
      }),
    chain: (p, n) => {
      const k = n + p[0];
      return [p[0] !== 0 ? `p_{${n}${signed(p[0])}}` : '', `p_{${k}}`];
    },
  },
);

/** seq.prime_sq: f(n) = p_(n+m1)^2 + m2. params [m1, m2] */
const SEQ_PRIME_SQ = closedEntry(
  {
    id: 'seq.prime_sq',
    since: SINCE,
    tier: 4,
    composable: false,
    arity: 2,
    maxIndex: PRIME_MAX_INDEX,
    normalize: (p) => ({ shift: p[0], add: p[1] }),
    sampleParams: (rng) => [draw(rng, RANGE.primeSqShift), draw(rng, RANGE.primeSqAdd)],
    evaluate: (p, n) => {
      if (!isIndex(n) || n > PRIME_MAX_INDEX) return null;
      const q = primeAt(n + p[0]);
      return q === null ? null : add(mul(q, q), p[1]);
    },
    latex: (p, arg = 'n') => addConst(`p_{${shift(arg, p[0])}}^{2}`, p[1]),
  },
  {
    id: 'seq.prime_sq',
    ruleParams: (p) => ({ k: p[0] + 1 }),
    extraDefinition: () => ['p_{1}=2,\\;p_{2}=3,\\;p_{3}=5,\\;p_{4}=7,\\;p_{5}=11,\\ldots'],
    detect: (p, pts) =>
      pts.slice(0, DETECT_COUNT).map(({ n, value }) => {
        const x = value - p[1];
        const q = Math.round(Math.sqrt(x));
        const k = x > 0 && q * q === x ? primeIndex(q) : -1;
        return k < 0
          ? `f(${n})=${value}`
          : `f(${n})${minusStr(p[1])}=${x}=${q}^{2}=p_{${k}}^{2},\\;${k}-${n}=${k - n}`;
      }),
    chain: (p, n) => {
      const k = n + p[0];
      const q = primeAt(k);
      const c = constStr(p[1]);
      return [p[0] !== 0 ? `p_{${n}${signed(p[0])}}^{2}${c}` : '', `p_{${k}}^{2}${c}`, `${q}^{2}${c}`];
    },
  },
);

/** fact.add: f(n) = n! + m1. params [m1] */
const FACT_ADD = closedEntry(
  {
    id: 'fact.add',
    since: SINCE,
    tier: 3,
    composable: false,
    arity: 1,
    maxIndex: FACT_MAX_INDEX,
    normalize: (p) => ({ add: p[0] }),
    sampleParams: (rng) => [draw(rng, RANGE.factAdd)],
    evaluate: (p, n) => (isIndex(n) && n <= FACT_MAX_INDEX ? add(factorial(n), p[0]) : null),
    latex: (p, arg = 'n') => addConst(`${wrap(arg)}!`, p[0]),
  },
  {
    id: 'fact.add',
    detect: (p, pts) =>
      pts.slice(0, DETECT_COUNT).map(({ n, value }) => {
        const x = value - p[0];
        return x === factorial(n) ? `f(${n})${minusStr(p[0])}=${x}=${n}!` : `f(${n})=${value}`;
      }),
    chain: (p, n) => {
      const c = constStr(p[0]);
      return [`${n}!${c}`, `${factorial(n)}${c}`];
    },
  },
);

/** pow.nn_mod: f(n) = n^n mod m1 (m1 >= 2). params [m1] */
const POW_NN_MOD = closedEntry(
  {
    id: 'pow.nn_mod',
    since: SINCE,
    tier: 4,
    composable: false,
    arity: 1,
    maxIndex: POWER_MAX_INDEX,
    normalize: (p) => ({ modulus: p[0] }),
    sampleParams: (rng) => [draw(rng, RANGE.nnModulus)],
    evaluate: (p, n) => {
      if (!isIndex(n) || n > POWER_MAX_INDEX || !Number.isInteger(p[0]) || p[0] < 2) return null;
      const x = ipow(n, n);
      return x === null ? null : x % p[0];
    },
    latex: (p, arg = 'n') => `${wrap(arg)}^{${arg}}\\bmod ${p[0]}`,
  },
  {
    id: 'pow.nn_mod',
    ruleParams: (p) => ({ m: p[0] }),
    detect: (p, pts) =>
      pts.slice(0, DETECT_COUNT).map(({ n, value }) => {
        const x = ipow(n, n);
        return x === null ? `f(${n})=${value}` : `${n}^{${n}}=${x}=${Math.floor(x / p[0])}\\cdot ${p[0]}+${value}`;
      }),
    chain: (p, n) => [`${n}^{${n}}\\bmod ${p[0]}`, `${ipow(n, n)}\\bmod ${p[0]}`],
  },
);

/** dig.rev_arith: f(n) = rev(a + d(n-1)), rev = digit reversal. params [a, d] */
const DIG_REV_ARITH = closedEntry(
  {
    id: 'dig.rev_arith',
    since: SINCE,
    tier: 4,
    composable: false,
    arity: 2,
    maxIndex: PATTERN_MAX_INDEX,
    normalize: (p) => ({ first: p[0], step: p[1] }),
    sampleParams: (rng) =>
      sampleAccepted(
        () => [draw(rng, RANGE.revFirst), draw(rng, RANGE.revStep)],
        ([a, d]) => {
          for (let n = 1; n <= TERMS; n++) if ((a + d * (n - 1)) % 10 === 0) return false;
          return true;
        },
        [12, 3],
      ),
    evaluate: (p, n) => {
      if (!isIndex(n) || n > PATTERN_MAX_INDEX) return null;
      const x = add(p[0], mul(p[1], n - 1));
      return x === null || x < 1 ? null : reverseDigits(x);
    },
    latex: (p, arg = 'n') => {
      const nm1 = shift(arg, -1);
      return `\\operatorname{rev}\\left(${affine(p[0], p[1], `\\left(${nm1}\\right)`)}\\right)`;
    },
  },
  {
    id: 'dig.rev_arith',
    ruleParams: (p) => ({ a: p[0], d: p[1] }),
    detect: (p, pts) => {
      const shown = pts.slice(0, DETECT_COUNT);
      const rev = shown.map(({ n, value }) => ({ n, value, r: reverseDigits(value) }));
      const lines = rev.map(({ value, r }) => `\\operatorname{rev}\\left(${value}\\right)=${r}`);
      if (rev.length >= 2 && rev[0].r !== null && rev[1].r !== null) {
        const dn = rev[1].n - rev[0].n;
        const dv = rev[1].r - rev[0].r;
        if (dn > 0 && dv % dn === 0) lines.push(`\\frac{${rev[1].r}-${rev[0].r}}{${dn}}=${dv / dn}`);
      }
      return lines;
    },
    chain: (p, n) => {
      const x = p[0] + p[1] * (n - 1);
      return [`\\operatorname{rev}\\left(${p[0]}${signed(p[1])}\\cdot ${n - 1}\\right)`, `\\operatorname{rev}\\left(${x}\\right)`];
    },
  },
);

/** dig.sum_pow: f(n) = digit sum of b^n. params [b] (b >= 2) */
const DIG_SUM_POW = closedEntry(
  {
    id: 'dig.sum_pow',
    since: SINCE,
    tier: 4,
    composable: true,
    arity: 1,
    maxIndex: DIGIT_MAX_INDEX,
    normalize: (p) => ({ base: p[0] }),
    sampleParams: (rng, ctx) => {
      const gen = () => [draw(rng, RANGE.digBase)];
      if (ctx && ctx.role === 'inner') return sampleAccepted(gen, innerAccept(DIG_SUM_POW_EVAL), INNER_FALLBACK['dig.sum_pow']);
      return gen();
    },
    evaluate: (p, n) => DIG_SUM_POW_EVAL(p, n),
    latex: (p, arg = 'n') => `\\operatorname{ds}\\left(${p[0]}^{${arg}}\\right)`,
  },
  {
    id: 'dig.sum_pow',
    ruleParams: (p) => ({ b: p[0] }),
    detect: (p, pts) =>
      pts.slice(0, DETECT_COUNT).map(({ n, value }) => {
        const s = powString(p[0], n);
        return s === null ? `f(${n})=${value}` : `${p[0]}^{${n}}=${s},\\;${digitsOf(s).join('+')}=${value}`;
      }),
    chain: (p, n) => {
      const s = powString(p[0], n);
      return [`\\operatorname{ds}\\left(${p[0]}^{${n}}\\right)`, `\\operatorname{ds}\\left(${s}\\right)`, digitsOf(String(s)).join('+')];
    },
  },
);

/** @param {number} b @param {number} n @returns {string|null} decimal string of b^n (BigInt, exact) */
function powString(b, n) {
  if (!Number.isInteger(b) || b < 2 || !isIndex(n) || n > DIGIT_MAX_INDEX) return null;
  return (BigInt(b) ** BigInt(n)).toString();
}

/** @param {number[]} p @param {number} n @returns {number|null} digit sum of p[0]^n */
function DIG_SUM_POW_EVAL(p, n) {
  const s = powString(p[0], n);
  return s === null ? null : digitsOf(s).reduce((acc, d) => acc + d, 0);
}

/** seq.alt_ap: odd n -> a1 + d1(n-1)/2, even n -> a2 + d2(n-2)/2. params [a1, d1, a2, d2] */
const SEQ_ALT_AP = closedEntry(
  {
    id: 'seq.alt_ap',
    since: SINCE,
    tier: 3,
    composable: true,
    arity: 4,
    maxIndex: PATTERN_MAX_INDEX,
    normalize: (p) => ({ odd: { first: p[0], step: p[1] }, even: { first: p[2], step: p[3] } }),
    sampleParams: (rng, ctx) => {
      const gen = () => [draw(rng, RANGE.altFirst), draw(rng, RANGE.altStep), draw(rng, RANGE.altFirst), draw(rng, RANGE.altStep)];
      const distinct = (p) => (p[0] !== p[2] || p[1] !== p[3]) && (p[1] !== 0 || p[3] !== 0);
      if (ctx && ctx.role === 'inner') {
        const ok = innerAccept(SEQ_ALT_AP_EVAL);
        return sampleAccepted(gen, (p) => distinct(p) && ok(p), INNER_FALLBACK['seq.alt_ap']);
      }
      return sampleAccepted(gen, distinct, [1, 2, 10, 3]);
    },
    evaluate: (p, n) => SEQ_ALT_AP_EVAL(p, n),
    latex: (p, arg = 'n') =>
      cases(
        affine(p[0], p[1], `\\frac{${shift(arg, -1)}}{2}`),
        affine(p[2], p[3], `\\frac{${shift(arg, -2)}}{2}`),
        `${wrap(arg)}\\bmod 2=1`,
        `${wrap(arg)}\\bmod 2=0`,
      ),
  },
  {
    id: 'seq.alt_ap',
    ruleParams: (p) => ({ a1: p[0], d1: p[1], a2: p[2], d2: p[3] }),
    detect: (p, pts) => {
      const lines = [];
      for (const parity of [1, 0]) {
        const group = pts.filter((q) => q.n % 2 === parity).slice(0, 2);
        if (group.length < 2) continue;
        const [x, y] = group;
        const h = (y.n - x.n) / 2;
        const d = (y.value - x.value) / h;
        lines.push(`\\frac{f(${y.n})-f(${x.n})}{${h}}=\\frac{${y.value}-${numStr(x.value)}}{${h}}=${d}`);
      }
      return lines;
    },
    chain: (p, n) => {
      const odd = n % 2 === 1;
      const a = odd ? p[0] : p[2];
      const d = odd ? p[1] : p[3];
      const r = odd ? 1 : 2;
      const k = (n - r) / 2;
      if (d === 0) return [`${a}`];
      return [`${a}${signed(d)}\\cdot\\frac{${n}-${r}}{2}`, `${a}${signed(d)}\\cdot ${k}`];
    },
  },
);

/** @param {number[]} p @param {number} n @returns {number|null} */
function SEQ_ALT_AP_EVAL(p, n) {
  if (!isIndex(n) || n > PATTERN_MAX_INDEX) return null;
  return n % 2 === 1 ? add(p[0], mul(p[1], (n - 1) / 2)) : add(p[2], mul(p[3], (n - 2) / 2));
}

/** mix.tri_sq_alt: n = 2k-1 -> k^2 + m1, n = 2k -> k(k+1)/2 + m2. params [m1, m2] */
const MIX_TRI_SQ_ALT = closedEntry(
  {
    id: 'mix.tri_sq_alt',
    since: SINCE,
    tier: 4,
    composable: true,
    arity: 2,
    maxIndex: PATTERN_MAX_INDEX,
    normalize: (p) => ({ squareAdd: p[0], triangularAdd: p[1] }),
    sampleParams: (rng, ctx) => {
      if (ctx && ctx.role === 'inner') {
        return sampleAccepted(
          () => [draw(rng, RANGE.triSqAddInner), draw(rng, RANGE.triSqAddInner)],
          innerAccept(MIX_TRI_SQ_ALT_EVAL),
          INNER_FALLBACK['mix.tri_sq_alt'],
        );
      }
      return [draw(rng, RANGE.triSqAdd), draw(rng, RANGE.triSqAdd)];
    },
    evaluate: (p, n) => MIX_TRI_SQ_ALT_EVAL(p, n),
    latex: (p, arg = 'n') =>
      cases(
        addConst(`\\frac{${wrap(shift(arg, 1))}^{2}}{4}`, p[0]),
        addConst(`\\frac{${wrap(arg)}\\left(${shift(arg, 2)}\\right)}{8}`, p[1]),
        `${wrap(arg)}\\bmod 2=1`,
        `${wrap(arg)}\\bmod 2=0`,
      ),
  },
  {
    id: 'mix.tri_sq_alt',
    ruleParams: (p) => ({ m1: p[0], m2: p[1] }),
    detect: (p, pts) =>
      pts.slice(0, DETECT_COUNT).map(({ n, value }) => {
        if (n % 2 === 1) {
          const k = (n + 1) / 2;
          return `f(${n})${minusStr(p[0])}=${value - p[0]}=${k}^{2}`;
        }
        const k = n / 2;
        return `f(${n})${minusStr(p[1])}=${value - p[1]}=\\frac{${k}\\cdot ${k + 1}}{2}`;
      }),
    chain: (p, n) => {
      if (n % 2 === 1) {
        const k = (n + 1) / 2;
        return [`${k}^{2}${constStr(p[0])}`, `${k * k}${constStr(p[0])}`];
      }
      const k = n / 2;
      return [`\\frac{${k}\\cdot ${k + 1}}{2}${constStr(p[1])}`, `${triangular(k)}${constStr(p[1])}`];
    },
  },
);

/** @param {number[]} p @param {number} n @returns {number|null} */
function MIX_TRI_SQ_ALT_EVAL(p, n) {
  if (!isIndex(n) || n > PATTERN_MAX_INDEX) return null;
  if (n % 2 === 1) {
    const k = (n + 1) / 2;
    return add(k * k, p[0]);
  }
  const k = n / 2;
  return add(triangular(k), p[1]);
}

// ---------------------------------------------------------------------------
// Recurrence entries
// ---------------------------------------------------------------------------

/** rec.fib_gap: f(n) = f(n-m1) + f(n-m2), 1 <= m1 < m2 <= 3; seeds f(1..m2). params [m1, m2, s1, s2, s3] (s3 unused when m2 = 2) */
const REC_FIB_GAP = recEntry({
  id: 'rec.fib_gap',
  tier: 3,
  composable: true,
  arity: 5,
  valid: (p) => Number.isInteger(p[0]) && Number.isInteger(p[1]) && p[0] >= 1 && p[0] < p[1] && p[1] <= 3,
  normalize: (p) => ({ m1: p[0], m2: p[1], seeds: p.slice(2, 2 + p[1]) }),
  seeds: (p) => p.slice(2, 2 + p[1]),
  next: (p, k, get) => add(get(k - p[0]), get(k - p[1])),
  deps: (p, k) => [k - p[0], k - p[1]],
  parts: (p, k, get) => [
    `${aSub(String(k - p[0]))}+${aSub(String(k - p[1]))}`,
    sumNums([get(k - p[0]), get(k - p[1])]),
  ],
  ruleLine: (p) => `a_{n}=a_{n-${p[0]}}+a_{n-${p[1]}},\\;n\\ge ${p[1] + 1}`,
  ruleParams: (p) => ({ m1: p[0], m2: p[1] }),
  sample: (rng) => {
    const [m1, m2] = rng.pick(FIB_GAP_PAIRS);
    const seeds = [draw(rng, RANGE.fibSeed), draw(rng, RANGE.fibSeed), draw(rng, RANGE.fibSeed)];
    if (m2 === 2) seeds[2] = 0;
    return [m1, m2, ...seeds];
  },
});

/** rec.pow_sum: f(n) = f(n-1) + n^(n-1), f(1) = s. params [s] */
const REC_POW_SUM = recEntry({
  id: 'rec.pow_sum',
  tier: 4,
  composable: false,
  arity: 1,
  normalize: (p) => ({ seeds: [p[0]] }),
  seeds: (p) => [p[0]],
  next: (p, k, get) => add(get(k - 1), ipow(k, k - 1)),
  deps: (p, k) => [k - 1],
  parts: (p, k, get) => [`${aSub(String(k - 1))}+${k}^{${k - 1}}`, sumNums([get(k - 1), ipow(k, k - 1)])],
  ruleLine: () => 'a_{n}=a_{n-1}+n^{n-1},\\;n\\ge 2',
  sample: (rng) => [draw(rng, RANGE.powSumSeed)],
});

/** rec.lin1: f(n) = m1 f(n-1) + m2, f(1) = s. params [m1, m2, s] */
const REC_LIN1 = recEntry({
  id: 'rec.lin1',
  tier: 3,
  composable: true,
  arity: 3,
  normalize: (p) => ({ mul: p[0], add: p[1], seeds: [p[2]] }),
  seeds: (p) => [p[2]],
  next: (p, k, get) => add(mul(p[0], get(k - 1)), p[1]),
  deps: (p, k) => [k - 1],
  parts: (p, k, get) => [
    joinTerms([coef(p[0], aSub(String(k - 1))), p[1] !== 0 ? String(p[1]) : '']),
    joinTerms([coefNum(p[0], get(k - 1)), p[1] !== 0 ? String(p[1]) : '']),
  ],
  ruleLine: (p) => `a_{n}=${joinTerms([coef(p[0], 'a_{n-1}'), p[1] !== 0 ? String(p[1]) : ''])},\\;n\\ge 2`,
  ruleParams: (p) => ({ m1: p[0], m2: p[1] }),
  sample: (rng) => [draw(rng, RANGE.linMul), draw(rng, RANGE.linAdd), draw(rng, RANGE.linSeed)],
});

/** rec.trib: f(n) = f(n-1) + f(n-2) + f(n-3), seeds f(1..3). params [s1, s2, s3] */
const REC_TRIB = recEntry({
  id: 'rec.trib',
  tier: 4,
  composable: false,
  arity: 3,
  normalize: (p) => ({ seeds: p.slice(0, 3) }),
  seeds: (p) => p.slice(0, 3),
  next: (p, k, get) => add(add(get(k - 1), get(k - 2)), get(k - 3)),
  deps: (p, k) => [k - 1, k - 2, k - 3],
  parts: (p, k, get) => [
    `${aSub(String(k - 1))}+${aSub(String(k - 2))}+${aSub(String(k - 3))}`,
    sumNums([get(k - 1), get(k - 2), get(k - 3)]),
  ],
  ruleLine: () => 'a_{n}=a_{n-1}+a_{n-2}+a_{n-3},\\;n\\ge 4',
  sample: (rng) => [draw(rng, RANGE.tribSeed), draw(rng, RANGE.tribSeed), draw(rng, RANGE.tribSeed)],
});

/** rec.alt_op: even n: f(n) = f(n-1) + m1; odd n >= 3: f(n) = m2 f(n-1); f(1) = s. params [s, m1, m2] */
const REC_ALT_OP = recEntry({
  id: 'rec.alt_op',
  tier: 4,
  composable: false,
  arity: 3,
  normalize: (p) => ({ seeds: [p[0]], addEven: p[1], mulOdd: p[2] }),
  seeds: (p) => [p[0]],
  next: (p, k, get) => (k % 2 === 0 ? add(get(k - 1), p[1]) : mul(get(k - 1), p[2])),
  deps: (p, k) => [k - 1],
  parts: (p, k, get) =>
    k % 2 === 0
      ? [addConst(aSub(String(k - 1)), p[1]), sumNums([get(k - 1), p[1]])]
      : [coef(p[2], aSub(String(k - 1))), coefNum(p[2], get(k - 1))],
  ruleLine: (p) =>
    `a_{n}=${cases(addConst('a_{n-1}', p[1]), coef(p[2], 'a_{n-1}'), 'n\\bmod 2=0', 'n\\bmod 2=1,\\;n\\ge 3')}`,
  ruleParams: (p) => ({ m1: p[1], m2: p[2] }),
  sample: (rng) => [draw(rng, RANGE.altOpSeed), draw(rng, RANGE.altOpAdd), draw(rng, RANGE.altOpMul)],
});

/** rec.sum_prev: f(n) = f(1) + ... + f(n-1) + m1, f(1) = s. params [s, m1] */
const REC_SUM_PREV = recEntry({
  id: 'rec.sum_prev',
  tier: 4,
  composable: false,
  arity: 2,
  normalize: (p) => ({ seeds: [p[0]], add: p[1] }),
  seeds: (p) => [p[0]],
  next: (p, k, get) => {
    let s = p[1];
    for (let i = 1; i < k; i++) s = /** @type {number} */ (add(s, get(i)));
    return s;
  },
  deps: (p, k) => Array.from({ length: k - 1 }, (_, i) => i + 1),
  parts: (p, k, get) => {
    const sym = k - 1 === 1 ? 'a_{1}' : k - 1 === 2 ? 'a_{1}+a_{2}' : `a_{1}+a_{2}+\\cdots+${aSub(String(k - 1))}`;
    const nums = Array.from({ length: k - 1 }, (_, i) => get(i + 1));
    return [addConst(sym, p[1]), sumNums(p[1] !== 0 ? [...nums, p[1]] : nums)];
  },
  ruleLine: (p) => `a_{n}=${addConst('a_{1}+a_{2}+\\cdots+a_{n-1}', p[1])},\\;n\\ge 2`,
  ruleParams: (p) => ({ m1: p[1] }),
  sample: (rng) => [draw(rng, RANGE.sumPrevSeed), draw(rng, RANGE.sumPrevAdd)],
});

/** rec.cum_prod: f(n) = f(n-1) * (n + m1), f(1) = s. params [s, m1] */
const REC_CUM_PROD = recEntry({
  id: 'rec.cum_prod',
  tier: 4,
  composable: false,
  arity: 2,
  normalize: (p) => ({ seeds: [p[0]], offset: p[1] }),
  seeds: (p) => [p[0]],
  next: (p, k, get) => mul(get(k - 1), k + p[1]),
  deps: (p, k) => [k - 1],
  parts: (p, k, get) => [
    `${aSub(String(k - 1))}\\cdot ${p[1] === 0 ? k : `\\left(${k}${signed(p[1])}\\right)`}`,
    prodNums([get(k - 1), k + p[1]]),
  ],
  ruleLine: (p) => `a_{n}=a_{n-1}\\cdot ${p[1] === 0 ? 'n' : `\\left(n${signed(p[1])}\\right)`},\\;n\\ge 2`,
  ruleParams: (p) => ({ m1: p[1] }),
  sample: (rng) => [draw(rng, RANGE.cumSeed), draw(rng, RANGE.cumAdd)],
});

/** rec.prod_two: f(n) = f(n-1) * f(n-2), seeds f(1..2). params [s1, s2] */
const REC_PROD_TWO = recEntry({
  id: 'rec.prod_two',
  tier: 4,
  composable: false,
  arity: 2,
  normalize: (p) => ({ seeds: p.slice(0, 2) }),
  seeds: (p) => p.slice(0, 2),
  next: (p, k, get) => mul(get(k - 1), get(k - 2)),
  deps: (p, k) => [k - 1, k - 2],
  parts: (p, k, get) => [`${aSub(String(k - 1))}\\cdot ${aSub(String(k - 2))}`, prodNums([get(k - 1), get(k - 2)])],
  ruleLine: () => 'a_{n}=a_{n-1}\\cdot a_{n-2},\\;n\\ge 3',
  sample: (rng) =>
    sampleAccepted(
      () => [draw(rng, RANGE.prodSeed), draw(rng, RANGE.prodSeed)],
      (p) => p[0] !== 1 || p[1] !== 1,
      [1, 2],
    ),
});

/** rec.lin2: f(n) = m1 f(n-1) + m2 f(n-2), seeds f(1..2). params [m1, m2, s1, s2] */
const REC_LIN2 = recEntry({
  id: 'rec.lin2',
  tier: 4,
  composable: false,
  arity: 4,
  normalize: (p) => ({ mul1: p[0], mul2: p[1], seeds: p.slice(2, 4) }),
  seeds: (p) => p.slice(2, 4),
  next: (p, k, get) => add(mul(p[0], get(k - 1)), mul(p[1], get(k - 2))),
  deps: (p, k) => [k - 1, k - 2],
  parts: (p, k, get) => [
    joinTerms([coef(p[0], aSub(String(k - 1))), coef(p[1], aSub(String(k - 2)))]),
    joinTerms([coefNum(p[0], get(k - 1)), coefNum(p[1], get(k - 2))]),
  ],
  ruleLine: (p) => `a_{n}=${joinTerms([coef(p[0], 'a_{n-1}'), coef(p[1], 'a_{n-2}')])},\\;n\\ge 3`,
  ruleParams: (p) => ({ m1: p[0], m2: p[1] }),
  sample: (rng) => [draw(rng, RANGE.lin2Mul1), draw(rng, RANGE.lin2Mul2), draw(rng, RANGE.lin2Seed), draw(rng, RANGE.lin2Seed)],
});

// Additional exam-style families. These are deliberately non-composable: their
// definitions are useful as standalone recognition questions, but their values
// are not constrained to stay small when nested inside another rule.
function gcdInt(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) [x, y] = [y, x % y];
  return x;
}

function digitSum(n) { return String(Math.abs(n)).split('').reduce((s, d) => s + Number(d), 0); }
function digitProduct(n) { return String(Math.abs(n)).split('').reduce((s, d) => s * Number(d), 1); }
function binaryOnes(n) { return n.toString(2).split('').filter((d) => d === '1').length; }
function divisorList(n) {
  const out = [];
  for (let d = 1; d * d <= n; d++) {
    if (n % d !== 0) continue;
    out.push(d);
    if (d * d !== n) out.push(n / d);
  }
  return out.sort((a, b) => a - b);
}
function primeFactors(n) {
  const out = [];
  let x = n;
  for (let p = 2; p * p <= x; p++) while (x % p === 0) { out.push(p); x /= p; }
  if (x > 1) out.push(x);
  return out;
}
function fibonacci(n) {
  let a = 0;
  let b = 1;
  for (let i = 0; i < n; i++) [a, b] = [b, a + b];
  return a;
}
function lucas(n) { return fibonacci(n - 1) + fibonacci(n + 1); }
function pell(n) {
  let a = 0;
  let b = 1;
  for (let i = 0; i < n; i++) [a, b] = [b, 2 * b + a];
  return a;
}
function jacobsthal(n) { return (2 ** n - (-1) ** n) / 3; }
function choose(n, k) {
  if (k < 0 || k > n) return 0;
  let out = 1;
  for (let i = 1; i <= k; i++) out = (out * (n - i + 1)) / i;
  return out;
}
function catalan(n) { return choose(2 * n, n) / (n + 1); }
function derangement(n) {
  let a = 1;
  let b = 0;
  for (let i = 2; i <= n; i++) [a, b] = [b, (i - 1) * (a + b)];
  return n === 0 ? 1 : b;
}
function partition(n) {
  const p = Array(n + 1).fill(0);
  p[0] = 1;
  for (let k = 1; k <= n; k++) for (let i = k; i <= n; i++) p[i] += p[i - k];
  return p[n];
}
function bell(n) {
  const row = [1];
  for (let i = 1; i <= n; i++) {
    const next = [row[row.length - 1]];
    for (let j = 1; j <= i; j++) next[j] = (next[j - 1] || 0) + (row[j] || 0);
    row.splice(0, row.length, ...next);
  }
  return row[0];
}
function stirling2(n, k) {
  const row = Array(k + 1).fill(0);
  row[0] = 1;
  for (let i = 1; i <= n; i++) for (let j = Math.min(i, k); j >= 1; j--) row[j] = j * row[j] + row[j - 1];
  return row[k];
}
function eulerPhi(n) {
  let out = n;
  for (const p of new Set(primeFactors(n))) out = (out / p) * (p - 1);
  return out;
}
function mobius(n) {
  const f = primeFactors(n);
  if (new Set(f).size !== f.length) return 0;
  return f.length % 2 === 0 ? 1 : -1;
}
function liouville(n) { return primeFactors(n).length % 2 === 0 ? 1 : -1; }
function largestPrimeFactor(n) { return n === 1 ? 1 : primeFactors(n).at(-1); }
function smallestPrimeFactor(n) { return n === 1 ? 1 : primeFactors(n)[0]; }
function collatzSteps(n) {
  let x = n;
  let count = 0;
  while (x !== 1 && count < 1000) { x = x % 2 === 0 ? x / 2 : 3 * x + 1; count++; }
  return count;
}
function alternatingDigitSum(n) {
  const ds = String(n).split('').map(Number);
  return ds.reduce((s, d, i) => s + (i % 2 === 0 ? d : -d), 0);
}
function isPalindrome(n) { const s = String(n); return s === [...s].reverse().join('') ? 1 : 0; }
function factorialDigitSum(n) { return digitSum(factorial(n)); }
function nthComposite(n) {
  let count = 0;
  for (let x = 4; ; x++) if (primeFactors(x).length > 1) { count++; if (count === n) return x; }
}
function nthSemiprime(n) {
  let count = 0;
  for (let x = 4; ; x++) if (primeFactors(x).length === 2) { count++; if (count === n) return x; }
}
function primeGap(n) { return primeAt(n + 1) - primeAt(n); }
function squarefree(n) { return mobius(n) === 0 ? 0 : 1; }
function makeFormulaEntry({ id, arity = 1, sample, evaluate, latex, normalize, rule }) {
  return closedEntry(
    {
      id,
      since: SINCE,
      tier: id.includes('digit') || id.includes('binary') || id.includes('collatz') ? 3 : 4,
      composable: false,
      arity,
      maxIndex: 60,
      normalize,
      reference: (nm, n) => safe(evaluate([nm.add], n)),
      sampleParams: sample,
      evaluate: (p, n) => isIndex(n) && n <= 60 ? safe(evaluate(p, n)) : null,
      latex,
    },
    {
      id,
      detect: (p, pts) => pts.slice(0, DETECT_COUNT).map(({ n, value }) => `f(${n})=${value}`),
      chain: (p, n) => [latex(p, String(n)), String(evaluate(p, n))],
      extraDefinition: () => [],
    },
  );
}

const OFFSET_SAMPLE = (rng) => [draw(rng, [-3, 3])];
const OFFSET = (base, text) => makeFormulaEntry({
  id: base.id,
  sample: OFFSET_SAMPLE,
  normalize: (p) => ({ add: p[0] }),
  evaluate: (p, n) => base.evaluate(n) + p[0],
  latex: (p, arg = 'n') => `${base.latex(arg)}${signed(p[0])}`,
  rule: text,
});

const EXTRA_ENTRIES = [
  OFFSET({ id: 'fig.triangular', evaluate: (n) => n * (n + 1) / 2, latex: (x) => `\\frac{${x}(${x}+1)}{2}` }, 'Triangular numbers plus a constant.'),
  OFFSET({ id: 'fig.pentagonal', evaluate: (n) => n * (3 * n - 1) / 2, latex: (x) => `\\frac{${x}(3${x}-1)}{2}` }, 'Pentagonal numbers plus a constant.'),
  OFFSET({ id: 'fig.hexagonal', evaluate: (n) => n * (2 * n - 1), latex: (x) => `${x}(2${x}-1)` }, 'Hexagonal numbers plus a constant.'),
  OFFSET({ id: 'fig.centered_square', evaluate: (n) => n * n + (n - 1) * (n - 1), latex: (x) => `${x}^{2}+(${x}-1)^{2}` }, 'Centered square numbers plus a constant.'),
  OFFSET({ id: 'fig.tetrahedral', evaluate: (n) => n * (n + 1) * (n + 2) / 6, latex: (x) => `\\frac{${x}(${x}+1)(${x}+2)}{6}` }, 'Tetrahedral numbers plus a constant.'),
  OFFSET({ id: 'fig.square_pyramidal', evaluate: (n) => n * (n + 1) * (2 * n + 1) / 6, latex: (x) => `\\frac{${x}(${x}+1)(2${x}+1)}{6}` }, 'Square pyramidal numbers plus a constant.'),
  OFFSET({ id: 'fig.pronic', evaluate: (n) => n * (n + 1), latex: (x) => `${x}(${x}+1)` }, 'Products of consecutive integers plus a constant.'),
  OFFSET({ id: 'comb.catalan', evaluate: catalan, latex: (x) => `\\frac{1}{${x}+1}\\binom{2${x}}{${x}}` }, 'Catalan numbers plus a constant.'),
  OFFSET({ id: 'comb.choose2', evaluate: (n) => choose(n + 1, 2), latex: (x) => `\\binom{${x}+1}{2}` }, 'The number of pairs chosen from the first positions.'),
  OFFSET({ id: 'comb.derangement', evaluate: derangement, latex: (x) => `!${x}` }, 'Derangement numbers plus a constant.'),
  OFFSET({ id: 'comb.bell', evaluate: bell, latex: (x) => `B_{${x}}` }, 'Bell numbers plus a constant.'),
  OFFSET({ id: 'comb.partition', evaluate: partition, latex: (x) => `p(${x})` }, 'Integer partition numbers plus a constant.'),
  OFFSET({ id: 'seq.fibonacci_closed', evaluate: fibonacci, latex: (x) => `F_{${x}}` }, 'Fibonacci numbers plus a constant.'),
  OFFSET({ id: 'seq.lucas', evaluate: lucas, latex: (x) => `L_{${x}}` }, 'Lucas numbers plus a constant.'),
  OFFSET({ id: 'seq.pell', evaluate: pell, latex: (x) => `P_{${x}}` }, 'Pell numbers plus a constant.'),
  OFFSET({ id: 'seq.jacobsthal', evaluate: jacobsthal, latex: (x) => `J_{${x}}` }, 'Jacobsthal numbers plus a constant.'),
  OFFSET({ id: 'seq.prime_gap', evaluate: primeGap, latex: (x) => `p_{${x}+1}-p_{${x}}` }, 'Gaps between consecutive primes plus a constant.'),
  OFFSET({ id: 'seq.composite', evaluate: nthComposite, latex: (x) => `c_{${x}}` }, 'The n-th composite number plus a constant.'),
  OFFSET({ id: 'seq.semiprime', evaluate: nthSemiprime, latex: (x) => `s_{${x}}` }, 'The n-th semiprime plus a constant.'),
  OFFSET({ id: 'nt.totient', evaluate: eulerPhi, latex: (x) => `\\varphi(${x})` }, 'Euler totients plus a constant.'),
  OFFSET({ id: 'nt.divisor_count', evaluate: (n) => divisorList(n).length, latex: (x) => `\\tau(${x})` }, 'The number of positive divisors plus a constant.'),
  OFFSET({ id: 'nt.divisor_sum', evaluate: (n) => divisorList(n).reduce((a, b) => a + b, 0), latex: (x) => `\\sigma(${x})` }, 'The sum of positive divisors plus a constant.'),
  OFFSET({ id: 'nt.proper_divisor_sum', evaluate: (n) => divisorList(n).reduce((a, b) => a + b, 0) - n, latex: (x) => `s(${x})` }, 'The sum of proper divisors plus a constant.'),
  OFFSET({ id: 'nt.mobius', evaluate: mobius, latex: (x) => `\\mu(${x})` }, 'Mobius function values plus a constant.'),
  OFFSET({ id: 'nt.liouville', evaluate: liouville, latex: (x) => `\\lambda(${x})` }, 'Liouville function values plus a constant.'),
  OFFSET({ id: 'nt.squarefree', evaluate: squarefree, latex: (x) => `\\mathbf{1}_{\\mathrm{sqfree}}(${x})` }, 'Squarefree indicators plus a constant.'),
  OFFSET({ id: 'nt.largest_prime_factor', evaluate: largestPrimeFactor, latex: (x) => `P(${x})` }, 'Largest prime factors plus a constant.'),
  OFFSET({ id: 'nt.smallest_prime_factor', evaluate: smallestPrimeFactor, latex: (x) => `p(${x})` }, 'Smallest prime factors plus a constant.'),
  OFFSET({ id: 'nt.gcd_12', evaluate: (n) => gcdInt(n, 12), latex: (x) => `\\gcd(${x},12)` }, 'GCD with a fixed integer plus a constant.'),
  OFFSET({ id: 'nt.lcm_12', evaluate: (n) => (n * 12) / gcdInt(n, 12), latex: (x) => `\\operatorname{lcm}(${x},12)` }, 'LCM with a fixed integer plus a constant.'),
  OFFSET({ id: 'digit.binary_ones', evaluate: binaryOnes, latex: (x) => `s_2(${x})` }, 'The number of one bits in the binary expansion plus a constant.'),
  OFFSET({ id: 'digit.binary_length', evaluate: (n) => n.toString(2).length, latex: (x) => `\\lfloor\\log_2(${x})\\rfloor+1` }, 'Binary lengths plus a constant.'),
  OFFSET({ id: 'digit.digital_root', evaluate: (n) => n === 0 ? 0 : 1 + ((n - 1) % 9), latex: (x) => `\\operatorname{dr}(${x})` }, 'Digital roots plus a constant.'),
  OFFSET({ id: 'digit.product', evaluate: digitProduct, latex: (x) => `\\operatorname{dp}(${x})` }, 'Products of decimal digits plus a constant.'),
  OFFSET({ id: 'digit.sum', evaluate: digitSum, latex: (x) => `\\operatorname{ds}(${x})` }, 'Sums of decimal digits plus a constant.'),
  OFFSET({ id: 'digit.alternating_sum', evaluate: alternatingDigitSum, latex: (x) => `\\operatorname{as}(${x})` }, 'Alternating sums of decimal digits plus a constant.'),
  OFFSET({ id: 'digit.reverse', evaluate: (n) => reverseDigits(n), latex: (x) => `\\operatorname{rev}(${x})` }, 'Digit reversals plus a constant.'),
  OFFSET({ id: 'digit.palindrome', evaluate: isPalindrome, latex: (x) => `\\operatorname{pal}(${x})` }, 'Palindrome indicators plus a constant.'),
  OFFSET({ id: 'digit.factorial_sum', evaluate: factorialDigitSum, latex: (x) => `\\operatorname{ds}(${x}!)` }, 'Digit sums of factorials plus a constant.'),
  OFFSET({ id: 'arith.floor_sqrt', evaluate: (n) => Math.floor(Math.sqrt(n)), latex: (x) => `\\lfloor\\sqrt{${x}}\\rfloor` }, 'Floor square roots plus a constant.'),
  OFFSET({ id: 'arith.ceil_sqrt', evaluate: (n) => Math.ceil(Math.sqrt(n)), latex: (x) => `\\lceil\\sqrt{${x}}\\rceil` }, 'Ceiling square roots plus a constant.'),
  OFFSET({ id: 'arith.sum_cubes', evaluate: (n) => ((n * (n + 1)) / 2) ** 2, latex: (x) => `\\left(\\frac{${x}(${x}+1)}{2}\\right)^2` }, 'Sums of the first cubes plus a constant.'),
  OFFSET({ id: 'arith.centered_triangular', evaluate: (n) => n * n - n + 1, latex: (x) => `${x}^{2}-${x}+1` }, 'Centered triangular numbers plus a constant.'),
  OFFSET({ id: 'arith.collatz_steps', evaluate: collatzSteps, latex: (x) => `\\operatorname{ColSteps}(${x})` }, 'Collatz stopping times plus a constant.'),
  OFFSET({ id: 'comb.stirling2', evaluate: (n) => stirling2(n + 2, 2), latex: (x) => `\\left\\{\\matrix{${x}+2\\\\2}\\right\\}` }, 'Stirling numbers of the second kind plus a constant.'),
  OFFSET({ id: 'seq.pell_lucas', evaluate: (n) => pell(n) + pell(n + 1), latex: (x) => `Q_{${x}}` }, 'Pell-Lucas numbers plus a constant.'),
  OFFSET({ id: 'seq.prime_index', evaluate: (n) => primeIndex(n), latex: (x) => `\\pi(${x})` }, 'Prime-counting function values plus a constant.'),
  OFFSET({ id: 'seq.omega', evaluate: (n) => new Set(primeFactors(n)).size, latex: (x) => `\\omega(${x})` }, 'Counts of distinct prime factors plus a constant.'),
  OFFSET({ id: 'seq.big_omega', evaluate: (n) => primeFactors(n).length, latex: (x) => `\\Omega(${x})` }, 'Counts of prime factors with multiplicity plus a constant.'),
  OFFSET({ id: 'seq.collatz_peak', evaluate: (n) => { let x = n; let peak = x; for (let i = 0; x !== 1 && i < 1000; i++) { x = x % 2 === 0 ? x / 2 : 3 * x + 1; peak = Math.max(peak, x); } return peak; }, latex: (x) => `\\operatorname{ColMax}(${x})` }, 'Maximum values reached by Collatz trajectories plus a constant.'),
];

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/** All Pool-B entries (tiers 3-4), sorted by id. @type {PoolEntry[]} */
export const ADVANCED_ENTRIES = [
  DIG_REV_ARITH,
  DIG_SUM_POW,
  FACT_ADD,
  MIX_TRI_SQ_ALT,
  POW_NN_MOD,
  REC_ALT_OP,
  REC_CUM_PROD,
  REC_FIB_GAP,
  REC_LIN1,
  REC_LIN2,
  REC_POW_SUM,
  REC_PROD_TWO,
  REC_SUM_PREV,
  REC_TRIB,
  SEQ_ALT_AP,
  SEQ_PRIME,
  SEQ_PRIME_SQ,
  ...EXTRA_ENTRIES,
].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
