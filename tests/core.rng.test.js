import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng, randomSeed } from '../src/core/rng.js';

const take = (rng, n, fn) => Array.from({ length: n }, () => fn(rng));

test('same seed gives identical streams, different seeds differ', () => {
  const a = take(createRng('seed-1'), 50, (r) => r.next());
  const b = take(createRng('seed-1'), 50, (r) => r.next());
  const c = take(createRng('seed-2'), 50, (r) => r.next());
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('pinned vector: first values of createRng("tcas").int(0,99)', () => {
  const rng = createRng('tcas');
  assert.deepEqual(take(rng, 5, (r) => r.int(0, 99)), PINNED_TCAS);
});

test('next() stays inside [0, 1)', () => {
  const rng = createRng('range');
  for (let i = 0; i < 20000; i++) {
    const x = rng.next();
    assert.ok(x >= 0 && x < 1);
  }
});

test('int() is inclusive and roughly uniform', () => {
  const rng = createRng('uniform');
  const counts = new Array(10).fill(0);
  const draws = 20000;
  for (let i = 0; i < draws; i++) counts[rng.int(0, 9)]++;
  for (const c of counts) assert.ok(c > draws / 10 * 0.9 && c < draws / 10 * 1.1, `bucket ${c}`);
  const rng2 = createRng('edges');
  const seen = new Set(take(rng2, 500, (r) => r.int(-2, 2)));
  assert.deepEqual([...seen].sort((a, b) => a - b), [-2, -1, 0, 1, 2]);
  assert.equal(createRng('x').int(7, 7), 7);
});

test('int() rejects bad ranges', () => {
  const rng = createRng('bad');
  assert.throws(() => rng.int(3, 2), RangeError);
  assert.throws(() => rng.int(0.5, 2), RangeError);
});

test('chance() follows its probability and always consumes one draw', () => {
  const rng = createRng('chance');
  let hits = 0;
  for (let i = 0; i < 20000; i++) if (rng.chance(0.3)) hits++;
  assert.ok(hits > 5400 && hits < 6600);
  const a = createRng('stream');
  const b = createRng('stream');
  a.chance(0);
  b.chance(1);
  assert.equal(a.next(), b.next());
});

test('pick() and weighted() are deterministic and respect weights', () => {
  assert.equal(createRng('p').pick(['a', 'b', 'c']), createRng('p').pick(['a', 'b', 'c']));
  assert.throws(() => createRng('p').pick([]), RangeError);
  const items = ['x', 'y', 'z'];
  const w = { x: 1, y: 0, z: 3 };
  const rng = createRng('weights');
  const counts = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < 20000; i++) counts[rng.weighted(items, (k) => w[k])]++;
  assert.equal(counts.y, 0);
  assert.ok(counts.z > counts.x * 2.5 && counts.z < counts.x * 3.5);
  assert.throws(() => createRng('w').weighted(items, () => 0), RangeError);
  assert.throws(() => createRng('w').weighted([], () => 1), RangeError);
  assert.equal(createRng('w1').weighted(items, (k) => w[k]), createRng('w1').weighted(items, (k) => w[k]));
});

test('shuffle() returns a new permutation and is deterministic', () => {
  const src = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const copy = src.slice();
  const out = createRng('shuf').shuffle(src);
  assert.deepEqual(src, copy);
  assert.notEqual(out, src);
  assert.deepEqual([...out].sort((a, b) => a - b), copy);
  assert.deepEqual(out, createRng('shuf').shuffle(src));
  assert.notDeepEqual(out, createRng('shuf2').shuffle(src));
});

test('fork(label) equals createRng(seed + "/" + label) and ignores parent consumption', () => {
  const parent = createRng('root');
  parent.next();
  parent.next();
  const forked = parent.fork('child');
  const direct = createRng('root/child');
  assert.deepEqual(take(forked, 20, (r) => r.next()), take(direct, 20, (r) => r.next()));
  assert.notDeepEqual(take(createRng('root').fork('a'), 5, (r) => r.next()), take(createRng('root').fork('b'), 5, (r) => r.next()));
  assert.equal(createRng('root').fork('a').fork('b').next(), createRng('root/a/b').next());
});

test('randomSeed() gives 8 base36 characters', () => {
  for (let i = 0; i < 20; i++) assert.match(randomSeed(), /^[0-9a-z]{8}$/);
});

const PINNED_TCAS = [71, 50, 8, 66, 51];
