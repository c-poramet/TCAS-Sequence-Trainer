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
  assert.equal(normalizeMathExpression('0n^{3}+1n^{2}+0n+1'), 'n^{2}+1');
  assert.equal(normalizeMathExpression('g(n)=0n^{3}+1n^{2}+0n+1'), 'g(n)=n^{2}+1');
  assert.equal(normalizeMathExpression('0\\cdot2^{n}+1\\cdot2^{n}+\\frac{n}{1}'), '2^{n}+n');
  assert.equal(normalizeMathExpression('(n+0)^{2}'), 'n^{2}');
  assert.equal(normalizeMathExpression('(-1)^{n+1}(0n+0)'), '(-1)^{n+1}0');
});

test('normalizes only delimited math in text', () => {
  assert.equal(normalizeMathText('Keep +0 in text: $$2n+0$$ and $n^{0}$.'),
    'Keep +0 in text: $$2n$$ and $1$.');
});
