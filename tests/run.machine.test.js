import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, setProvider } from '../src/trainer/run.js';

const q = (id, answer, fns = ['f.a'], mode = 'N') => ({ id, answer, fns, mode });

function setup({ questions = [q('Q1', 10), q('Q2', 20, ['f.a', 'f.b'], 'H')], total = questions.length, source = 'set', answerMode = 'typed' } = {}) {
  const clock = { t: 1000 };
  const recorded = [];
  let pulls = 0;
  const inner = setProvider(questions);
  const run = createRun({
    source,
    provider: () => { pulls += 1; return inner(); },
    total,
    answerMode,
    maxRecords: 77,
    now: () => clock.t,
    record: (rec, opts) => recorded.push({ rec, opts }),
  });
  return { run, clock, recorded, pulls: () => pulls };
}

test('happy path records a complete AttemptRecord and passes maxRecords', () => {
  const { run, clock, recorded } = setup();
  assert.equal(run.index, 0);
  assert.equal(run.total, 2);
  const first = run.next();
  assert.equal(first.id, 'Q1');
  assert.equal(run.index, 1);
  clock.t += 1500;
  const res = run.submit(10);
  assert.deepEqual({ correct: res.correct, expected: res.expected, ms: res.ms }, { correct: true, expected: 10, ms: 1500 });
  assert.deepEqual(res.record, { t: 2500, qid: 'Q1', ms: 1500, ok: true, ans: 10, fns: ['f.a'], mode: 'N', src: 'set', am: 'typed' });
  assert.equal(recorded.length, 1);
  assert.deepEqual(recorded[0].opts, { maxRecords: 77 });
  assert.equal(recorded[0].rec, res.record);
});

test('wrong answer, source and answer mode are recorded', () => {
  const { run, clock } = setup({ source: 'trainer', answerMode: 'mc' });
  run.next();
  clock.t += 10;
  const res = run.submit(11);
  assert.equal(res.correct, false);
  assert.equal(res.record.ans, 11);
  assert.equal(res.record.src, 'trainer');
  assert.equal(res.record.am, 'mc');
});

test('double submit / skip-after-submit are guarded: first result wins, one record', () => {
  const { run, clock, recorded } = setup();
  run.next();
  clock.t += 200;
  const a = run.submit(10);
  clock.t += 9999;
  const b = run.submit(99);
  const c = run.skip();
  assert.equal(b, a);
  assert.equal(c, a);
  assert.equal(recorded.length, 1);
  assert.equal(run.summary().correct, 1);
  assert.equal(run.summary().wrong, 0);
});

test('skip records a failed attempt with ans null', () => {
  const { run, clock, recorded } = setup();
  run.next();
  clock.t += 300;
  const res = run.skip();
  assert.equal(res.correct, false);
  assert.equal(res.record.ans, null);
  assert.equal(res.record.ok, false);
  assert.equal(recorded.length, 1);
  assert.equal(run.summary().skipped, 1);
  assert.equal(run.summary().answered, 0);
});

test('bounded run finishes after the last answer; next() then returns null', () => {
  const { run, clock } = setup();
  run.next(); clock.t += 100; run.submit(10);
  assert.equal(run.finished, false);
  assert.equal(run.next().id, 'Q2');
  clock.t += 100; run.submit(5);
  assert.equal(run.finished, true);
  assert.equal(run.current().id, 'Q2'); // still shown for feedback
  assert.equal(run.next(), null);
  assert.equal(run.current(), null);
  const s = run.summary();
  assert.deepEqual({ total: s.total, answered: s.answered, correct: s.correct, wrong: s.wrong, skipped: s.skipped, cancelled: s.cancelled }, { total: 2, answered: 2, correct: 1, wrong: 1, skipped: 0, cancelled: false });
  assert.equal(s.records.length, 2);
  assert.equal(s.avgMs, 100);
});

test('provider exhaustion finishes an endless run', () => {
  const { run } = setup({ questions: [q('Q1', 1)], total: null });
  assert.equal(run.total, null);
  run.next(); run.submit(1);
  assert.equal(run.finished, false);
  assert.equal(run.next(), null);
  assert.equal(run.finished, true);
});

test('total of 0 or null means endless', () => {
  assert.equal(setup({ total: 0 }).run.total, null);
  assert.equal(setup({ total: null }).run.total, null);
});

test('next() on an unanswered question returns it without pulling again', () => {
  const { run, pulls } = setup();
  const a = run.next();
  const b = run.next();
  assert.equal(a, b);
  assert.equal(pulls(), 1);
  assert.equal(run.index, 1);
});

test('cancel keeps recorded attempts, drops the pending one and stops the run', () => {
  const { run, clock, recorded } = setup({ questions: [q('Q1', 1), q('Q2', 2), q('Q3', 3)] });
  run.next(); clock.t += 50; run.submit(1);
  run.next(); clock.t += 50;
  const s = run.cancel();
  assert.equal(s.cancelled, true);
  assert.equal(s.answered, 1);
  assert.equal(s.records.length, 1);
  assert.equal(recorded.length, 1);
  assert.equal(run.finished, true);
  assert.equal(run.next(), null);
  assert.equal(run.current(), null);
  assert.throws(() => run.submit(2), /no active question/);
  assert.equal(run.cancel().cancelled, true); // idempotent
});

test('cancel after a natural finish does not flag the run as cancelled', () => {
  const { run } = setup({ questions: [q('Q1', 1)] });
  run.next(); run.submit(1);
  assert.equal(run.cancel().cancelled, false);
});

test('submit/skip without an active question throw and record nothing', () => {
  const { run, recorded } = setup();
  assert.throws(() => run.submit(1), /no active question/);
  assert.throws(() => run.skip(), /no active question/);
  assert.equal(recorded.length, 0);
});

test('non-finite answers are rejected without recording or consuming the question', () => {
  const { run, recorded } = setup();
  run.next();
  assert.throws(() => run.submit(Number.NaN), TypeError);
  assert.throws(() => run.submit(/** @type {any} */ ('7')), TypeError);
  assert.equal(recorded.length, 0);
  assert.equal(run.submit(10).correct, true);
});

test('elapsed() follows the clock while pending and freezes after answering', () => {
  const { run, clock } = setup();
  assert.equal(run.elapsed(), 0);
  run.next();
  clock.t += 400;
  assert.equal(run.elapsed(), 400);
  clock.t += 100;
  assert.equal(run.elapsed(), 500);
  run.submit(10);
  clock.t += 5000;
  assert.equal(run.elapsed(), 500);
});

test('timing is recorded regardless of whether elapsed() (the visible timer) is ever read', () => {
  const a = setup();
  a.run.next(); a.clock.t += 1234; const withoutTimer = a.run.submit(10);
  const b = setup();
  b.run.next(); b.clock.t += 600; b.run.elapsed(); b.clock.t += 634; const withTimer = b.run.submit(10);
  assert.equal(withoutTimer.ms, 1234);
  assert.equal(withTimer.ms, 1234);
  assert.equal(withoutTimer.record.ms, withTimer.record.ms);
});

test('a backwards clock never yields negative times', () => {
  const { run, clock } = setup();
  run.next();
  clock.t -= 500;
  assert.equal(run.elapsed(), 0);
  assert.equal(run.submit(10).ms, 0);
});

test('fns array in the record is a copy', () => {
  const question = q('Q1', 1, ['f.a']);
  const { run } = setup({ questions: [question] });
  run.next();
  const res = run.submit(1);
  res.record.fns.push('mutated');
  assert.deepEqual(question.fns, ['f.a']);
});

test('summary avgMs is null before any attempt', () => {
  const { run } = setup();
  assert.equal(run.summary().avgMs, null);
});

test('setProvider walks the list once and copies it', () => {
  const list = [q('A', 1), q('B', 2)];
  const p = setProvider(list);
  list.pop();
  assert.equal(p().id, 'A');
  assert.equal(p().id, 'B');
  assert.equal(p(), null);
  assert.equal(p(), null);
});