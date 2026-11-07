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
