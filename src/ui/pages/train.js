import { h } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { getSetting, setSetting, getStatsConfig } from '../../core/settings.js';
import { SCHEMA } from '../../core/schema.js';
import { loadRecords } from '../../stats/store.js';
import { summarizeByFn, getBuckets } from '../../stats/analysis.js';
import { listEntries } from '../../pool/index.js';
import { setHandoff } from '../handoff.js';

/** Bucket ids in display order. */
const BUCKET_IDS = ['easy', 'normal', 'hard', 'failed'];
/** A count of 0 means an endless session. */
const ENDLESS_COUNT = 0;

/**
 * Numeric bounds of a schema key.
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
 * Mount the personal trainer setup page.
 * @param {HTMLElement} container
 * @param {{segments:string[], query:URLSearchParams, navigate:(hash:string)=>void}} ctx
 * @returns {() => void}
 */
export function mount(container, ctx) {
  const summaries = summarizeByFn(
    loadRecords(),
    getStatsConfig(),
    listEntries().map((e) => e.id),
  );
  const buckets = getBuckets(summaries);
  const preselected = getSetting('trainer.buckets');

  const checkboxes = BUCKET_IDS.map((id) => {
    const cb = h('input', { type: 'checkbox', class: 'train__check', name: 'bucket', value: id, id: 'train-bucket-' + id });
    cb.checked = Array.isArray(preselected) && preselected.includes(id);
    return cb;
  });
  const bucketRows = BUCKET_IDS.map((id, i) =>
    h(
      'li',
      { class: 'train__bucket', 'data-bucket': id },
      h(
        'label',
        { class: 'train__bucket-label', for: 'train-bucket-' + id },
        checkboxes[i],
        h('span', { class: 'train__bucket-name' }, t('trainer.bucket.' + id)),
        h('span', { class: 'train__bucket-count' }, t('ui.train.functionCount', { n: (buckets[id] || []).length })),
      ),
    ),
  );

  const bounds = boundsOf('trainer.count');
  const countAttrs = {
    id: 'train-count',
    class: 'train__input',
    name: 'count',
    type: 'number',
    step: '1',
    inputmode: 'numeric',
    value: String(getSetting('trainer.count')),
  };
  if (bounds.min !== undefined) countAttrs.min = String(bounds.min);
  if (bounds.max !== undefined) countAttrs.max = String(bounds.max);
  const countInput = h('input', countAttrs);

  const error = h('p', { class: 'train__error', role: 'alert' }, t('ui.train.noBucket'));
  const start = h('button', { type: 'submit', class: 'train__start' }, t('ui.train.start'));

  const chosen = () => BUCKET_IDS.filter((_, i) => checkboxes[i].checked);
  const sync = () => {
    const none = chosen().length === 0;
    start.disabled = none;
    error.hidden = !none;
  };
  checkboxes.forEach((cb) => cb.addEventListener('change', sync));
  sync();

  const form = h(
    'form',
    {
      class: 'train__form',
      novalidate: true,
      onsubmit: (e) => {
        e.preventDefault();
        const selected = chosen();
        if (selected.length === 0) {
          sync();
          return;
        }
        const raw = countInput.value.trim() === '' ? NaN : Number(countInput.value);
        let count = Number.isFinite(raw) ? Math.round(raw) : getSetting('trainer.count');
        count = Math.min(bounds.max ?? Infinity, Math.max(bounds.min ?? ENDLESS_COUNT, count));
        setSetting('trainer.buckets', selected);
        setSetting('trainer.count', count);
        setHandoff({ kind: 'trainer', buckets: selected, count });
        ctx.navigate('#/run/trainer');
      },
    },
    h('fieldset', { class: 'train__buckets' }, h('legend', { class: 'train__legend' }, t('ui.train.bucketsLegend')), h('ul', { class: 'train__bucket-list' }, ...bucketRows)),
    h('p', { class: 'train__note' }, t('ui.train.unratedNote')),
    h(
      'div',
      { class: 'train__field' },
      h('label', { class: 'train__label', for: 'train-count' }, t('ui.train.countLabel')),
      countInput,
      h('p', { class: 'train__help' }, t('ui.train.countHelp')),
    ),
    error,
    start,
  );

  container.append(
    h('section', { class: 'train' }, h('h1', { class: 'train__title' }, t('ui.train.title')), h('p', { class: 'train__lead' }, t('ui.train.lead')), form),
  );
  return () => {};
}