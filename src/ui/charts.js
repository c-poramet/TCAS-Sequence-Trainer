/**
 * Statistics charts (Chart.js 4 global). Only informative charts, no decoration, default palette.
 * Without the `Chart` global nothing is drawn and `stats.noCharts` is shown instead.
 * @module ui/charts
 */
import { h, clear } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { timeSeries, histogram } from '../stats/analysis.js';

const MS_PER_SECOND = 1000;
const TIERS = ['easy', 'normal', 'hard', 'unrated'];
/** Chart.js' own default aspect ratio (width / height). */
const BASE_ASPECT = 2;
/** Number of horizontal-bar rows that fit in one base-height chart before it grows taller. */
const ROWS_PER_BASE_HEIGHT = 8;
/** One decimal for second labels. */
const LABEL_DECIMALS = 10;

/**
 * @param {number|null} ms
 * @returns {number|null} seconds
 */
function toSeconds(ms) {
  return ms === null ? null : ms / MS_PER_SECOND;
}

/**
 * @param {number} seconds
 * @returns {string} seconds rounded to one decimal
 */
function formatSeconds(seconds) {
  return String(Math.round(seconds * LABEL_DECIMALS) / LABEL_DECIMALS);
}

/**
 * Smooth, parameter-free grouping rule: about sqrt(n) groups of about sqrt(n) attempts.
 * @param {number} n number of items
 * @returns {number}
 */
function sqrtCount(n) {
  return Math.max(1, Math.ceil(Math.sqrt(n)));
}

/**
 * @param {number} rows
 * @returns {number} aspect ratio that gives each row of a horizontal chart enough height
 */
function rowsAspect(rows) {
  return BASE_ASPECT / Math.max(1, Math.ceil(rows / ROWS_PER_BASE_HEIGHT));
}

/**
 * (a) median time per function with the p25-p75 range as floating bar, coloured by tier.
 * @param {import('../stats/analysis.js').FnSummary[]} summaries
 * @returns {object|null} Chart.js config
 */
function timeConfig(summaries) {
  const rows = summaries.filter((s) => s.medianMs !== null).sort((a, b) => /** @type {number} */ (b.medianMs) - /** @type {number} */ (a.medianMs));
  if (rows.length === 0) return null;
  const datasets = TIERS.filter((tier) => rows.some((s) => s.tier === tier)).map((tier) => ({
    type: 'bar',
    label: t(`stats.tier.${tier}`),
    data: rows.map((s) => (s.tier === tier ? [toSeconds(s.p25Ms), toSeconds(s.p75Ms)] : null)),
    grouped: false,
    order: 2,
  }));
  datasets.push(/** @type {any} */ ({
    type: 'line',
    indexAxis: 'y',
    label: t('stats.chart.median'),
    data: rows.map((s) => toSeconds(s.medianMs)),
    showLine: false,
    order: 1,
  }));
  return {
    type: 'bar',
    data: { labels: rows.map((s) => s.fn), datasets },
    options: {
      indexAxis: 'y',
      aspectRatio: rowsAspect(rows.length),
      scales: { x: { beginAtZero: true, title: { display: true, text: t('stats.chart.seconds') } } },
    },
  };
}

/**
 * (b) correct vs wrong per function, stacked.
 * @param {import('../stats/analysis.js').FnSummary[]} summaries
 * @returns {object|null}
 */
function resultsConfig(summaries) {
  const rows = summaries.filter((s) => s.attempts > 0).sort((a, b) => b.attempts - a.attempts);
  if (rows.length === 0) return null;
  return {
    type: 'bar',
    data: {
      labels: rows.map((s) => s.fn),
      datasets: [
        { label: t('stats.chart.correct'), data: rows.map((s) => s.correct), stack: 'results' },
        { label: t('stats.chart.wrong'), data: rows.map((s) => s.attempts - s.correct), stack: 'results' },
      ],
    },
    options: {
      indexAxis: 'y',
      aspectRatio: rowsAspect(rows.length),
      scales: {
        x: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: t('stats.chart.count') } },
        y: { stacked: true },
      },
    },
  };
}

/**
 * (c) accuracy % and median time over time.
 * @param {import('../stats/analysis.js').AttemptRecord[]} records
 * @returns {object|null}
 */
function trendConfig(records) {
  if (records.length === 0) return null;
  const points = timeSeries(records, { size: sqrtCount(records.length) });
  let running = 0;
  const labels = points.map((p) => {
    running += p.attempts;
    return String(running);
  });
  return {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: t('stats.chart.accuracy'), data: points.map((p) => p.accuracy), yAxisID: 'y', spanGaps: true },
        { label: t('stats.chart.medianSeconds'), data: points.map((p) => toSeconds(p.medianMs)), yAxisID: 'y1', spanGaps: true },
      ],
    },
    options: {
      scales: {
        x: { title: { display: true, text: t('stats.chart.attempts') } },
        y: { position: 'left', min: 0, max: 100, title: { display: true, text: t('stats.chart.accuracy') } },
        y1: { position: 'right', beginAtZero: true, grid: { drawOnChartArea: false }, title: { display: true, text: t('stats.chart.medianSeconds') } },
      },
    },
  };
}

/**
 * (d) distribution of answer times (correct attempts).
 * @param {import('../stats/analysis.js').AttemptRecord[]} records
 * @returns {object|null}
 */
function histogramConfig(records) {
  const seconds = records.filter((r) => r.ok).map((r) => r.ms / MS_PER_SECOND);
  if (seconds.length === 0) return null;
  const bins = histogram(seconds, sqrtCount(seconds.length));
  return {
    type: 'bar',
    data: {
      labels: bins.map((b) => t('stats.chart.binLabel', { from: formatSeconds(b.from), to: formatSeconds(b.to) })),
      datasets: [{ label: t('stats.chart.count'), data: bins.map((b) => b.count) }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: t('stats.chart.seconds') } },
        y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: t('stats.chart.count') } },
      },
    },
  };
}

/**
 * Draw the four charts into `container`.
 * @param {HTMLElement} container
 * @param {import('../stats/analysis.js').AttemptRecord[]} records
 * @param {import('../stats/analysis.js').FnSummary[]} summaries
 * @param {{minAttempts:number, fastRatio:number, slowRatio:number, failedRate:number}} cfg stats config (accepted for API symmetry; the charts need no threshold themselves)
 * @returns {() => void} destroy: tears down every chart and empties the container
 */
export function renderCharts(container, records, summaries, cfg) {
  void cfg;
  clear(container);
  const ChartLib = /** @type {any} */ (globalThis).Chart;
  if (typeof ChartLib !== 'function') {
    container.appendChild(h('p', { class: 'stats__nocharts' }, t('stats.noCharts')));
    return () => {};
  }
  /** @type {{destroy:()=>void}[]} */
  const charts = [];
  /**
   * @param {string} name
   * @param {string} captionKey
   * @param {object|null} config
   */
  const add = (name, captionKey, config) => {
    if (!config) return;
    const canvas = h('canvas', { class: 'chart__canvas' });
    container.appendChild(
      h('figure', { class: `chart chart--${name}`, 'data-chart': name },
        canvas,
        h('figcaption', { class: 'chart__caption' }, t(captionKey))),
    );
    try {
      charts.push(new ChartLib(canvas, config));
    } catch {
      /* a failing chart must not take the page down */
    }
  };
  add('time', 'stats.chart.time.caption', timeConfig(summaries));
  add('results', 'stats.chart.results.caption', resultsConfig(summaries));
  add('trend', 'stats.chart.trend.caption', trendConfig(records));
  add('histogram', 'stats.chart.hist.caption', histogramConfig(records));
  return () => {
    for (const chart of charts) chart.destroy();
    charts.length = 0;
    clear(container);
  };
}