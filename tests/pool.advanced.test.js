import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ADVANCED_ENTRIES } from '../src/pool/advanced.js';
import { validateEntry } from '../src/pool/validate.js';
import { createRng } from '../src/core/rng.js';
import { hasKey } from '../src/core/i18n.js';
import '../src/i18n/pool_advanced.js';

const REQUIRED_IDS = ['seq.prime', 'rec.fib_gap', 'rec.pow_sum'];
const ID_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;
const MIN_ENTRIES = 14;
const VALIDATE_SAMPLES = 200;
const REF_TERMS = 12;
const TERMS = 6;
const HIT_SAMPLES = 300;
const HIT_CAP_DEFAULT = 2500;
const HIT_CAP_LARGE = 20000;
const INNER_LIMIT = 60;
const FIRST_PRIMES = 50;
const EXPECTED_200TH_PRIME = 1223;
const SOLVE_SAMPLES = 40;
const MIN_STEPS = 3;
const MAX_STEPS = 6;
/** Entries that by design exceed the default cap (spec: rec.pow_sum). */
const EXPECTED_ZERO_AT_DEFAULT_CAP = new Set(['rec.pow_sum']);

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

/** @param {bigint|number|null} v @returns {number|null} */
function toSafe(v) {
  if (v === null) return null;
  const b = BigInt(v);
  return b > MAX_SAFE || b < -MAX_SAFE ? null : Number(b);
}

/** Independent trial-division prime generator. @param {number} count @returns {number[]} */
function firstPrimes(count) {
  const out = [];
  for (let c = 2; out.length < count; c++) {
    let isPrime = true;
    for (let d = 2; d * d <= c; d++) {
      if (c % d === 0) {
        isPrime = false;
        break;
      }
    }
    if (isPrime) out.push(c);
  }
  return out;
}

const PRIME_LIST = firstPrimes(600);

/** @param {bigint[]} seeds @param {(v:bigint[], k:number)=>bigint} step @param {number} n @returns {bigint} */
function runRef(seeds, step, n) {
  const v = seeds.slice();
  for (let k = v.length + 1; k <= n; k++) v.push(step(v, k));
  return v[n - 1];
}

/** @param {bigint} x @returns {bigint} */
function reverseBig(x) {
  return BigInt(String(x).split('').reverse().join(''));
}

/**
 * Independent evaluators written from the normalized description only (BigInt, exact).
 * @type {Record<string,(nm:any, n:number)=>bigint|null>}
 */
const REFERENCE = {
  'seq.prime': (nm, n) => BigInt(PRIME_LIST[n + nm.shift - 1]),
  'seq.prime_sq': (nm, n) => BigInt(PRIME_LIST[n + nm.shift - 1]) ** 2n + BigInt(nm.add),
  'fact.add': (nm, n) => {
    let f = 1n;
    for (let i = 2n; i <= BigInt(n); i++) f *= i;
    return f + BigInt(nm.add);
  },
  'pow.nn_mod': (nm, n) => BigInt(n) ** BigInt(n) % BigInt(nm.modulus),
  'dig.rev_arith': (nm, n) => reverseBig(BigInt(nm.first) + BigInt(nm.step) * BigInt(n - 1)),
  'dig.sum_pow': (nm, n) =>
    (BigInt(nm.base) ** BigInt(n)).toString().split('').reduce((acc, d) => acc + BigInt(d), 0n),
  'seq.alt_ap': (nm, n) =>
    n % 2 === 1
      ? BigInt(nm.odd.first) + BigInt(nm.odd.step) * BigInt((n - 1) / 2)
      : BigInt(nm.even.first) + BigInt(nm.even.step) * BigInt((n - 2) / 2),
  'mix.tri_sq_alt': (nm, n) =>
    n % 2 === 1
      ? BigInt(((n + 1) / 2) ** 2) + BigInt(nm.squareAdd)
      : BigInt(((n / 2) * (n / 2 + 1)) / 2) + BigInt(nm.triangularAdd),
  'rec.fib_gap': (nm, n) =>
    runRef(nm.seeds.map(BigInt), (v, k) => v[k - 1 - nm.m1] + v[k - 1 - nm.m2], n),
  'rec.pow_sum': (nm, n) => runRef(nm.seeds.map(BigInt), (v, k) => v[k - 2] + BigInt(k) ** BigInt(k - 1), n),
  'rec.lin1': (nm, n) => runRef(nm.seeds.map(BigInt), (v, k) => BigInt(nm.mul) * v[k - 2] + BigInt(nm.add), n),
  'rec.trib': (nm, n) => runRef(nm.seeds.map(BigInt), (v, k) => v[k - 2] + v[k - 3] + v[k - 4], n),
  'rec.alt_op': (nm, n) =>
    runRef(nm.seeds.map(BigInt), (v, k) => (k % 2 === 0 ? v[k - 2] + BigInt(nm.addEven) : v[k - 2] * BigInt(nm.mulOdd)), n),
  'rec.sum_prev': (nm, n) =>
    runRef(nm.seeds.map(BigInt), (v, k) => v.slice(0, k - 1).reduce((a, b) => a + b, 0n) + BigInt(nm.add), n),
  'rec.cum_prod': (nm, n) => runRef(nm.seeds.map(BigInt), (v, k) => v[k - 2] * BigInt(k + nm.offset), n),
  'rec.prod_two': (nm, n) => runRef(nm.seeds.map(BigInt), (v, k) => v[k - 2] * v[k - 3], n),
  'rec.lin2': (nm, n) =>
    runRef(nm.seeds.map(BigInt), (v, k) => BigInt(nm.mul1) * v[k - 2] + BigInt(nm.mul2) * v[k - 3], n),
};

/** @param {any} entry @param {string} seed @param {'solo'|'outer'|'inner'} role @returns {number[]} */
function sample(entry, seed, role = 'solo') {
  return entry.sampleParams(createRng(seed), { cap: HIT_CAP_DEFAULT, role });
}

test('pool-b: entry list satisfies the structural spec', () => {
  assert.ok(ADVANCED_ENTRIES.length >= MIN_ENTRIES, `need >= ${MIN_ENTRIES} entries`);
  const ids = ADVANCED_ENTRIES.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, 'ids unique');
  for (const id of REQUIRED_IDS) assert.ok(ids.includes(id), `${id} present`);
  for (const e of ADVANCED_ENTRIES) {
    assert.match(e.id, ID_PATTERN);
    assert.ok(e.tier === 3 || e.tier === 4, `${e.id} tier`);
    assert.equal(typeof e.composable, 'boolean');
    assert.equal(typeof e.normalize, 'function');
    assert.ok(Number.isInteger(e.since) && e.since >= 1);
    assert.ok(Number.isInteger(e.arity) && e.arity >= 1);
    assert.ok(Number.isInteger(e.maxIndex) && e.maxIndex >= 1);
    assert.ok(REFERENCE[e.id], `${e.id} has an independent reference evaluator`);
  }
  for (const id of ['rec.fib_gap', 'rec.pow_sum']) {
    assert.ok(ADVANCED_ENTRIES.find((e) => e.id === id).maxIndex >= 30, `${id} maxIndex >= 30`);
  }
  assert.ok(ADVANCED_ENTRIES.find((e) => e.id === 'seq.prime').maxIndex >= 200);
});

for (const entry of ADVANCED_ENTRIES) {
  test(`validateEntry: ${entry.id}`, () => {
    const res = validateEntry(entry, { samples: VALIDATE_SAMPLES, seed: `validate-${entry.id}` });
    assert.deepEqual(res.errors, []);
    assert.equal(res.ok, true);
  });

  test(`normalize-based evaluator equals evaluate: ${entry.id}`, () => {
    const rng = createRng(`ref-${entry.id}`);
    for (let i = 0; i < VALIDATE_SAMPLES; i++) {
      const p = entry.sampleParams(rng, { cap: HIT_CAP_DEFAULT, role: 'solo' });
      const nm = entry.normalize(p);
      for (let n = 1; n <= REF_TERMS; n++) {
        const expected = toSafe(REFERENCE[entry.id](nm, n));
        assert.equal(entry.evaluate(p, n), expected, `${entry.id} p=${JSON.stringify(p)} n=${n}`);
      }
    }
  });

  test(`evaluate is null outside its domain: ${entry.id}`, () => {
    const p = sample(entry, `domain-${entry.id}`);
    assert.equal(entry.evaluate(p, 0), null);
    assert.equal(entry.evaluate(p, -3), null);
    assert.equal(entry.evaluate(p, 1.5), null);
    assert.equal(entry.evaluate(p, entry.maxIndex + 1), null);
  });

  test(`latex honours arg and definition is non-empty: ${entry.id}`, () => {
    const p = sample(entry, `latex-${entry.id}`);
    assert.ok(entry.latex(p).length > 0);
    assert.equal(entry.latex(p), entry.latex(p, 'n'));
    const shifted = entry.latex(p, '2n+1');
    assert.ok(shifted.length > 0 && !shifted.includes('NaN') && !shifted.includes('undefined'));
    assert.ok(entry.latex(p, '3').length > 0);
    const def = entry.definition(p);
    assert.ok(Array.isArray(def) && def.length >= 1 && def.every((l) => typeof l === 'string' && l.length > 0));
  });

  test(`sampleParams is deterministic and integer: ${entry.id}`, () => {
    const a = sample(entry, 'same-seed');
    const b = sample(entry, 'same-seed');
    assert.deepEqual(a, b);
    assert.equal(a.length, entry.arity);
    assert.ok(a.every(Number.isInteger));
  });

  if (entry.composable) {
    test(`inner role gives small positive indices: ${entry.id}`, () => {
      const rng = createRng(`inner-${entry.id}`);
      for (let i = 0; i < VALIDATE_SAMPLES; i++) {
        const p = entry.sampleParams(rng, { cap: HIT_CAP_DEFAULT, role: 'inner' });
        for (let n = 1; n <= TERMS; n++) {
          const v = entry.evaluate(p, n);
          assert.ok(Number.isInteger(v) && v >= 1 && v <= INNER_LIMIT, `${entry.id} p=${JSON.stringify(p)} n=${n} v=${v}`);
        }
      }
    });
  }

  test(`solve: 3-6 steps, own keys, both languages, never shows the missing term: ${entry.id}`, () => {
    const rng = createRng(`solve-${entry.id}`);
    let checked = 0;
    for (let i = 0; i < SOLVE_SAMPLES; i++) {
      const p = entry.sampleParams(rng, { cap: HIT_CAP_DEFAULT, role: 'solo' });
      const values = [];
      for (let n = 1; n <= TERMS; n++) values.push(entry.evaluate(p, n));
      if (values.some((v) => v === null)) continue;
      const hidden = 1 + (i % TERMS);
      const all = values.map((value, k) => ({ n: k + 1, value }));
      const variants = [
        { points: all.filter((q) => q.n !== hidden), hidden },
        { points: all, hidden: null },
        { points: all.filter((q) => q.n % 2 === 1 && q.n !== hidden), hidden },
        { points: all.filter((q) => q.n % 2 === 0 && q.n !== hidden), hidden },
      ];
      for (const ctx of variants) {
        const steps = entry.solve(p, ctx);
        assert.ok(steps.length >= MIN_STEPS && steps.length <= MAX_STEPS, `${entry.id} step count ${steps.length}`);
        for (const s of steps) {
          assert.ok(s.key.startsWith(`pool.${entry.id}.`), `key ${s.key}`);
          assert.ok(hasKey('en', s.key), `en ${s.key}`);
          assert.ok(hasKey('th', s.key), `th ${s.key}`);
          assert.ok(!s.math || s.math.every((l) => typeof l === 'string' && l.length > 0), 'math lines');
        }
        if (ctx.hidden !== null) {
          const secret = values[hidden - 1];
          const text = JSON.stringify(steps.map((s) => s.math));
          for (const lhs of [`a_{${hidden}}=${secret}`, `f(${hidden})=${secret}`]) {
            assert.ok(!text.includes(lhs.replace(/\\/g, '\\\\')), `${entry.id} reveals ${lhs}`);
          }
        }
      }
      checked++;
    }
    assert.ok(checked > 0, `${entry.id}: at least one sample fully defined`);
  });
}

test('seq.prime: first 50 primes and the 200th prime', () => {
  const prime = ADVANCED_ENTRIES.find((e) => e.id === 'seq.prime');
  const expected = firstPrimes(FIRST_PRIMES);
  for (let n = 1; n <= FIRST_PRIMES; n++) assert.equal(prime.evaluate([0], n), expected[n - 1], `p_${n}`);
  assert.equal(prime.evaluate([0], prime.maxIndex), EXPECTED_200TH_PRIME);
  assert.equal(prime.evaluate([3], 1), expected[3]);
  assert.equal(prime.latex([2]), 'p_{n+2}');
  assert.equal(prime.latex([0], '2n'), 'p_{2n}');
});

test('rec.fib_gap: classic Fibonacci and gap variants', () => {
  const e = ADVANCED_ENTRIES.find((x) => x.id === 'rec.fib_gap');
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map((n) => e.evaluate([1, 2, 1, 1, 0], n)), [1, 1, 2, 3, 5, 8, 13]);
  // f(n) = f(n-1) + f(n-3), seeds 1,1,1 -> 1,1,1,2,3,4,6
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map((n) => e.evaluate([1, 3, 1, 1, 1], n)), [1, 1, 1, 2, 3, 4, 6]);
  assert.equal(e.evaluate([2, 2, 1, 1, 1], 5), null, 'invalid gap pair is undefined');
  assert.equal(e.evaluate([0, 2, 1, 1, 1], 5), null);
  assert.equal(e.evaluate([1, 4, 1, 1, 1], 5), null);
});

test('rec.pow_sum: values and overflow', () => {
  const e = ADVANCED_ENTRIES.find((x) => x.id === 'rec.pow_sum');
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((n) => e.evaluate([1], n)), [1, 3, 12, 76, 701, 8477]);
  assert.ok(e.evaluate([1], 14) !== null);
  assert.equal(e.evaluate([1], 30), null, 'n^(n-1) overflows safe integers');
});

test('recurrence overflow returns null', () => {
  const byId = (id) => ADVANCED_ENTRIES.find((e) => e.id === id);
  assert.equal(byId('rec.lin1').evaluate([1000, 1, 1], 30), null);
  assert.equal(byId('rec.lin2').evaluate([3, 3, 1, 1], 30), null);
  assert.equal(byId('rec.trib').evaluate([5, 5, 5], 30) === null, false, 'trib stays safe at n=30 with tiny seeds');
  assert.equal(byId('rec.trib').evaluate([Number.MAX_SAFE_INTEGER, 1, 1], 4), null);
  assert.equal(byId('rec.prod_two').evaluate([9, 9], 12), null);
  assert.equal(byId('rec.cum_prod').evaluate([1, 0], 30), null);
  assert.equal(byId('rec.sum_prev').evaluate([Number.MAX_SAFE_INTEGER, 1], 2), null);
  assert.equal(byId('rec.fib_gap').evaluate([1, 2, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 0], 3), null);
  assert.equal(byId('fact.add').evaluate([Number.MAX_SAFE_INTEGER], 18), null);
  assert.equal(byId('pow.nn_mod').evaluate([1], 3), null, 'modulus < 2 is undefined');
});

test('hit-rate report (6 terms integer, |value| <= cap)', (t) => {
  const rows = [];
  for (const e of ADVANCED_ENTRIES) {
    const rng = createRng(`hit-${e.id}`);
    let hitDefault = 0;
    let hitLarge = 0;
    for (let i = 0; i < HIT_SAMPLES; i++) {
      const p = e.sampleParams(rng, { cap: HIT_CAP_DEFAULT, role: 'solo' });
      const vals = [];
      for (let n = 1; n <= TERMS; n++) vals.push(e.evaluate(p, n));
      if (vals.some((v) => v === null || !Number.isInteger(v))) continue;
      const max = Math.max(...vals.map(Math.abs));
      if (max <= HIT_CAP_DEFAULT) hitDefault++;
      if (max <= HIT_CAP_LARGE) hitLarge++;
    }
    rows.push({ id: e.id, tier: e.tier, [`<=${HIT_CAP_DEFAULT}`]: hitDefault / HIT_SAMPLES, [`<=${HIT_CAP_LARGE}`]: hitLarge / HIT_SAMPLES });
    assert.ok(hitLarge > 0, `${e.id}: no usable sample at cap ${HIT_CAP_LARGE}`);
    if (!EXPECTED_ZERO_AT_DEFAULT_CAP.has(e.id)) assert.ok(hitDefault > 0, `${e.id}: no usable sample at cap ${HIT_CAP_DEFAULT}`);
  }
  t.diagnostic(`hit rates:\n${rows.map((r) => JSON.stringify(r)).join('\n')}`);
});
