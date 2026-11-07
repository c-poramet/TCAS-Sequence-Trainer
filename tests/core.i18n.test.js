import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStorage, setStorage } from '../src/core/storage.js';
import { SCHEMA } from '../src/core/schema.js';
import { getSetting } from '../src/core/settings.js';
import {
  getLang, hasKey, missingKeys, onLangChange, registerStrings, setLang, t,
} from '../src/core/i18n.js';
import '../src/i18n/core.js';

registerStrings('en', {
  'test.hello': 'Hello {name}, you have {n} items', 'test.both': 'English both', 'test.onlyEn': 'Only English',
  'test.math': 'Solve $x^{2}$ for {name}',
});
registerStrings('th', { 'test.hello': 'สวัสดี {name} คุณมี {n} รายการ', 'test.both': 'ไทย', 'test.onlyTh': 'เฉพาะไทย' });

beforeEach(() => {
  setStorage(createMemoryStorage());
  setLang('en');
});

test('t() translates, interpolates and leaves unknown placeholders intact', () => {
  assert.equal(t('test.hello', { name: 'Ann', n: 3 }), 'Hello Ann, you have 3 items');
  assert.equal(t('test.hello', { name: 'Ann' }), 'Hello Ann, you have {n} items');
  assert.equal(t('test.hello'), 'Hello {name}, you have {n} items');
  assert.equal(t('test.math', { name: 'Bo' }), 'Solve $x^{2}$ for Bo');
  setLang('th');
  assert.equal(t('test.hello', { name: 'แอน', n: 0 }), 'สวัสดี แอน คุณมี 0 รายการ');
});

test('t() falls back to English, then to the key (warning once)', () => {
  setLang('th');
  assert.equal(t('test.onlyEn'), 'Only English');
  const warnings = [];
  const original = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    assert.equal(t('test.nowhere'), 'test.nowhere');
    assert.equal(t('test.nowhere'), 'test.nowhere');
  } finally {
    console.warn = original;
  }
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /test\.nowhere/);
});

test('hasKey and missingKeys report translation gaps', () => {
  assert.ok(hasKey('en', 'test.both'));
  assert.ok(!hasKey('th', 'test.onlyEn'));
  assert.ok(!hasKey('en', 'test.onlyTh'));
  const gaps = missingKeys();
  assert.ok(gaps.th.includes('test.onlyEn'));
  assert.ok(gaps.en.includes('test.onlyTh'));
  assert.ok(!gaps.th.includes('test.both'));
  assert.deepEqual(gaps.th, [...gaps.th].sort());
});

test('setLang persists, notifies listeners once per change, and can unsubscribe', () => {
  const seen = [];
  const off = onLangChange((lang) => seen.push(lang));
  setLang('th');
  setLang('th');
  assert.equal(getLang(), 'th');
  assert.equal(getSetting('lang'), 'th');
  setLang('en');
  assert.deepEqual(seen, ['th', 'en']);
  off();
  setLang('th');
  assert.deepEqual(seen, ['th', 'en']);
  assert.throws(() => setLang('fr'), RangeError);
  assert.throws(() => registerStrings('fr', {}), RangeError);
});

test('core strings: every schema key has label and help in both languages, no core gaps', () => {
  for (const e of SCHEMA) {
    for (const lang of ['en', 'th']) {
      assert.ok(hasKey(lang, `settings.${e.key}.label`), `${lang} ${e.key} label`);
      assert.ok(hasKey(lang, `settings.${e.key}.help`), `${lang} ${e.key} help`);
      for (const opt of e.options ?? []) assert.ok(hasKey(lang, `settings.${e.key}.option.${opt}`), `${lang} ${e.key} ${opt}`);
    }
    assert.ok(hasKey('en', `settings.group.${e.group}`) && hasKey('th', `settings.group.${e.group}`));
  }
  const gaps = missingKeys();
  const ours = (k) => k.startsWith('core.') || k.startsWith('settings.');
  assert.deepEqual(gaps.en.filter(ours), []);
  assert.deepEqual(gaps.th.filter(ours), []);
  assert.equal(t('core.choiceLabels').split(',').length, 8);
  setLang('th');
  assert.equal(t('core.choiceLabels').split(',').length, 8);
  assert.equal(t('core.solution.answer', { answer: -12 }), 'คำตอบ: -12');
});

test('core strings use Arabic digits only', () => {
  setLang('th');
  for (const e of SCHEMA) {
    for (const part of ['label', 'help']) assert.doesNotMatch(t(`settings.${e.key}.${part}`), /[๐-๙]/);
  }
});
