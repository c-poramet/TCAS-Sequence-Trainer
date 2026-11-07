/**
 * DOM helpers. No styling anywhere: semantic markup with BEM class hooks only.
 * Nothing here touches `document` at import time.
 * @module core/dom
 */
import { t } from './i18n.js';
import '../i18n/core.js';

const MATH_DELIMITERS = [
  { left: '$$', right: '$$', display: true },
  { left: '$', right: '$', display: false },
];
const FALLBACK_LABEL_OFFSET = 1;

/**
 * @param {any} x
 * @returns {boolean}
 */
function isAttrObject(x) {
  if (x === null || typeof x !== 'object' || Array.isArray(x)) return false;
  if (typeof Node !== 'undefined' && x instanceof Node) return false;
  return true;
}

/**
 * Append children (strings, numbers, nodes, nested arrays); null/undefined/booleans are skipped.
 * @param {Node} parent
 * @param {any} child
 * @returns {void}
 */
function appendChild(parent, child) {
  if (child === null || child === undefined || child === false || child === true) return;
  if (Array.isArray(child)) {
    for (const c of child) appendChild(parent, c);
    return;
  }
  parent.appendChild(typeof child === 'object' ? child : document.createTextNode(String(child)));
}

/**
 * Create an element.
 * Attributes: `class` (string|array), `id`, `data-*`, `on<event>` functions, boolean attrs
 * (true -> present, false/null/undefined -> omitted). A `style` attribute throws.
 * @param {string} tag
 * @param {Record<string, any>|null} [attrs]
 * @param {...any} children
 * @returns {HTMLElement}
 */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  let kids = children;
  let attributes = attrs;
  if (!isAttrObject(attrs)) {
    kids = attrs === undefined || attrs === null ? children : [attrs, ...children];
    attributes = null;
  }
  /** @type {any} */
  let deferredValue;
  let hasValue = false;
  for (const [name, value] of Object.entries(attributes ?? {})) {
    if (name.toLowerCase() === 'style') throw new Error('h(): the "style" attribute is forbidden (no styling in code)');
    if (value === null || value === undefined || value === false) continue;
    if (/^on[a-z]/.test(name)) {
      if (typeof value !== 'function') throw new Error(`h(): ${name} must be a function`);
      el.addEventListener(name.slice(2), value);
    } else if (name === 'class') {
      const cls = Array.isArray(value) ? value.filter(Boolean).join(' ') : String(value);
      if (cls) el.setAttribute('class', cls);
    } else if (name === 'value') {
      hasValue = true;
      deferredValue = value;
    } else if (value === true) {
      el.setAttribute(name, '');
    } else {
      el.setAttribute(name, String(value));
    }
  }
  appendChild(el, kids);
  if (hasValue) /** @type {any} */ (el).value = String(deferredValue);
  return el;
}

/**
 * Remove all children.
 * @param {Node} el
 * @returns {void}
 */
export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/**
 * Render KaTeX math (`$$..$$` display, `$..$` inline) inside an element; no-op without KaTeX.
 * @param {HTMLElement} el
 * @returns {void}
 */
export function renderMath(el) {
  const render = globalThis.renderMathInElement;
  if (typeof render !== 'function') return;
  try {
    render(el, { delimiters: MATH_DELIMITERS, throwOnError: false });
  } catch (err) {
    console.warn('Math rendering failed', err);
  }
}

/**
 * Render a sequence as `<ol class="seq">`. A term is blank (`?`) when it is `null`, or when its
 * position equals `missing` and `reveal` is not set.
 * @param {(number|null)[]} terms
 * @param {{missing?:number, reveal?:boolean}} [opts]
 * @returns {HTMLElement}
 */
export function renderSequence(terms, { missing, reveal = false } = {}) {
  const items = terms.map((term, index) => {
    const n = index + 1;
    const isMissing = n === missing;
    const blank = term === null || term === undefined || (isMissing && !reveal);
    return h('li', {
      class: ['seq__term', isMissing ? 'seq__term--missing' : null],
      'data-n': n,
      'data-missing': isMissing ? 'true' : null,
      'data-revealed': isMissing && reveal && !blank ? 'true' : null,
    }, blank ? t('core.seq.blank') : String(term));
  });
  return h('ol', { class: 'seq' }, items);
}

/**
 * Render a step-by-step solution.
 * @param {{answer:number, sections:{titleKey:string, titleParams?:Record<string,string|number>, steps:{key:string, params?:Record<string,string|number>, math?:string[]}[]}[]}} solution
 * @returns {HTMLElement}
 */
export function renderSolution(solution) {
  const sections = solution.sections.map((section) =>
    h('section', { class: 'solution__section' },
      h('h3', { class: 'solution__title' }, t(section.titleKey, section.titleParams)),
      section.steps.map((step) =>
        h('div', { class: 'solution__step' },
          h('p', { class: 'solution__text' }, t(step.key, step.params)),
          (step.math ?? []).map((line) => h('div', { class: 'solution__math' }, `$$${line}$$`))))));
  const root = h('div', { class: 'solution' },
    sections,
    h('p', { class: 'solution__answer' }, t('core.solution.answer', { answer: solution.answer })));
  renderMath(root);
  return root;
}

/**
 * Label of the multiple-choice option at `index` (A, B, C... / ก, ข, ค...).
 * @param {number} index zero-based
 * @returns {string}
 */
export function choiceLabel(index) {
  const labels = t('core.choiceLabels').split(',').map((s) => s.trim());
  return labels[index] ?? String(index + FALLBACK_LABEL_OFFSET);
}
