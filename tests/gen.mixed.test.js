import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/gen/engine.js';
import { mockPool, baseSettings, MOCK_POOL_VERSION } from './fixtures/mockPool.js';

const engine = createEngine({ pool: mockPool });
const ev = (leaf, n) => mockPool.getEntry(leaf.f).evaluate(leaf.p, n);
const exprAt = (expr, n) => (expr.o ? ev(expr.o, ev(expr.i, n)) : ev(expr, n));

test('mixed questions: rules[0] on odd n, rules[1] on even n (independent evaluation)', async () => {
  const qs = await engine.generateSet({ ...baseSettings, seed: 'mx', count: 300, mixedChance: 1, hardRatio: 0.5, poolVersion: MOCK_POOL_VERSION });
  for (const q of qs) {
    assert.equal(q.descriptor.rules.length, 2);
    for (let n = 1; n <= 6; n++) {
      const rule = q.descriptor.rules[n % 2 === 1 ? 0 : 1];
      assert.equal(q.terms[n - 1], exprAt(rule, n), `${q.id} n=${n}`);
    }
  }
});

test('single-rule questions use rules[0] everywhere', async () => {
  const qs = await engine.generateSet({ ...baseSettings, seed: 'sg', count: 100, mixedChance: 0 });
  for (const q of qs) for (let n = 1; n <= 6; n++) assert.equal(q.terms[n - 1], exprAt(q.descriptor.rules[0], n));
});

test('composition value is outer(inner(n))', () => {
  const q = engine.rebuildQuestion('Q1:H3:mock.quad(1,0,0)@mock.lin(2,1)'); // (2n+1)^2
  assert.deepEqual(q.terms, [9, 25, 49, 81, 121, 169]);
  assert.equal(q.answer, 49);
  assert.deepEqual(q.fns, ['mock.lin', 'mock.quad']);
  assert.equal(q.mixed, false);
});

test('mixed rebuild by hand: odd = lin, even = fib-like', () => {
  const q = engine.rebuildQuestion('Q1:N4:mock.lin(3,0)|mock.lin(5,1)');
  assert.deepEqual(q.terms, [3, 11, 9, 21, 15, 31]);
  assert.equal(q.mixed, true);
});
