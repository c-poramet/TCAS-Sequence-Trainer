import { createRng } from '../core/rng.js';
import { hasKey } from '../core/i18n.js';

const ID = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;
const roles = ['solo', 'outer', 'inner'];
const error = (entry, p, message) => `${entry.id} ${JSON.stringify(p)}: ${message}`;

/**
 * Validate a pool entry against the shared contract.
 * @param {object} entry
 * @param {{samples?:number,seed?:string}} options
 * @returns {{ok:boolean,errors:string[]}}
 */
export function validateEntry(entry, { samples = 200, seed = 'validate' } = {}) {
  const errors = [];
  if (!entry || typeof entry !== 'object') return { ok: false, errors: ['entry: not an object'] };
  for (const key of ['id', 'since', 'tier', 'composable', 'arity', 'maxIndex', 'sampleParams', 'evaluate', 'latex', 'definition', 'solve']) {
    if (!(key in entry)) errors.push(`${entry.id || 'entry'}: missing ${key}`);
  }
  if (!ID.test(entry.id || '')) errors.push(`${entry.id || 'entry'}: invalid id`);
  for (const role of roles) {
    const a = entry.sampleParams(createRng(`${seed}${entry.id}`), { cap: 2500, role });
    const b = entry.sampleParams(createRng(`${seed}${entry.id}`), { cap: 2500, role });
    if (!Array.isArray(a) || a.length !== entry.arity || !a.every(Number.isInteger)) errors.push(`${entry.id}: invalid sampleParams ${role}`);
    if (JSON.stringify(a) !== JSON.stringify(b)) errors.push(`${entry.id}: nondeterministic sampleParams ${role}`);
  }
  for (let i = 0; i < samples; i++) {
    const p = entry.sampleParams(createRng(`${seed}${entry.id}/${i}`), { cap: 2500, role: 'solo' });
    try {
      const vals = [];
      for (let n = 1; n <= 6; n++) {
        const a = entry.evaluate(p, n);
        const b = entry.evaluate(p, n);
        if (a !== b || (a !== null && !Number.isSafeInteger(a))) errors.push(error(entry, p, 'evaluate is impure or unsafe'));
        vals.push(a);
      }
      if (entry.evaluate(p, 0) !== null || entry.evaluate(p, entry.maxIndex + 1) !== null) errors.push(error(entry, p, 'domain guard failed'));
      const latex = entry.latex(p);
      if (typeof latex !== 'string' || !latex) errors.push(error(entry, p, 'latex empty'));
      if (typeof entry.latex(p, '(n+1)') !== 'string' || !entry.latex(p, '(n+1)').length) errors.push(error(entry, p, 'latex arg failed'));
      const def = entry.definition(p);
      if (!Array.isArray(def) || !def.length || !def.every((x) => typeof x === 'string' && x.length)) errors.push(error(entry, p, 'definition invalid'));
      const hidden = (i % 6) + 1;
      const points = vals.map((value, j) => ({ n: j + 1, value })).filter((x) => x.n !== hidden && x.value !== null);
      const steps = entry.solve(p, { points, hidden });
      if (!Array.isArray(steps) || steps.length < 3 || steps.length > 6) errors.push(error(entry, p, 'solve step count'));
      for (const step of steps || []) {
        if (!step.key || !step.key.startsWith(`pool.${entry.id}.`) || !hasKey('en', step.key) || !hasKey('th', step.key)) errors.push(error(entry, p, `bad solve key ${step.key}`));
        if (step.params && !Object.values(step.params).every((v) => typeof v === 'string' || typeof v === 'number')) errors.push(error(entry, p, 'bad solve params'));
        if (step.math && (!Array.isArray(step.math) || !step.math.every((v) => typeof v === 'string' && v.length))) errors.push(error(entry, p, 'bad solve math'));
      }
    } catch (e) {
      errors.push(error(entry, p, `threw ${e.message}`));
    }
  }
  return { ok: errors.length === 0, errors };
}
