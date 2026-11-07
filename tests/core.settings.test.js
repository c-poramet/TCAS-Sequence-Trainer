import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SCHEMA, getSchemaEntry } from '../src/core/schema.js';
import { createMemoryStorage, getStorage, setStorage } from '../src/core/storage.js';
import {
  getAllSettings, getGenConfig, getSetting, getStatsConfig, onSettingsChange, resetSettings, setSetting, toGenSettings,
} from '../src/core/settings.js';
import { decodeSetId, encodeSetId } from '../src/core/ids.js';

let mem;
beforeEach(() => {
  mem = createMemoryStorage();
  setStorage(mem);
});

const TABLE = {
  lang: ['enum', 'en'], answerMode: ['enum', 'typed'], mcChoices: ['int', 5, 3, 8], showTimer: ['bool', true],
  'gen.count': ['int', 20, 1, 5000], 'gen.maxSetSize': ['int', 2000, 1, 5000],
  'gen.hardRatio': ['float', 0.25, 0, 1], 'gen.mixedChance': ['float', 0.5, 0, 1],
  'gen.cap': ['int', 2500, 10, 1000000], 'gen.maxAttempts': ['int', 300, 1, 5000], 'gen.poolVersion': ['int', null, 1],
  'gen.normalTiers': ['intList', [1, 2], 1, 4], 'gen.composeTiers': ['intList', [1, 2, 3], 1, 4],
  'gen.rareTiers': ['intList', [3, 4], 1, 4], 'gen.composeChance': ['float', 0.5, 0, 1],
  'gen.minDistinct': ['int', 4, 2, 6], 'gen.allowNegative': ['bool', true],
  'trainer.count': ['int', 20, 0, 1000], 'trainer.buckets': ['enumList', ['easy', 'normal', 'hard', 'failed']],
  'stats.minAttempts': ['int', 3, 1, 50], 'stats.fastRatio': ['float', 0.8, 0.1, 1],
  'stats.slowRatio': ['float', 1.25, 1, 5], 'stats.failedRate': ['float', 0.4, 0, 1],
  'stats.maxRecords': ['int', 20000, 100, 200000],
  'print.includeAnswers': ['bool', true], 'print.includeSolutions': ['bool', false],
};

test('SCHEMA matches the contract table verbatim', () => {
  assert.equal(SCHEMA.length, Object.keys(TABLE).length);
  for (const [key, [type, def, min, max]] of Object.entries(TABLE)) {
    const e = getSchemaEntry(key);
    assert.ok(e, key);
    assert.equal(e.type, type, key);
    assert.deepEqual(e.default, def, key);
    assert.equal(e.min, min, key);
    assert.equal(e.max, max, key);
    assert.equal(e.group, key.includes('.') ? key.split('.')[0] : 'general');
  }
});

test('lang default is resolved lazily from navigator (Node-safe)', () => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  try {
    Object.defineProperty(globalThis, 'navigator', { value: { language: 'th-TH' }, configurable: true });
    assert.equal(getSchemaEntry('lang').default, 'th');
    assert.equal(getSetting('lang'), 'th');
    Object.defineProperty(globalThis, 'navigator', { value: { language: 'en-US' }, configurable: true });
    assert.equal(getSchemaEntry('lang').default, 'en');
    delete globalThis.navigator;
    assert.equal(getSchemaEntry('lang').default, 'en');
  } finally {
    if (saved) Object.defineProperty(globalThis, 'navigator', saved);
    else delete globalThis.navigator;
  }
});

test('defaults are returned and nothing is persisted until a value changes', () => {
  assert.equal(getSetting('gen.count'), 20);
  assert.deepEqual(getSetting('gen.normalTiers'), [1, 2]);
  assert.equal(getSetting('gen.poolVersion'), null);
  assert.equal(mem.getItem('tcas.settings.v1'), null);
  assert.throws(() => getSetting('nope'), /Unknown setting/);
  assert.throws(() => setSetting('nope', 1), /Unknown setting/);
});

test('setSetting clamps numbers and rounds integers', () => {
  assert.equal(setSetting('mcChoices', 99), 8);
  assert.equal(setSetting('mcChoices', 1), 3);
  assert.equal(setSetting('mcChoices', '6'), 6);
  assert.equal(setSetting('mcChoices', 4.6), 5);
  assert.equal(setSetting('gen.hardRatio', 7), 1);
  assert.equal(setSetting('gen.hardRatio', -2), 0);
  assert.equal(setSetting('stats.fastRatio', 0), 0.1);
  assert.equal(setSetting('trainer.count', 0), 0);
  assert.equal(setSetting('gen.cap', 5), 10);
});

test('invalid input leaves the setting unchanged', () => {
  setSetting('mcChoices', 7);
  assert.equal(setSetting('mcChoices', 'abc'), 7);
  assert.equal(setSetting('mcChoices', NaN), 7);
  assert.equal(setSetting('mcChoices', null), 7);
  assert.equal(setSetting('answerMode', 'bogus'), 'typed');
  assert.equal(setSetting('showTimer', 'maybe'), true);
  assert.deepEqual(setSetting('trainer.buckets', []), ['easy', 'normal', 'hard', 'failed']);
  assert.deepEqual(setSetting('gen.normalTiers', 'a,b'), [1, 2]);
});

test('intList / enumList are de-duplicated, sorted and clamped', () => {
  assert.deepEqual(setSetting('gen.normalTiers', [3, 1, 3, 2]), [1, 2, 3]);
  assert.deepEqual(setSetting('gen.normalTiers', '4, 2 ,2'), [2, 4]);
  assert.deepEqual(setSetting('gen.rareTiers', [0, 9]), [1, 4]);
  assert.deepEqual(setSetting('trainer.buckets', ['failed', 'easy', 'easy', 'zzz']), ['easy', 'failed']);
});

test('nullable gen.poolVersion', () => {
  assert.equal(setSetting('gen.poolVersion', 3), 3);
  assert.equal(setSetting('gen.poolVersion', 0), 1);
  assert.equal(setSetting('gen.poolVersion', null), null);
  assert.equal(setSetting('gen.poolVersion', 4), 4);
  assert.equal(setSetting('gen.poolVersion', ''), null);
});

test('gen.count max follows gen.maxSetSize dynamically', () => {
  assert.equal(setSetting('gen.maxSetSize', 50), 50);
  assert.equal(setSetting('gen.count', 100), 50);
  assert.equal(setSetting('gen.maxSetSize', 10), 10);
  assert.equal(getSetting('gen.count'), 10);
  assert.equal(setSetting('gen.maxSetSize', 5000), 5000);
  assert.equal(getSetting('gen.count'), 50);
});

test('only non-default values are persisted; setting the default removes the key', () => {
  setSetting('mcChoices', 6);
  setSetting('showTimer', true);
  assert.deepEqual(JSON.parse(mem.getItem('tcas.settings.v1')), { mcChoices: 6 });
  setSetting('mcChoices', 5);
  assert.equal(mem.getItem('tcas.settings.v1'), null);
});

test('values survive a reload from storage; corrupt storage is ignored', () => {
  setSetting('gen.cap', 777);
  setSetting('gen.normalTiers', [4]);
  const again = createMemoryStorage();
  again.setItem('tcas.settings.v1', mem.getItem('tcas.settings.v1'));
  setStorage(again);
  assert.equal(getSetting('gen.cap'), 777);
  assert.deepEqual(getSetting('gen.normalTiers'), [4]);
  const broken = createMemoryStorage();
  broken.setItem('tcas.settings.v1', '{not json');
  setStorage(broken);
  assert.equal(getSetting('gen.cap'), 2500);
  const partial = createMemoryStorage();
  partial.setItem('tcas.settings.v1', JSON.stringify({ mcChoices: 99, bogus: 1, answerMode: 'mc', 'gen.cap': 'x' }));
  setStorage(partial);
  assert.equal(getSetting('mcChoices'), 8);
  assert.equal(getSetting('answerMode'), 'mc');
  assert.equal(getSetting('gen.cap'), 2500);
});

test('resetSettings resets all or selected keys and getAllSettings reflects it', () => {
  setSetting('mcChoices', 7);
  setSetting('gen.cap', 100);
  resetSettings(['mcChoices']);
  assert.equal(getSetting('mcChoices'), 5);
  assert.equal(getSetting('gen.cap'), 100);
  assert.equal(getAllSettings()['gen.cap'], 100);
  assert.equal(Object.keys(getAllSettings()).length, SCHEMA.length);
  resetSettings();
  assert.equal(getSetting('gen.cap'), 2500);
  assert.equal(mem.getItem('tcas.settings.v1'), null);
  assert.throws(() => resetSettings(['nope']), /Unknown setting/);
});

test('onSettingsChange fires per changed key and can unsubscribe', () => {
  const seen = [];
  const off = onSettingsChange((key, value) => seen.push([key, value]));
  setSetting('mcChoices', 6);
  setSetting('mcChoices', 6);
  setSetting('gen.maxSetSize', 5);
  resetSettings(['mcChoices']);
  assert.deepEqual(seen, [['mcChoices', 6], ['gen.count', 5], ['gen.maxSetSize', 5], ['mcChoices', 5]]);
  off();
  setSetting('mcChoices', 8);
  assert.equal(seen.length, 4);
});

test('getGenConfig resolves the pool version and strips the gen. prefix', () => {
  const cfg = getGenConfig({ poolVersion: 3 });
  assert.deepEqual(cfg, {
    hardRatio: 0.25, mixedChance: 0.5, cap: 2500, maxAttempts: 300, poolVersion: 3, normalTiers: [1, 2],
    composeTiers: [1, 2, 3], rareTiers: [3, 4], composeChance: 0.5, minDistinct: 4, allowNegative: true,
  });
  setSetting('gen.poolVersion', 2);
  assert.equal(getGenConfig({ poolVersion: 3 }).poolVersion, 2);
  assert.equal(getGenConfig({ poolVersion: 1 }).poolVersion, 1);
  assert.throws(() => getGenConfig({ poolVersion: 0 }), RangeError);
});

test('getStatsConfig strips the stats. prefix', () => {
  assert.deepEqual(getStatsConfig(), { minAttempts: 3, fastRatio: 0.8, slowRatio: 1.25, failedRate: 0.4, maxRecords: 20000 });
});

test('toGenSettings produces a valid Set ID payload', () => {
  setSetting('gen.normalTiers', [2, 1]);
  const gs = toGenSettings(getGenConfig({ poolVersion: 1 }), { seed: 'abc', count: 12 });
  assert.equal(gs.seed, 'abc');
  assert.equal(gs.count, 12);
  assert.deepEqual(decodeSetId(encodeSetId(gs)).settings, gs);
  gs.normalTiers.push(9);
  assert.deepEqual(getSetting('gen.normalTiers'), [1, 2]);
});

test('storage falls back to memory when localStorage is unavailable', () => {
  setStorage(null);
  const s = getStorage();
  s.setItem('k', 'v');
  assert.equal(s.getItem('k'), 'v');
  s.removeItem('k');
  assert.equal(s.getItem('k'), null);
  assert.throws(() => setStorage({}), TypeError);
});
