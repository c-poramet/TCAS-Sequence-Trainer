import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStorage, setStorage } from '../src/core/storage.js';
import { loadRecords, recordAttempt, clearRecords } from '../src/stats/store.js';

const KEY = 'tcas.stats.v1';
const mk = (n, extra = {}) => ({ t: n, qid: `Q1:N1:x.y(${n})`, ms: 1000 + n, ok: true, ans: n, fns: ['x.y'], mode: 'N', src: 'set', am: 'typed', ...extra });

test('empty storage loads as []', () => {
  setStorage(createMemoryStorage());
  assert.deepEqual(loadRecords(), []);
});

test('recordAttempt appends and persists as JSON under tcas.stats.v1', () => {
  const mem = createMemoryStorage();
  setStorage(mem);
  recordAttempt(mk(1), { maxRecords: 100 });
  recordAttempt(mk(2), { maxRecords: 100 });
  assert.deepEqual(loadRecords().map((r) => r.t), [1, 2]);
  assert.deepEqual(JSON.parse(mem.getItem(KEY)).map((r) => r.t), [1, 2]);
});

test('oldest records are dropped beyond maxRecords', () => {
  setStorage(createMemoryStorage());
  for (let i = 1; i <= 7; i += 1) recordAttempt(mk(i), { maxRecords: 5 });
  assert.deepEqual(loadRecords().map((r) => r.t), [3, 4, 5, 6, 7]);
});

test('corrupted JSON, wrong shapes and bad entries are tolerated', () => {
  const mem = createMemoryStorage();
  setStorage(mem);
  mem.setItem(KEY, '{not json');
  assert.deepEqual(loadRecords(), []);
  mem.setItem(KEY, '{"a":1}');
  assert.deepEqual(loadRecords(), []);
  mem.setItem(KEY, JSON.stringify([mk(1), null, 7, { ok: 'yes' }, mk(2)]));
  assert.deepEqual(loadRecords().map((r) => r.t), [1, 2]);
  recordAttempt(mk(3), { maxRecords: 10 }); // heals the stored value
  assert.deepEqual(JSON.parse(mem.getItem(KEY)).map((r) => r.t), [1, 2, 3]);
});

test('recordAttempt survives a failing storage adapter', () => {
  setStorage({ getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('quota'); }, removeItem: () => { throw new Error('x'); } });
  assert.doesNotThrow(() => recordAttempt(mk(1), { maxRecords: 5 }));
  assert.deepEqual(loadRecords(), []);
  assert.doesNotThrow(() => clearRecords());
});

test('clearRecords empties the store', () => {
  setStorage(createMemoryStorage());
  recordAttempt(mk(1), { maxRecords: 5 });
  clearRecords();
  assert.deepEqual(loadRecords(), []);
});