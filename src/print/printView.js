/**
 * Printable view of a generated set (browser Print -> Save as PDF).
 * Structure only, no styling. Everything that is not meant for paper must carry `data-noprint`
 * (this view renders no screen-only chrome of its own).
 * @module print/printView
 */
import { h, clear, renderSequence, renderSolution, choiceLabel } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { getSetting } from '../core/settings.js';
import { getChoices } from '../gen/choices.js';
import { buildSolution } from '../gen/solution.js';
import { renderQr } from '../core/qr.js';

/**
 * The six terms with the missing one blanked.
 * @param {{terms:number[], missing:number}} q
 * @returns {(number|null)[]}
 */
function maskedTerms(q) {
  return q.terms.map((value, i) => (i + 1 === q.missing ? null : value));
}

/**
 * Render the whole set into `container` (replacing its content).
 * The DOM is assembled in a DocumentFragment and attached once. Solutions render their
 * math as they are created.
 * @param {HTMLElement} container
 * @param {{setId:string, questions:import('../gen/generator.js').Question[],
 *          options:{includeAnswers:boolean, includeSolutions:boolean, answerMode:'typed'|'mc', mcChoices:number}}} spec
 * @returns {void}
 */
export function renderPrintView(container, { setId, questions, options }) {
  clear(container);
  const fragment = document.createDocumentFragment();
  const choiceCount = Number.isInteger(options.mcChoices) ? options.mcChoices : getSetting('mcChoices');
  const choiceSets = questions.map((q) => getChoices(q, choiceCount));

  const setQr = renderQr(setId, t('print.setQrLabel'));
  fragment.appendChild(
    h('header', { class: 'print__head' },
      h('div', { class: 'print__head-main' },
      h('h1', { class: 'print__title' }, t('print.title')),
      h('p', { class: 'print__setid' },
        h('span', { class: 'print__setid-label' }, t('print.setId')),
        ' ',
        h('code', { class: 'print__setid-value' }, setId)),
      h('p', { class: 'print__count' }, t('print.count', { count: questions.length }))),
      h('div', { class: 'print__qr print__set-qr' }, setQr),
    ),
  );

  const list = h('ol', { class: 'print__list' });
  questions.forEach((q, i) => {
    const content = h(
      'div',
      { class: 'print__q-content' },
      h(
        'div',
        { class: 'print__q-head' },
        h('span', { class: 'print__q-number' }, `${i + 1}`),
      ),
      renderSequence(maskedTerms(q), { missing: q.missing }),
      h(
        'ol',
        { class: 'print__choices' },
        choiceSets[i].choices.map((value, k) =>
          h('li', { class: 'print__choice', 'data-index': String(k) },
            h('span', { class: 'print__choice-label' }, choiceLabel(k)),
            h('span', { class: 'print__choice-value' }, String(value)))),
      ),
    );
    list.appendChild(
      h(
        'li',
        { class: 'print__q', 'data-qid': q.id },
        content,
        h('div', { class: 'print__qr print__question-qr' }, renderQr(q.id, t('print.questionQrLabel'))),
      ),
    );
  });
  fragment.appendChild(list);

  if (options.includeAnswers) {
    const answerText = (q, i) => t('print.answerMc', {
      label: choiceLabel(choiceSets[i].correctIndex),
      value: q.answer,
    });
    fragment.appendChild(
      h('section', { class: 'print__answers' },
        h('h2', { class: 'print__heading' }, t('print.answers')),
        h('table', { class: 'print__answer-table' },
          h(
            'tbody',
            {},
            questions.map((q, i) =>
              h('tr', { class: 'print__answer', 'data-qid': q.id },
                h('th', { scope: 'row' }, String(i + 1)),
                h('td', { class: 'print__answer-value' }, answerText(q, i)))),
          ),
        ),
      ),
    );
  }

  /** @type {HTMLElement|null} */
  let solutions = null;
  if (options.includeSolutions) {
    solutions = h('section', { class: 'print__solutions' },
      h('h2', { class: 'print__heading' }, t('print.solutions')),
      h('ol', { class: 'print__solution-list' },
        questions.map((q, i) =>
          h('li', { class: 'print__solution', 'data-qid': q.id },
            h('div', { class: 'print__solution-number' }, String(i + 1)),
            renderSolution(buildSolution(q))))));
    fragment.appendChild(solutions);
  }

  container.appendChild(fragment);
}