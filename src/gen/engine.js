/**
 * Question engine: turns a pool of sequence functions into questions and
 * step-by-step solutions. Pure and DOM-free; the pool is injected so the
 * engine can be tested against a mock pool.
 * @module gen/engine
 */
import { createRng } from '../core/rng.js';
import { ALGO_VERSION, decodeQuestionId, decodeSetId, encodeQuestionId } from '../core/ids.js';
import { t } from '../core/i18n.js';

/** @typedef {{f:string, p:number[]}} Leaf */
/** @typedef {Leaf | {o:Leaf, i:Leaf}} Expr */
/** @typedef {{v:number, mode:'N'|'H', missing:number, rules:Expr[]}} Descriptor */
/** @typedef {{id:string, descriptor:Descriptor, terms:number[], missing:number, answer:number, fns:string[], mode:'N'|'H', mixed:boolean}} Question */
/** @typedef {{key:string, params?:Record<string,string|number>, math?:string[]}} Step */
/** @typedef {{titleKey:string, titleParams?:Record<string,string|number>, steps:Step[]}} Section */
/** @typedef {{answer:number, sections:Section[]}} Solution */
/** @typedef {Object} GenCfg
 * @property {number} hardRatio @property {number} mixedChance @property {number} cap
 * @property {number} maxAttempts @property {number} poolVersion
 * @property {number[]} normalTiers @property {number[]} composeTiers @property {number[]} rareTiers
 * @property {number} composeChance @property {number} minDistinct @property {boolean} allowNegative */
/** @typedef {GenCfg & {seed:string, count:number}} GenSettings */
/** @typedef {{getEntry:(id:string)=>Object|undefined|null, listEntries:(o?:Object)=>Object[]}} PoolApi */

/** Raised when no valid question can be generated. */
export class GenerationError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'GenerationError';
  }
}

/** Raised when a question ID / descriptor cannot be rebuilt. */
export class RebuildError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'RebuildError';
  }
}

/** Number of terms in every question (structural, fixed by the exam format). */
const TERM_COUNT = 6;
/** Default number of questions generated between event-loop yields (contract). */
const DEFAULT_CHUNK = 50;
const MODE_NORMAL = 'N';
const MODE_HARD = 'H';
const ROLE_SOLO = 'solo';
const ROLE_OUTER = 'outer';
const ROLE_INNER = 'inner';

// ---------------------------------------------------------------- pure helpers

/**
 * @param {Expr} expr
 * @returns {boolean} true when expr is a composition {o,i}
 */
function isComposition(expr) {
  return expr.o !== undefined && expr.i !== undefined;
}

/**
 * @param {Expr} expr
 * @returns {Leaf[]} leaves of the expression (outer first)
 */
function leavesOf(expr) {
  return isComposition(expr) ? [expr.o, expr.i] : [expr];
}

/**
 * @param {Leaf} leaf
 * @returns {string} canonical text of a leaf
 */
function leafKey(leaf) {
  return `${leaf.f}(${leaf.p.join(',')})`;
}

/**
 * @param {Expr} expr
 * @returns {string} canonical text of an expression
 */
function exprKey(expr) {
  return isComposition(expr) ? `${leafKey(expr.o)}@${leafKey(expr.i)}` : leafKey(expr);
}

/**
 * Index of the rule that governs position n.
 * @param {number} n position (1-based)
 * @param {number} ruleCount 1 or 2
 * @returns {number} 0 for the odd-position/only rule, 1 for the even-position rule
 */
function ruleIndexOf(n, ruleCount) {
  return ruleCount === 2 && n % 2 === 0 ? 1 : 0;
}

/**
 * @param {number[]} terms
 * @param {GenCfg} cfg
 * @returns {boolean} whether the terms satisfy every acceptance rule
 */
function acceptable(terms, cfg) {
  if (terms.length !== TERM_COUNT) return false;
  for (const v of terms) {
    if (!Number.isSafeInteger(v) || Math.abs(v) > cfg.cap) return false;
    if (v < 0 && !cfg.allowNegative) return false;
  }
  const distinct = new Set(terms).size;
  return distinct >= cfg.minDistinct && distinct > 1;
}

/**
 * @param {import('../core/rng.js').Rng} rng
 * @param {any[]} arr
 * @returns {any|null} random element or null for an empty array
 */
function pickFrom(rng, arr) {
  return arr.length > 0 ? rng.pick(arr) : null;
}

/**
 * Wrap an LaTeX expression in \left( \right) (used for the combined formula).
 * @param {string} s
 * @returns {string}
 */
function paren(s) {
  return `\\left(${s}\\right)`;
}

/** Probe argument used to detect whether a pool entry wraps its own argument. */
const WRAP_PROBE = 'x+1';

/**
 * Outer formula with an inner formula substituted for the argument. The contract
 * asks for a pre-wrapped argument, while pool entries are also told to wrap
 * non-trivial arguments themselves; probing avoids double parentheses and still
 * guarantees parentheses when an entry does not wrap.
 * @param {{latex:(p:number[], arg?:string)=>string}} entry
 * @param {number[]} params
 * @param {string} innerLatex
 * @returns {string}
 */
function composeLatex(entry, params, innerLatex) {
  const selfWraps = entry.latex(params, WRAP_PROBE).includes(paren(WRAP_PROBE));
  return entry.latex(params, selfWraps ? innerLatex : paren(innerLatex));
}

/**
 * @param {{n:number,value:number}[]} points
 * @returns {string} LaTeX line "a_{1}=3,\; a_{3}=9"
 */
function pairsMath(points) {
  return points.map((p) => `a_{${p.n}}=${p.value}`).join(',\\;');
}

// --------------------------------------------------------------------- engine

/**
 * Build an engine bound to a pool.
 * @param {{pool:PoolApi}} deps
 * @returns {{
 *  generateQuestion:(rng:any, o:{mode:'N'|'H', cfg:GenCfg, filter?:{mustInclude?:string}})=>Question,
 *  questionFromDescriptor:(d:Descriptor)=>Question,
 *  rebuildQuestion:(id:string)=>Question,
 *  generateSetQuestion:(gs:GenSettings, index:number)=>Question,
 *  generateSet:(gs:GenSettings, o?:{onProgress?:(done:number,total:number)=>void, chunk?:number})=>Promise<Question[]>,
 *  generateSetFromId:(sid:string, o?:Object)=>Promise<{settings:GenSettings, questions:Question[]}>,
 *  buildSolution:(q:Question)=>Solution}}
 */
export function createEngine({ pool }) {
  /** @type {Map<string, Object[]>} */
  const listCache = new Map();

  /**
   * @param {string} id
   * @returns {Object|null}
   */
  function entryOrNull(id) {
    try {
      return pool.getEntry(id) || null;
    } catch {
      return null;
    }
  }

  /**
   * @param {string} id
   * @returns {Object} pool entry
   * @throws {RebuildError} unknown function
   */
  function entryOf(id) {
    const entry = entryOrNull(id);
    if (!entry) throw new RebuildError(`Unknown pool function: ${id}`);
    return entry;
  }

  /**
   * Entries allowed by version, tiers and (optionally) composability.
   * @param {GenCfg} cfg
   * @param {number[]} tiers
   * @param {boolean} composableOnly
   * @returns {Object[]}
   */
  function eligible(cfg, tiers, composableOnly) {
    if (!Array.isArray(tiers) || tiers.length === 0) return [];
    const key = `${cfg.poolVersion}|${tiers.join(',')}|${composableOnly ? 1 : 0}`;
    let list = listCache.get(key);
    if (!list) {
      list = pool
        .listEntries({ maxVersion: cfg.poolVersion, tiers, composableOnly })
        .filter(
          (e) =>
            e.since <= cfg.poolVersion && tiers.includes(e.tier) && (!composableOnly || e.composable),
        );
      listCache.set(key, list);
    }
    return list;
  }

  // ------------------------------------------------------------- evaluation

  /**
   * @param {Expr} expr
   * @param {number} n position
   * @returns {number|null}
   */
  function exprValue(expr, n) {
    if (isComposition(expr)) {
      const inner = entryOf(expr.i.f).evaluate(expr.i.p, n);
      if (inner === null || inner === undefined) return null;
      return entryOf(expr.o.f).evaluate(expr.o.p, inner);
    }
    return entryOf(expr.f).evaluate(expr.p, n);
  }

  /**
   * @param {Expr[]} rules
   * @returns {number[]|null} the 6 true terms, or null if any is undefined / unsafe
   */
  function computeTerms(rules) {
    const terms = [];
    for (let n = 1; n <= TERM_COUNT; n++) {
      const v = exprValue(rules[ruleIndexOf(n, rules.length)], n);
      if (typeof v !== 'number' || !Number.isSafeInteger(v)) return null;
      terms.push(v + 0); // normalises -0
    }
    return terms;
  }

  /**
   * @param {Descriptor} descriptor
   * @param {number[]} terms
   * @returns {Question}
   */
  function assemble(descriptor, terms) {
    const fns = [...new Set(descriptor.rules.flatMap((r) => leavesOf(r).map((l) => l.f)))].sort();
    return {
      id: encodeQuestionId(descriptor),
      descriptor,
      terms,
      missing: descriptor.missing,
      answer: terms[descriptor.missing - 1],
      fns,
      mode: descriptor.mode,
      mixed: descriptor.rules.length === 2,
    };
  }

  // ------------------------------------------------------------- generation

  /**
   * @param {any} rng
   * @param {Object} entry
   * @param {'solo'|'outer'|'inner'} role
   * @param {number} cap
   * @returns {Leaf|null}
   */
  function sampleLeaf(rng, entry, role, cap) {
    const p = entry.sampleParams(rng, { cap, role });
    if (!Array.isArray(p) || p.length !== entry.arity) return null;
    if (!p.every((x) => Number.isSafeInteger(x))) return null;
    return { f: entry.id, p: p.map((x) => x + 0) };
  }

  /**
   * Decide how a required pool function can appear for this mode.
   * @param {string} id
   * @param {'N'|'H'} mode
   * @param {GenCfg} cfg
   * @returns {{entry:Object, normal:boolean, rare:boolean, compose:boolean}}
   * @throws {GenerationError} when the id is not eligible
   */
  function planMust(id, mode, cfg) {
    const entry = entryOrNull(id);
    if (!entry) throw new GenerationError(`mustInclude: unknown pool function "${id}"`);
    const has = (list) => list.some((e) => e.id === id);
    if (mode === MODE_NORMAL) {
      if (!has(eligible(cfg, cfg.normalTiers, false))) {
        throw new GenerationError(`mustInclude: "${id}" is not eligible for normal mode`);
      }
      return { entry, normal: true, rare: false, compose: false };
    }
    const rare = cfg.composeChance < 1 && has(eligible(cfg, cfg.rareTiers, false));
    const compose = cfg.composeChance > 0 && has(eligible(cfg, cfg.composeTiers, true));
    if (!rare && !compose) {
      throw new GenerationError(`mustInclude: "${id}" is not eligible for hard mode`);
    }
    return { entry, normal: false, rare, compose };
  }

  /**
   * Build one rule expression.
   * @param {any} rng
   * @param {'N'|'H'} mode
   * @param {GenCfg} cfg
   * @param {ReturnType<typeof planMust>|null} plan required function, if this rule carries it
   * @returns {Expr|null}
   */
  function buildRule(rng, mode, cfg, plan) {
    if (mode === MODE_NORMAL) {
      const entry = plan ? plan.entry : pickFrom(rng, eligible(cfg, cfg.normalTiers, false));
      return entry ? sampleLeaf(rng, entry, ROLE_SOLO, cfg.cap) : null;
    }
    let compose;
    if (plan) compose = plan.compose && plan.rare ? rng.chance(cfg.composeChance) : plan.compose;
    else compose = rng.chance(cfg.composeChance);

    if (compose) {
      const composables = eligible(cfg, cfg.composeTiers, true);
      let outerEntry;
      let innerEntry;
      if (plan) {
        const mustBeOuter = rng.int(0, 1) === 0;
        const other = pickFrom(rng, composables);
        outerEntry = mustBeOuter ? plan.entry : other;
        innerEntry = mustBeOuter ? other : plan.entry;
      } else {
        outerEntry = pickFrom(rng, composables);
        innerEntry = pickFrom(rng, composables);
      }
      if (!outerEntry || !innerEntry) return null;
      const o = sampleLeaf(rng, outerEntry, ROLE_OUTER, cfg.cap);
      const i = sampleLeaf(rng, innerEntry, ROLE_INNER, cfg.cap);
      return o && i ? { o, i } : null;
    }
    const entry = plan ? plan.entry : pickFrom(rng, eligible(cfg, cfg.rareTiers, false));
    return entry ? sampleLeaf(rng, entry, ROLE_SOLO, cfg.cap) : null;
  }

  /**
   * One generation attempt.
   * @param {any} rng
   * @param {'N'|'H'} mode
   * @param {GenCfg} cfg
   * @param {ReturnType<typeof planMust>|null} plan
   * @returns {Question|null}
   */
  function attempt(rng, mode, cfg, plan) {
    const missing = rng.int(1, TERM_COUNT);
    const mixed = rng.chance(cfg.mixedChance);
    const ruleCount = mixed ? 2 : 1;
    const target = plan ? rng.int(0, ruleCount - 1) : -1;
    const rules = [];
    for (let r = 0; r < ruleCount; r++) {
      const rule = buildRule(rng, mode, cfg, r === target ? plan : null);
      if (!rule) return null;
      rules.push(rule);
    }
    if (mixed && exprKey(rules[0]) === exprKey(rules[1])) return null;
    const terms = computeTerms(rules);
    if (!terms || !acceptable(terms, cfg)) return null;
    return assemble({ v: cfg.poolVersion, mode, missing, rules }, terms);
  }

  /**
   * Generate one question.
   * @param {any} rng seeded Rng
   * @param {{mode:'N'|'H', cfg:GenCfg, filter?:{mustInclude?:string}}} opts
   * @returns {Question}
   * @throws {GenerationError}
   */
  function generateQuestion(rng, { mode, cfg, filter } = /** @type {any} */ ({})) {
    if (mode !== MODE_NORMAL && mode !== MODE_HARD) {
      throw new GenerationError(`Invalid mode: ${mode}`);
    }
    const must = filter && filter.mustInclude ? filter.mustInclude : null;
    const plan = must ? planMust(must, mode, cfg) : null;
    for (let i = 0; i < cfg.maxAttempts; i++) {
      const q = attempt(rng, mode, cfg, plan);
      if (q) return q;
    }
    throw new GenerationError(`No valid question found in ${cfg.maxAttempts} attempts`);
  }

  // ---------------------------------------------------------------- rebuild

  /**
   * @param {Descriptor} d
   * @throws {RebuildError}
   */
  function validateDescriptor(d) {
    const bad = (m) => new RebuildError(`Invalid descriptor: ${m}`);
    if (!d || typeof d !== 'object') throw bad('not an object');
    if (!Number.isInteger(d.v) || d.v < 1) throw bad('version');
    if (d.mode !== MODE_NORMAL && d.mode !== MODE_HARD) throw bad('mode');
    if (!Number.isInteger(d.missing) || d.missing < 1 || d.missing > TERM_COUNT) throw bad('missing');
    if (!Array.isArray(d.rules) || d.rules.length < 1 || d.rules.length > 2) throw bad('rules');
    for (const rule of d.rules) {
      if (!rule || typeof rule !== 'object') throw bad('rule');
      for (const leaf of leavesOf(rule)) {
        if (!leaf || typeof leaf.f !== 'string' || !Array.isArray(leaf.p)) throw bad('leaf');
        if (!leaf.p.every((x) => Number.isSafeInteger(x))) throw bad('params');
        const entry = entryOf(leaf.f);
        if (entry.arity !== leaf.p.length) {
          throw new RebuildError(`Wrong parameter count for ${leaf.f}: expected ${entry.arity}`);
        }
      }
    }
  }

  /**
   * Rebuild a question from its descriptor (cap/tier rules are NOT re-applied).
   * @param {Descriptor} descriptor
   * @returns {Question}
   * @throws {RebuildError}
   */
  function questionFromDescriptor(descriptor) {
    validateDescriptor(descriptor);
    const clone = (leaf) => ({ f: leaf.f, p: leaf.p.map((x) => x + 0) });
    const rules = descriptor.rules.map((r) =>
      isComposition(r) ? { o: clone(r.o), i: clone(r.i) } : clone(r),
    );
    const d = { v: descriptor.v, mode: descriptor.mode, missing: descriptor.missing, rules };
    const terms = computeTerms(rules);
    if (!terms) throw new RebuildError('Descriptor does not produce six integer terms');
    return assemble(d, terms);
  }

  /**
   * @param {string} id question ID
   * @returns {Question}
   * @throws {Error} IdError for malformed IDs, RebuildError for unknown/invalid content
   */
  function rebuildQuestion(id) {
    return questionFromDescriptor(decodeQuestionId(id));
  }

  // -------------------------------------------------------------------- sets

  /**
   * Question number `index` of a set; independent of every other index.
   * @param {GenSettings} gs
   * @param {number} index 0-based
   * @returns {Question}
   */
  function generateSetQuestion(gs, index) {
    const rng = createRng(`${gs.seed}#${index}`);
    const mode = rng.chance(gs.hardRatio) ? MODE_HARD : MODE_NORMAL; // FIRST draw
    return generateQuestion(rng, { mode, cfg: gs });
  }

  /**
   * @param {GenSettings} gs
   * @param {{onProgress?:(done:number,total:number)=>void, chunk?:number}} [opts]
   * @returns {Promise<Question[]>}
   */
  async function generateSet(gs, { onProgress, chunk = DEFAULT_CHUNK } = {}) {
    const total = gs.count;
    if (!Number.isSafeInteger(total) || total < 0) throw new GenerationError('Invalid question count');
    const step = Number.isInteger(chunk) && chunk > 0 ? chunk : DEFAULT_CHUNK;
    /** @type {Question[]} */
    const out = [];
    for (let i = 0; i < total; i++) {
      out.push(generateSetQuestion(gs, i));
      const done = i + 1;
      if (done % step === 0 || done === total) {
        if (onProgress) onProgress(done, total);
        if (done < total) await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    return out;
  }

  /**
   * @param {string} sid Set ID
   * @param {{onProgress?:Function, chunk?:number}} [opts]
   * @returns {Promise<{settings:GenSettings, questions:Question[]}>}
   * @throws {Error} IdError for malformed IDs, RebuildError for a different algorithm version
   */
  async function generateSetFromId(sid, opts) {
    const { algo, settings } = decodeSetId(sid);
    if (algo !== ALGO_VERSION) {
      throw new RebuildError(`Unsupported set algorithm version: ${algo}`);
    }
    return { settings, questions: await generateSet(settings, opts) };
  }

  // ---------------------------------------------------------------- solution

  /**
   * Step-by-step solution of a question.
   * @param {Question} question
   * @returns {Solution}
   */
  function buildSolution(question) {
    const { rules, missing } = question.descriptor;
    const terms = question.terms;
    const ruleCount = rules.length;
    const mixed = ruleCount === 2;
    const whichOf = (r) => (mixed ? (r === 0 ? 'odd' : 'even') : 'all');
    const positionsOf = (r) =>
      Array.from({ length: TERM_COUNT }, (_, k) => k + 1).filter((n) => ruleIndexOf(n, ruleCount) === r);
    const pointsOf = (r) =>
      positionsOf(r)
        .filter((n) => n !== missing)
        .map((n) => ({ n, value: terms[n - 1] }));
    const hiddenOf = (r) => (ruleIndexOf(missing, ruleCount) === r ? missing : null);
    const show = (v) => (typeof v === 'number' ? String(v) : '?');

    /** @type {Section[]} */
    const sections = [];

    // 1. Given
    const seqMath = terms.map((v, k) => (k + 1 === missing ? '?' : String(v))).join(',\\ ');
    /** @type {Step[]} */
    const given = [{ key: 'gen.step.sequence', params: { missing }, math: [seqMath] }];
    if (mixed) {
      given.push({
        key: 'gen.step.oddEvenSplit',
        math: [0, 1].map((r) => {
          const ns = positionsOf(r);
          const vals = ns.map((n) => (n === missing ? '?' : String(terms[n - 1])));
          return `n=${ns.join(',')}:\\; ${vals.join(',\\ ')}`;
        }),
      });
    } else {
      given.push({ key: 'gen.step.oneRule' });
    }
    sections.push({ titleKey: 'gen.sec.given', steps: given });

    // 2. One section per rule
    rules.forEach((rule, r) => {
      const which = whichOf(r);
      const points = pointsOf(r);
      const hidden = hiddenOf(r);
      /** @type {Step[]} */
      const steps = [];
      if (points.length > 0) steps.push({ key: 'gen.step.points', math: [pairsMath(points)] });

      if (!isComposition(rule)) {
        const entry = entryOf(rule.f);
        steps.push({ key: 'gen.step.ruleDefinition', math: entry.definition(rule.p) });
        steps.push(...entry.solve(rule.p, { points, hidden }));
      } else {
        const inner = entryOf(rule.i.f);
        const outer = entryOf(rule.o.f);
        const g = (n) => inner.evaluate(rule.i.p, n);
        steps.push({ key: 'gen.step.innerDefinition', math: inner.definition(rule.i.p) });
        steps.push({
          key: 'gen.step.innerTable',
          math: [
            [
              `\\begin{array}{c|${'c'.repeat(points.length)}}`,
              `n & ${points.map((p) => p.n).join(' & ')}`,
              '\\\\ \\hline',
              `g(n) & ${points.map((p) => show(g(p.n))).join(' & ')}`,
              '\\end{array}',
            ].join(' '),
          ],
        });
        const outerPoints = points.map((p) => ({ n: g(p.n) ?? 0, value: p.value }));
        const outerHidden = hidden === null ? null : g(hidden);
        steps.push({ key: 'gen.step.outerSolve' });
        steps.push(...outer.solve(rule.o.p, { points: outerPoints, hidden: outerHidden }));
        steps.push({
          key: 'gen.step.combined',
          math: [`a_n=${composeLatex(outer, rule.o.p, inner.latex(rule.i.p))}`],
        });
      }
      sections.push({
        titleKey: 'gen.sec.rule',
        titleParams: { which, label: t(`gen.which.${which}`) },
        steps,
      });
    });

    // 3. Answer
    const rIdx = ruleIndexOf(missing, ruleCount);
    const rule = rules[rIdx];
    const answer = question.answer;
    /** @type {Step[]} */
    const fin = [
      {
        key: mixed ? (rIdx === 0 ? 'gen.step.ruleOdd' : 'gen.step.ruleEven') : 'gen.step.ruleAll',
        params: { n: missing },
      },
    ];
    if (!isComposition(rule)) {
      const entry = entryOf(rule.f);
      fin.push({
        key: 'gen.step.substitute',
        params: { n: missing },
        math: [`a_{${missing}}=${entry.latex(rule.p, String(missing))}=${answer}`],
      });
    } else {
      const inner = entryOf(rule.i.f);
      const outer = entryOf(rule.o.f);
      const gv = inner.evaluate(rule.i.p, missing);
      fin.push({
        key: 'gen.step.substituteInner',
        params: { n: missing },
        math: [`g(${missing})=${inner.latex(rule.i.p, String(missing))}=${show(gv)}`],
      });
      fin.push({
        key: 'gen.step.substituteOuter',
        params: { n: missing, inner: show(gv) },
        math: [`a_{${missing}}=${outer.latex(rule.o.p, show(gv))}=${answer}`],
      });
    }
    fin.push({ key: 'gen.step.conclusion', params: { n: missing, answer } });
    sections.push({ titleKey: 'gen.sec.answer', steps: fin });

    return { answer, sections };
  }

  return {
    generateQuestion,
    questionFromDescriptor,
    rebuildQuestion,
    generateSetQuestion,
    generateSet,
    generateSetFromId,
    buildSolution,
  };
}
