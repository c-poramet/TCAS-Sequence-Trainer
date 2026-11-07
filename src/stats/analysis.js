/**
 * Pure statistics over AttemptRecord arrays. DOM-free, import-safe in Node 20.
 * Accuracy values are PERCENT (0-100); `failRate` is a FRACTION (0-1); times are milliseconds.
 * @module stats/analysis
 */

/** @typedef {{t:number, qid:string, ms:number, ok:boolean, ans:number|null, fns:string[], mode:'N'|'H', src:'set'|'trainer', am:'typed'|'mc'}} AttemptRecord */
/** @typedef {{fn:string, attempts:number, correct:number, failRate:number, medianMs:number|null, p25Ms:number|null, p75Ms:number|null, tier:'easy'|'normal'|'hard'|'unrated', oftenFailed:boolean}} FnSummary */
/** @typedef {{minAttempts:number, fastRatio:number, slowRatio:number, failedRate:number}} StatsCfg */
/** @typedef {{attempts:number, correct:number, accuracy:number|null, medianMs:number|null}} ModeStats */
/** @typedef {{attempts:number, correct:number, accuracy:number|null, medianMs:number|null, streak:number, bestStreak:number, daysActive:number, byMode:{N:ModeStats,H:ModeStats}}} Overview */
/** @typedef {{group:number, from:number, to:number, attempts:number, accuracy:number|null, medianMs:number|null}} SeriesPoint */
/** @typedef {{from:number, to:number, count:number}} HistBin */

const QUARTILE_LOW = 0.25;
const QUARTILE_MID = 0.5;
const QUARTILE_HIGH = 0.75;
const FRACTION_TO_PERCENT = 100;

/**
 * @param {number[]} values
 * @returns {number[]} new ascending array of the finite values
 */
function sortedFinite(values) {
  return values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
}

/**
 * Linear-interpolated percentile of an ascending array.
 * @param {number[]} sorted
 * @param {number} p fraction in [0,1]
 * @returns {number|null} null for an empty array
 */
function percentileOfSorted(sorted, p) {
  const n = sorted.length;
  if (n === 0) return null;
  if (n === 1) return sorted[0];
  const pos = p * (n - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * @param {number[]} values
 * @returns {number|null}
 */
function medianOf(values) {
  return percentileOfSorted(sortedFinite(values), QUARTILE_MID);
}

/**
 * @param {AttemptRecord[]} records
 * @returns {AttemptRecord[]} copy ordered by timestamp (stable)
 */
function chronological(records) {
  return [...records].sort((a, b) => a.t - b.t);
}

/**
 * @param {AttemptRecord[]} records
 * @returns {number[]} times of the correct attempts
 */
function correctTimes(records) {
  return records.filter((r) => r.ok).map((r) => r.ms);
}

/**
 * @param {number} correct
 * @param {number} attempts
 * @returns {number|null} percent, null when there are no attempts
 */
function toPercent(correct, attempts) {
  return attempts > 0 ? (correct / attempts) * FRACTION_TO_PERCENT : null;
}

/**
 * @param {boolean} rated
 * @param {number} correct
 * @param {number|null} medianMs
 * @param {number|null} globalMedian
 * @param {StatsCfg} cfg
 * @returns {FnSummary['tier']}
 */
function classifyTier(rated, correct, medianMs, globalMedian, cfg) {
  if (!rated) return 'unrated';
  if (correct === 0 || medianMs === null) return 'hard';
  if (globalMedian === null || !(globalMedian > 0)) return 'normal';
  const ratio = medianMs / globalMedian;
  if (ratio <= cfg.fastRatio) return 'easy';
  if (ratio >= cfg.slowRatio) return 'hard';
  return 'normal';
}

/**
 * One summary per function id. A record counts toward EACH function in its `fns`.
 * Timing statistics use correct attempts only; the reference median `G` is the median
 * time of ALL correct attempts (also those of functions not in `allFnIds`).
 * @param {AttemptRecord[]} records
 * @param {StatsCfg} statsCfg
 * @param {string[]} allFnIds
 * @returns {FnSummary[]} in order of first appearance in `allFnIds`
 */
export function summarizeByFn(records, statsCfg, allFnIds) {
  const globalMedian = medianOf(correctTimes(records));
  /** @type {Map<string,{attempts:number, correct:number, ms:number[]}>} */
  const acc = new Map();
  for (const id of allFnIds) {
    if (!acc.has(id)) acc.set(id, { attempts: 0, correct: 0, ms: [] });
  }
  for (const r of records) {
    for (const fn of new Set(r.fns)) {
      const e = acc.get(fn);
      if (!e) continue;
      e.attempts += 1;
      if (r.ok) {
        e.correct += 1;
        e.ms.push(r.ms);
      }
    }
  }
  return [...acc.entries()].map(([fn, e]) => {
    const sorted = sortedFinite(e.ms);
    const medianMs = percentileOfSorted(sorted, QUARTILE_MID);
    const rated = e.attempts >= statsCfg.minAttempts;
    const failRate = e.attempts > 0 ? (e.attempts - e.correct) / e.attempts : 0;
    return {
      fn,
      attempts: e.attempts,
      correct: e.correct,
      failRate,
      medianMs,
      p25Ms: percentileOfSorted(sorted, QUARTILE_LOW),
      p75Ms: percentileOfSorted(sorted, QUARTILE_HIGH),
      tier: classifyTier(rated, e.correct, medianMs, globalMedian, statsCfg),
      oftenFailed: rated && failRate >= statsCfg.failedRate,
    };
  });
}

/**
 * Group function ids by personal difficulty. Unrated functions go into `normal`;
 * `failed` holds the often-failed ones (a function may be in `hard` and `failed`).
 * @param {FnSummary[]} summaries
 * @returns {{easy:string[], normal:string[], hard:string[], failed:string[]}}
 */
export function getBuckets(summaries) {
  const out = { easy: [], normal: [], hard: [], failed: [] };
  for (const s of summaries) {
    if (s.tier === 'easy') out.easy.push(s.fn);
    else if (s.tier === 'hard') out.hard.push(s.fn);
    else out.normal.push(s.fn);
    if (s.oftenFailed) out.failed.push(s.fn);
  }
  return out;
}

/**
 * @param {AttemptRecord[]} records
 * @returns {ModeStats}
 */
function modeStats(records) {
  const attempts = records.length;
  const correct = records.filter((r) => r.ok).length;
  return {
    attempts,
    correct,
    accuracy: toPercent(correct, attempts),
    medianMs: medianOf(correctTimes(records)),
  };
}

/**
 * Overall figures. `medianMs` uses correct attempts only; `streak` is the current run of
 * correct answers at the end (chronological), `daysActive` counts distinct local calendar days.
 * @param {AttemptRecord[]} records
 * @returns {Overview}
 */
export function overview(records) {
  const ordered = chronological(records);
  const base = modeStats(ordered);
  let run = 0;
  let best = 0;
  const days = new Set();
  for (const r of ordered) {
    run = r.ok ? run + 1 : 0;
    best = Math.max(best, run);
    if (Number.isFinite(r.t)) {
      const d = new Date(r.t);
      days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
  }
  return {
    ...base,
    streak: run,
    bestStreak: best,
    daysActive: days.size,
    byMode: {
      N: modeStats(ordered.filter((r) => r.mode === 'N')),
      H: modeStats(ordered.filter((r) => r.mode === 'H')),
    },
  };
}

/**
 * Accuracy (percent) and median time (correct attempts) per consecutive group of `size`
 * attempts in chronological order; the last group may be smaller.
 * @param {AttemptRecord[]} records
 * @param {{size:number}} opts
 * @returns {SeriesPoint[]}
 * @throws {RangeError} when `size` is not at least 1
 */
export function timeSeries(records, { size }) {
  const n = Math.floor(size);
  if (!(n >= 1)) throw new RangeError('timeSeries: size must be >= 1');
  const ordered = chronological(records);
  /** @type {SeriesPoint[]} */
  const out = [];
  for (let i = 0; i < ordered.length; i += n) {
    const slice = ordered.slice(i, i + n);
    const stats = modeStats(slice);
    out.push({
      group: i / n + 1,
      from: slice[0].t,
      to: slice[slice.length - 1].t,
      attempts: stats.attempts,
      accuracy: stats.accuracy,
      medianMs: stats.medianMs,
    });
  }
  return out;
}

/**
 * Equal-width histogram over [min,max]; the maximum falls into the last bin.
 * Non-finite values are ignored. Empty input or `bins < 1` gives `[]`.
 * @param {number[]} values
 * @param {number} bins
 * @returns {HistBin[]}
 */
export function histogram(values, bins) {
  const count = Math.floor(bins);
  const data = sortedFinite(values);
  if (!(count >= 1) || data.length === 0) return [];
  const min = data[0];
  const max = data[data.length - 1];
  const width = (max - min) / count;
  const out = Array.from({ length: count }, (_, i) => ({
    from: min + i * width,
    to: min + (i + 1) * width,
    count: 0,
  }));
  for (const v of data) {
    const idx = width === 0 ? 0 : Math.min(count - 1, Math.floor((v - min) / width));
    out[idx].count += 1;
  }
  return out;
}

/**
 * @param {number} a
 * @param {number} b
 * @returns {number} descending comparator
 */
function descending(a, b) {
  if (a === b) return 0;
  return a > b ? -1 : 1;
}

/**
 * Order summaries weakest first: functions with attempts before untouched ones, then higher
 * failure rate, then slower median time, then function id.
 * @param {FnSummary[]} summaries
 * @returns {FnSummary[]} new array
 */
export function weakestFirst(summaries) {
  return [...summaries].sort((a, b) =>
    descending(Number(a.attempts > 0), Number(b.attempts > 0)) ||
    descending(a.failRate, b.failRate) ||
    descending(a.medianMs ?? -Infinity, b.medianMs ?? -Infinity) ||
    (a.fn < b.fn ? -1 : a.fn > b.fn ? 1 : 0));
}