/**
 * Practice run state machine and the personal-trainer question provider.
 * DOM-free; the clock and the recorder are injectable. Timing is ALWAYS recorded,
 * independent of whether the UI shows a timer.
 * @module trainer/run
 */
import { recordAttempt } from '../stats/store.js';
import { getBuckets } from '../stats/analysis.js';

/** @typedef {import('../stats/analysis.js').AttemptRecord} AttemptRecord */
/** @typedef {import('../stats/analysis.js').FnSummary} FnSummary */
/** @typedef {{id:string, answer:number, fns:string[], mode:'N'|'H'}} RunQuestion  (subset of Question used here) */
/** @typedef {{total:number|null, answered:number, correct:number, wrong:number, skipped:number, avgMs:number|null, cancelled:boolean, records:AttemptRecord[]}} Summary */
/** @typedef {{correct:boolean, expected:number, ms:number, record:AttemptRecord}} AttemptResult */
/** @typedef {{next:()=>RunQuestion|null, current:()=>RunQuestion|null, elapsed:()=>number, submit:(answer:number)=>AttemptResult, skip:()=>AttemptResult, cancel:()=>Summary, summary:()=>Summary, readonly index:number, readonly total:number|null, readonly finished:boolean}} Run */

const BUCKET_NAMES = ['easy', 'normal', 'hard', 'failed'];
const STREAM_PREFIX = 'q';

/**
 * Create a run.
 *
 * Behaviour notes:
 * - `total` that is not a positive number means an endless run (`run.total === null`).
 * - `index` is the 1-based number of the current question (0 before the first `next()`).
 * - `next()` while the current question is still unanswered returns it again without pulling.
 * - `submit`/`skip` act once per question; repeating either returns the first result unchanged
 *   and records nothing. With no active question they throw an `Error`.
 * - `finished` becomes true when the last question of a bounded run is answered, when the
 *   provider is exhausted, or on `cancel()`.
 *
 * @param {{source:'set'|'trainer', provider:()=>RunQuestion|null, total:number|null, answerMode:'typed'|'mc',
 *          maxRecords:number, now?:()=>number, record?:(rec:AttemptRecord, opts:{maxRecords:number})=>void}} opts
 * @returns {Run}
 */
export function createRun({ source, provider, total, answerMode, maxRecords, now = Date.now, record = recordAttempt }) {
  const limit = Number.isFinite(total) && /** @type {number} */ (total) > 0 ? Math.floor(/** @type {number} */ (total)) : null;
  let index = 0;
  let finished = false;
  let cancelled = false;
  /** @type {RunQuestion|null} */
  let current = null;
  let startedAt = 0;
  /** @type {AttemptResult|null} */
  let outcome = null;
  let correct = 0;
  let wrong = 0;
  let skipped = 0;
  /** @type {AttemptRecord[]} */
  const records = [];

  /** @returns {RunQuestion|null} */
  function next() {
    if (finished) {
      current = null;
      return null;
    }
    if (current && !outcome) return current;
    if (limit !== null && index >= limit) {
      finished = true;
      current = null;
      return null;
    }
    const q = provider();
    if (!q) {
      finished = true;
      current = null;
      return null;
    }
    index += 1;
    current = q;
    outcome = null;
    startedAt = now();
    return q;
  }

  /**
   * @param {number|null} answer null = skipped
   * @returns {AttemptResult}
   */
  function settle(answer) {
    if (cancelled || !current) throw new Error('run: no active question');
    if (outcome) return outcome;
    if (answer !== null && !Number.isFinite(answer)) throw new TypeError('run: answer must be a finite number');
    const end = now();
    const ms = Math.max(0, end - startedAt);
    const ok = answer !== null && answer === current.answer;
    /** @type {AttemptRecord} */
    const rec = {
      t: end,
      qid: current.id,
      ms,
      ok,
      ans: answer,
      fns: [...current.fns],
      mode: current.mode,
      src: source,
      am: answerMode,
    };
    record(rec, { maxRecords });
    records.push(rec);
    if (answer === null) skipped += 1;
    else if (ok) correct += 1;
    else wrong += 1;
    outcome = { correct: ok, expected: current.answer, ms, record: rec };
    if (limit !== null && index >= limit) finished = true;
    return outcome;
  }

  /** @returns {Summary} */
  function summary() {
    const avgMs = records.length > 0 ? records.reduce((sum, r) => sum + r.ms, 0) / records.length : null;
    return {
      total: limit,
      answered: correct + wrong,
      correct,
      wrong,
      skipped,
      avgMs,
      cancelled,
      records: [...records],
    };
  }

  return {
    next,
    current: () => current,
    elapsed: () => {
      if (!current) return 0;
      if (outcome) return outcome.ms;
      return Math.max(0, now() - startedAt);
    },
    submit: (answer) => settle(answer),
    skip: () => settle(null),
    cancel: () => {
      if (!finished) {
        cancelled = true;
        finished = true;
        current = null;
        outcome = null;
      }
      return summary();
    },
    summary,
    get index() { return index; },
    get total() { return limit; },
    get finished() { return finished; },
  };
}

/**
 * Provider that walks a fixed list once, then returns null.
 * @template Q
 * @param {Q[]} questions
 * @returns {() => Q|null}
 */
export function setProvider(questions) {
  const list = [...questions];
  let i = 0;
  return () => (i < list.length ? list[i++] : null);
}

/**
 * @param {unknown} err
 * @returns {boolean} true for generator.js `GenerationError` (matched by name; that module may not be imported here)
 */
function isGenerationError(err) {
  if (!(err instanceof Error)) return false;
  return err.name === 'GenerationError' || err.constructor?.name === 'GenerationError';
}

/**
 * Resolve the non-empty candidate groups of function ids.
 * `buckets` is normally the list of SELECTED bucket names (membership comes from `summaries`);
 * an object shaped like `getBuckets()` output is accepted too (every non-empty array is selected).
 * @param {string[]|Record<string,string[]>} buckets
 * @param {FnSummary[]} summaries
 * @returns {string[][]}
 */
function buildGroups(buckets, summaries) {
  /** @type {Record<string,string[]>} */
  let membership = {};
  /** @type {string[]} */
  let selected = [];
  if (Array.isArray(buckets)) {
    membership = getBuckets(summaries ?? []);
    selected = buckets.filter((b) => BUCKET_NAMES.includes(b));
  } else if (buckets && typeof buckets === 'object') {
    membership = buckets;
    selected = BUCKET_NAMES.filter((name) => Array.isArray(buckets[name]));
  }
  return [...new Set(selected)]
    .map((name) => membership[name])
    .filter((ids) => Array.isArray(ids) && ids.length > 0)
    .map((ids) => [...new Set(ids)]);
}

/**
 * Pick a bucket uniformly, then a function uniformly, preferring functions not tried yet.
 * @param {{pick:(arr:any[])=>any}} rng
 * @param {string[][]} groups non-empty groups
 * @param {Set<string>} tried mutated: cleared when every function has been tried
 * @returns {string}
 */
function pickFn(rng, groups, tried) {
  let live = groups.map((g) => g.filter((id) => !tried.has(id))).filter((g) => g.length > 0);
  if (live.length === 0) {
    tried.clear();
    live = groups;
  }
  return rng.pick(rng.pick(live));
}

/**
 * Endless provider for the personal trainer.
 * Each question uses its own stream `rng.fork('q'+counter)`; bucket, function and mode are drawn
 * from it, then it is handed to `deps.generateQuestion`. On a `GenerationError` another function is
 * tried, at most `genCfg.maxAttempts` times, then the last error is rethrown.
 * @param {{buckets:string[]|Record<string,string[]>, summaries:FnSummary[],
 *          genCfg:{hardRatio:number, maxAttempts:number, poolVersion:number},
 *          rng:{fork:(label:string)=>any},
 *          deps:{generateQuestion:(rng:any, o:{mode:'N'|'H', cfg:any, filter?:{mustInclude?:string}})=>RunQuestion,
 *                listEntries:(o?:{maxVersion?:number})=>{id:string}[]}}} opts
 * @returns {() => RunQuestion}
 */
export function trainerProvider({ buckets, summaries, genCfg, rng, deps }) {
  let groups = buildGroups(buckets, summaries);
  if (groups.length === 0) {
    const allIds = deps.listEntries({ maxVersion: genCfg.poolVersion }).map((e) => e.id);
    groups = allIds.length > 0 ? [allIds] : [];
  }
  let counter = 0;
  return function provider() {
    if (groups.length === 0) throw new Error('trainer: no functions available');
    const qRng = rng.fork(STREAM_PREFIX + counter);
    counter += 1;
    const tried = new Set();
    let lastError = null;
    for (let attempt = 0; attempt < genCfg.maxAttempts; attempt += 1) {
      const fnId = pickFn(qRng, groups, tried);
      const mode = qRng.chance(genCfg.hardRatio) ? 'H' : 'N';
      try {
        return deps.generateQuestion(qRng, { mode, cfg: genCfg, filter: { mustInclude: fnId } });
      } catch (err) {
        if (!isGenerationError(err)) throw err;
        tried.add(fnId);
        lastError = err;
      }
    }
    throw lastError ?? new Error('trainer: no generation attempts allowed');
  };
}