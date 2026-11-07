import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStorage, setStorage } from '../src/core/storage.js';
import { getSetting, setSetting } from '../src/core/settings.js';
import { clearRecordsData, exportData, importData } from '../src/core/dataIO.js';

const RECORDS_KEY = 'tcas.stats.v1';
let mem;
beforeEach(() => {
  mem = createMemoryStorage();
  setStorage(mem);
});

const rec = (t, extra = {}) => ({
  t, qid: 'Q1:N3:poly.lin(2,1)', ms: 4200, ok: true, ans: 7, fns: ['poly.lin'], mode: 'N', src: 'set', am: 'typed', ...extra,
});
const file = (settings, records) => ({ app: 'tcas-seq-trainer', format: 1, exportedAt: '2026-01-01T00:00:00.000Z', settings, records });
const stored = () => JSON.parse(mem.getItem(RECORDS_KEY));

test('exportData has the contract shape and only non-default settings', () => {
  setSetting('mcChoices', 7);
  mem.setItem(RECORDS_KEY, JSON.stringify([rec(1), rec(2, { ans: null, ok: false })]));
  const out = exportData();
  assert.equal(out.app, 'tcas-seq-trainer');
  assert.equal(out.format, 1);
  assert.equal(typeof out.exportedAt, 'string');
  assert.ok(!Number.isNaN(Date.parse(out.exportedAt)));
  assert.deepEqual(out.settings, { mcChoices: 7 });
  assert.equal(out.records.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(out)), out);
});

test('replace: resets settings, overwrites records', () => {
  setSetting('gen.cap', 100);
  mem.setItem(RECORDS_KEY, JSON.stringify([rec(1)]));
  const res = importData(file({ mcChoices: 6 }, [rec(10), rec(11)]), { mode: 'replace' });
  assert.deepEqual(res, { settings: 1, records: 2 });
  assert.equal(getSetting('gen.cap'), 2500);
  assert.equal(getSetting('mcChoices'), 6);
  assert.deepEqual(stored().map((r) => r.t), [10, 11]);
});

test('merge: keeps current settings not in the file, unions records by (qid, t)', () => {
  setSetting('gen.cap', 100);
  mem.setItem(RECORDS_KEY, JSON.stringify([rec(1), rec(5)]));
  const res = importData(JSON.stringify(file({ mcChoices: 6 }, [rec(5), rec(3), rec(5, { qid: 'Q1:N4:poly.lin(2,1)' })])), { mode: 'merge' });
  assert.deepEqual(res, { settings: 1, records: 4 });
  assert.equal(getSetting('gen.cap'), 100);
  assert.equal(getSetting('mcChoices'), 6);
  assert.deepEqual(stored().map((r) => `${r.t}:${r.qid}`), ['1:Q1:N3:poly.lin(2,1)', '3:Q1:N3:poly.lin(2,1)', '5:Q1:N3:poly.lin(2,1)', '5:Q1:N4:poly.lin(2,1)']);
});

test('merge is the default; unknown settings and bad setting values are ignored', () => {
  const res = importData(file({ bogus: 1, mcChoices: 'abc', answerMode: 'mc' }, []));
  assert.deepEqual(res, { settings: 1, records: 0 });
  assert.equal(getSetting('answerMode'), 'mc');
  assert.equal(getSetting('mcChoices'), 5);
});

test('records are trimmed to stats.maxRecords keeping the newest', () => {
  const many = Array.from({ length: 130 }, (_, i) => rec(i + 1));
  const res = importData(file({ 'stats.maxRecords': 100 }, many), { mode: 'replace' });
  assert.equal(res.records, 100);
  assert.equal(stored()[0].t, 31);
});

test('invalid imports throw Error("core.error.badImport") and change nothing', () => {
  setSetting('gen.cap', 100);
  mem.setItem(RECORDS_KEY, JSON.stringify([rec(1)]));
  const good = file({ mcChoices: 6 }, [rec(2)]);
  const bads = [
    '{not json', 'null', '[]', '42', file({}, []).app && { ...good, app: 'other' }, { ...good, format: 2 },
    { ...good, settings: [] }, { ...good, settings: null }, { ...good, records: {} }, { ...good, records: [rec(2), 'x'] },
    { ...good, records: [rec(2, { t: 'now' })] }, { ...good, records: [rec(2, { qid: 'garbage' })] },
    { ...good, records: [rec(2, { ms: -1 })] }, { ...good, records: [rec(2, { ok: 'yes' })] },
    { ...good, records: [rec(2, { ans: 1.5 })] }, { ...good, records: [rec(2, { fns: [1] })] },
    { ...good, records: [rec(2, { mode: 'X' })] }, { ...good, records: [rec(2, { src: 'web' })] },
    { ...good, records: [rec(2, { am: 'voice' })] },
  ];
  for (const bad of bads) {
    for (const mode of ['merge', 'replace']) {
      assert.throws(() => importData(bad, { mode }), (err) => err instanceof Error && err.message === 'core.error.badImport');
    }
  }
  assert.equal(getSetting('gen.cap'), 100);
  assert.equal(getSetting('mcChoices'), 5);
  assert.deepEqual(stored().map((r) => r.t), [1]);
  assert.throws(() => importData(good, { mode: 'sideways' }), TypeError);
});

test('export then import round-trips', () => {
  setSetting('gen.normalTiers', [1, 3]);
  mem.setItem(RECORDS_KEY, JSON.stringify([rec(1), rec(2)]));
  const out = JSON.stringify(exportData());
  setStorage(createMemoryStorage());
  assert.equal(getSetting('gen.normalTiers').length, 2);
  setSetting('gen.normalTiers', [4]);
  importData(out, { mode: 'replace' });
  assert.deepEqual(getSetting('gen.normalTiers'), [1, 3]);
  assert.equal(exportData().records.length, 2);
});

test('clearRecordsData removes every record', () => {
  mem.setItem(RECORDS_KEY, JSON.stringify([rec(1)]));
  clearRecordsData();
  assert.equal(mem.getItem(RECORDS_KEY), null);
  assert.deepEqual(exportData().records, []);
});
