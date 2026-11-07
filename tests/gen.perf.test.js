import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/gen/engine.js';
import { mockPool, baseSettings } from './fixtures/mockPool.js';

test('1000 questions in < 3 s', async () => {
  const engine = createEngine({ pool: mockPool });
  const t0 = performance.now();
  const qs = await engine.generateSet({ ...baseSettings, seed: 'perf', count: 1000, hardRatio: 0.5 });
  const ms = performance.now() - t0;
  assert.equal(qs.length, 1000);
  assert.ok(ms < 3000, `took ${ms.toFixed(0)} ms`);
});
