import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';
import {
  ALGO_VERSION, GEN_KEYS, IdError, decodeQuestionId, decodeSetId, encodeQuestionId, encodeSetId,
  isQuestionId, isSetId,
} from '../src/core/ids.js';

const FN_IDS = ['poly.lin', 'poly.quad', 'seq.prime', 'rec.fib', 'a.b_c9', 'geo.ratio', 'x1.y2.z3'];

function randomParam(rng) {
  const kind = rng.int(0, 5);
  if (kind === 0) return 0;
  if (kind === 1) return -rng.int(1, 9);
  if (kind === 2) return rng.int(-100000, 100000);
  if (kind === 3) return rng.pick([Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER, 1, -1]);
  return rng.int(-20, 20);
}
const randomLeaf = (rng) => ({ f: rng.pick(FN_IDS), p: Array.from({ length: rng.int(0, 4) }, () => randomParam(rng)) });
const randomExpr = (rng) => (rng.chance(0.5) ? randomLeaf(rng) : { o: randomLeaf(rng), i: randomLeaf(rng) });

function randomDescriptor(rng) {
  const mixed = rng.chance(0.5);
  return {
    v: rng.pick([1, 2, 10, 999]),
    mode: rng.pick(['N', 'H']),
    missing: rng.int(1, 6),
    rules: mixed ? [randomExpr(rng), randomExpr(rng)] : [randomExpr(rng)],
  };
}

test('question ID: documented example decodes and re-encodes', () => {
  const id = 'Q1:H4:poly.lin(2,1)@poly.quad(1,0,3)|seq.prime(0)';
  const d = decodeQuestionId(id);
  assert.deepEqual(d, {
    v: 1, mode: 'H', missing: 4,
    rules: [{ o: { f: 'poly.lin', p: [2, 1] }, i: { f: 'poly.quad', p: [1, 0, 3] } }, { f: 'seq.prime', p: [0] }],
  });
  assert.equal(encodeQuestionId(d), id);
  assert.ok(isQuestionId(id));
});

test('question ID: round-trips on 300 generated descriptors (both directions)', () => {
  const rng = createRng('qid-roundtrip');
  for (let k = 0; k < 300; k++) {
    const d = randomDescriptor(rng);
    const id = encodeQuestionId(d);
    assert.deepEqual(decodeQuestionId(id), d, id);
    assert.equal(encodeQuestionId(decodeQuestionId(id)), id);
    assert.ok(!/\s/.test(id));
  }
});

test('question ID: hand-picked shapes (negative, zero, empty params, composition, mixed, both)', () => {
  const cases = [
    { v: 1, mode: 'N', missing: 1, rules: [{ f: 'poly.lin', p: [-3, 0] }] },
    { v: 3, mode: 'H', missing: 6, rules: [{ f: 'a.b', p: [] }] },
    { v: 2, mode: 'N', missing: 3, rules: [{ o: { f: 'a.b', p: [0] }, i: { f: 'c.d', p: [-1, -2] } }] },
    { v: 2, mode: 'H', missing: 2, rules: [{ f: 'a.b', p: [1] }, { f: 'c.d', p: [0, 0] }] },
    { v: 7, mode: 'H', missing: 5, rules: [{ o: { f: 'a.b', p: [1] }, i: { f: 'c.d', p: [2] } }, { o: { f: 'e.f', p: [-3] }, i: { f: 'g.h', p: [] } }] },
  ];
  for (const d of cases) assert.deepEqual(decodeQuestionId(encodeQuestionId(d)), d);
});

const BAD_QIDS = [
  '', 'Q', 'Q1', 'Q1:', 'Q1:N', 'Q1:N4', 'Q1:N4:', 'Q1N4:a.b(1)', 'Q1::N4:a.b(1)',
  'q1:N4:a.b(1)', 'Q0:N4:a.b(1)', 'Q-1:N4:a.b(1)', 'Q01:N4:a.b(1)', 'Qx:N4:a.b(1)',
  'Q1:X4:a.b(1)', 'Q1:n4:a.b(1)', 'Q1:N0:a.b(1)', 'Q1:N7:a.b(1)', 'Q1:N10:a.b(1)', 'Q1:N:a.b(1)',
  'Q1:N4:a.b(1)|c.d(2)|e.f(3)', 'Q1:N4:a.b(1)@c.d(2)@e.f(3)', 'Q1:N4:a.b(1)|c.d(2)@e.f(3)@g.h(4)',
  'Q1:N4:a.b(1.5)', 'Q1:N4:a.b(1e3)', 'Q1:N4:a.b(+1)', 'Q1:N4:a.b(1,)', 'Q1:N4:a.b(,1)', 'Q1:N4:a.b(1,,2)',
  'Q1:N4:a.b(-)', 'Q1:N4:a.b(-0)', 'Q1:N4:a.b(01)', 'Q1:N4:a.b(99999999999999999999)',
  'Q1:N4: a.b(1)', 'Q1:N4:a.b(1) ', 'Q1:N4:a.b( 1)', 'Q1:N4:a.b(1, 2)', 'Q1:N4:a.b(1)\n',
  'Q1:N4:a.b(1', 'Q1:N4:a.b1)', 'Q1:N4:a.b', 'Q1:N4:(1)', 'Q1:N4:A.b(1)', 'Q1:N4:a-b(1)',
  'Q1:N4:a.b(1)|', 'Q1:N4:|a.b(1)', 'Q1:N4:a.b(1)@', 'Q1:N4:@a.b(1)', 'Q1:N4:a.b(1)(2)', 'Q1:N4:a.b(1)||c.d(2)',
  'Q1:N4:a.b(1)x',
];

test('question ID: malformed IDs are rejected with IdError', () => {
  assert.ok(BAD_QIDS.length >= 20);
  for (const bad of BAD_QIDS) {
    assert.throws(() => decodeQuestionId(bad), IdError, JSON.stringify(bad));
    assert.equal(isQuestionId(bad), false, JSON.stringify(bad));
  }
  for (const notString of [null, undefined, 42, {}, []]) {
    assert.throws(() => decodeQuestionId(notString), IdError);
    assert.equal(isQuestionId(notString), false);
  }
});

test('question ID: encoder rejects invalid descriptors', () => {
  const ok = { v: 1, mode: 'N', missing: 1, rules: [{ f: 'a.b', p: [1] }] };
  const bads = [
    { ...ok, v: 0 }, { ...ok, v: 1.5 }, { ...ok, mode: 'X' }, { ...ok, missing: 0 }, { ...ok, missing: 7 },
    { ...ok, rules: [] }, { ...ok, rules: [ok.rules[0], ok.rules[0], ok.rules[0]] },
    { ...ok, rules: [{ f: 'A.b', p: [] }] }, { ...ok, rules: [{ f: '', p: [] }] },
    { ...ok, rules: [{ f: 'a.b', p: [1.5] }] }, { ...ok, rules: [{ f: 'a.b', p: ['1'] }] },
    { ...ok, rules: [{ f: 'a.b' }] }, null,
  ];
  for (const bad of bads) assert.throws(() => encodeQuestionId(bad), IdError);
});

const baseSettings = () => ({
  seed: 'abc123', count: 20, hardRatio: 0.25, mixedChance: 0.5, cap: 2500, maxAttempts: 300,
  poolVersion: 1, normalTiers: [1, 2], composeTiers: [1, 2, 3], rareTiers: [3, 4],
  composeChance: 0.5, minDistinct: 4, allowNegative: true,
});

test('set ID: round-trip, including unicode and awkward numbers', () => {
  assert.equal(ALGO_VERSION, 1);
  const variants = [
    baseSettings(),
    { ...baseSettings(), seed: 'เมล็ด🌱สุ่ม', hardRatio: 0.1 + 0.2, allowNegative: false },
    { ...baseSettings(), seed: 'x', count: 5000, cap: 1000000, hardRatio: 0, mixedChance: 1, poolVersion: 12 },
    { ...baseSettings(), seed: 'é'.repeat(64), normalTiers: [4], rareTiers: [1, 2, 3, 4] },
  ];
  for (const s of variants) {
    const sid = encodeSetId(s);
    assert.match(sid, /^S1-[A-Za-z0-9_-]+$/);
    const decoded = decodeSetId(sid);
    assert.equal(decoded.algo, 1);
    assert.deepEqual(decoded.settings, s);
    assert.equal(encodeSetId(decoded.settings, decoded.algo), sid);
    assert.ok(isSetId(sid));
  }
});

test('set ID: payload is a JSON array in GEN_KEYS order', () => {
  const s = baseSettings();
  const sid = encodeSetId(s);
  const json = Buffer.from(sid.slice(3), 'base64url').toString('utf8');
  assert.deepEqual(JSON.parse(json), GEN_KEYS.map((k) => s[k]));
  assert.equal(sid.slice(3), Buffer.from(json, 'utf8').toString('base64url'));
});

const b64 = (text) => Buffer.from(text, 'utf8').toString('base64url');
const sidOf = (arr) => `S1-${b64(JSON.stringify(arr))}`;
const arrOf = (patch) => GEN_KEYS.map((k) => (k in patch ? patch[k] : baseSettings()[k]));

test('set ID: malformed or out-of-range IDs are rejected with IdError', () => {
  const good = encodeSetId(baseSettings());
  const bads = [
    '', 'S', 'S1', 'S1-', 'X1-' + good.slice(3), good.replace('S1-', 'S-'), good.replace('S1-', 'S0-'),
    good.replace('S1-', 'S01-'), good.replace('S1-', 'S2-'), good.replace('S1-', 'S1_'),
    good + '=', good + '!', good + ' ', ' ' + good, good.slice(0, -1) + '*',
    'S1-a', 'S1-' + b64('not json'), 'S1-' + b64('{}'), 'S1-' + b64('[1,2,3]'),
    'S1-' + Buffer.from([0xff, 0xfe, 0xfd]).toString('base64url'),
    // JSON with whitespace is valid JSON but not canonical
    `S1-${b64(JSON.stringify(arrOf({}), null, 1))}`,
    sidOf(arrOf({ seed: '' })), sidOf(arrOf({ seed: 'x'.repeat(65) })), sidOf(arrOf({ seed: 5 })),
    sidOf(arrOf({ count: 0 })), sidOf(arrOf({ count: 5001 })), sidOf(arrOf({ count: 1.5 })),
    sidOf(arrOf({ hardRatio: 1.5 })), sidOf(arrOf({ hardRatio: -0.1 })), sidOf(arrOf({ mixedChance: '0.5' })),
    sidOf(arrOf({ cap: 9 })), sidOf(arrOf({ cap: 1000001 })), sidOf(arrOf({ maxAttempts: 0 })),
    sidOf(arrOf({ poolVersion: 0 })), sidOf(arrOf({ poolVersion: null })), sidOf(arrOf({ normalTiers: [] })),
    sidOf(arrOf({ normalTiers: [5] })), sidOf(arrOf({ composeTiers: [0, 1] })), sidOf(arrOf({ rareTiers: [1.5] })),
    sidOf(arrOf({ rareTiers: 'x' })), sidOf(arrOf({ composeChance: 2 })), sidOf(arrOf({ minDistinct: 1 })),
    sidOf(arrOf({ minDistinct: 7 })), sidOf(arrOf({ allowNegative: 1 })),
  ];
  assert.ok(bads.length >= 20);
  for (const bad of bads) {
    assert.throws(() => decodeSetId(bad), IdError, bad.slice(0, 60));
    assert.equal(isSetId(bad), false);
  }
  assert.throws(() => decodeSetId(null), IdError);
  assert.throws(() => encodeSetId({ ...baseSettings(), count: 0 }), IdError);
  assert.throws(() => encodeSetId(baseSettings(), 0), IdError);
});
