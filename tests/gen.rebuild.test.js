import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, RebuildError } from '../src/gen/engine.js';
import { encodeSetId, IdError } from '../src/core/ids.js';
import { mockPool, baseSettings, MOCK_POOL_VERSION } from './fixtures/mockPool.js';

const engine = createEngine({ pool: mockPool });

test('rebuildQuestion round-trips 500 questions (deep-equal)', async () => {
  const qs = await engine.generateSet({ ...baseSettings, seed: 'rt', count: 500, hardRatio: 0.5, poolVersion: MOCK_POOL_VERSION });
  for (const q of qs) {
    assert.deepEqual(engine.rebuildQuestion(q.id), q, q.id);
    assert.deepEqual(engine.questionFromDescriptor(q.descriptor), q, q.id);
  }
});

test('question shape', async () => {
  const qs = await engine.generateSet({ ...baseSettings, seed: 'shape', count: 50 });
  for (const q of qs) {
    assert.equal(q.terms.length, 6);
    assert.equal(q.answer, q.terms[q.missing - 1]);
    assert.equal(q.missing, q.descriptor.missing);
    assert.equal(q.mixed, q.descriptor.rules.length === 2);
    assert.deepEqual(q.fns, [...new Set(q.fns)].sort());
    assert.equal(q.descriptor.v, baseSettings.poolVersion);
    assert.ok(q.terms.every((v) => !Object.is(v, -0)));
  }
});

test('unknown function and wrong arity -> RebuildError', () => {
  assert.throws(() => engine.rebuildQuestion('Q1:N3:nope.fn(1,2)'), RebuildError);
  assert.throws(() => engine.rebuildQuestion('Q1:N3:mock.lin(1,2,3)'), RebuildError);
  assert.throws(() => engine.rebuildQuestion('Q1:N3:mock.lin(1)'), RebuildError);
});

test('malformed ID -> IdError', () => {
  assert.throws(() => engine.rebuildQuestion('garbage'), IdError);
});

test('old IDs stay valid: cap and tier rules are not re-applied', () => {
  const q = engine.rebuildQuestion('Q1:N2:mock.lin(1000,1000)'); // terms up to 6000 > default cap
  assert.deepEqual(q.terms, [2000, 3000, 4000, 5000, 6000, 7000]);
  assert.equal(q.answer, 3000);
});

test('descriptor whose terms are undefined -> RebuildError', () => {
  assert.throws(() => engine.rebuildQuestion('Q1:N1:mock.geo(1,2)@mock.lin(0,-3)'), RebuildError);
});

test('generateSetFromId regenerates the set; wrong algo -> RebuildError', async () => {
  const gs = { ...baseSettings, seed: 'sid', count: 15 };
  const direct = await engine.generateSet(gs);
  const viaId = await engine.generateSetFromId(encodeSetId(gs));
  assert.deepEqual(viaId.settings, gs);
  assert.deepEqual(viaId.questions, direct);
  await assert.rejects(() => engine.generateSetFromId(encodeSetId(gs, 99)), RebuildError);
});
