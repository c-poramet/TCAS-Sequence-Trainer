import test from 'node:test';
import assert from 'node:assert/strict';
import { trainerProvider } from '../src/trainer/run.js';

/** Small seeded mock generator with the Rng surface the provider uses. */
function mockRng(seed = 1, forks = []) {
  let s = seed >>> 0;
  const next = () => { // mulberry32
    s = (s + 0x6d2b79f5) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
  const hash = (label) => [...label].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  return {
    next,
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    fork: (label) => { forks.push(label); return mockRng(hash(label) + seed, forks); },
  };
}

class GenerationError extends Error {}

const CFG = { hardRatio: 0.25, maxAttempts: 10, poolVersion: 3 };
const summary = (fn, tier, oftenFailed = false) => ({ fn, attempts: 5, correct: 5, failRate: 0, medianMs: 1, p25Ms: 1, p75Ms: 1, tier, oftenFailed });

function harness(overrides = {}) {
  const calls = [];
  const listCalls = [];
  const deps = {
    generateQuestion: (rng, opts) => { calls.push({ rng, opts }); return { id: 'Q:' + opts.filter.mustInclude, fns: [opts.filter.mustInclude], mode: opts.mode, answer: 1 }; },
    listEntries: (o) => { listCalls.push(o); return [{ id: 'p.one' }, { id: 'p.two' }, { id: 'p.three' }]; },
    ...overrides,
  };
  return { deps, calls, listCalls };
}

const summaries = [
  summary('e1', 'easy'), summary('e2', 'easy'),
  summary('n1', 'normal'), summary('u1', 'unrated'),
  summary('h1', 'hard', true),
];

test('only functions of the selected buckets are drawn; mustInclude is passed', () => {
  const { deps, calls } = harness();
  const next = trainerProvider({ buckets: ['easy'], summaries, genCfg: CFG, rng: mockRng(), deps });
  for (let i = 0; i < 60; i += 1) next();
  assert.equal(calls.length, 60);
  const used = new Set(calls.map((c) => c.opts.filter.mustInclude));
  assert.deepEqual([...used].sort(), ['e1', 'e2']);
  assert.ok(calls.every((c) => c.opts.cfg === CFG));
});

test('unrated functions are drawn from the normal bucket', () => {
  const { deps, calls } = harness();
  const next = trainerProvider({ buckets: ['normal'], summaries, genCfg: CFG, rng: mockRng(), deps });
  for (let i = 0; i < 60; i += 1) next();
  assert.deepEqual([...new Set(calls.map((c) => c.opts.filter.mustInclude))].sort(), ['n1', 'u1']);
});

test('buckets are chosen uniformly (not weighted by size)', () => {
  const { deps, calls } = harness();
  // easy has 2 functions, failed has 1: uniform over buckets => ~50% h1
  const next = trainerProvider({ buckets: ['easy', 'failed'], summaries, genCfg: CFG, rng: mockRng(5), deps });
  const n = 600;
  for (let i = 0; i < n; i += 1) next();
  const failedShare = calls.filter((c) => c.opts.filter.mustInclude === 'h1').length / n;
  assert.ok(failedShare > 0.4 && failedShare < 0.6, `failed share ${failedShare}`);
});

test('empty selected buckets are skipped', () => {
  const { deps, calls } = harness();
  // 'failed' is non-empty (h1), 'easy' selected but empty after filtering
  const only = [summary('h1', 'hard', true), summary('n1', 'normal')];
  const next = trainerProvider({ buckets: ['easy', 'failed'], summaries: only, genCfg: CFG, rng: mockRng(), deps });
  for (let i = 0; i < 30; i += 1) next();
  assert.ok(calls.every((c) => c.opts.filter.mustInclude === 'h1'));
});

test('falls back to all pool ids when no selected bucket has members', () => {
  const { deps, calls, listCalls } = harness();
  const next = trainerProvider({ buckets: ['failed'], summaries: [summary('n1', 'normal')], genCfg: CFG, rng: mockRng(), deps });
  for (let i = 0; i < 60; i += 1) next();
  assert.deepEqual([...new Set(calls.map((c) => c.opts.filter.mustInclude))].sort(), ['p.one', 'p.three', 'p.two']);
  assert.deepEqual(listCalls[0], { maxVersion: CFG.poolVersion });
  const none = harness();
  const p2 = trainerProvider({ buckets: [], summaries, genCfg: CFG, rng: mockRng(), deps: none.deps });
  p2();
  assert.ok(['p.one', 'p.two', 'p.three'].includes(none.calls[0].opts.filter.mustInclude));
});

test('accepts a getBuckets()-shaped object as `buckets`', () => {
  const { deps, calls } = harness();
  const next = trainerProvider({ buckets: { easy: ['x'], normal: [], hard: ['y'], failed: [] }, summaries: [], genCfg: CFG, rng: mockRng(), deps });
  for (let i = 0; i < 40; i += 1) next();
  assert.deepEqual([...new Set(calls.map((c) => c.opts.filter.mustInclude))].sort(), ['x', 'y']);
});

test('mode follows hardRatio', () => {
  for (const [ratio, expected] of [[0, 'N'], [1, 'H']]) {
    const { deps, calls } = harness();
    const next = trainerProvider({ buckets: ['easy'], summaries, genCfg: { ...CFG, hardRatio: ratio }, rng: mockRng(), deps });
    for (let i = 0; i < 20; i += 1) next();
    assert.ok(calls.every((c) => c.opts.mode === expected));
  }
  const { deps, calls } = harness();
  const next = trainerProvider({ buckets: ['easy'], summaries, genCfg: { ...CFG, hardRatio: 0.5 }, rng: mockRng(3), deps });
  for (let i = 0; i < 400; i += 1) next();
  const hard = calls.filter((c) => c.opts.mode === 'H').length / 400;
  assert.ok(hard > 0.4 && hard < 0.6, `hard share ${hard}`);
});

test('each question forks its own stream q0, q1, q2 ...', () => {
  const forks = [];
  const { deps, calls } = harness();
  const next = trainerProvider({ buckets: ['easy'], summaries, genCfg: CFG, rng: mockRng(1, forks), deps });
  next(); next(); next();
  assert.deepEqual(forks.filter((l) => /^q\d+$/.test(l)), ['q0', 'q1', 'q2']);
  assert.equal(new Set(calls.map((c) => c.rng)).size, 3);
});

test('same seed gives the same sequence', () => {
  const run = () => {
    const { deps, calls } = harness();
    const next = trainerProvider({ buckets: ['easy', 'normal', 'hard'], summaries, genCfg: CFG, rng: mockRng(42), deps });
    for (let i = 0; i < 25; i += 1) next();
    return calls.map((c) => `${c.opts.filter.mustInclude}/${c.opts.mode}`);
  };
  assert.deepEqual(run(), run());
});

test('a GenerationError is retried with another function', () => {
  const { deps, calls } = harness({
    generateQuestion: (rng, opts) => {
      calls.push(opts.filter.mustInclude);
      if (opts.filter.mustInclude === 'bad') throw new GenerationError('no luck');
      return { id: 'ok', fns: [opts.filter.mustInclude], mode: opts.mode, answer: 1 };
    },
  });
  const sums = [summary('bad', 'easy'), summary('good', 'easy')];
  const next = trainerProvider({ buckets: ['easy'], summaries: sums, genCfg: CFG, rng: mockRng(9), deps });
  for (let i = 0; i < 30; i += 1) {
    const question = next();
    assert.equal(question.fns[0], 'good');
  }
  assert.ok(calls.length >= 30);
});

test('gives up after maxAttempts and rethrows the GenerationError', () => {
  let count = 0;
  const { deps } = harness({ generateQuestion: () => { count += 1; throw new GenerationError('never'); } });
  const next = trainerProvider({ buckets: ['easy'], summaries, genCfg: { ...CFG, maxAttempts: 5 }, rng: mockRng(), deps });
  assert.throws(() => next(), GenerationError);
  assert.equal(count, 5);
});

test('other errors are not retried', () => {
  let count = 0;
  const { deps } = harness({ generateQuestion: () => { count += 1; throw new TypeError('bug'); } });
  const next = trainerProvider({ buckets: ['easy'], summaries, genCfg: CFG, rng: mockRng(), deps });
  assert.throws(() => next(), TypeError);
  assert.equal(count, 1);
});

test('empty pool and no buckets throws a clear error', () => {
  const { deps } = harness({ listEntries: () => [] });
  const next = trainerProvider({ buckets: [], summaries: [], genCfg: CFG, rng: mockRng(), deps });
  assert.throws(() => next(), /no functions available/);
});

test('Math.random is never used', () => {
  const original = Math.random;
  Math.random = () => { throw new Error('Math.random called'); };
  try {
    const { deps } = harness();
    const next = trainerProvider({ buckets: ['easy'], summaries, genCfg: CFG, rng: mockRng(), deps });
    for (let i = 0; i < 10; i += 1) next();
  } finally {
    Math.random = original;
  }
});