import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, GenerationError } from '../src/gen/engine.js';
import { createRng } from '../src/core/rng.js';
import { mockPool, baseCfg } from './fixtures/mockPool.js';

const engine = createEngine({ pool: mockPool });
const many = (cfg, mode, id, n = 80) => {
  const rng = createRng('mi-' + id);
  return Array.from({ length: n }, () => engine.generateQuestion(rng, { mode, cfg, filter: { mustInclude: id } }));
};

test('mustInclude appears in every normal question (single and mixed)', () => {
  for (const mixedChance of [0, 1, 0.5]) {
    for (const q of many({ ...baseCfg, mixedChance }, 'N', 'mock.geo')) assert.ok(q.fns.includes('mock.geo'));
  }
});

test('mustInclude in hard mode: rare leaf', () => {
  for (const q of many({ ...baseCfg, composeChance: 0 }, 'H', 'mock.prime')) assert.ok(q.fns.includes('mock.prime'));
});

test('mustInclude in hard mode: composition, outer or inner', () => {
  const qs = many({ ...baseCfg, composeChance: 1, mixedChance: 0 }, 'H', 'mock.tri', 120);
  let asOuter = 0;
  let asInner = 0;
  for (const q of qs) {
    const r = q.descriptor.rules[0];
    assert.ok(r.o.f === 'mock.tri' || r.i.f === 'mock.tri');
    if (r.o.f === 'mock.tri') asOuter++;
    if (r.i.f === 'mock.tri') asInner++;
  }
  assert.ok(asOuter > 0 && asInner > 0);
});

test('mustInclude in mixed hard mode lands in one of the rules', () => {
  for (const q of many({ ...baseCfg, mixedChance: 1, composeChance: 0.5 }, 'H', 'mock.cube')) {
    assert.ok(q.fns.includes('mock.cube'));
  }
});

test('ineligible mustInclude fails immediately (no looping)', () => {
  const rng = createRng('z');
  const before = rng.next();
  const rng2 = createRng('z');
  const cfg = { ...baseCfg, maxAttempts: 5000 };
  const bad = [
    ['N', 'mock.alt'], // tier 4 not in normalTiers
    ['N', 'mock.nope'], // unknown
    ['N', 'mock.lin2'], // since 2 > poolVersion 1
    ['H', 'mock.geo'], // tier 1: neither rare nor in compose tiers... and not composable
    ['H', 'mock.fib'], // tier 2, not composable, not rare
  ];
  for (const [mode, id] of bad) {
    assert.throws(() => engine.generateQuestion(rng2, { mode, cfg, filter: { mustInclude: id } }), GenerationError, id);
  }
  assert.equal(rng2.next(), before, 'no random numbers consumed');
  assert.throws(() => engine.generateQuestion(rng2, { mode: 'H', cfg: { ...cfg, composeChance: 0 }, filter: { mustInclude: 'mock.cube' } }), GenerationError);
  assert.throws(() => engine.generateQuestion(rng2, { mode: 'H', cfg: { ...cfg, composeChance: 1 }, filter: { mustInclude: 'mock.prime' } }), GenerationError);
});
