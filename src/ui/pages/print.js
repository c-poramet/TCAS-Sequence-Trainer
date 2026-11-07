import { h, clear } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { getSetting } from '../../core/settings.js';
import { isSetId } from '../../core/ids.js';
import { generateSetFromId } from '../../gen/generator.js';
import { renderPrintView } from '../../print/printView.js';

/**
 * Read a 0/1 query flag with a fallback.
 * @param {URLSearchParams} query
 * @param {string} name
 * @param {boolean} fallback
 * @returns {boolean}
 */
function flagFromQuery(query, name, fallback) {
  return query.has(name) ? query.get(name) === '1' : fallback;
}

/**
 * Mount the print page (#/print/<SID>?answers=1&solutions=0).
 * @param {HTMLElement} container
 * @param {{segments:string[], query:URLSearchParams, navigate:(hash:string)=>void}} ctx
 * @returns {() => void}
 */
export function mount(container, ctx) {
  let disposed = false;
  const sid = ctx.segments[0];
  const backHref = sid ? '#/set/' + encodeURIComponent(sid) : '#/generate';

  const toolbar = h(
    'div',
    { class: 'print__toolbar', 'data-noprint': 'true' },
    h('a', { class: 'print__back', href: backHref }, t('ui.print.back')),
    h('button', { type: 'button', class: 'print__button', onclick: () => window.print() }, t('ui.print.print')),
  );
  const body = h('div', { class: 'print__body' });
  container.append(h('section', { class: 'print' }, toolbar, body));

  const showError = (key) => {
    clear(body);
    body.append(h('p', { class: 'print__error', role: 'alert', 'data-noprint': 'true' }, t(key)));
  };

  if (!sid || !isSetId(sid)) {
    showError('ui.error.invalidSetId');
    return () => {};
  }

  const bar = h('progress', { class: 'print__bar', max: '1', value: '0' });
  body.append(h('p', { class: 'print__loading', role: 'status', 'data-noprint': 'true' }, t('ui.print.loading')), bar);

  const options = {
    includeAnswers: flagFromQuery(ctx.query, 'answers', Boolean(getSetting('print.includeAnswers'))),
    includeSolutions: flagFromQuery(ctx.query, 'solutions', Boolean(getSetting('print.includeSolutions'))),
    answerMode: getSetting('answerMode'),
    mcChoices: getSetting('mcChoices'),
  };

  generateSetFromId(sid, {
    onProgress: (done, total) => {
      if (disposed) return;
      bar.max = total;
      bar.value = done;
    },
  })
    .then(({ questions }) => {
      if (disposed) return;
      clear(body);
      renderPrintView(body, { setId: sid, questions, options });
    })
    .catch((err) => {
      if (disposed) return;
      console.error(err);
      showError('ui.error.generic');
    });

  return () => {
    disposed = true;
  };
}