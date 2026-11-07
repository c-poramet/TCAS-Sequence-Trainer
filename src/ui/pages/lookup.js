import { h, renderSequence, renderMath, renderSolution, clear } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { isQuestionId, isSetId, IdError } from '../../core/ids.js';
import { rebuildQuestion, RebuildError } from '../../gen/generator.js';
import { buildSolution } from '../../gen/solution.js';

/**
 * Map a pasted ID to a route hash.
 * @param {string} text
 * @returns {string|null}
 */
function resolveId(text) {
  const id = text.trim();
  if (isQuestionId(id)) return '#/q/' + encodeURIComponent(id);
  if (isSetId(id)) return '#/set/' + encodeURIComponent(id);
  return null;
}

/**
 * Highlight the missing term.
 * @param {HTMLElement} seq
 * @param {number} missing
 * @returns {void}
 */
function markMissing(seq, missing) {
  const el = seq.querySelectorAll('.seq__term')[missing - 1];
  if (el && !el.hasAttribute('data-missing')) el.setAttribute('data-missing', 'true');
}

/**
 * Map a rebuild error to an i18n key.
 * @param {unknown} err
 * @returns {string}
 */
function errorKeyFor(err) {
  if (err instanceof IdError) return 'ui.id.invalid';
  if (err instanceof RebuildError) return 'ui.lookup.error.rebuild';
  return 'ui.error.generic';
}

/**
 * Mount the lookup page (#/lookup and #/q/<QID>).
 * @param {HTMLElement} container
 * @param {{segments:string[], query:URLSearchParams, navigate:(hash:string)=>void}} ctx
 * @returns {() => void}
 */
export function mount(container, ctx) {
  const qid = ctx.segments[0];
  const input = h('input', {
    id: 'lookup-input',
    class: 'lookup__input',
    name: 'id',
    type: 'text',
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: t('ui.id.placeholder'),
  });
  if (qid !== undefined) input.value = qid;
  const error = h('p', { class: 'lookup__error', role: 'alert' }, t('ui.id.invalid'));
  error.hidden = true;
  input.addEventListener('input', () => {
    error.hidden = true;
  });

  const result = h('div', { class: 'lookup__result' });

  const form = h(
    'form',
    {
      class: 'lookup__form',
      novalidate: true,
      onsubmit: (e) => {
        e.preventDefault();
        const hash = resolveId(input.value);
        if (hash === null) {
          error.textContent = t('ui.id.invalid');
          error.hidden = false;
          input.focus();
          return;
        }
        ctx.navigate(hash);
      },
    },
    h('label', { class: 'lookup__label', for: 'lookup-input' }, t('ui.lookup.label')),
    input,
    h('button', { type: 'submit', class: 'lookup__button' }, t('ui.lookup.button')),
    error,
  );

  /**
   * Render the rebuilt question and its solution.
   * @param {string} id
   * @returns {void}
   */
  function showQuestion(id) {
    clear(result);
    let q;
    try {
      q = rebuildQuestion(id);
    } catch (err) {
      console.error(err);
      result.append(h('p', { class: 'lookup__error', role: 'alert' }, t(errorKeyFor(err))));
      return;
    }
    const seq = renderSequence(q.terms, { missing: q.missing, reveal: true });
    markMissing(seq, q.missing);

    const solutionBox = h('div', { class: 'lookup__solution' });
    try {
      solutionBox.append(renderSolution(buildSolution(q)));
      renderMath(solutionBox);
    } catch (err) {
      console.error(err);
      solutionBox.append(h('p', { class: 'lookup__error', role: 'alert' }, t('ui.error.generic')));
    }

    const meta = [
      ['mode', t('ui.lookup.mode.' + q.mode)],
      ['mixed', t(q.mixed ? 'ui.common.yes' : 'ui.common.no')],
      ['missing', String(q.missing)],
      ['answer', String(q.answer)],
      ['functions', q.fns.join(', ')],
    ];
    const rows = [];
    for (const [name, value] of meta) {
      rows.push(h('dt', { class: 'lookup__term' }, t('ui.lookup.meta.' + name)), h('dd', { class: 'lookup__value', 'data-meta': name }, value));
    }

    result.append(
      h(
        'article',
        { class: 'lookup__question', 'data-qid': q.id, 'data-mode': q.mode, 'data-mixed': String(q.mixed) },
        h('h2', { class: 'lookup__heading' }, t('ui.lookup.questionHeading')),
        h('p', { class: 'lookup__id' }, h('code', { class: 'lookup__code' }, q.id)),
        h('div', { class: 'lookup__sequence' }, seq),
        h('dl', { class: 'lookup__meta' }, ...rows),
        h('h2', { class: 'lookup__heading' }, t('ui.lookup.solutionHeading')),
        solutionBox,
      ),
    );
  }

  container.append(
    h('section', { class: 'lookup' }, h('h1', { class: 'lookup__title' }, t('ui.lookup.title')), h('p', { class: 'lookup__lead' }, t('ui.lookup.lead')), form, result),
  );
  if (qid !== undefined) showQuestion(qid);
  return () => {};
}