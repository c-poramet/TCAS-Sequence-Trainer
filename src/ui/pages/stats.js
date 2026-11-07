/**
 * Statistics page: overview, charts, per-function table, bucket membership, clear button.
 * Thin DOM glue over src/stats/analysis.js.
 * @module ui/pages/stats
 */
import { h, clear } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { getStatsConfig } from '../../core/settings.js';
import { clearRecordsData } from '../../core/dataIO.js';
import { loadRecords } from '../../stats/store.js';
import { summarizeByFn, getBuckets, overview, weakestFirst } from '../../stats/analysis.js';
import { renderCharts } from '../charts.js';

const MS_PER_SECOND = 1000;
const DECIMALS = 10;
const BUCKETS = ['easy', 'normal', 'hard', 'failed'];
const TABLE_COLUMNS = ['fn', 'attempts', 'accuracy', 'median', 'p25', 'p75', 'tier', 'failed'];

/**
 * @param {number|null} ms
 * @returns {string}
 */
function fmtSeconds(ms) {
  if (ms === null) return t('stats.na');
  return t('stats.value.seconds', { value: Math.round((ms / MS_PER_SECOND) * DECIMALS) / DECIMALS });
}

/**
 * @param {number|null} percent
 * @returns {string}
 */
function fmtPercent(percent) {
  return percent === null ? t('stats.na') : t('stats.value.percent', { value: Math.round(percent) });
}

/**
 * @param {import('../../stats/analysis.js').ModeStats} m
 * @returns {string}
 */
function fmtMode(m) {
  if (m.attempts === 0) return t('stats.na');
  return t('stats.overview.modeValue', { attempts: m.attempts, accuracy: Math.round(/** @type {number} */ (m.accuracy)) });
}

/**
 * @param {import('../../stats/analysis.js').Overview} ov
 * @returns {HTMLElement}
 */
function renderOverview(ov) {
  const items = [
    ['attempts', String(ov.attempts)],
    ['accuracy', fmtPercent(ov.accuracy)],
    ['median', fmtSeconds(ov.medianMs)],
    ['streak', String(ov.streak)],
    ['bestStreak', String(ov.bestStreak)],
    ['days', String(ov.daysActive)],
    ['normalMode', fmtMode(ov.byMode.N)],
    ['hardMode', fmtMode(ov.byMode.H)],
  ];
  return h('dl', { class: 'stats__overview', id: 'stats-overview' },
    items.map(([key, value]) =>
      h('div', { class: 'stats__card', 'data-metric': key },
        h('dt', { class: 'stats__label' }, t(`stats.overview.${key}`)),
        h('dd', { class: 'stats__value' }, value))));
}

/**
 * @param {import('../../stats/analysis.js').FnSummary[]} summaries
 * @returns {HTMLElement}
 */
function renderTable(summaries) {
  const head = h('thead', {}, h('tr', {},
    TABLE_COLUMNS.map((col) => h('th', { scope: 'col', class: `stats__th stats__th--${col}` }, t(`stats.table.${col}`)))));
  const body = h('tbody', {},
    weakestFirst(summaries).map((s) =>
      h('tr', { class: 'stats__row', 'data-fn': s.fn, 'data-tier': s.tier, 'data-failed': String(s.oftenFailed) },
        h('th', { scope: 'row', class: 'stats__cell stats__cell--fn' }, h('code', {}, s.fn)),
        h('td', { class: 'stats__cell' }, String(s.attempts)),
        h('td', { class: 'stats__cell' }, s.attempts > 0 ? fmtPercent((s.correct / s.attempts) * 100) : t('stats.na')),
        h('td', { class: 'stats__cell' }, fmtSeconds(s.medianMs)),
        h('td', { class: 'stats__cell' }, fmtSeconds(s.p25Ms)),
        h('td', { class: 'stats__cell' }, fmtSeconds(s.p75Ms)),
        h('td', { class: 'stats__cell' }, t(`stats.tier.${s.tier}`)),
        h('td', { class: 'stats__cell' }, s.oftenFailed ? t('stats.yes') : t('stats.no')))));
  return h('table', { class: 'stats__table', id: 'stats-table' },
    h('caption', { class: 'stats__caption' }, t('stats.table.title')), head, body);
}

/**
 * @param {{easy:string[], normal:string[], hard:string[], failed:string[]}} buckets
 * @returns {HTMLElement}
 */
function renderBuckets(buckets) {
  return h('section', { class: 'stats__section', id: 'stats-buckets' },
    h('h2', { class: 'stats__heading' }, t('stats.buckets.title')),
    h('p', { class: 'stats__note' }, t('stats.bucket.note')),
    BUCKETS.map((name) =>
      h('div', { class: 'stats__bucket', 'data-bucket': name },
        h('h3', { class: 'stats__subheading' }, t(`trainer.bucket.${name}`)),
        buckets[name].length === 0
          ? h('p', { class: 'stats__empty-bucket' }, t('stats.bucket.empty'))
          : h('ul', { class: 'stats__bucket-list' },
            buckets[name].map((fn) => h('li', { class: 'stats__bucket-item' }, h('code', {}, fn)))))));
}

/**
 * Mount the page. Returns synchronously; the pool list is loaded asynchronously.
 * @param {HTMLElement} container
 * @param {{segments:string[], query:URLSearchParams, navigate:(hash:string)=>void}} ctx
 * @returns {() => void} unmount
 */
export function mount(container, ctx) {
  void ctx;
  let disposed = false;
  let destroyCharts = () => {};
  /** @type {string[]|null} */
  let poolIds = null;

  const draw = () => {
    destroyCharts();
    destroyCharts = () => {};
    clear(container);
    const records = loadRecords();
    const title = h('h1', { class: 'stats__title' }, t('stats.title'));
    if (records.length === 0) {
      container.appendChild(h('section', { class: 'stats', id: 'stats-page' },
        title, h('p', { class: 'stats__empty' }, t('stats.empty'))));
      return;
    }
    const cfg = getStatsConfig();
    const ids = poolIds ?? [...new Set(records.flatMap((r) => r.fns))];
    const summaries = summarizeByFn(records, cfg, ids);
    const chartsHost = h('div', { class: 'stats__charts', id: 'stats-charts' });
    const onClear = () => {
      const confirmFn = /** @type {any} */ (globalThis).confirm;
      if (typeof confirmFn === 'function' && !confirmFn(t('stats.clearConfirm'))) return;
      clearRecordsData();
      draw();
    };
    container.appendChild(h('section', { class: 'stats', id: 'stats-page' },
      title,
      h('section', { class: 'stats__section' },
        h('h2', { class: 'stats__heading' }, t('stats.overview.title')),
        renderOverview(overview(records))),
      h('section', { class: 'stats__section' },
        h('h2', { class: 'stats__heading' }, t('stats.charts.title')),
        chartsHost),
      h('section', { class: 'stats__section' }, renderTable(summaries)),
      renderBuckets(getBuckets(summaries)),
      h('p', { class: 'stats__actions', 'data-noprint': true },
        h('button', { type: 'button', class: 'stats__clear', id: 'stats-clear', onclick: onClear }, t('stats.clear')))));
    destroyCharts = renderCharts(chartsHost, records, summaries, cfg);
  };

  container.appendChild(h('p', { class: 'stats__loading' }, t('stats.loading')));
  import('../../pool/index.js')
    .then((pool) => pool.listEntries().map((e) => e.id))
    .catch(() => null)
    .then((ids) => {
      if (disposed) return;
      poolIds = ids;
      draw();
    });

  return () => {
    disposed = true;
    destroyCharts();
    destroyCharts = () => {};
    clear(container);
  };
}