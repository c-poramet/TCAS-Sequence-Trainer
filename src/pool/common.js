import { registerStrings } from '../core/i18n.js';

/** @typedef {{next:()=>number,int:(min:number,max:number)=>number,chance:(p:number)=>boolean,pick:(a:any[])=>any,weighted:(a:any[],f:(x:any)=>number)=>any,shuffle:(a:any[])=>any[],fork:(s:string)=>any}} Rng */
/** @typedef {{key:string,params?:Record<string,string|number>,math?:string[]}} Step */

const SIMPLE = /^\d+$|^n$/;
const wrap = (arg) => SIMPLE.test(arg) ? arg : `\\left(${arg}\\right)`;
const safe = (x) => Number.isSafeInteger(x) ? x : null;
const terms = (fn, p) => Array.from({ length: 6 }, (_, i) => fn(p, i + 1));
const valid = (fn, p, cap = 2500) => terms(fn, p).every((v) => v !== null && Math.abs(v) <= cap);
const inner = (fn, gen, fallback) => {
  for (let i = 0; i < 80; i++) {
    const p = gen();
    if (terms(fn, p).every((v) => Number.isInteger(v) && v >= 1 && v <= 60)) return p;
  }
  return fallback.slice();
};

function make(base, spec) {
  const entry = { ...base };
  entry.sampleParams = (rng, ctx) => {
    const makeParams = () => spec.sample(rng, ctx);
    if (ctx.role === 'inner') return inner(spec.eval, makeParams, spec.fallback);
    for (let i = 0; i < 80; i++) {
      const p = makeParams();
      if (valid(spec.eval, p, ctx.cap)) return p;
    }
    return spec.fallback.slice();
  };
  entry.evaluate = (p, n) => {
    if (!Number.isInteger(n) || n < 1 || n > entry.maxIndex || !Array.isArray(p) || p.length !== entry.arity) return null;
    try { return safe(spec.eval(p, n)); } catch { return null; }
  };
  entry.latex = (p, arg = 'n') => spec.latex(p, wrap(arg));
  entry.definition = (p) => [`f(n)=${entry.latex(p)}`];
  entry.normalize = spec.normalize;
  entry.solve = (p, ctx = { points: [], hidden: null }) => {
    const pts = (ctx.points || []).filter((x) => x && x.n !== ctx.hidden).sort((a, b) => a.n - b.n);
    const id = entry.id;
    const visible = pts.map((x) => `f(${x.n})=${x.value}`).join(',\\;');
    const checks = pts.slice(-2).map((x) => `f(${x.n})=${spec.substitute(p, x.n)}=${x.value}`);
    return [
      { key: `pool.${id}.observe`, math: visible ? [visible] : [] },
      { key: `pool.${id}.detect`, math: [spec.detect(p)] },
      { key: `pool.${id}.rule`, math: entry.definition(p) },
      { key: `pool.${id}.verify`, math: checks },
    ];
  };
  return Object.freeze(entry);
}

const r = (rng, a, b) => rng.int(a, b);
const signed = (x) => x < 0 ? `-${-x}` : `+${x}`;
const add = (x, c) => c ? `${x}${signed(c)}` : x;
const coefficient = (c, body) => c === 0 ? '' : c === 1 ? String(body) : c === -1 ? `-${body}` : `${c}${body}`;
const polynomial = (terms) => terms.filter((term) => term && term !== '0').map((term, i) => i === 0 || term.startsWith('-') ? term : `+${term}`).join('') || '0';
const shifted = (x, shift) => shift === 0 ? x : `(${x}${signed(shift)})`;

const COMMON_ENTRIES = [
  make({ id: 'poly.lin', since: 1, tier: 1, composable: true, arity: 2, maxIndex: 60 }, {
    fallback: [2, 1], sample: (g, c) => c.role === 'outer' ? [r(g, 1, 4), r(g, -2, 3)] : [r(g, 1, 5), r(g, -5, 5)],
    eval: (p, n) => p[0] * n + p[1], normalize: (p) => ({ m: p[0], b: p[1] }),
    latex: (p, x) => polynomial([coefficient(p[0], x), String(p[1])]), detect: (p) => `f(n+1)-f(n)=${p[0]}`, substitute: (p, n) => polynomial([coefficient(p[0], n), String(p[1])]),
  }),
  make({ id: 'poly.quad', since: 1, tier: 1, composable: true, arity: 3, maxIndex: 60 }, {
    fallback: [1, 0, 0], sample: (g) => [r(g, -2, 3), r(g, -2, 3), r(g, -3, 3)],
    eval: (p, n) => p[0] * n * n + p[1] * n + p[2], normalize: (p) => ({ a: p[0], b: p[1], c: p[2] }),
    latex: (p, x) => polynomial([coefficient(p[0], `${x}^{2}`), coefficient(p[1], x), String(p[2])]), detect: (p) => `\\Delta^{2}f(n)=${2 * p[0]}`, substitute: (p, n) => polynomial([coefficient(p[0], `${n}^{2}`), coefficient(p[1], n), String(p[2])]),
  }),
  make({ id: 'geo.pure', since: 1, tier: 1, composable: true, arity: 2, maxIndex: 60 }, {
    fallback: [1, 2], sample: (g, c) => [r(g, 1, 4), r(g, 2, 3)],
    eval: (p, n) => p[0] * p[1] ** (n - 1), normalize: (p) => ({ first: p[0], ratio: p[1] }),
    latex: (p, x) => coefficient(p[0], `${p[1]}^{${x}-1}`), detect: (p) => `\\frac{f(n+1)}{f(n)}=${p[1]}`, substitute: (p, n) => coefficient(p[0], `${p[1]}^{${n}-1}`),
  }),
  make({ id: 'poly.shift_sq', since: 1, tier: 1, composable: true, arity: 2, maxIndex: 60 }, {
    fallback: [1, 0], sample: (g) => [r(g, -2, 3), r(g, -3, 3)],
    eval: (p, n) => (n + p[0]) ** 2 + p[1], normalize: (p) => ({ shift: p[0], add: p[1] }),
    latex: (p, x) => add(`${shifted(x, p[0])}^{2}`, p[1]), detect: (p) => `f(n)${signed(-p[1])}=(n${signed(p[0])})^{2}`, substitute: (p, n) => add(`${shifted(n, p[0])}^{2}`, p[1]),
  }),
  make({ id: 'poly.shift_cube', since: 1, tier: 1, composable: true, arity: 2, maxIndex: 60 }, {
    fallback: [0, 0], sample: (g) => [r(g, -1, 2), r(g, -2, 2)],
    eval: (p, n) => (n + p[0]) ** 3 + p[1], normalize: (p) => ({ shift: p[0], add: p[1] }),
    latex: (p, x) => add(`${shifted(x, p[0])}^{3}`, p[1]), detect: (p) => `f(n)${signed(-p[1])}=(n${signed(p[0])})^{3}`, substitute: (p, n) => add(`${shifted(n, p[0])}^{3}`, p[1]),
  }),
  make({ id: 'seq.triangular', since: 1, tier: 1, composable: true, arity: 1, maxIndex: 60 }, {
    fallback: [0], sample: (g) => [r(g, -2, 3)],
    eval: (p, n) => n * (n + 1) / 2 + p[0], normalize: (p) => ({ add: p[0] }),
    latex: (p, x) => `${x}(${x}+1)/2${signed(p[0])}`, detect: () => `\\Delta f(n+1)-\\Delta f(n)=1`, substitute: (p, n) => `${n}(${n}+1)/2${signed(p[0])}`,
  }),
  make({ id: 'poly.cubic', since: 1, tier: 2, composable: true, arity: 4, maxIndex: 60 }, {
    fallback: [1, 0, 0, 0], sample: (g) => [r(g, -1, 2), r(g, -2, 2), r(g, -2, 2), r(g, -2, 2)],
    eval: (p, n) => p[0] * n ** 3 + p[1] * n ** 2 + p[2] * n + p[3], normalize: (p) => ({ a: p[0], b: p[1], c: p[2], d: p[3] }),
    latex: (p, x) => polynomial([coefficient(p[0], `${x}^{3}`), coefficient(p[1], `${x}^{2}`), coefficient(p[2], x), String(p[3])]), detect: (p) => `\\Delta^{3}f(n)=${6 * p[0]}`, substitute: (p, n) => polynomial([coefficient(p[0], `${n}^{3}`), coefficient(p[1], `${n}^{2}`), coefficient(p[2], n), String(p[3])]),
  }),
  make({ id: 'geo.offset', since: 1, tier: 2, composable: true, arity: 3, maxIndex: 60 }, {
    fallback: [1, 2, 0], sample: (g) => [r(g, 1, 3), r(g, 2, 3), r(g, -3, 3)],
    eval: (p, n) => p[0] * p[1] ** (n - 1) + p[2], normalize: (p) => ({ first: p[0], ratio: p[1], add: p[2] }),
    latex: (p, x) => add(coefficient(p[0], `${p[1]}^{${x}-1}`), p[2]), detect: (p) => `\\frac{f(n+1)${signed(-p[2])}}{f(n)${signed(-p[2])}}=${p[1]}`, substitute: (p, n) => add(coefficient(p[0], `${p[1]}^{${n}-1}`), p[2]),
  }),
  make({ id: 'poly.nprod', since: 1, tier: 2, composable: true, arity: 2, maxIndex: 60 }, {
    fallback: [1, 1], sample: (g) => [r(g, 1, 3), r(g, -1, 3)],
    eval: (p, n) => n * (n + p[0]) + p[1], normalize: (p) => ({ shift: p[0], add: p[1] }),
    latex: (p, x) => `${x}(${x}${signed(p[0])})${signed(p[1])}`, detect: (p) => `f(n)${signed(-p[1])}=n(n${signed(p[0])})`, substitute: (p, n) => `${n}(${n}${signed(p[0])})${signed(p[1])}`,
  }),
  make({ id: 'seq.alt_sign', since: 1, tier: 2, composable: false, arity: 2, maxIndex: 60 }, {
    fallback: [1, 1], sample: (g) => [r(g, 1, 4), r(g, 1, 3)],
    eval: (p, n) => (n % 2 ? 1 : -1) * (p[0] * n + p[1]), normalize: (p) => ({ multiplier: p[0], add: p[1] }),
    latex: (p, x) => `(-1)^{${x}+1}(${polynomial([coefficient(p[0], x), String(p[1])])})`, detect: (p) => `|f(n)|=${p[0] === 1 ? '' : p[0]}n${signed(p[1])}`, substitute: (p, n) => `(-1)^{${n}+1}(${polynomial([coefficient(p[0], n), String(p[1])])})`,
  }),
  make({ id: 'rec.fib', since: 1, tier: 2, composable: false, arity: 2, maxIndex: 60 }, {
    fallback: [1, 1], sample: (g) => [r(g, 1, 3), r(g, 1, 3)],
    eval: (p, n) => { let a = p[0], b = p[1]; for (let i = 2; i < n; i++) [a, b] = [b, a + b]; return n === 1 ? a : b; },
    normalize: (p) => ({ first: p[0], second: p[1] }), latex: (p, x) => `f(1)=${p[0]},\\ f(2)=${p[1]},\\ f(n)=f(n-1)+f(n-2)`, detect: () => `f(n)=f(n-1)+f(n-2)`, substitute: (p, n) => `f(${n})`,
  }),
  make({ id: 'exp.pow2', since: 1, tier: 2, composable: true, arity: 2, maxIndex: 60 }, {
    fallback: [1, 0], sample: (g) => [r(g, 1, 3), r(g, -2, 2)],
    eval: (p, n) => p[0] * 2 ** n + p[1], normalize: (p) => ({ multiplier: p[0], add: p[1] }),
    latex: (p, x) => add(coefficient(p[0], `2^{${x}}`), p[1]), detect: () => `\\Delta f(n+1)=2\\Delta f(n)`, substitute: (p, n) => add(coefficient(p[0], `2^{${n}}`), p[1]),
  }),
  make({ id: 'poly.diff2', since: 1, tier: 2, composable: true, arity: 3, maxIndex: 60 }, {
    fallback: [1, 1, 0], sample: (g) => [r(g, -2, 2), r(g, -2, 2), r(g, -2, 2)],
    eval: (p, n) => p[0] * n * n + p[1] * n + p[2], normalize: (p) => ({ secondDifference: 2 * p[0], linear: p[1], add: p[2] }),
    latex: (p, x) => polynomial([coefficient(p[0], `${x}^{2}`), coefficient(p[1], x), String(p[2])]), detect: (p) => `\\Delta^{2}f(n)=${2 * p[0]}`, substitute: (p, n) => polynomial([coefficient(p[0], `${n}^{2}`), coefficient(p[1], n), String(p[2])]),
  }),
  make({ id: 'seq.step3', since: 1, tier: 2, composable: true, arity: 2, maxIndex: 60 }, {
    fallback: [1, 3], sample: (g) => [r(g, -3, 5), r(g, 1, 4)],
    eval: (p, n) => p[0] + p[1] * (n - 1), normalize: (p) => ({ first: p[0], step: p[1] }),
    latex: (p, x) => polynomial([String(p[0]), coefficient(p[1], `(${x}-1)`)]) , detect: (p) => `f(n+1)-f(n)=${p[1]}`, substitute: (p, n) => polynomial([String(p[0]), coefficient(p[1], `(${n}-1)`)]) ,
  }),
];

export { COMMON_ENTRIES };
