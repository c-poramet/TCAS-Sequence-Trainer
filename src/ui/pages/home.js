import { h } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { isQuestionId, isSetId } from '../../core/ids.js';

/** Entry cards: id, route. */
const CARDS = [
  { id: 'generate', hash: '#/generate' },
  { id: 'train', hash: '#/train' },
  { id: 'stats', hash: '#/stats' },
];

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
 * Mount the home page.
 * @param {HTMLElement} container
 * @param {{segments:string[], query:URLSearchParams, navigate:(hash:string)=>void}} ctx
 * @returns {() => void}
 */
export function mount(container, ctx) {
  const input = h('input', {
    id: 'home-id',
    class: 'home__input',
    name: 'id',
    type: 'text',
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: t('ui.id.placeholder'),
  });
  const error = h('p', { class: 'home__error', role: 'alert' }, t('ui.id.invalid'));
  error.hidden = true;
  input.addEventListener('input', () => {
    error.hidden = true;
  });

  const form = h(
    'form',
    {
      class: 'home__open',
      novalidate: true,
      onsubmit: (e) => {
        e.preventDefault();
        const hash = resolveId(input.value);
        if (hash === null) {
          error.hidden = false;
          input.focus();
          return;
        }
        ctx.navigate(hash);
      },
    },
    h('h2', { class: 'home__open-title' }, t('ui.home.open.title')),
    h('label', { class: 'home__label', for: 'home-id' }, t('ui.home.open.label')),
    h(
      'div',
      { class: 'home__input-row' },
      input,
      h('button', { type: 'submit', class: 'home__open-button' }, t('ui.home.open.button')),
    ),
    error,
  );

  const cards = CARDS.map((card) =>
    h(
      'li',
      { class: 'home__item' },
      h(
        'article',
        { class: 'home__card', 'data-card': card.id },
        h('h2', { class: 'home__card-title' }, t('ui.home.card.' + card.id + '.title')),
        h('p', { class: 'home__card-text' }, t('ui.home.card.' + card.id + '.text')),
        h('a', { class: 'home__cta', href: card.hash }, t('ui.home.card.' + card.id + '.cta')),
      ),
    ),
  );

  container.append(
    h(
      'section',
      { class: 'home' },
      h('h1', { class: 'home__title' }, t('ui.home.title')),
      h('p', { class: 'home__lead' }, t('ui.home.lead')),
      h('ul', { class: 'home__cards' }, ...cards),
      form,
    ),
  );
  return () => {};
}