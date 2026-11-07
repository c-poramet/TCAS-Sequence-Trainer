import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMMON_ENTRIES } from '../src/pool/common.js';
import { validateEntry } from '../src/pool/validate.js';
import { createRng } from '../src/core/rng.js';
import '../src/i18n/pool_common.js';

const ID = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;

test('Pool-A contains the required common families', () => {
  assert.ok(COMMON_ENTRIES.length >= 14);
  assert.equal(new Set(COMMON_ENTRIES.map((entry) => entry.id)).size, COMMON_ENTRIES.length);
  for (const entry of COMMON_ENTRIES) {
    assert.match(entry.id, ID);
    assert.ok(entry.tier === 1 || entry.tier === 2);
    assert.equal(typeof entry.normalize, 'function');
  }
});

test('shift formulas format negative offsets without double signs', () => {
  const square = COMMON_ENTRIES.find((entry) => entry.id === 'poly.shift_sq');
  const cube = COMMON_ENTRIES.find((entry) => entry.id === 'poly.shift_cube');
  assert.equal(square.solve([3, -3], { points: [{ n: 1, value: 13 }], hidden: null })[1].math[0], 'f(n)+3=(n+3)^{2}');
  assert.equal(cube.solve([3, -3], { points: [{ n: 1, value: 61 }], hidden: null })[1].math[0], 'f(n)+3=(n+3)^{3}');
});

test('offset and product formulas format negative constants without double signs', () => {
  const offset = COMMON_ENTRIES.find((entry) => entry.id === 'geo.offset');
  const product = COMMON_ENTRIES.find((entry) => entry.id === 'poly.nprod');
  assert.equal(offset.solve([1, 2, -3], { points: [{ n: 1, value: -2 }], hidden: null })[1].math[0],
    '\\frac{f(n+1)+3}{f(n)+3}=2');
  assert.equal(product.solve([2, -3], { points: [{ n: 1, value: 0 }], hidden: null })[1].math[0],
    'f(n)+3=n(n+2)');
});

test('polynomial formulas omit zero and unit coefficients', () => {
  const cubic = COMMON_ENTRIES.find((entry) => entry.id === 'poly.cubic');
  const quad = COMMON_ENTRIES.find((entry) => entry.id === 'poly.quad');
  assert.equal(cubic.latex([0, 1, 0, 1], 'g(n)'), '\\left(g(n)\\right)^{2}+1');
  assert.equal(quad.latex([0, 1, 0], 'g(n)'), '\\left(g(n)\\right)');
});

test('all common identity coefficients render without redundant terms', () => {
  const entry = (id) => COMMON_ENTRIES.find((item) => item.id === id);
  assert.equal(entry('poly.lin').latex([0, 0], 'n'), '0');
  assert.equal(entry('geo.pure').latex([1, 1], 'n'), '1^{n-1}');
  assert.equal(entry('poly.shift_sq').latex([0, 0], 'n'), 'n^{2}');
  assert.equal(entry('geo.offset').latex([1, 1, 0], 'n'), '1^{n-1}');
  assert.equal(entry('seq.alt_sign').latex([1, 0], 'n'), '(-1)^{n+1}(n)');
  assert.equal(entry('exp.pow2').latex([1, 0], 'n'), '2^{n}');
  assert.equal(entry('seq.step3').latex([0, 0], 'n'), '0');
});

for (const entry of COMMON_ENTRIES) {
  test(`Pool-A entry validates: ${entry.id}`, () => {
    assert.deepEqual(validateEntry(entry, { samples: 200, seed: `pool-a-${entry.id}` }), { ok: true, errors: [] });
  });

  test(`Pool-A sampling is deterministic: ${entry.id}`, () => {
    const a = entry.sampleParams(createRng(`sample-${entry.id}`), { cap: 2500, role: 'solo' });
    const b = entry.sampleParams(createRng(`sample-${entry.id}`), { cap: 2500, role: 'solo' });
    assert.deepEqual(a, b);
    assert.equal(a.length, entry.arity);
  });
}
