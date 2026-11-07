import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/gen/engine.js';
import { getChoices } from '../src/gen/choices.js';
import { mockPool, baseSettings } from './fixtures/mockPool.js';

const engine = createEngine({ pool: mockPool });

test('unique integers, exactly one correct answer, valid index', async () => {
  const qs = await engine.generateSet({ ...baseSettings, seed: 'ch', count: 150, hardRatio: 0.5 });
  for (const q of qs) {
    for (const count of [1, 3, 5, 8]) {
      const { choices, correctIndex } = getChoices(q, count);
      assert.equal(choices.length, count);
      assert.equal(new Set(choices).size, count);
      assert.ok(choices.every((c) => Number.isSafeInteger(c)));
      assert.ok(correctIndex >= 0 && correctIndex < count);
      assert.equal(choices[correctIndex], q.answer);
      assert.equal(choices.filter((c) => c === q.answer).length, 1);
    }
  }
});

test('distractors avoid shown terms', async () => {
  const qs = await engine.generateSet({ ...baseSettings, seed: 'ch2', count: 100 });
  for (const q of qs) {
    const shown = new Set(q.terms.filter((_, k) => k !== q.missing - 1));
    const { choices, correctIndex } = getChoices(q, 6);
    choices.forEach((c, k) => {
      if (k !== correctIndex) assert.ok(!shown.has(c), `${q.id}: ${c}`);
    });
  }
});

test('deterministic from the question id', async () => {
  const qs = await engine.generateSet({ ...baseSettings, seed: 'ch3', count: 30 });
  for (const q of qs) {
    const a = getChoices(q, 5);
    const b = getChoices(engine.rebuildQuestion(q.id), 5);
    assert.deepEqual(a, b);
  }
});

test('correctIndex is spread over all positions', async () => {
  const qs = await engine.generateSet({ ...baseSettings, seed: 'ch4', count: 300 });
  const hits = new Array(5).fill(0);
  for (const q of qs) hits[getChoices(q, 5).correctIndex]++;
  assert.ok(hits.every((h) => h > 300 / 5 / 2), JSON.stringify(hits));
});

test('plausible distractors are mostly near the answer; works for tiny/zero answers', () => {
  const q = { id: 'Q1:N1:mock.lin(0,0)', terms: [0, 0, 0, 0, 0, 0], missing: 1, answer: 0 };
  const { choices } = getChoices(q, 8);
  assert.equal(new Set(choices).size, 8);
  const q2 = { id: 'Q1:N3:x.y(1)', terms: [2, 4, 6, 8, 10, 12], missing: 3, answer: 6 };
  const r = getChoices(q2, 5);
  assert.equal(r.choices.length, 5);
  assert.ok(r.choices.every((c) => Math.abs(c - 6) <= 12));
});

test('invalid count throws RangeError', () => {
  assert.throws(() => getChoices({ id: 'a', terms: [1, 2, 3, 4, 5, 6], missing: 1, answer: 1 }, 0), RangeError);
});
