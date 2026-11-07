import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMathExpression, normalizeMathText } from '../src/core/dom.js';

test('normalizes identity and zero arithmetic terms', () => {
  assert.equal(normalizeMathExpression('2n+0'), '2n');
  assert.equal(normalizeMathExpression('3\\cdot 1'), '3');
  assert.equal(normalizeMathExpression('n\\cdot 0'), '0');
  assert.equal(normalizeMathExpression('0\\cdot n'), '0');
  assert.equal(normalizeMathExpression('n^{0}'), '1');
  assert.equal(normalizeMathExpression('n/1'), 'n');
});

test('normalizes only delimited math in text', () => {
  assert.equal(normalizeMathText('Keep +0 in text: $$2n+0$$ and $n^{0}$.'),
    'Keep +0 in text: $$2n$$ and $1$.');
});
