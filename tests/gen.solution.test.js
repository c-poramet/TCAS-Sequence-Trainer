import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/gen/engine.js';
import { hasKey } from '../src/core/i18n.js';
import '../src/i18n/gen.js';
import { mockPool, baseSettings, MOCK_POOL_VERSION } from './fixtures/mockPool.js';

const engine = createEngine({ pool: mockPool });
const allSteps = (sol) => sol.sections.flatMap((s) => s.steps);

async function sample() {
  const out = [];
  for (const [mixedChance, hardRatio] of [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0.5]]) {
    out.push(...(await engine.generateSet({ ...baseSettings, seed: `sol${mixedChance}${hardRatio}`, count: 80, mixedChance, hardRatio, poolVersion: MOCK_POOL_VERSION })));
  }
  return out;
}

test('solutions are non-empty and the answer matches', async () => {
  for (const q of await sample()) {
    const sol = engine.buildSolution(q);
    assert.equal(sol.answer, q.answer);
    assert.ok(sol.sections.length >= 3);
    assert.ok(allSteps(sol).length > 0);
    for (const s of sol.sections) {
      assert.ok(s.titleKey.startsWith('gen.sec.'));
      assert.ok(s.steps.length > 0);
      for (const st of s.steps) assert.equal(typeof st.key, 'string');
    }
  }
});

test('every gen.* key is registered in en AND th', async () => {
  const keys = new Set(['gen.which.odd', 'gen.which.even', 'gen.which.all']);
  for (const q of await sample()) {
    const sol = engine.buildSolution(q);
    for (const s of sol.sections) {
      keys.add(s.titleKey);
      for (const st of s.steps) if (st.key.startsWith('gen.')) keys.add(st.key);
    }
  }
  assert.ok(keys.size >= 15);
  for (const k of keys) {
    assert.ok(hasKey('en', k), `en missing ${k}`);
    assert.ok(hasKey('th', k), `th missing ${k}`);
  }
});

test('structure: sections per rule, which param, composition steps', async () => {
  for (const q of await sample()) {
    const sol = engine.buildSolution(q);
    const ruleSecs = sol.sections.filter((s) => s.titleKey === 'gen.sec.rule');
    assert.equal(ruleSecs.length, q.descriptor.rules.length);
    const whichs = ruleSecs.map((s) => s.titleParams.which);
    assert.deepEqual(whichs, q.mixed ? ['odd', 'even'] : ['all']);
    assert.equal(sol.sections[0].titleKey, 'gen.sec.given');
    assert.equal(sol.sections.at(-1).titleKey, 'gen.sec.answer');
    q.descriptor.rules.forEach((rule, i) => {
      const keys = ruleSecs[i].steps.map((s) => s.key);
      assert.equal(keys.includes('gen.step.innerTable'), Boolean(rule.o));
      assert.equal(keys.includes('gen.step.combined'), Boolean(rule.o));
    });
  }
});

test('given section shows the question mark; answer section picks the rule by parity', () => {
  const q = engine.rebuildQuestion('Q1:N4:mock.lin(3,0)|mock.lin(5,1)'); // missing n=4 (even) -> 21
  const sol = engine.buildSolution(q);
  assert.deepEqual(sol.sections[0].steps[0].math, ['3,\\ 11,\\ 9,\\ ?,\\ 15,\\ 31']);
  const fin = sol.sections.at(-1).steps;
  assert.equal(fin[0].key, 'gen.step.ruleEven');
  assert.equal(fin.at(-1).params.answer, 21);
  assert.ok(fin[1].math[0].endsWith('=21'));
});

test('solve receives only visible points; hidden only for the owning rule', () => {
  const calls = [];
  const spy = {
    getEntry: (id) => {
      const e = mockPool.getEntry(id);
      return { ...e, solve: (p, ctx) => (calls.push(ctx), e.solve(p, ctx)) };
    },
    listEntries: mockPool.listEntries,
  };
  const eng = createEngine({ pool: spy });
  eng.buildSolution(eng.rebuildQuestion('Q1:N4:mock.lin(3,0)|mock.lin(5,1)'));
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].points, [{ n: 1, value: 3 }, { n: 3, value: 9 }, { n: 5, value: 15 }]);
  assert.equal(calls[0].hidden, null);
  assert.deepEqual(calls[1].points, [{ n: 2, value: 11 }, { n: 6, value: 31 }]);
  assert.equal(calls[1].hidden, 4);
});

test('composition: outer.solve gets points (g(n), value)', () => {
  const calls = [];
  const spy = {
    getEntry: (id) => {
      const e = mockPool.getEntry(id);
      return id === 'mock.quad' ? { ...e, solve: (p, ctx) => (calls.push(ctx), e.solve(p, ctx)) } : e;
    },
    listEntries: mockPool.listEntries,
  };
  const eng = createEngine({ pool: spy });
  const q = eng.rebuildQuestion('Q1:H3:mock.quad(1,0,0)@mock.lin(2,1)'); // g = 2n+1, a = g^2, missing n=3
  const sol = eng.buildSolution(q);
  assert.deepEqual(calls[0].points, [{ n: 3, value: 9 }, { n: 5, value: 25 }, { n: 9, value: 81 }, { n: 11, value: 121 }, { n: 13, value: 169 }]);
  assert.equal(calls[0].hidden, 7);
  const ruleSteps = sol.sections[1].steps;
  assert.ok(ruleSteps.find((s) => s.key === 'gen.step.combined').math[0].startsWith('a_n=1'));
  const fin = sol.sections.at(-1).steps.map((s) => s.key);
  assert.deepEqual(fin, ['gen.step.ruleAll', 'gen.step.substituteInner', 'gen.step.substituteOuter', 'gen.step.conclusion']);
});

test('combined formula: no double parentheses, parentheses guaranteed', () => {
  const q = createEngine({ pool: mockPool }).rebuildQuestion('Q1:H3:mock.quad(1,0,0)@mock.lin(2,1)');
  const combined = (pool) => createEngine({ pool }).buildSolution(q).sections[1].steps.find((s) => s.key === 'gen.step.combined').math[0];
  assert.ok(!combined(mockPool).includes('\\left(\\left('), 'entry wraps itself');
  // an entry that never wraps its argument: the assembler must add the parentheses
  const noWrap = {
    getEntry: (id) => {
      const e = mockPool.getEntry(id);
      return id === 'mock.quad' ? { ...e, latex: (p, arg = 'n') => `${p[0]}${arg}^2` } : e;
    },
    listEntries: mockPool.listEntries,
  };
  assert.equal(combined(noWrap), 'a_n=1\\left(2\\cdot n+1\\right)^2');
});
