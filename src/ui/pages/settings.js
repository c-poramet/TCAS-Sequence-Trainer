/**
 * Settings page: a form generated from SCHEMA. Semantic markup only, no styling.
 * Route: #/settings
 * @module ui/pages/settings
 */
import { DYNAMIC_MAX, SCHEMA, isNullable } from '../../core/schema.js';
import { getSetting, onSettingsChange, resetSettings, setSetting } from '../../core/settings.js';
import { setLang, t } from '../../core/i18n.js';
import { downloadExport, importData } from '../../core/dataIO.js';
import { clear, h } from '../../core/dom.js';
import '../../i18n/core.js';

const STEP_INTEGER = '1';
const STEP_FLOAT = 'any';
const KEY_ATTR = 'data-setting-key';
const ACTION_ATTR = 'data-action';
const BAD_IMPORT = 'core.error.badImport';
const IMPORT_MODES = ['merge', 'replace'];

/**
 * @param {string} key
 * @returns {string} DOM id fragment for a settings key
 */
function fieldId(key) {
  return `settings-${key.replace(/\./g, '-')}`;
}

/**
 * Effective maximum of a numeric entry (gen.count follows gen.maxSetSize).
 * @param {import('../../core/schema.js').SchemaEntry} entry
 * @returns {number|undefined}
 */
function maxFor(entry) {
  const dynamicKey = DYNAMIC_MAX[entry.key];
  if (!dynamicKey) return entry.max;
  return Math.min(entry.max ?? Infinity, getSetting(dynamicKey));
}

/**
 * @typedef {{entry:import('../../core/schema.js').SchemaEntry, nodes:HTMLElement[]}} Control
 */

/**
 * Build the control element(s) for one entry.
 * @param {import('../../core/schema.js').SchemaEntry} entry
 * @param {string} helpId
 * @param {string} labelId
 * @returns {{node:HTMLElement, nodes:HTMLElement[]}}
 */
function buildControl(entry, helpId, labelId) {
  const id = fieldId(entry.key);
  const common = { id, class: 'settings__input', [KEY_ATTR]: entry.key, 'aria-describedby': helpId };
  switch (entry.type) {
    case 'int':
    case 'float': {
      const node = h('input', {
        ...common,
        type: 'number',
        min: entry.min,
        max: maxFor(entry),
        step: entry.type === 'int' ? STEP_INTEGER : STEP_FLOAT,
        placeholder: isNullable(entry) ? t('core.latest') : null,
      });
      return { node, nodes: [node] };
    }
    case 'bool': {
      const node = h('input', { ...common, type: 'checkbox' });
      return { node, nodes: [node] };
    }
    case 'enum': {
      const node = h('select', common,
        entry.options.map((opt) => h('option', { value: opt }, t(`settings.${entry.key}.option.${opt}`))));
      return { node, nodes: [node] };
    }
    case 'enumList': {
      const boxes = entry.options.map((opt) => h('input', {
        type: 'checkbox',
        class: 'settings__input',
        value: opt,
        id: `${id}-${opt}`,
        [KEY_ATTR]: entry.key,
        'aria-describedby': helpId,
      }));
      const node = h('div', { class: 'settings__options', role: 'group', 'aria-labelledby': labelId },
        entry.options.map((opt, index) => h('label', { class: 'settings__option', for: `${id}-${opt}` },
          boxes[index], t(`settings.${entry.key}.option.${opt}`))));
      return { node, nodes: boxes };
    }
    case 'intList': {
      const node = h('input', { ...common, type: 'text', inputmode: 'numeric' });
      return { node, nodes: [node] };
    }
    default: {
      const node = h('input', { ...common, type: 'text' });
      return { node, nodes: [node] };
    }
  }
}

/**
 * Write a stored value into its control.
 * @param {Control} control
 * @param {any} value
 * @returns {void}
 */
function setControl(control, value) {
  const { entry, nodes } = control;
  const el = /** @type {any} */ (nodes[0]);
  switch (entry.type) {
    case 'int':
    case 'float': {
      el.value = value === null ? '' : String(value);
      const max = maxFor(entry);
      if (max !== undefined) el.setAttribute('max', String(max));
      break;
    }
    case 'bool':
      el.checked = value === true;
      break;
    case 'enumList':
      for (const box of nodes) /** @type {any} */ (box).checked = value.includes(/** @type {any} */ (box).value);
      break;
    case 'intList':
      el.value = value.join(', ');
      break;
    default:
      el.value = String(value);
  }
}

/**
 * Read the raw value from a control.
 * @param {Control} control
 * @returns {any}
 */
function readControl(control) {
  const { entry, nodes } = control;
  const el = /** @type {any} */ (nodes[0]);
  switch (entry.type) {
    case 'bool':
      return el.checked;
    case 'enumList':
      return nodes.filter((box) => /** @type {any} */ (box).checked).map((box) => /** @type {any} */ (box).value);
    default:
      return el.value;
  }
}

/**
 * Did the stored value differ from what the user entered (clamped / rejected)?
 * @param {import('../../core/schema.js').SchemaEntry} entry
 * @param {any} raw
 * @param {any} stored
 * @returns {boolean}
 */
function inputWasAdjusted(entry, raw, stored) {
  switch (entry.type) {
    case 'int':
    case 'float':
      return (raw === '' ? null : Number(raw)) !== stored;
    case 'enumList':
      return JSON.stringify(raw) !== JSON.stringify(stored);
    case 'intList': {
      const nums = String(raw).split(',').map((s) => s.trim()).filter((s) => s !== '').map(Number);
      if (nums.length === 0 || nums.some((n) => !Number.isFinite(n))) return true;
      const normalized = Array.from(new Set(nums)).sort((a, b) => a - b);
      return JSON.stringify(normalized) !== JSON.stringify(stored);
    }
    default:
      return raw !== stored;
  }
}

/**
 * Mount the settings page.
 * @param {HTMLElement} container
 * @param {{segments:string[], query:URLSearchParams, navigate:(hash:string)=>void}} ctx
 * @returns {() => void} unmount
 */
export function mount(container, ctx) {
  void ctx;
  /** @type {Map<string, Control>} */
  const controls = new Map();
  let unmounted = false;

  const status = h('p', { class: 'settings__status', id: 'settings-status', role: 'status', 'aria-live': 'polite' });
  /** @param {string} message */
  const say = (message) => {
    status.textContent = message;
  };

  /** @type {Map<string, HTMLElement[]>} */
  const groups = new Map();
  for (const entry of SCHEMA) {
    const id = fieldId(entry.key);
    const helpId = `${id}-help`;
    const labelId = `${id}-label`;
    const { node, nodes } = buildControl(entry, helpId, labelId);
    controls.set(entry.key, { entry, nodes });
    const labelText = t(`settings.${entry.key}.label`);
    const label = entry.type === 'enumList'
      ? h('span', { class: 'settings__label', id: labelId }, labelText)
      : h('label', { class: 'settings__label', id: labelId, for: id }, labelText);
    const field = h('div', { class: 'settings__field', [KEY_ATTR]: entry.key },
      label, node, h('p', { class: 'settings__help', id: helpId }, t(`settings.${entry.key}.help`)));
    if (!groups.has(entry.group)) groups.set(entry.group, []);
    groups.get(entry.group)?.push(field);
  }

  const importFileId = 'settings-import-file';
  const importModeId = 'settings-import-mode';
  const modeSelect = h('select', { id: importModeId, class: 'settings__input', 'data-import-mode': true },
    IMPORT_MODES.map((mode) => h('option', { value: mode }, t(`core.import.mode.${mode}`))));
  const form = h('form', { class: 'settings__form', id: 'settings-form', novalidate: true },
    Array.from(groups, ([group, fields]) => h('fieldset', { class: 'settings__group', 'data-group': group },
      h('legend', { class: 'settings__legend' }, t(`settings.group.${group}`)), fields)));
  const tools = h('div', { class: 'settings__tools' },
    h('button', { type: 'button', class: 'settings__button', [ACTION_ATTR]: 'reset' }, t('core.button.reset')),
    h('button', { type: 'button', class: 'settings__button', [ACTION_ATTR]: 'export' }, t('core.button.export')),
    h('div', { class: 'settings__import' },
      h('label', { for: importFileId }, t('core.button.import')),
      h('input', { type: 'file', id: importFileId, accept: 'application/json,.json', [ACTION_ATTR]: 'import-file' }),
      h('label', { for: importModeId }, t('core.import.mode.label')),
      modeSelect));
  const root = h('div', { class: 'settings', id: 'settings-page', 'data-noprint': true },
    h('h1', { class: 'settings__title' }, t('settings.title')), form, status, tools);

  const refreshAll = () => {
    for (const control of controls.values()) setControl(control, getSetting(control.entry.key));
  };

  /** @param {HTMLInputElement} fileInput */
  const handleImport = (fileInput) => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const mode = /** @type {'merge'|'replace'} */ (/** @type {any} */ (modeSelect).value);
    const confirmFn = globalThis.confirm;
    if (mode === 'replace' && typeof confirmFn === 'function' && !confirmFn(t('core.confirm.replace'))) {
      fileInput.value = '';
      return;
    }
    file.text().then((text) => {
      if (unmounted) return;
      try {
        const result = importData(text, { mode });
        refreshAll();
        say(t('core.import.done', result));
      } catch (err) {
        say(err instanceof Error && err.message === BAD_IMPORT ? t(BAD_IMPORT) : t('core.error.storage'));
      }
    }).catch(() => {
      if (!unmounted) say(t(BAD_IMPORT));
    }).finally(() => {
      fileInput.value = '';
    });
  };

  /** @param {Event} ev */
  const onChange = (ev) => {
    const target = /** @type {HTMLElement} */ (ev.target);
    if (!target || typeof target.getAttribute !== 'function') return;
    if (target.getAttribute(ACTION_ATTR) === 'import-file') {
      handleImport(/** @type {HTMLInputElement} */ (target));
      return;
    }
    const key = target.getAttribute(KEY_ATTR);
    const control = key ? controls.get(key) : undefined;
    if (!key || !control) return;
    const raw = readControl(control);
    let stored;
    if (key === 'lang') {
      setLang(raw);
      stored = getSetting('lang');
    } else {
      stored = setSetting(key, raw);
    }
    const adjusted = inputWasAdjusted(control.entry, raw, stored);
    refreshAll();
    say(adjusted ? t('core.error.invalid') : '');
  };

  /** @param {Event} ev */
  const onClick = (ev) => {
    const target = /** @type {HTMLElement|null} */ (/** @type {HTMLElement} */ (ev.target)?.closest?.(`[${ACTION_ATTR}]`));
    const action = target?.getAttribute(ACTION_ATTR);
    if (action === 'reset') {
      resetSettings();
      refreshAll();
      say(t('core.reset.done'));
    } else if (action === 'export') {
      downloadExport();
    }
  };

  /** @param {Event} ev */
  const onSubmit = (ev) => ev.preventDefault();

  refreshAll();
  root.addEventListener('change', onChange);
  root.addEventListener('click', onClick);
  form.addEventListener('submit', onSubmit);
  const unsubscribe = onSettingsChange(() => {
    if (!unmounted) refreshAll();
  });
  clear(container);
  container.appendChild(root);

  return () => {
    unmounted = true;
    root.removeEventListener('change', onChange);
    root.removeEventListener('click', onClick);
    form.removeEventListener('submit', onSubmit);
    unsubscribe();
    clear(container);
  };
}
