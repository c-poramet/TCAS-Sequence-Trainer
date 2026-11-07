import { h, renderMath } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { listEntries, POOL_VERSION } from '../../pool/index.js';
import { validateEntry } from '../../pool/validate.js';
import { createRng } from '../../core/rng.js';

const TIER_OPTIONS = [1, 2, 3, 4];

function label(key, params) {
  return t(key, params);
}

function sampleFor(entry) {
  return entry.sampleParams(createRng(`dev:${entry.id}`), { cap: 2500, role: 'solo' });
}

function buildCard(entry) {
  const params = sampleFor(entry);
  const validation = validateEntry(entry, { samples: 12, seed: 'dev' });
  const result = h(
    'p',
    { class: ['dev__validation', validation.ok ? 'dev__validation--ok' : 'dev__validation--error'] },
    validation.ok
      ? label('ui.dev.validationPassed')
      : label('ui.dev.validationFailed', { count: validation.errors.length }),
  );
  if (!validation.ok) result.title = validation.errors.join('\n');

  const formula = h('div', { class: 'dev__formula' }, `$$${entry.latex(params)}$$`);
  const details = h(
    'details',
    { class: 'dev__entry' },
    h(
      'summary',
      { class: 'dev__entry-summary' },
      h('code', { class: 'dev__entry-id' }, entry.id),
      h('span', { class: 'dev__entry-tier' }, label('ui.dev.tier', { tier: entry.tier })),
    ),
    h(
      'div',
      { class: 'dev__entry-body' },
      h(
        'dl',
        { class: 'dev__meta' },
        h('dt', {}, label('ui.dev.version')),
        h('dd', {}, String(entry.since)),
        h('dt', {}, label('ui.dev.arity')),
        h('dd', {}, String(entry.arity)),
        h('dt', {}, label('ui.dev.maxIndex')),
        h('dd', {}, String(entry.maxIndex)),
        h('dt', {}, label('ui.dev.composable')),
        h('dd', {}, entry.composable ? label('ui.common.yes') : label('ui.common.no')),
      ),
      h('p', { class: 'dev__sample-label' }, label('ui.dev.sample')),
      formula,
      h('p', { class: 'dev__definition' }, entry.definition(params).join(' · ')),
      result,
    ),
  );
  renderMath(formula);
  return details;
}

export function mount(container) {
  const entries = listEntries();
  const search = h('input', {
    class: 'dev__search',
    type: 'search',
    placeholder: label('ui.dev.searchPlaceholder'),
    'aria-label': label('ui.dev.search'),
  });
  const tier = h(
    'select',
    { class: 'dev__filter', 'aria-label': label('ui.dev.tierFilter') },
    h('option', { value: 'all' }, label('ui.dev.allTiers')),
    ...TIER_OPTIONS.map((value) => h('option', { value: String(value) }, label('ui.dev.tier', { tier: value }))),
  );
  const categories = [...new Set(entries.map((entry) => entry.id.split('.')[0]))].sort();
  const category = h(
    'select',
    { class: 'dev__filter', 'aria-label': label('ui.dev.categoryFilter') },
    h('option', { value: 'all' }, label('ui.dev.allCategories')),
    ...categories.map((value) => h('option', { value }, value)),
  );
  const composable = h(
    'select',
    { class: 'dev__filter', 'aria-label': label('ui.dev.composableFilter') },
    h('option', { value: 'all' }, label('ui.dev.allComposability')),
    h('option', { value: 'yes' }, label('ui.dev.composableOnly')),
    h('option', { value: 'no' }, label('ui.dev.nonComposableOnly')),
  );
  const list = h('div', { class: 'dev__entries' });
  const count = h('p', { class: 'dev__count' });

  const update = () => {
    const query = search.value.trim().toLowerCase();
    const selectedTier = tier.value;
    const selectedCategory = category.value;
    const selectedComposable = composable.value;
    const visible = entries.filter((entry) =>
      (!query || entry.id.toLowerCase().includes(query)) &&
      (selectedTier === 'all' || String(entry.tier) === selectedTier) &&
      (selectedCategory === 'all' || entry.id.startsWith(`${selectedCategory}.`)) &&
      (selectedComposable === 'all' ||
        (selectedComposable === 'yes' ? entry.composable : !entry.composable)));
    list.replaceChildren(...visible.map(buildCard));
    count.textContent = label('ui.dev.count', { shown: visible.length, total: entries.length });
  };
  search.addEventListener('input', update);
  tier.addEventListener('change', update);
  category.addEventListener('change', update);
  composable.addEventListener('change', update);

  update();
  container.append(
    h(
      'section',
      { class: 'dev' },
      h('h1', {}, label('ui.dev.title')),
      h('p', { class: 'dev__lead' }, label('ui.dev.lead')),
      h('p', { class: 'dev__pool-version' }, label('ui.dev.poolVersion', { version: POOL_VERSION })),
      h(
        'div',
        { class: 'dev__filters' },
        search,
        tier,
        category,
        composable,
      ),
      count,
      list,
    ),
  );
  return () => {};
}
