import './i18n/core.js';
import './i18n/pool_common.js';
import './i18n/pool_advanced.js';
import './i18n/gen.js';
import './i18n/stats.js';
import './i18n/ui.js';
import { t, getLang, setLang, onLangChange } from './core/i18n.js';
import { h, clear } from './core/dom.js';

/** Lazy page loaders keyed by page id. */
const PAGES = {
  home: () => import('./ui/pages/home.js'),
  generate: () => import('./ui/pages/generate.js'),
  run: () => import('./ui/pages/run.js'),
  train: () => import('./ui/pages/train.js'),
  stats: () => import('./ui/pages/stats.js'),
  settings: () => import('./ui/pages/settings.js'),
  lookup: () => import('./ui/pages/lookup.js'),
  print: () => import('./ui/pages/print.js'),
};

/** First hash segment → page id. */
const ROUTES = new Map([
  ['', 'home'],
  ['generate', 'generate'],
  ['set', 'generate'],
  ['run', 'run'],
  ['train', 'train'],
  ['stats', 'stats'],
  ['settings', 'settings'],
  ['lookup', 'lookup'],
  ['q', 'lookup'],
  ['print', 'print'],
]);

/** Navigation entries, in display order. */
const NAV_ITEMS = [
  { id: 'home', hash: '#/' },
  { id: 'generate', hash: '#/generate' },
  { id: 'train', hash: '#/train' },
  { id: 'stats', hash: '#/stats' },
  { id: 'lookup', hash: '#/lookup' },
  { id: 'settings', hash: '#/settings' },
];

/** @type {(() => void)|null} */
let unmountCurrent = null;
let renderToken = 0;

/**
 * Decode a URI component without throwing.
 * @param {string} s
 * @returns {string}
 */
function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Parse "#/seg/seg?query" into its parts.
 * @param {string} hash
 * @returns {{name:string, segments:string[], query:URLSearchParams}}
 */
function parseHash(hash) {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const qIndex = raw.indexOf('?');
  const path = qIndex === -1 ? raw : raw.slice(0, qIndex);
  const queryText = qIndex === -1 ? '' : raw.slice(qIndex + 1);
  const parts = path.split('/').filter((p) => p.length > 0).map(safeDecode);
  return { name: parts[0] ?? '', segments: parts.slice(1), query: new URLSearchParams(queryText) };
}

/**
 * Which nav entry is highlighted for a page.
 * @param {string} pageId
 * @param {string[]} segments
 * @returns {string}
 */
function navIdFor(pageId, segments) {
  if (pageId === 'run') return segments[0] === 'trainer' ? 'train' : 'generate';
  if (pageId === 'print') return 'generate';
  return pageId;
}

/**
 * Navigate to a hash; re-renders even if the hash is unchanged.
 * @param {string} hash
 * @returns {void}
 */
function navigate(hash) {
  const target = hash.startsWith('#') ? hash : '#' + hash;
  const before = window.location.href;
  window.location.hash = target;
  if (window.location.href === before) render();
}

/**
 * Rebuild nav, document title and html lang.
 * @param {string} pageId
 * @param {string} activeNavId
 * @returns {void}
 */
function renderChrome(pageId, activeNavId) {
  const lang = getLang();
  document.documentElement.lang = lang;
  document.title = t('ui.title.' + pageId) + ' · ' + t('ui.app.name');
  const nav = document.getElementById('nav');
  if (!nav) return;
  clear(nav);
  nav.setAttribute('aria-label', t('ui.nav.label'));
  const nextLang = lang === 'th' ? 'en' : 'th';
  const items = NAV_ITEMS.map((item) => {
    const attrs = { class: 'nav__link', href: item.hash, 'data-route': item.id };
    if (item.id === activeNavId) attrs['aria-current'] = 'page';
    return h('li', { class: 'nav__item' }, h('a', attrs, t('ui.nav.' + item.id)));
  });
  nav.append(
    h('a', { class: 'nav__brand', href: '#/' }, t('ui.app.name')),
    h('ul', { class: 'nav__list' }, ...items),
    h(
      'button',
      {
        type: 'button',
        class: 'nav__lang',
        id: 'lang-switch',
        lang: nextLang,
        'aria-label': t('ui.lang.switchLabel'),
        onclick: () => setLang(nextLang),
      },
      t('ui.lang.switch'),
    ),
  );
}

/**
 * Unmount the current page, resolve the route and mount the page.
 * @returns {Promise<void>}
 */
async function render() {
  const my = ++renderToken;
  const main = document.getElementById('app');
  if (!main) return;
  if (unmountCurrent) {
    try {
      unmountCurrent();
    } catch (err) {
      console.error(err);
    }
    unmountCurrent = null;
  }
  const route = parseHash(window.location.hash);
  const known = ROUTES.has(route.name);
  const pageId = known ? ROUTES.get(route.name) : 'home';
  const segments = known ? route.segments : [];
  const query = known ? route.query : new URLSearchParams();
  renderChrome(pageId, navIdFor(pageId, segments));
  clear(main);
  try {
    const mod = await PAGES[pageId]();
    if (my !== renderToken) return;
    const unmount = mod.mount(main, { segments, query, navigate });
    unmountCurrent = typeof unmount === 'function' ? unmount : null;
  } catch (err) {
    if (my !== renderToken) return;
    console.error(err);
    clear(main);
    main.append(
      h('p', { class: 'app__error', role: 'alert' }, t('ui.error.generic')),
      h('a', { class: 'app__error-home', href: '#/' }, t('ui.nav.home')),
    );
  }
}

window.addEventListener('hashchange', () => {
  render();
});
onLangChange(() => {
  render();
});
render();