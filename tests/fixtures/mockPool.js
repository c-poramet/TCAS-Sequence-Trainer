/**
 * Hand-written mock pool for the engine tests (independent of the real pool).
 * Step keys use the mock.* namespace under pool.* and are not checked for i18n.
 */
const wrap = (arg) => (/^\d+$|^n$/.test(arg) ? arg : `\\left(${arg}\\right)`);
const signed = (x) => (x < 0 ? `-${-x}` : `+${x}`);
const inRange = (n, max) => Number.isInteger(n) && n >= 1 && n <= max;
const safe = (v) => (Number.isSafeInteger(v) ? v : null);

const PRIMES = [];
for (let c = 2; PRIMES.length < 80; c++) if (PRIMES.every((p) => c % p !== 0)) PRIMES.push(c);

function entry(def) {
  return {
    since: 1,
    composable: false,
    maxIndex: 60,
    solve: (p, ctx) => [
      { key: `pool.${def.id}.derive`, params: { points: ctx.points.length }, math: [def.latex(p)] },
      { key: `pool.${def.id}.verify`, math: ctx.points.slice(0, 2).map((pt) => `${pt.n}\\mapsto ${pt.value}`) },
    ],
    definition: (p) => [`f(n)=${def.latex(p)}`],
    ...def,
  };
}

export const MOCK_POOL_VERSION = 2;

const ENTRIES = [
  entry({
    id: 'mock.lin', tier: 1, composable: true, arity: 2,
    sampleParams: (rng, { role }) => (role === 'inner' ? [rng.int(1, 4), rng.int(-5, 5)] : [rng.int(-9, 9), rng.int(-20, 20)]),
    evaluate: (p, n) => (inRange(n, 60) ? safe(p[0] * n + p[1]) : null),
    latex: (p, arg = 'n') => `${p[0]}\\cdot ${wrap(arg)}${signed(p[1])}`,
  }),
  entry({
    id: 'mock.quad', tier: 2, composable: true, arity: 3,
    sampleParams: (rng) => [rng.int(1, 3), rng.int(-4, 4), rng.int(-9, 9)],
    evaluate: (p, n) => (inRange(n, 60) ? safe(p[0] * n * n + p[1] * n + p[2]) : null),
    latex: (p, arg = 'n') => `${p[0]}${wrap(arg)}^2${signed(p[1])}${wrap(arg)}${signed(p[2])}`,
  }),
  entry({
    id: 'mock.cube', tier: 2, composable: true, arity: 2,
    sampleParams: (rng) => [rng.int(1, 2), rng.int(-9, 9)],
    evaluate: (p, n) => (inRange(n, 60) ? safe(p[0] * n ** 3 + p[1]) : null),
    latex: (p, arg = 'n') => `${p[0]}${wrap(arg)}^3${signed(p[1])}`,
  }),
  entry({
    id: 'mock.geo', tier: 1, composable: false, arity: 2, maxIndex: 15,
    sampleParams: (rng) => [rng.int(1, 5), rng.int(2, 3)],
    evaluate: (p, n) => (inRange(n, 15) ? safe(p[0] * p[1] ** (n - 1)) : null),
    latex: (p, arg = 'n') => `${p[0]}\\cdot ${p[1]}^{${arg}-1}`,
  }),
  entry({
    id: 'mock.fib', tier: 2, composable: false, arity: 2, maxIndex: 40,
    sampleParams: (rng) => [rng.int(1, 5), rng.int(1, 5)],
    evaluate: (p, n) => {
      if (!inRange(n, 40)) return null;
      let a = p[0];
      let b = p[1];
      for (let k = 1; k < n; k++) [a, b] = [b, a + b];
      return safe(a);
    },
    latex: (p, arg = 'n') => `a_{${arg}}=a_{${arg}-1}+a_{${arg}-2}`,
    definition: (p) => ['a_n=a_{n-1}+a_{n-2}', `a_1=${p[0]},\\ a_2=${p[1]}`],
  }),
  entry({
    id: 'mock.tri', tier: 3, composable: true, arity: 1,
    sampleParams: (rng) => [rng.int(1, 3)],
    evaluate: (p, n) => (inRange(n, 60) ? safe((p[0] * n * (n + 1)) / 2) : null),
    latex: (p, arg = 'n') => `${p[0]}\\cdot\\frac{${arg}(${arg}+1)}{2}`,
  }),
  entry({
    id: 'mock.prime', tier: 3, composable: false, arity: 1, maxIndex: 40,
    sampleParams: (rng) => [rng.int(0, 5)],
    evaluate: (p, n) => (inRange(n, 40) ? PRIMES[n - 1 + p[0]] : null),
    latex: (p, arg = 'n') => `p_{${arg}+${p[0]}}`,
  }),
  entry({
    id: 'mock.alt', tier: 4, composable: false, arity: 2,
    sampleParams: (rng) => [rng.int(-5, 5), rng.int(1, 6)],
    evaluate: (p, n) => (inRange(n, 60) ? safe(p[0] + (n % 2 === 0 ? 1 : -1) * p[1] * n) : null),
    latex: (p, arg = 'n') => `${p[0]}+(-1)^{${arg}}\\cdot ${p[1]}${wrap(arg)}`,
  }),
  entry({
    id: 'mock.lin2', since: 2, tier: 1, composable: true, arity: 2,
    sampleParams: (rng) => [rng.int(1, 9), rng.int(-9, 9)],
    evaluate: (p, n) => (inRange(n, 60) ? safe(p[0] * n + p[1]) : null),
    latex: (p, arg = 'n') => `${p[0]}\\cdot ${wrap(arg)}${signed(p[1])}`,
  }),
];

/** @param {string} id */
export function getEntry(id) {
  return ENTRIES.find((e) => e.id === id);
}

/** @param {{maxVersion?:number, tiers?:number[], composableOnly?:boolean}} [o] */
export function listEntries({ maxVersion, tiers, composableOnly } = {}) {
  return ENTRIES.filter(
    (e) =>
      (maxVersion === undefined || e.since <= maxVersion) &&
      (!tiers || tiers.includes(e.tier)) &&
      (!composableOnly || e.composable),
  ).sort((a, b) => (a.id < b.id ? -1 : 1));
}

export const mockPool = { getEntry, listEntries };

/** Default GenCfg matching the contract defaults, on pool version 1. */
export const baseCfg = {
  hardRatio: 0.25, mixedChance: 0.5, cap: 2500, maxAttempts: 300, poolVersion: 1,
  normalTiers: [1, 2], composeTiers: [1, 2, 3], rareTiers: [3, 4], composeChance: 0.5,
  minDistinct: 4, allowNegative: true,
};

/** Default GenSettings. */
export const baseSettings = { ...baseCfg, seed: 'unit-seed', count: 40 };
