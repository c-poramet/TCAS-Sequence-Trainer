import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeByFn, getBuckets, overview, timeSeries, histogram, weakestFirst } from '../src/stats/analysis.js';

const CFG = { minAttempts: 3, fastRatio: 0.8, slowRatio: 1.25, failedRate: 0.4 };
let clock = 0;

/** @returns {import('../src/stats/analysis.js').AttemptRecord} */
function rec(fns, ok, ms, extra = {}) {
  clock += 1000;
  return { t: clock, qid: 'Q1:N1:x.y()', ms, ok, ans: ok ? 1 : 2, fns, mode: 'N', src: 'set', am: 'typed', ...extra };
}
const many = (fns, ok, ms, n) => Array.from({ length: n }, () => rec(fns, ok, ms));
const byFn = (summaries, id) => summaries.find((s) => s.fn === id);

test('percentiles: single, two, four correct attempts and none', () => {
  const one = summarizeByFn([rec(['a'], true, 700)], CFG, ['a'])[0];
  assert.deepEqual([one.p25Ms, one.medianMs, one.p75Ms], [700, 700, 700]);

  const two = summarizeByFn([rec(['a'], true, 1000), rec(['a'], true, 3000)], CFG, ['a'])[0];
  assert.deepEqual([two.p25Ms, two.medianMs, two.p75Ms], [1500, 2000, 2500]);

  const four = summarizeByFn([4000, 1000, 3000, 2000].map((ms) => rec(['a'], true, ms)), CFG, ['a'])[0];
  assert.deepEqual([four.p25Ms, four.medianMs, four.p75Ms], [1750, 2500, 3250]);

  const none = summarizeByFn([rec(['a'], false, 900)], CFG, ['a'])[0];
  assert.deepEqual([none.p25Ms, none.medianMs, none.p75Ms], [null, null, null]);
});

test('timing statistics ignore wrong attempts; failRate counts them', () => {
  const s = summarizeByFn([rec(['a'], true, 1000), rec(['a'], false, 99999), rec(['a'], true, 3000), rec(['a'], false, 1)], CFG, ['a'])[0];
  assert.equal(s.attempts, 4);
  assert.equal(s.correct, 2);
  assert.equal(s.failRate, 0.5);
  assert.equal(s.medianMs, 2000);
});

test('tiers: easy / normal / hard relative to the global median', () => {
  const records = [...many(['a'], true, 400, 3), ...many(['b'], true, 1000, 3), ...many(['c'], true, 2000, 3)];
  const s = summarizeByFn(records, CFG, ['a', 'b', 'c']);
  assert.equal(byFn(s, 'a').tier, 'easy');
  assert.equal(byFn(s, 'b').tier, 'normal');
  assert.equal(byFn(s, 'c').tier, 'hard');
});

test('tier boundaries are inclusive (ratio == fastRatio is easy, == slowRatio is hard)', () => {
  const records = [...many(['x'], true, 800, 3), ...many(['y'], true, 1000, 3), ...many(['z'], true, 1250, 3)];
  const s = summarizeByFn(records, CFG, ['x', 'y', 'z']);
  assert.equal(byFn(s, 'x').tier, 'easy');
  assert.equal(byFn(s, 'y').tier, 'normal');
  assert.equal(byFn(s, 'z').tier, 'hard');
});

test('unrated below minAttempts, never often-failed even when always wrong', () => {
  const s = summarizeByFn(many(['a'], false, 500, 2), CFG, ['a'])[0];
  assert.equal(s.tier, 'unrated');
  assert.equal(s.oftenFailed, false);
  assert.equal(s.failRate, 1);
});

test('rated with zero correct attempts is hard and often failed', () => {
  const s = summarizeByFn(many(['a'], false, 500, 3), CFG, ['a'])[0];
  assert.equal(s.tier, 'hard');
  assert.equal(s.medianMs, null);
  assert.equal(s.oftenFailed, true);
});

test('functions without records are unrated with zeroed counters', () => {
  const s = summarizeByFn([], CFG, ['a', 'b']);
  assert.equal(s.length, 2);
  assert.deepEqual(s[0], { fn: 'a', attempts: 0, correct: 0, failRate: 0, medianMs: null, p25Ms: null, p75Ms: null, tier: 'unrated', oftenFailed: false });
});

test('oftenFailed threshold is inclusive', () => {
  const at = summarizeByFn([...many(['a'], true, 100, 3), ...many(['a'], false, 100, 2)], CFG, ['a'])[0];
  assert.equal(at.failRate, 0.4);
  assert.equal(at.oftenFailed, true);
  const below = summarizeByFn([...many(['a'], true, 100, 4), ...many(['a'], false, 100, 1)], CFG, ['a'])[0];
  assert.equal(below.oftenFailed, false);
});

test('composite questions count toward each function', () => {
  const records = [...many(['a', 'b'], true, 1000, 3), ...many(['a'], false, 1000, 1)];
  const s = summarizeByFn(records, CFG, ['a', 'b']);
  assert.equal(byFn(s, 'a').attempts, 4);
  assert.equal(byFn(s, 'b').attempts, 3);
  assert.equal(byFn(s, 'b').correct, 3);
});

test('global median uses all correct attempts, also of ids outside allFnIds', () => {
  const records = [...many(['a'], true, 1000, 3), ...many(['other'], true, 100, 5)];
  const s = summarizeByFn(records, CFG, ['a']);
  assert.equal(s.length, 1);
  assert.equal(s[0].tier, 'hard'); // 1000 / 100 = 10
});

test('duplicate ids in allFnIds yield one summary', () => {
  assert.equal(summarizeByFn([], CFG, ['a', 'a', 'b']).length, 2);
});

test('getBuckets: unrated go to normal, failed may overlap hard', () => {
  const records = [
    ...many(['easy'], true, 400, 3),
    ...many(['norm'], true, 1000, 3),
    ...many(['hard'], true, 2000, 3),
    ...many(['hard'], false, 2000, 3),
    ...many(['unr'], false, 10, 1),
  ];
  const summaries = summarizeByFn(records, CFG, ['easy', 'norm', 'hard', 'unr', 'none']);
  const b = getBuckets(summaries);
  assert.deepEqual(b.easy, ['easy']);
  assert.deepEqual(b.normal, ['norm', 'unr', 'none']);
  assert.deepEqual(b.hard, ['hard']);
  assert.deepEqual(b.failed, ['hard']);
});

test('overview: counts, accuracy, median, streaks, days, per-mode split', () => {
  const day = (d, h) => new Date(2024, 0, d, h).getTime();
  const records = [
    rec(['a'], true, 1000, { t: day(1, 9), mode: 'N' }),
    rec(['a'], true, 3000, { t: day(1, 10), mode: 'H' }),
    rec(['a'], false, 500, { t: day(2, 9), mode: 'N' }),
    rec(['a'], true, 2000, { t: day(2, 10), mode: 'N' }),
    rec(['a'], true, 4000, { t: day(2, 11), mode: 'H' }),
  ];
  const o = overview([records[3], records[0], records[4], records[2], records[1]]); // shuffled
  assert.equal(o.attempts, 5);
  assert.equal(o.correct, 4);
  assert.equal(o.accuracy, 80);
  assert.equal(o.medianMs, 2500);
  assert.equal(o.streak, 2);
  assert.equal(o.bestStreak, 2);
  assert.equal(o.daysActive, 2);
  assert.deepEqual(o.byMode.N, { attempts: 3, correct: 2, accuracy: (2 / 3) * 100, medianMs: 1500 });
  assert.deepEqual(o.byMode.H, { attempts: 2, correct: 2, accuracy: 100, medianMs: 3500 });
});

test('overview of nothing and streak reset by a final miss', () => {
  const empty = overview([]);
  assert.equal(empty.attempts, 0);
  assert.equal(empty.accuracy, null);
  assert.equal(empty.medianMs, null);
  assert.equal(empty.streak, 0);
  assert.equal(empty.daysActive, 0);
  const o = overview([rec(['a'], true, 1), rec(['a'], true, 1), rec(['a'], true, 1), rec(['a'], false, 1)]);
  assert.equal(o.streak, 0);
  assert.equal(o.bestStreak, 3);
});

test('timeSeries groups consecutive attempts, last group may be smaller', () => {
  const records = [
    rec(['a'], true, 1000), rec(['a'], false, 2000),
    rec(['a'], true, 3000), rec(['a'], true, 5000),
    rec(['a'], false, 4000),
  ];
  const ts = timeSeries(records, { size: 2 });
  assert.equal(ts.length, 3);
  assert.deepEqual(ts.map((g) => g.attempts), [2, 2, 1]);
  assert.deepEqual(ts.map((g) => g.accuracy), [50, 100, 0]);
  assert.deepEqual(ts.map((g) => g.medianMs), [1000, 4000, null]);
  assert.deepEqual(ts.map((g) => g.group), [1, 2, 3]);
  assert.deepEqual(timeSeries([], { size: 3 }), []);
  assert.throws(() => timeSeries(records, { size: 0 }), RangeError);
  assert.throws(() => timeSeries(records, { size: Number.NaN }), RangeError);
});

test('histogram: bin edges, inclusive maximum, degenerate inputs', () => {
  const h = histogram([0, 1, 2, 3, 4], 2);
  assert.deepEqual(h, [{ from: 0, to: 2, count: 2 }, { from: 2, to: 4, count: 3 }]);
  assert.deepEqual(histogram([5, 5, 5], 3).map((b) => b.count), [3, 0, 0]);
  assert.deepEqual(histogram([], 3), []);
  assert.deepEqual(histogram([1, 2], 0), []);
  assert.deepEqual(histogram([1, Number.NaN, 3], 1).map((b) => b.count), [2]);
  assert.equal(histogram([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4).reduce((s, b) => s + b.count, 0), 10);
});

test('weakestFirst: attempted before untouched, higher failRate, slower, then id', () => {
  const mk = (fn, attempts, failRate, medianMs) => ({ fn, attempts, correct: 0, failRate, medianMs, p25Ms: null, p75Ms: null, tier: 'normal', oftenFailed: false });
  const sorted = weakestFirst([
    mk('untouched', 0, 0, null),
    mk('b', 5, 0.2, 1000),
    mk('a', 5, 0.2, 1000),
    mk('slow', 5, 0.2, 5000),
    mk('bad', 5, 0.8, 100),
  ]);
  assert.deepEqual(sorted.map((s) => s.fn), ['bad', 'slow', 'a', 'b', 'untouched']);
});