import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/gen/engine.js';
import { mockPool, baseSettings } from './fixtures/mockPool.js';

const engine = createEngine({ pool: mockPool });
const settings = { ...baseSettings, seed: 'determinism', count: 200, hardRatio: 0.4 };

test('same seed -> same 200 question IDs', async () => {
  const a = await engine.generateSet(settings);
  const b = await engine.generateSet(settings);
  assert.equal(a.length, 200);
  assert.deepEqual(a.map((q) => q.id), b.map((q) => q.id));
  assert.deepEqual(a, b);
});

test('different seed -> different IDs', async () => {
  const a = await engine.generateSet(settings);
  const b = await engine.generateSet({ ...settings, seed: 'other' });
  assert.notDeepEqual(a.map((q) => q.id), b.map((q) => q.id));
});

test('index i is reproducible alone and independent of other questions', async () => {
  const all = await engine.generateSet(settings);
  for (const i of [0, 1, 57, 133, 199]) {
    assert.deepEqual(engine.generateSetQuestion(settings, i), all[i]);
  }
  const shrunk = await engine.generateSet({ ...settings, count: 10 });
  assert.deepEqual(shrunk, all.slice(0, 10));
});

test('hardRatio extremes', async () => {
  const hard = await engine.generateSet({ ...settings, count: 30, hardRatio: 1 });
  assert.ok(hard.every((q) => q.mode === 'H'));
  const normal = await engine.generateSet({ ...settings, count: 30, hardRatio: 0 });
  assert.ok(normal.every((q) => q.mode === 'N'));
});

test('generateSet reports progress and yields in chunks', async () => {
  const calls = [];
  const qs = await engine.generateSet({ ...settings, count: 25 }, { chunk: 10, onProgress: (d, t) => calls.push([d, t]) });
  assert.equal(qs.length, 25);
  assert.deepEqual(calls, [[10, 25], [20, 25], [25, 25]]);
});
