import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, GenerationError } from '../src/gen/engine.js';
import { createRng } from '../src/core/rng.js';
import { mockPool, baseCfg } from './fixtures/mockPool.js';

const engine = createEngine({ pool: mockPool });
const run = (cfg, mode, n = 150, seed = 'c') => {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => engine.generateQuestion(rng, { mode, cfg }));
};

test('cap respected', () => {
  const cfg = { ...baseCfg, cap: 60 };
  for (const mode of ['N', 'H']) for (const q of run(cfg, mode)) assert.ok(q.terms.every((v) => Math.abs(v) <= 60));
});

test('minDistinct respected', () => {
  for (const minDistinct of [2, 4, 6]) {
    for (const mode of ['N', 'H']) {
      for (const q of run({ ...baseCfg, minDistinct }, mode, 100)) {
        const d = new Set(q.terms).size;
        assert.ok(d >= minDistinct && d > 1);
      }
    }
  }
});

test('allowNegative=false -> no negative terms', () => {
  for (const mode of ['N', 'H']) for (const q of run({ ...baseCfg, allowNegative: false }, mode)) assert.ok(q.terms.every((v) => v >= 0));
});

test('allowNegative=true can produce negatives', () => {
  assert.ok(run(baseCfg, 'N', 300).some((q) => q.terms.some((v) => v < 0)));
});

test('tiers and pool version respected', () => {
  const normalIds = new Set(mockPool.listEntries({ tiers: baseCfg.normalTiers, maxVersion: 1 }).map((e) => e.id));
  for (const q of run(baseCfg, 'N', 200)) assert.ok(q.fns.every((f) => normalIds.has(f)));
  const v1 = run({ ...baseCfg, poolVersion: 1, normalTiers: [1] }, 'N', 200);
  assert.ok(v1.every((q) => !q.fns.includes('mock.lin2')));
  const v2 = run({ ...baseCfg, poolVersion: 2, normalTiers: [1] }, 'N', 200);
  assert.ok(v2.some((q) => q.fns.includes('mock.lin2')));
  assert.ok(v2.every((q) => q.descriptor.v === 2));
});

test('hard mode: composeChance 1 -> only compositions of composable entries', () => {
  for (const q of run({ ...baseCfg, composeChance: 1, mixedChance: 0.5 }, 'H')) {
    for (const r of q.descriptor.rules) {
      assert.ok(r.o && r.i);
      assert.ok(mockPool.getEntry(r.o.f).composable && mockPool.getEntry(r.i.f).composable);
    }
  }
});

test('hard mode: composeChance 0 -> only rare leaves', () => {
  const rare = new Set(mockPool.listEntries({ tiers: baseCfg.rareTiers }).map((e) => e.id));
  for (const q of run({ ...baseCfg, composeChance: 0 }, 'H')) {
    for (const r of q.descriptor.rules) {
      assert.ok(!r.o);
      assert.ok(rare.has(r.f));
    }
  }
});

test('mixed: the two rules differ; mixedChance 0/1', () => {
  for (const q of run({ ...baseCfg, mixedChance: 1 }, 'N')) {
    assert.equal(q.descriptor.rules.length, 2);
    assert.notDeepEqual(q.descriptor.rules[0], q.descriptor.rules[1]);
  }
  for (const q of run({ ...baseCfg, mixedChance: 0 }, 'N')) assert.equal(q.descriptor.rules.length, 1);
});

test('GenerationError when nothing can satisfy the constraints', () => {
  const rng = createRng('x');
  assert.throws(() => engine.generateQuestion(rng, { mode: 'N', cfg: { ...baseCfg, cap: 10, minDistinct: 6, maxAttempts: 20 } }), GenerationError);
  assert.throws(() => engine.generateQuestion(rng, { mode: 'N', cfg: { ...baseCfg, normalTiers: [] } }), GenerationError);
  assert.throws(() => engine.generateQuestion(rng, { mode: 'X', cfg: baseCfg }), GenerationError);
});
