import { h, renderSequence, renderMath, renderSolution, clear } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { getSetting, getGenConfig, getStatsConfig } from '../../core/settings.js';
import { createRng, randomSeed } from '../../core/rng.js';
import { IdError, isSetId } from '../../core/ids.js';
import { generateSetFromId, generateQuestion } from '../../gen/generator.js';
import { getChoices } from '../../gen/choices.js';
import { buildSolution } from '../../gen/solution.js';
import { POOL_VERSION, listEntries } from '../../pool/index.js';
import { loadRecords } from '../../stats/store.js';
import { summarizeByFn } from '../../stats/analysis.js';
import { createRun, setProvider, trainerProvider } from '../../trainer/run.js';
import { takeHandoff } from '../handoff.js';

/** Timer display refresh interval (ms). */
const TIMER_TICK_MS = 250;
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const CLOCK_PAD = 2;
const SECONDS_DECIMALS = 1;
const INTEGER_PATTERN = /^-?[0-9]+$/;
const INPUT_ID = 'run-input';

/**
 * In-memory session; survives a language-change re-mount of the same route.
 * @type {null|{key:string, run:any, phase:'ask'|'review'|'done', shown:number, question:any,
 *   last:null|{kind:string, ms:number, given:number|null}, cancelled:boolean,
 *   tally:{correct:number, wrong:number, skipped:number, ms:number},
 *   timerVisible:boolean, solutionOpen:boolean, answerMode:string, mcChoices:number}}
 */
let session = null;

/**
 * Format milliseconds as m:ss.
 * @param {number} ms
 * @returns {string}
 */
function formatClock(ms) {
  const total = Math.floor(Math.max(0, ms) / MS_PER_SECOND);
  const minutes = Math.floor(total / SECONDS_PER_MINUTE);
  const seconds = total % SECONDS_PER_MINUTE;
  return `${minutes}:${String(seconds).padStart(CLOCK_PAD, '0')}`;
}

/**
 * Format milliseconds as localized seconds.
 * @param {number} ms
 * @returns {string}
 */
function formatSeconds(ms) {
  return t('ui.run.seconds', { value: (Math.max(0, ms) / MS_PER_SECOND).toFixed(SECONDS_DECIMALS) });
}

/**
 * Parse a typed answer; null when it is not a safe integer.
 * @param {string} text
 * @returns {number|null}
 */
function parseIntegerAnswer(text) {
  const s = text.trim();
  if (!INTEGER_PATTERN.test(s)) return null;
  const n = Number(s);
  if (!Number.isSafeInteger(n)) return null;
  return n === 0 ? 0 : n;
}

/**
 * Add one attempt to a tally (pure).
 * @param {{correct:number, wrong:number, skipped:number, ms:number}} tally
 * @param {'correct'|'wrong'|'skipped'} kind
 * @param {number} ms
 * @returns {void}
 */
function addToTally(tally, kind, ms) {
  tally[kind] += 1;
  tally.ms += Number.isFinite(ms) ? ms : 0;
}

/**
 * Decode the run route key from the current hash, or null if not a run route.
 * @returns {string|null}
 */
function routeKeyFromHash() {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  const parts = raw
    .split('/')
    .filter((p) => p.length > 0)
    .map((p) => {
      try {
        return decodeURIComponent(p);
      } catch {
        return p;
      }
    });
  return parts[0] === 'run' ? parts.slice(1).join('/') : null;
}

/**
 * Set data-missing on the missing term element.
 * @param {HTMLElement} seq
 * @param {number} missing
 * @returns {void}
 */
function markMissing(seq, missing) {
  const el = seq.querySelectorAll('.seq__term')[missing - 1];
  if (el && !el.hasAttribute('data-missing')) el.setAttribute('data-missing', 'true');
}

/**
 * Mount the run page (#/run/set/<SID>, #/run/trainer).
 * @param {HTMLElement} container
 * @param {{segments:string[], query:URLSearchParams, navigate:(hash:string)=>void}} ctx
 * @returns {() => void}
 */
export function mount(container, ctx) {
  const key = ctx.segments.join('/');
  let disposed = false;
  let timerId = null;
  let timerEl = null;

  function show(node) {
    clear(container);
    container.append(node);
    const target = container.querySelector('[data-autofocus]');
    if (target) target.focus();
  }

  function showError(messageKey) {
    show(
      h(
        'section',
        { class: 'run', 'data-phase': 'error' },
        h('p', { class: 'run__error', role: 'alert' }, t(messageKey)),
        h('nav', { class: 'run__links' }, h('a', { href: '#/' }, t('ui.nav.home')), h('a', { href: '#/generate' }, t('ui.nav.generate'))),
      ),
    );
  }

  function fail(err) {
    console.error(err);
    stopTimer();
    showError('ui.error.generic');
  }

  function stopTimer() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function tick() {
    if (timerEl && session && session.phase === 'ask') {
      timerEl.textContent = formatClock(session.run.elapsed());
    }
  }

  function startTimer() {
    stopTimer();
    tick();
    timerId = setInterval(tick, TIMER_TICK_MS);
  }

  function progressText() {
    const total = session.run.total;
    return total !== null && total !== undefined
      ? t('ui.run.progress', { i: session.shown, n: total })
      : t('ui.run.progressEndless', { i: session.shown });
  }

  function cancelButton() {
    return h('button', { type: 'button', class: 'run__cancel', onclick: onCancel }, t('ui.run.cancel'));
  }

  function onCancel() {
    if (!window.confirm(t('ui.run.confirmCancel'))) return;
    stopTimer();
    try {
      session.run.cancel();
    } catch (err) {
      console.error(err);
    }
    session.cancelled = true;
    session.phase = 'done';
    render();
  }

  function recordResult(kind, ms, given) {
    addToTally(session.tally, kind, ms);
    session.last = { kind, ms, given };
    session.phase = 'review';
    session.solutionOpen = false;
    render();
  }

  function submitAnswer(value) {
    stopTimer();
    try {
      const res = session.run.submit(value);
      recordResult(res.correct ? 'correct' : 'wrong', res.ms, value);
    } catch (err) {
      fail(err);
    }
  }

  function onSkip() {
    stopTimer();
    try {
      const res = session.run.skip();
      recordResult('skipped', res.ms, null);
    } catch (err) {
      fail(err);
    }
  }

  function advance() {
    try {
      const q = session.run.next();
      if (!q) {
        session.phase = 'done';
        session.question = null;
      } else {
        session.question = q;
        session.shown += 1;
        session.phase = 'ask';
        session.last = null;
        session.solutionOpen = false;
      }
      render();
    } catch (err) {
      fail(err);
    }
  }

  function buildTypedForm() {
    const error = h('p', { id: 'run-error', class: 'run__error', role: 'alert' });
    error.hidden = true;
    const input = h('input', {
      id: INPUT_ID,
      class: 'run__input',
      type: 'text',
      inputmode: 'numeric',
      pattern: '-?[0-9]*',
      autocomplete: 'off',
      'aria-describedby': 'run-error',
      'data-autofocus': 'true',
    });
    input.addEventListener('input', () => {
      error.hidden = true;
    });
    return h(
      'form',
      {
        class: 'run__form',
        novalidate: true,
        onsubmit: (e) => {
          e.preventDefault();
          const value = parseIntegerAnswer(input.value);
          if (value === null) {
            error.textContent = t('ui.run.error.notInteger');
            error.hidden = false;
            input.focus();
            return;
          }
          submitAnswer(value);
        },
      },
      h('label', { class: 'run__label', for: INPUT_ID }, t('ui.run.answerLabel')),
      input,
      h('button', { type: 'submit', class: 'run__submit' }, t('ui.run.submit')),
      error,
    );
  }

  function buildChoiceForm(q) {
    const { choices } = getChoices(q, session.mcChoices);
    const error = h('p', { class: 'run__error', role: 'alert' }, t('ui.run.error.pickOne'));
    error.hidden = true;
    const options = choices.map((value, i) => {
      const attrs = { type: 'radio', name: 'run-choice', class: 'run__radio', value: String(i) };
      if (i === 0) attrs['data-autofocus'] = 'true';
      return h(
        'label',
        { class: 'run__choice', 'data-index': String(i) },
        h('input', attrs),
        h('span', { class: 'run__choice-label' }, `${i + 1}.`),
        h('span', { class: 'run__choice-value' }, String(value)),
      );
    });
    const form = h(
      'form',
      {
        class: 'run__form',
        novalidate: true,
        onsubmit: (e) => {
          e.preventDefault();
          const picked = form.querySelector('input[name="run-choice"]:checked');
          if (!picked) {
            error.hidden = false;
            return;
          }
          submitAnswer(choices[Number(picked.value)]);
        },
      },
      h('fieldset', { class: 'run__choices' }, h('legend', { class: 'run__legend' }, t('ui.run.pickLegend')), ...options),
      h('button', { type: 'submit', class: 'run__submit' }, t('ui.run.submit')),
      error,
    );
    form.addEventListener('change', () => {
      error.hidden = true;
    });
    return form;
  }

  function renderAsk() {
    const q = session.question;
    timerEl = h('output', { class: 'run__timer', role: 'timer' }, formatClock(session.run.elapsed()));
    timerEl.hidden = !session.timerVisible;
    const timerCb = h('input', { type: 'checkbox', class: 'run__timer-checkbox' });
    timerCb.checked = session.timerVisible;
    timerCb.addEventListener('change', () => {
      session.timerVisible = timerCb.checked;
      timerEl.hidden = !timerCb.checked;
    });
    const bar = h(
      'header',
      { class: 'run__bar' },
      h('p', { class: 'run__progress' }, progressText()),
      h('div', { class: 'run__timebox' }, timerEl, h('label', { class: 'run__timer-toggle' }, timerCb, h('span', {}, t('ui.run.showTimer')))),
      h(
        'div',
        { class: 'run__actions' },
        h('button', { type: 'button', class: 'run__skip', onclick: onSkip }, t('ui.run.skip')),
        cancelButton(),
      ),
    );
    const seq = renderSequence(
      q.terms.map((v, i) => (i + 1 === q.missing ? null : v)),
      { missing: q.missing },
    );
    const form = session.answerMode === 'mc' ? buildChoiceForm(q) : buildTypedForm();
    show(
      h(
        'section',
        { class: 'run', 'data-phase': 'ask', 'data-mode': q.mode },
        bar,
        h('div', { class: 'run__stage' }, h('div', { class: 'run__sequence' }, seq), form),
      ),
    );
    startTimer();
  }

  function renderReview() {
    const q = session.question;
    const last = session.last;
    const bar = h('header', { class: 'run__bar' }, h('p', { class: 'run__progress' }, progressText()), h('div', { class: 'run__actions' }, cancelButton()));

    const seq = renderSequence(q.terms, { missing: q.missing, reveal: true });
    markMissing(seq, q.missing);

    const rows = [
      h('dt', { class: 'run__term' }, t('ui.run.correctAnswerLabel')),
      h('dd', { class: 'run__correct' }, String(q.answer)),
    ];
    if (last.kind === 'wrong' && last.given !== null) {
      rows.push(h('dt', { class: 'run__term' }, t('ui.run.yourAnswerLabel')), h('dd', { class: 'run__given' }, String(last.given)));
    }
    rows.push(h('dt', { class: 'run__term' }, t('ui.run.timeLabel')), h('dd', { class: 'run__time' }, formatSeconds(last.ms)));

    const solutionBox = h('div', { id: 'run-solution', class: 'run__solution' });
    solutionBox.hidden = true;
    const toggle = h('button', { type: 'button', class: 'run__solution-toggle', 'aria-controls': 'run-solution' });
    let built = false;
    const applyToggle = (open) => {
      session.solutionOpen = open;
      if (open && !built) {
        built = true;
        try {
          solutionBox.append(renderSolution(buildSolution(q)));
          renderMath(solutionBox);
        } catch (err) {
          console.error(err);
          solutionBox.append(h('p', { class: 'run__error', role: 'alert' }, t('ui.run.error.solution')));
        }
      }
      solutionBox.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = t(open ? 'ui.run.hideSolution' : 'ui.run.showSolution');
    };
    toggle.addEventListener('click', () => applyToggle(solutionBox.hidden));
    applyToggle(session.solutionOpen);

    const total = session.run.total;
    const finishing = total !== null && total !== undefined && session.shown >= total;
    const nextBtn = h(
      'button',
      { type: 'button', class: 'run__next', 'data-autofocus': 'true', onclick: advance },
      t(finishing ? 'ui.run.finish' : 'ui.run.next'),
    );

    show(
      h(
        'section',
        { class: 'run', 'data-phase': 'review', 'data-verdict': last.kind, 'data-mode': q.mode },
        bar,
        h(
          'div',
          { class: 'run__stage' },
          h('div', { class: 'run__sequence' }, seq),
          h('p', { class: 'run__verdict', role: 'status', 'data-verdict': last.kind }, t('ui.run.verdict.' + last.kind)),
          h('dl', { class: 'run__details' }, ...rows),
          toggle,
          solutionBox,
          nextBtn,
        ),
      ),
    );
  }

  function renderSummary() {
    const tally = session.tally;
    const attempts = tally.correct + tally.wrong + tally.skipped;
    const average = attempts > 0 ? formatSeconds(tally.ms / attempts) : t('ui.run.noAverage');
    const isSet = ctx.segments[0] === 'set';
    const links = [];
    if (isSet) {
      links.push(
        h(
          'button',
          {
            type: 'button',
            class: 'run__restart',
            onclick: () => {
              session = null;
              ctx.navigate('#/run/' + ctx.segments.map(encodeURIComponent).join('/'));
            },
          },
          t('ui.run.restart'),
        ),
      );
    } else {
      links.push(h('a', { class: 'run__link', href: '#/train' }, t('ui.run.trainAgain')));
    }
    links.push(
      h('a', { class: 'run__link', href: '#/stats' }, t('ui.nav.stats')),
      h('a', { class: 'run__link', href: '#/generate' }, t('ui.nav.generate')),
      h('a', { class: 'run__link', href: '#/' }, t('ui.nav.home')),
    );
    show(
      h(
        'section',
        { class: 'run', 'data-phase': 'done', 'data-cancelled': String(session.cancelled) },
        h('h1', { class: 'run__title' }, t(session.cancelled ? 'ui.run.cancelledTitle' : 'ui.run.doneTitle')),
        h(
          'dl',
          { class: 'run__stats' },
          h('dt', { class: 'run__term' }, t('ui.run.stats.correct')),
          h('dd', { class: 'run__stat', 'data-stat': 'correct' }, String(tally.correct)),
          h('dt', { class: 'run__term' }, t('ui.run.stats.wrong')),
          h('dd', { class: 'run__stat', 'data-stat': 'wrong' }, String(tally.wrong)),
          h('dt', { class: 'run__term' }, t('ui.run.stats.skipped')),
          h('dd', { class: 'run__stat', 'data-stat': 'skipped' }, String(tally.skipped)),
          h('dt', { class: 'run__term' }, t('ui.run.stats.average')),
          h('dd', { class: 'run__stat', 'data-stat': 'average' }, average),
        ),
        h('nav', { class: 'run__links' }, ...links),
      ),
    );
  }

  function render() {
    if (disposed || !session) return;
    stopTimer();
    timerEl = null;
    if (session.phase === 'ask') renderAsk();
    else if (session.phase === 'review') renderReview();
    else renderSummary();
  }

  function startSession(run) {
    session = {
      key,
      run,
      phase: 'ask',
      shown: 0,
      question: null,
      last: null,
      cancelled: false,
      tally: { correct: 0, wrong: 0, skipped: 0, ms: 0 },
      timerVisible: Boolean(getSetting('showTimer')),
      solutionOpen: false,
      answerMode: getSetting('answerMode'),
      mcChoices: getSetting('mcChoices'),
    };
    advance();
  }

  async function bootSet(sid) {
    const bar = h('progress', { class: 'run__loading-bar', max: '1', value: '0' });
    show(h('section', { class: 'run', 'data-phase': 'loading' }, h('p', { class: 'run__loading', role: 'status' }, t('ui.run.loading')), bar));
    try {
      let questions = null;
      const handoff = takeHandoff();
      if (handoff && handoff.kind === 'set' && handoff.setId === sid && Array.isArray(handoff.questions)) {
        questions = handoff.questions;
      } else {
        if (!isSetId(sid)) {
          showError('ui.error.invalidSetId');
          return;
        }
        const res = await generateSetFromId(sid, {
          onProgress: (done, total) => {
            if (disposed) return;
            bar.max = total;
            bar.value = done;
          },
        });
        questions = res.questions;
      }
      if (disposed) return;
      if (questions.length === 0) {
        showError('ui.error.emptySet');
        return;
      }
      startSession(
        createRun({
          source: 'set',
          provider: setProvider(questions),
          total: questions.length,
          answerMode: getSetting('answerMode'),
          maxRecords: getSetting('stats.maxRecords'),
        }),
      );
    } catch (err) {
      if (disposed) return;
      console.error(err);
      showError(err instanceof IdError ? 'ui.error.invalidSetId' : 'ui.error.generic');
    }
  }

  function bootTrainer() {
    const handoff = takeHandoff();
    if (!handoff || handoff.kind !== 'trainer') {
      ctx.navigate('#/train');
      return;
    }
    try {
      const entries = listEntries();
      const summaries = summarizeByFn(
        loadRecords(),
        getStatsConfig(),
        entries.map((e) => e.id),
      );
      const provider = trainerProvider({
        buckets: handoff.buckets,
        summaries,
        genCfg: getGenConfig({ poolVersion: POOL_VERSION }),
        rng: createRng(randomSeed()),
        deps: { generateQuestion, listEntries },
      });
      startSession(
        createRun({
          source: 'trainer',
          provider,
          total: handoff.count || null,
          answerMode: getSetting('answerMode'),
          maxRecords: getSetting('stats.maxRecords'),
        }),
      );
    } catch (err) {
      fail(err);
    }
  }

  if (session && session.key === key) {
    render();
  } else {
    session = null;
    if (ctx.segments[0] === 'set' && ctx.segments[1]) bootSet(ctx.segments[1]);
    else if (ctx.segments[0] === 'trainer') bootTrainer();
    else ctx.navigate('#/');
  }

  return () => {
    disposed = true;
    stopTimer();
    if (routeKeyFromHash() !== key) session = null;
  };
}