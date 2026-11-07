import { h, renderSequence, clear } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { getSetting, getGenConfig, toGenSettings } from '../../core/settings.js';
import { randomSeed } from '../../core/rng.js';
import { encodeSetId, decodeSetId, isSetId, IdError } from '../../core/ids.js';
import { SCHEMA } from '../../core/schema.js';
import { generateSet, generateSetFromId, GenerationError } from '../../gen/generator.js';
import { getChoices } from '../../gen/choices.js';
import { POOL_VERSION } from '../../pool/index.js';
import { setHandoff, takeHandoff } from '../handoff.js';
import { questionSolutionUrl, renderQr } from '../../core/qr.js';

/** Number of question rows appended per "show more" click. */
const PAGE_SIZE = 50;
const GENERATE_RETURN_KEY = 'tcas-generate-return';
/** Smallest allowed set size. */
const MIN_COUNT = 1;
/** How long the "copied" notice stays visible (ms). */
const COPY_NOTICE_MS = 2000;
/** gen.* settings shown read-only below the form. */
const FIXED_KEYS = [
  'cap',
  'maxAttempts',
  'poolVersion',
  'normalTiers',
  'composeTiers',
  'rareTiers',
  'composeChance',
  'minDistinct',
  'allowNegative',
  'termCount',
];

function readGenerateReturn() {
  const handoff = takeHandoff();
  if (handoff && handoff.kind === 'generate-return') return handoff;
  try {
    const stored = sessionStorage.getItem(GENERATE_RETURN_KEY);
    sessionStorage.removeItem(GENERATE_RETURN_KEY);
    const value = stored ? JSON.parse(stored) : null;
    return value && value.kind === 'generate-return' ? value : null;
  } catch {
    return null;
  }
}

/**
 * Numeric bounds of a schema key (undefined when not numeric).
 * @param {string} key
 * @returns {{min:number|undefined, max:number|undefined}}
 */
function boundsOf(key) {
  const entry = SCHEMA.find((e) => e.key === key);
  return {
    min: entry && typeof entry.min === 'number' ? entry.min : undefined,
    max: entry && typeof entry.max === 'number' ? entry.max : undefined,
  };
}

/**
 * Clamp a number into optional bounds.
 * @param {number} value
 * @param {{min?:number, max?:number}} limit
 * @returns {number}
 */
function clampTo(value, limit) {
  return Math.min(limit.max ?? Infinity, Math.max(limit.min ?? -Infinity, value));
}

/**
 * Parse a text field to a number (NaN when blank).
 * @param {string} text
 * @returns {number}
 */
function toNumber(text) {
  return text.trim() === '' ? NaN : Number(text);
}

/**
 * Validate and clamp the raw form values.
 * @param {{count:string, hardRatio:string, mixedChance:string, seed:string}} raw
 * @param {{count:{min?:number,max?:number}, hardRatio:{min?:number,max?:number}, mixedChance:{min?:number,max?:number}}} limits
 * @returns {{ok:true, values:{count:number, hardRatio:number, mixedChance:number, seed:string}}|{ok:false, errorKey:string}}
 */
function parseFormValues(raw, limits) {
  const count = toNumber(raw.count);
  if (!Number.isInteger(count)) return { ok: false, errorKey: 'ui.generate.error.count' };
  const hardRatio = toNumber(raw.hardRatio);
  if (!Number.isFinite(hardRatio)) return { ok: false, errorKey: 'ui.generate.error.hardRatio' };
  const mixedChance = toNumber(raw.mixedChance);
  if (!Number.isFinite(mixedChance)) return { ok: false, errorKey: 'ui.generate.error.mixedChance' };
  return {
    ok: true,
    values: {
      count: clampTo(count, limits.count),
      hardRatio: clampTo(hardRatio, limits.hardRatio),
      mixedChance: clampTo(mixedChance, limits.mixedChance),
      seed: raw.seed.trim() || randomSeed(),
    },
  };
}

/**
 * Format a setting value for read-only display.
 * @param {unknown} value
 * @returns {string}
 */
function formatValue(value) {
  if (value === null || value === undefined) return t('ui.common.none');
  if (typeof value === 'boolean') return t(value ? 'ui.common.yes' : 'ui.common.no');
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

/**
 * Build the print route hash.
 * @param {string} sid
 * @param {boolean} answers
 * @param {boolean} solutions
 * @returns {string}
 */
function printHash(sid, answers, solutions) {
  return `#/print/${encodeURIComponent(sid)}?answers=${answers ? 1 : 0}&solutions=${solutions ? 1 : 0}`;
}

/**
 * One list row for a question.
 * @param {{id:string, terms:number[], missing:number, mode:string}} q
 * @param {number} number
 * @returns {HTMLElement}
 */
function questionRow(q, number, onOpen) {
  const { choices } = getChoices(q, getSetting('mcChoices'));
  return h(
    'li',
    { class: 'gen__row', 'data-qid': q.id, 'data-mode': q.mode },
    h(
      'div',
      { class: 'gen__row-content' },
      h(
        'div',
        { class: 'gen__row-head' },
        h(
          'a',
          {
            class: 'gen__qid',
            href: '#/q/' + encodeURIComponent(q.id) + '?back=generate',
            'aria-label': t('ui.generate.questionNumber', { number }),
            onclick: () => onOpen(),
          },
          String(number),
        ),
      ),
      renderSequence(
        q.terms.map((v, i) => (i + 1 === q.missing ? null : v)),
        { missing: q.missing },
      ),
      h(
        'ol',
        { class: 'gen__choices' },
        choices.map((value) => h('li', { class: 'gen__choice' }, String(value))),
      ),
    ),
    h('span', { class: 'gen__qr' }, renderQr(questionSolutionUrl(q.id), t('print.questionQrLabel'))),
  );
}

/**
 * Mount the generate page (#/generate and #/set/<SID>).
 * @param {HTMLElement} container
 * @param {{segments:string[], query:URLSearchParams, navigate:(hash:string)=>void}} ctx
 * @returns {() => void}
 */
export function mount(container, ctx) {
  let disposed = false;
  let token = 0;
  let copyTimer = null;

  const maxSize = getSetting('gen.maxSetSize');
  const limits = {
    count: { min: boundsOf('gen.count').min ?? MIN_COUNT, max: maxSize },
    hardRatio: boundsOf('gen.hardRatio'),
    mixedChance: boundsOf('gen.mixedChance'),
  };

  const numberInput = (id, name, value, limit, step) => {
    const attrs = { id, class: 'gen__input', name, type: 'number', step, value: String(value), required: true };
    if (limit.min !== undefined) attrs.min = String(limit.min);
    if (limit.max !== undefined) attrs.max = String(limit.max);
    return h('input', attrs);
  };

  const countInput = numberInput('gen-count', 'count', getSetting('gen.count'), limits.count, '1');
  countInput.setAttribute('inputmode', 'numeric');
  const hardInput = numberInput('gen-hard', 'hardRatio', getSetting('gen.hardRatio'), limits.hardRatio, 'any');
  const mixedInput = numberInput('gen-mixed', 'mixedChance', getSetting('gen.mixedChance'), limits.mixedChance, 'any');
  const seedInput = h('input', {
    id: 'gen-seed',
    class: 'gen__input',
    name: 'seed',
    type: 'text',
    autocomplete: 'off',
    spellcheck: 'false',
  });
  const restore = readGenerateReturn();
  const restoreGenerate = restore && restore.kind === 'generate-return' ? restore : null;

  const field = (id, labelKey, input, helpKey, helpParams) =>
    h(
      'div',
      { class: 'gen__field' },
      h('label', { class: 'gen__label', for: id }, t(labelKey)),
      input,
      h('p', { class: 'gen__help' }, t(helpKey, helpParams)),
    );

  const fixedList = h('dl', { class: 'gen__fixed-list' });
  const errorEl = h('p', { class: 'gen__error', role: 'alert' });
  errorEl.hidden = true;
  const submit = h('button', { type: 'submit', class: 'gen__submit' }, t('ui.generate.submit'));

  const progressBar = h('progress', { class: 'gen__bar', id: 'gen-bar', max: '1', value: '0' });
  const progressText = h('span', { class: 'gen__progress-text', role: 'status' });
  const progressWrap = h(
    'div',
    { class: 'gen__progress' },
    h('label', { class: 'gen__progress-label', for: 'gen-bar' }, t('ui.generate.progressLabel')),
    progressBar,
    progressText,
  );
  progressWrap.hidden = true;

  const resultEl = h('section', { class: 'gen__result', 'aria-live': 'polite' });
  resultEl.hidden = true;

  /**
   * Show the read-only gen.* values.
   * @param {Record<string, unknown>} settings
   * @returns {void}
   */
  function renderFixed(settings) {
    clear(fixedList);
    for (const key of FIXED_KEYS) {
      fixedList.append(
        h('dt', { class: 'gen__fixed-name' }, t('settings.gen.' + key + '.label')),
        h('dd', { class: 'gen__fixed-value', 'data-key': key }, formatValue(settings[key])),
      );
    }
  }

  /**
   * Fill the editable inputs from generation settings.
   * @param {{count:number, hardRatio:number, mixedChance:number, seed:string}} s
   * @returns {void}
   */
  function fillForm(s) {
    countInput.value = String(s.count);
    hardInput.value = String(s.hardRatio);
    mixedInput.value = String(s.mixedChance);
    seedInput.value = s.seed;
  }

  function showError(key) {
    errorEl.textContent = t(key);
    errorEl.hidden = false;
  }

  function setBusy(busy) {
    submit.disabled = busy;
    progressWrap.hidden = !busy;
    if (busy) {
      progressBar.max = 1;
      progressBar.value = 0;
      progressText.textContent = '';
    }
  }

  /**
   * Map an error to an i18n key.
   * @param {unknown} err
   * @returns {string}
   */
  function errorKeyFor(err) {
    if (err instanceof IdError) return 'ui.generate.error.invalidSetId';
    if (err instanceof GenerationError) return 'ui.generate.error.generation';
    return 'ui.error.generic';
  }

  /**
   * Copy text, falling back to selecting the input.
   * @param {string} text
   * @param {HTMLInputElement} input
   * @param {HTMLElement} status
   * @returns {Promise<void>}
   */
  async function copyText(text, input, status) {
    let ok = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      input.select();
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
    }
    if (disposed) return;
    status.textContent = t(ok ? 'ui.common.copied' : 'ui.common.copyFailed');
    status.hidden = false;
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      status.textContent = '';
      status.hidden = true;
    }, COPY_NOTICE_MS);
  }

  /**
   * Render the result panel for a generated set.
   * @param {string} sid
   * @param {{seed:string}} settings
   * @param {Array<{id:string, terms:number[], missing:number, mode:string}>} questions
   * @returns {void}
   */
  function showResult(sid, settings, questions, initialShown = 0) {
    clear(resultEl);

    const sidInput = h('input', {
      class: 'gen__setid',
      id: 'gen-setid',
      type: 'text',
      readonly: true,
      value: sid,
    });
    const copyStatus = h('span', { class: 'gen__copy-status', role: 'status', hidden: true });
    const copyBtn = h(
      'button',
      { type: 'button', class: 'gen__copy', onclick: () => copyText(sid, sidInput, copyStatus) },
      t('ui.common.copy'),
    );

    const answersCb = h('input', { type: 'checkbox', class: 'gen__check', id: 'gen-print-answers' });
    answersCb.checked = Boolean(getSetting('print.includeAnswers'));
    const solutionsCb = h('input', { type: 'checkbox', class: 'gen__check', id: 'gen-print-solutions' });
    solutionsCb.checked = Boolean(getSetting('print.includeSolutions'));
    const printLink = h(
      'a',
      { class: 'gen__print gen__link-button', href: printHash(sid, answersCb.checked, solutionsCb.checked) },
      t('ui.generate.print'),
    );
    const updateHref = () => printLink.setAttribute('href', printHash(sid, answersCb.checked, solutionsCb.checked));
    answersCb.addEventListener('change', updateHref);
    solutionsCb.addEventListener('change', updateHref);

    const practiceBtn = h(
      'button',
      {
        type: 'button',
        class: 'gen__practice',
        onclick: () => {
          setHandoff({ kind: 'set', setId: sid, questions });
          ctx.navigate('#/run/set/' + encodeURIComponent(sid));
        },
      },
      t('ui.generate.practice'),
    );

    const list = h('ol', { class: 'gen__list', 'aria-label': t('ui.generate.listLabel') });
    const more = h('button', { type: 'button', class: 'gen__more' });
    let shown = Math.min(Math.max(0, initialShown), questions.length);
    const renderMore = () => {
      const start = shown;
      const end = Math.min(shown + PAGE_SIZE, questions.length);
      const frag = document.createDocumentFragment();
      for (let i = start; i < end; i += 1) {
        frag.append(questionRow(questions[i], i + 1, () => {
          const snapshot = {
            kind: 'generate-return',
            sid,
            settings,
            questions,
            shown,
            form: {
              count: countInput.value,
              hardRatio: hardInput.value,
              mixedChance: mixedInput.value,
              seed: seedInput.value,
            },
            scrollY: window.scrollY,
          };
          setHandoff(snapshot);
          try {
            sessionStorage.setItem(GENERATE_RETURN_KEY, JSON.stringify(snapshot));
          } catch {
            // The in-memory handoff remains sufficient when storage is unavailable.
          }
        }));
      }
      list.append(frag);
      shown = end;
      const remaining = questions.length - shown;
      more.hidden = remaining <= 0;
      more.textContent = t('ui.generate.showMore', { next: Math.min(PAGE_SIZE, remaining), remaining });
    };
    more.addEventListener('click', renderMore);

    resultEl.append(
      h('h2', { class: 'gen__result-title' }, t('ui.generate.resultTitle')),
      h(
        'div',
        { class: 'gen__overview' },
        h(
          'div',
          { class: 'gen__overview-content' },
          h(
            'p',
            { class: 'gen__summary' },
            t('ui.generate.summary', { count: questions.length, seed: settings.seed }),
          ),
          h(
            'div',
            { class: 'gen__setid-row' },
            h('label', { class: 'gen__label', for: 'gen-setid' }, t('ui.generate.setId')),
            sidInput,
            copyBtn,
            h('a', { class: 'gen__link-button gen__permalink', href: '#/set/' + encodeURIComponent(sid) }, t('ui.generate.permalink')),
            copyStatus,
          ),
          h(
            'fieldset',
            { class: 'gen__print-options' },
            h('legend', { class: 'gen__legend' }, t('ui.generate.printOptions')),
            h('label', { class: 'gen__check-label', for: 'gen-print-answers' }, answersCb, h('span', {}, t('ui.generate.printAnswers'))),
            h('label', { class: 'gen__check-label', for: 'gen-print-solutions' }, solutionsCb, h('span', {}, t('ui.generate.printSolutions'))),
          ),
          h('div', { class: 'gen__actions' }, practiceBtn, printLink),
        ),
        h('div', { class: 'gen__set-qr' }, renderQr(sid, t('print.setQrLabel'))),
      ),
      h('h3', { class: 'gen__list-title' }, t('ui.generate.listTitle')),
      list,
      more,
    );
    if (initialShown > 0) {
      let rendered = 0;
      while (rendered < initialShown) {
        const before = shown;
        shown = rendered;
        renderMore();
        rendered = shown;
        if (shown === before) break;
      }
    } else {
      renderMore();
    }
    resultEl.hidden = false;
    if (restoreGenerate) requestAnimationFrame(() => window.scrollTo(0, restoreGenerate.scrollY));
  }

  /**
   * Run a generation and show the outcome.
   * @param {(onProgress:(done:number,total:number)=>void)=>Promise<Array<object>>} produce
   * @param {string} sid
   * @param {{seed:string}} settings
   * @returns {Promise<void>}
   */
  async function start(produce, sid, settings) {
    const my = ++token;
    errorEl.hidden = true;
    resultEl.hidden = true;
    setBusy(true);
    try {
      const questions = await produce((done, total) => {
        if (disposed || my !== token) return;
        progressBar.max = total;
        progressBar.value = done;
        progressText.textContent = t('ui.generate.progress', { done, total });
      });
      if (disposed || my !== token) return;
      showResult(sid, settings, questions);
    } catch (err) {
      if (disposed || my !== token) return;
      console.error(err);
      showError(errorKeyFor(err));
    } finally {
      if (!disposed && my === token) setBusy(false);
    }
  }

  const form = h(
    'form',
    {
      class: 'gen__form',
      id: 'gen-form',
      novalidate: true,
      onsubmit: (e) => {
        e.preventDefault();
        errorEl.hidden = true;
        const parsed = parseFormValues(
          { count: countInput.value, hardRatio: hardInput.value, mixedChance: mixedInput.value, seed: seedInput.value },
          limits,
        );

        if (!parsed.ok) {
          showError(parsed.errorKey);
          return;
        }
        const v = parsed.values;
        countInput.value = String(v.count);
        hardInput.value = String(v.hardRatio);
        mixedInput.value = String(v.mixedChance);
        try {
          const cfg = { ...getGenConfig({ poolVersion: POOL_VERSION }), hardRatio: v.hardRatio, mixedChance: v.mixedChance };
          const genSettings = toGenSettings(cfg, { seed: v.seed, count: v.count });
          renderFixed(genSettings);
          const sid = encodeSetId(genSettings);
          start((onProgress) => generateSet(genSettings, { onProgress }), sid, genSettings);
        } catch (err) {
          console.error(err);
          showError(errorKeyFor(err));
        }
      },
    },
    field('gen-count', 'ui.generate.count.label', countInput, 'ui.generate.count.help', { min: limits.count.min, max: limits.count.max }),
    field('gen-hard', 'ui.generate.hardRatio.label', hardInput, 'ui.generate.ratio.help'),
    field('gen-mixed', 'ui.generate.mixedChance.label', mixedInput, 'ui.generate.ratio.help'),
    field('gen-seed', 'ui.generate.seed.label', seedInput, 'ui.generate.seed.help'),
    h(
      'details',
      { class: 'gen__fixed' },
      h('summary', { class: 'gen__fixed-title' }, t('ui.generate.otherSettings')),
      fixedList,
      h('a', { class: 'gen__settings-link', href: '#/settings' }, t('ui.generate.editSettings')),
    ),
    submit,
    errorEl,
  );

  container.append(
    h('section', { class: 'gen' }, h('h1', { class: 'gen__title' }, t('ui.generate.title')), form, progressWrap, resultEl),
  );

  renderFixed(getGenConfig({ poolVersion: POOL_VERSION }));

  if (restoreGenerate) {
    fillForm(restoreGenerate.form);
    renderFixed(restoreGenerate.settings);
    showResult(restoreGenerate.sid, restoreGenerate.settings, restoreGenerate.questions, restoreGenerate.shown);
  }

  const routeSid = ctx.segments[0];
  if (routeSid !== undefined) {
    if (!isSetId(routeSid)) {
      showError('ui.generate.error.invalidSetId');
    } else {
      try {
        const { settings } = decodeSetId(routeSid);
        fillForm(settings);
        renderFixed(settings);
        start((onProgress) => generateSetFromId(routeSid, { onProgress }).then((r) => r.questions), routeSid, settings);
      } catch (err) {
        console.error(err);
        showError(errorKeyFor(err));
      }
    }
  }

  return () => {
    disposed = true;
    token += 1;
    clearTimeout(copyTimer);
  };
}