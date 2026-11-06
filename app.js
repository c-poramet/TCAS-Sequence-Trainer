'use strict';
/* ============ QUESTION ENGINE ============
   Each sequence family returns 6 integers (position i = 0..5). Add a family = add one line to FAM, then list it in GROUPS.
   Fixed questions: BANK.push({topic:'Verbal', q:'...', choices:[...], answer:index}) */
let activeRng = null;
const randomValue = () => activeRng ? activeRng() : Math.random();
const makeRng = seed => {
  let state = (Number(seed) >>> 0) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
};
const withRng = (rng, work) => { const previous = activeRng; activeRng = rng; try { return work(); } finally { activeRng = previous; } };
const newSeed = () => Math.floor(Math.random() * 2147483646) + 1;
const normalizeSeed = value => { const n = Math.floor(Number(value)); return Number.isFinite(n) && n > 0 ? Math.min(2147483647, n) : 0; };
const rnd = (a, b) => Math.floor(randomValue() * (b - a + 1)) + a, pk = a => a[rnd(0, a.length - 1)], sg = () => rnd(0, 1) ? 1 : -1;
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function mcq(topic, q, ans, near) {
  const s = new Set([ans]); let g = 0;
  while (s.size < 5 && g++ < 200) s.add(near());
  const c = [...s].sort((x, y) => x - y);
  return { topic, q, choices: c.map(String), answer: c.indexOf(ans) };
}
const BANK = []; // fixed questions go here
const S = f => Array.from({ length: 6 }, (_, i) => f(i));
const rec = (a, st) => { const t = [a]; for (let i = 0; i < 5; i++) t.push(st(t[i], i, t)); return t; };
const PR = [2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61];
const mk = () => {
  const a = rnd(1, 12), kind = pk(['arith', 'arith', 'geom', 'sq', 'cube']);
  if (kind === 'arith') {
    const d = rnd(2, 9) * sg();
    const rule = k => a + d * (k - 1);
    rule.label = `f(k) = ${a} ${d < 0 ? '−' : '+'} ${Math.abs(d)}(k − 1)`;
    rule.at = k => `${a} ${d < 0 ? '−' : '+'} ${Math.abs(d)}(${k} − 1)`;
    return rule;
  }
  if (kind === 'geom') {
    const r = rnd(2, 3);
    const rule = k => a * r ** (k - 1);
    rule.label = `f(k) = ${a} × (${r})^{k − 1}`;
    rule.at = k => `${a} × (${r})^(${k} − 1)`;
    return rule;
  }
  const c = rnd(-4, 6), e = kind === 'sq' ? 2 : 3;
  const rule = k => k ** e + c;
  rule.label = `f(k) = k^${e} ${c < 0 ? '−' : '+'} ${Math.abs(c)}`;
  rule.at = k => `${k}^${e} ${c < 0 ? '−' : '+'} ${Math.abs(c)}`;
  return rule;
};
const PF = [n => n * n, n => n ** 3, n => 2 * n + 1, n => n * (n + 1), n => 3 * n - 1, n => n * n + 1, n => 2 * n * n, n => n * (n - 1), n => 4 * n - 3, n => 2 ** n];
const PF_LABELS = ['n²', 'n³', '2n + 1', 'n² + n', '3n − 1', 'n² + 1', '2n²', 'n² − n', '4n − 3', '2^n'];
const F = [n => n + 2, n => n * 2, n => n * n, n => 3 * n - 1, n => n * (n + 1), n => n + 5, n => 2 * n + 1, n => 4 * n - 3, n => n * n - 1];
const F_LABELS = ['n + 2', '2n', 'n²', '3n − 1', 'n² + n', 'n + 5', '2n + 1', '4n − 3', 'n² − 1'];
const esc = x => String(x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const latex = x => String(x)
  .replace(/×/g, '\\times ')
  .replace(/÷/g, '\\div ')
  .replace(/−/g, '-')
  .replace(/⁻¹/g, '^{-1}')
  .replace(/\bn = /g, 'n\\,=\\,')
  .replace(/\btherefore\b/g, ' ⇒ ')
  .replace(/;\s*/g, '\\;\\quad ')
  .replace(/:\s*/g, '\\;\\quad ');
const polynomial = coefficients => {
  const terms = [];
  for (let degree = coefficients.length - 1; degree >= 0; degree--) {
    const coefficient = coefficients[degree] || 0;
    if (!coefficient) continue;
    const magnitude = Math.abs(coefficient);
    const variable = degree === 0 ? '' : degree === 1 ? 'n' : `n^${degree}`;
    const value = degree === 0 ? String(magnitude) : magnitude === 1 ? variable : `${magnitude}${variable}`;
    terms.push({ negative: coefficient < 0, value });
  }
  return terms.map((term, index) => {
    const sign = term.negative ? '−' : '+';
    return index === 0 ? `${term.negative ? '−' : ''}${term.value}` : `${sign} ${term.value}`;
  }).join(' ') || '0';
};
const polynomialWithPrefix = (prefix, coefficients) => {
  const expression = polynomial(coefficients);
  if (expression === '0') return prefix;
  return `${prefix} ${expression.startsWith('−') ? '−' : '+'} ${expression.replace(/^−|^\+\s*/, '')}`;
};
const binomialPower = (constant, slope, power, offset = 0) => {
  const coefficients = Array(power + 1).fill(0);
  for (let degree = 0; degree <= power; degree++) {
    let choose = 1;
    for (let i = 1; i <= degree; i++) choose *= (power - i + 1) / i;
    coefficients[degree] = choose * slope ** degree * constant ** (power - degree);
  }
  coefficients[0] += offset;
  return polynomial(coefficients);
};
const signed = value => value < 0 ? `− ${Math.abs(value)}` : `+ ${value}`;
const polynomialForms = (constant, slope, power, offset = 0) => {
  const expanded = polynomial(Array.from({ length: power + 1 }, (_, degree) => {
    let choose = 1;
    for (let i = 1; i <= degree; i++) choose *= (power - i + 1) / i;
    return choose * slope ** degree * constant ** (power - degree) + (degree === 0 ? offset : 0);
  }));
  if (power !== 2) return expanded;
  const vertexOffset = slope * constant;
  return `${expanded} = (n ${signed(vertexOffset)})^2${offset ? ` ${signed(offset)}` : ''}`;
};
const formulaMarkup = x => {
  const parts = String(x).split(';').map(part => part.trim()).filter(Boolean);
  if (!/[=^()]/.test(String(x))) return `<span class="rule-prose">${esc(x)}</span>`;
  return `<span class="formula-stack">${parts.map(part => `<span class="formula-row">\\(${latex(part)}\\)</span>`).join('')}</span>`;
};
const familyFormula = (family, t) => {
  const d = t[1] - t[0], r = t[0] ? t[1] / t[0] : 0;
  const formulas = {
    arith: `f(n) = ${t[0]} ${d < 0 ? '- ' + Math.abs(d) : '+ ' + d}(n - 1)`,
    geom: `f(n) = ${t[0]} × (${r})ⁿ⁻¹`,
    geomDown: `f(n) = ${t[0]} ÷ (${t[0] / t[1]})ⁿ⁻¹`,
    dArith: 'f(n) = f(n − 1) + Δ(n)',
    dGeom: 'f(n) = f(n − 1) + Δr^{n − 2}',
    dPow: 'f(n) = f(n − 1) + (n − 1)^p',
    fib: 'f(n) = f(n − 1) + f(n − 2)',
    altOp: 'f(n) = \\begin{cases}p f(n - 1), & n\\text{ even}\\\\ f(n - 1) + q, & n\\text{ odd}\\end{cases}',
    affine: 'f(n) = m f(n − 1) + c',
    mulAdd: 'f(n) = (f(n − 1) ± 1)n',
    mulHalf: 'f(n) = f(n − 1)n ÷ 2',
    inter: 'f(2k − 1) = A(k); f(2k) = B(k)',
    parity: 'f(n) = \\begin{cases}F_1(n), & n\\text{ odd}\\\\ F_2(n), & n\\text{ even}\\end{cases}',
    sqPrev: 'f(2k − 1) = a + d(k − 1); f(2k) = f(2k − 1)^2',
    poly: 'f(n) = an^2 + bn + c',
    pron: 'f(n) = n^2 + n',
    recip: 'f(n) = c ÷ n',
    prime: 'f(n) = p_n'
  };
  return formulas[family] || `f(n) = value at position n`;
};
function explanation(family, t, custom) {
  const formula = custom?.formula || familyFormula(family, t);
  const steps = t.map((value, i) => {
    const n = i + 1;
    if (custom?.steps?.[i]) return custom.steps[i];
    if (family === 'arith') return `n = ${n}: f(${n}) = ${t[0]} ${i && t[1] - t[0] < 0 ? '- ' + Math.abs(t[1] - t[0]) + ' × ' + i : i ? '+ ' + (t[1] - t[0]) + ' × ' + i : ''} = ${value}`;
    if (family === 'geom') return `n = ${n}: f(${n}) = ${t[0]} × (${t[1] / t[0]})^${i} = ${value}`;
    return `n = ${n}: f(${n}) = ${value}`;
  });
  return { formula, steps };
}
const sgn = v => v < 0 ? '−' : '+', ab = Math.abs, pv = x => x < 0 ? `(${x})` : `${x}`, co = c => ab(c) === 1 ? '' : ab(c);
const TRI = m => m * (m + 1) / 2;
const FIBS = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233];
const FACT = [1, 1, 2, 6, 24, 120, 720, 5040, 40320];
const polyAt = (cs, n) => { let s = ''; for (let d = cs.length - 1; d >= 0; d--) { const c = cs[d]; if (!c) continue; const m = ab(c), body = d === 0 ? `${m}` : `${m === 1 ? '' : m + ' × '}${n}${d > 1 ? '^' + d : ''}`; s += s ? ` ${sgn(c)} ${body}` : `${c < 0 ? '−' : ''}${body}`; } return s || '0'; };
const PRIME_ROW = 'p_k \\text{ is the }k\\text{-th prime}';
const FIGURATE = [
  { s: v => `${v}(${v} + 1) ÷ 2`, f: m => m * (m + 1) / 2 },
  { s: v => `${v}(3${v} − 1) ÷ 2`, f: m => m * (3 * m - 1) / 2 },
  { s: v => `${v}(2${v} − 1)`, f: m => m * (2 * m - 1) },
  { s: v => `${v}(${v} + 1)(${v} + 2) ÷ 6`, f: m => m * (m + 1) * (m + 2) / 6 }
];
const LISTS = (() => {
  const upto = (n, fn) => Array.from({ length: n }, (_, i) => i + 1).filter(fn);
  const isSq = x => Number.isInteger(Math.sqrt(x)), isCube = x => Number.isInteger(Math.round(Math.cbrt(x))) && Math.round(Math.cbrt(x)) ** 3 === x;
  return {
    div3: [upto(90, x => x % 3), 'the positive integers that are not multiples of 3, in increasing order'],
    div4: [upto(90, x => x % 4), 'the positive integers that are not multiples of 4, in increasing order'],
    div5: [upto(90, x => x % 5), 'the positive integers that are not multiples of 5, in increasing order'],
    nonSq: [upto(90, x => !isSq(x)), 'the positive integers that are not perfect squares, in increasing order'],
    composite: [upto(90, x => x > 3 && !PR.includes(x) && x < 62), 'the composite numbers (positive integers with more than two divisors), in increasing order'],
    sqCube: [upto(450, x => isSq(x) || isCube(x)), 'the positive integers that are perfect squares or perfect cubes, in increasing order'],
    odd3: [upto(90, x => x % 2 && x % 3), 'the positive integers that are neither multiples of 2 nor multiples of 3, in increasing order']
  };
})();
const divisors = m => { const d = []; for (let i = 1; i <= m; i++) if (m % i === 0) d.push(i); return d; };
const FAM = {
  arith: () => { const a = rnd(-20, 90), d = rnd(2, 15) * sg(); return S(i => a + d * i); },
  geom: () => { const a = rnd(1, 6) * sg(), r = pk([2, 3, 4, -2, -3]); return S(i => a * r ** i); },
  geomDown: () => { const r = rnd(2, 5), a = rnd(1, 5) * r ** 5; return S(i => a / r ** i); },
  dArith: () => { const a = rnd(-5, 30), d = rnd(1, 5), k = rnd(1, 4) * sg(), t = rec(a, (x, i) => x + d + k * i); t.explain = { formula: `f(1) = ${a}; ${polynomialWithPrefix('f(n) = f(n − 1)', [d - 2 * k, k])}`, steps: t.map((value, i) => i ? `f(${i + 1}) = f(${i}) + ${d} ${k < 0 ? '−' : '+'} ${Math.abs(k)}(${i}) = ${t[i - 1]} ${d + k * (i - 1) < 0 ? '−' : '+'} ${Math.abs(d + k * (i - 1))} = ${value}` : `f(1) = ${a}`) }; return t; },
  dGeom: () => { const a = rnd(1, 20), m = rnd(1, 3), b = pk([2, 3]), s = sg(), t = rec(a, (x, i) => x + s * m * b ** i); t.explain = { formula: `f(1) = ${a}; f(n) = f(n − 1) ${s < 0 ? '−' : '+'} ${m} × ${b}^{n − 2}`, steps: t.map((value, i) => i ? `f(${i + 1}) = ${t[i - 1]} ${s < 0 ? '−' : '+'} ${m} × ${b}^{${i - 1}} = ${value}` : `f(1) = ${a}`) }; return t; },
  dPow: () => { const a = rnd(1, 100), p = pk([2, 3]), s = sg(), t = rec(a, (x, i) => x + s * (i + 1) ** p); t.explain = { formula: `f(1) = ${a}; f(n) = f(n − 1) ${s < 0 ? '−' : '+'} (n − 1)^${p}`, steps: t.map((value, i) => i ? `f(${i + 1}) = f(${i}) ${s < 0 ? '−' : '+'} (${i})^${p} = ${t[i - 1]} ${s < 0 ? '−' : '+'} ${i ** p} = ${value}` : `f(1) = ${a}`) }; return t; },
  fib: () => { const t = [rnd(-5, 6), rnd(1, 6) * sg()]; while (t.length < 6) t.push(t[t.length - 1] + t[t.length - 2]); t.explain = { formula: `f(1) = ${t[0]}, f(2) = ${t[1]}; f(n) = f(n − 1) + f(n − 2)`, steps: t.map((value, i) => i < 2 ? `f(${i + 1}) = ${value}` : `f(${i + 1}) = f(${i}) + f(${i - 1}) = ${t[i - 1]} + ${t[i - 2]} = ${value}`) }; return t; },
  altOp: () => { const p = pk([2, 3, -2]), q = rnd(2, 12) * sg(), a = rnd(2, 9), t = rec(a, (x, i) => i % 2 ? x + q : x * p); t.explain = { formula: `f(1) = ${a}; f(n) = \\begin{cases}${p}f(n − 1), & n\\text{ even}\\\\ f(n − 1) ${q < 0 ? '−' : '+'} ${Math.abs(q)}, & n\\text{ odd}\\end{cases}`, steps: t.map((value, i) => i === 0 ? `f(1) = ${a}` : `f(${i + 1}) = ${(i - 1) % 2 ? `${pv(t[i - 1])} ${q < 0 ? '−' : '+'} ${Math.abs(q)}` : `${pv(t[i - 1])} × ${pv(p)}`} = ${value}`) }; return t; },
  affine: () => { const m = pk([2, 3, -2, -3]), c = rnd(1, 6) * sg(), a = rnd(0, 5), t = rec(a, x => m * x + c); t.explain = { formula: `f(n) = ${m} × f(n − 1) + (${c})`, steps: t.map((value, i) => i === 0 ? `f(1) = ${a}` : `f(${i + 1}) = ${m} × f(${i}) + (${c}) = ${m} × (${t[i - 1]}) + (${c}) = ${value}`) }; return t; },
  mulAdd: () => { const s = sg(), a = rnd(2, 4), t = rec(a, (x, i) => (x + s) * (i + 2)); t.explain = { formula: `f(1) = ${a}; f(n) = (f(n − 1) ${s < 0 ? '−' : '+'} 1)n`, steps: t.map((value, i) => i ? `f(${i + 1}) = (f(${i}) ${s < 0 ? '−' : '+'} 1) × ${i + 1} = (${t[i - 1]} ${s < 0 ? '−' : '+'} 1) × ${i + 1} = ${value}` : `f(1) = ${a}`) }; return t; },
  mulHalf: () => { const a = 4 * rnd(1, 3), t = rec(a, (x, i) => x * (i + 2) / 2); t.explain = { formula: `f(1) = ${a}; f(n) = f(n − 1) × n ÷ 2`, steps: t.map((value, i) => i ? `f(${i + 1}) = ${t[i - 1]} × ${i + 1} ÷ 2 = ${value}` : `f(1) = ${a}`) }; return t; },
  inter: () => { const f = mk(), g = mk(), t = S(i => (i % 2 ? g : f)((i >> 1) + 1)); t.explain = { formula: `f(2k − 1) = ${f.label.replace(/^f\(k\) = /, '')}; f(2k) = ${g.label.replace(/^f\(k\) = /, '')}`, steps: t.map((value, i) => { const n = i + 1, k = Math.ceil(n / 2), rule = i % 2 ? g : f; return `f(${n}) = ${rule.at(k)} = ${value}`; }) }; return t; },
  parity: () => { const ix = shuffle(PF.map((_, k) => k)), [f, g] = [PF[ix[0]], PF[ix[1]]], t = S(i => (i % 2 ? g : f)(i + 1)); t.explain = { formula: `f(n) = \\begin{cases}${PF_LABELS[ix[0]]}, & n\\text{ odd}\\\\ ${PF_LABELS[ix[1]]}, & n\\text{ even}\\end{cases}`, steps: t.map((value, i) => `f(${i + 1}) = ${value}`) }; return t; },
  sqPrev: () => { const a = rnd(2, 6), d = rnd(1, 3), t = []; for (let i = 0; i < 6; i++) t.push(i % 2 ? t[i - 1] ** 2 : a + d * (i / 2)); t.explain = { formula: `f(2k − 1) = ${a} + ${d}(k − 1); f(2k) = f(2k − 1)^2`, steps: t.map((value, i) => `f(${i + 1}) = ${value}`) }; return t; },
  poly: () => { const p = pk([2, 3]), o = p === 3 ? rnd(-4, 3) : rnd(1, 8), c = p === 2 ? rnd(0, 9) * sg() : 0, r = rnd(0, 1), base = i => r ? o + 5 - i : o + i, constant = r ? o + 6 : o - 1, slope = r ? -1 : 1, t = S(i => base(i) ** p + c); t.explain = { formula: `f(n) = ${polynomialForms(constant, slope, p, c)}`, steps: t.map((value, i) => { const n = i + 1, b = base(i); return `f(${n}) = (${b})^${p}${c ? ` ${c < 0 ? '−' : '+'} ${Math.abs(c)}` : ''} = ${value}`; }) }; return t; },
  pron: () => { const o = rnd(1, 5), t = S(i => (o + i) * (o + i + 1)); t.explain = { formula: `f(n) = ${polynomial([o * (o - 1), 2 * o - 1, 1])}`, steps: t.map((value, i) => `f(${i + 1}) = (${o + i})(${o + i + 1}) = ${value}`) }; return t; },
  recip: () => { const c = pk([60, 120, 180, 360, 720]), t = S(i => c / (i + 1)); t.explain = { formula: `f(n) = ${c} ÷ n`, steps: t.map((value, i) => `f(${i + 1}) = ${c} ÷ ${i + 1} = ${value}`) }; return t; },
  prime: () => { const s = rnd(0, 9), q = rnd(0, 1), t = S(i => PR[s + i] ** (q ? 2 : 1)); t.explain = { formula: q ? 'f(n) = p_n^2; p_n = \\text{the }n\\text{-th prime}' : 'f(n) = p_n; p_n = \\text{the }n\\text{-th prime}', steps: t.map((value, i) => `f(${i + 1}) = ${PR[s + i]}${q ? `^2 = ${value}` : ` = ${value}`}`) }; return t; }
  ,entangled: () => { const ix = shuffle(F.map((_, k) => k)), [f1, f2, f3] = ix.slice(0, 3).map(i => F[i]), a = rnd(1, 5), t = S(i => f1(f2(a + i)) + f3(a + i)); t.explain = { formula: `F_1(n) = ${F_LABELS[ix[0]]}; F_2(n) = ${F_LABELS[ix[1]]}; F_3(n) = ${F_LABELS[ix[2]]}; therefore f(n) = F_1(F_2(n)) + F_3(n)`, steps: t.map((value, i) => { const n = a + i, inner = f2(n), outer = f1(inner), extra = f3(n); return `n = ${n}: F_2(${n}) = ${inner}; F_1(${inner}) = ${outer}; F_3(${n}) = ${extra}; ${outer} + ${extra} = ${value}`; }) }; return t; }
  ,nested: () => { const ix = shuffle(F.map((_, k) => k)), [f1, f2, f3, f4] = ix.slice(0, 4).map(i => F[i]), a = rnd(1, 4), t = S(i => f1(f2(f3(a + i))) + f4(a + i)); t.explain = { formula: `F_1(n) = ${F_LABELS[ix[0]]}; F_2(n) = ${F_LABELS[ix[1]]}; F_3(n) = ${F_LABELS[ix[2]]}; F_4(n) = ${F_LABELS[ix[3]]}; therefore f(n) = F_1(F_2(F_3(n))) + F_4(n)`, steps: t.map((value, i) => { const n = a + i, inner = f3(n), middle = f2(inner), outer = f1(middle), extra = f4(n); return `n = ${n}: F_3(${n}) = ${inner}; F_2(${inner}) = ${middle}; F_1(${middle}) = ${outer}; F_4(${n}) = ${extra}; ${outer} + ${extra} = ${value}`; }) }; return t; }
  /* ---- growing differences ---- */
  ,dTri: () => { const a = rnd(-5, 30), s = sg(), t = rec(a, (x, i) => x + s * TRI(i + 1)); t.explain = { formula: `f(1) = ${a}; f(n) = f(n − 1) ${sgn(s)} \\frac{(n − 1)n}{2}`, steps: t.map((v, i) => i ? `f(${i + 1}) = ${t[i - 1]} ${sgn(s)} ${TRI(i)} = ${v}` : `f(1) = ${a}`) }; return t; }
  ,dFib: () => { const a = rnd(-5, 30), s = sg(), t = rec(a, (x, i) => x + s * FIBS[i]); t.explain = { formula: `f(1) = ${a}; f(n) = f(n − 1) ${sgn(s)} F_{n − 1}; F_k \\text{ is the Fibonacci sequence } 1, 1, 2, 3, 5, \\ldots`, steps: t.map((v, i) => i ? `f(${i + 1}) = ${t[i - 1]} ${sgn(s)} ${FIBS[i - 1]} = ${v}` : `f(1) = ${a}`) }; return t; }
  ,dPrime: () => { const a = rnd(-5, 30), s = sg(), off = rnd(0, 1), t = rec(a, (x, i) => x + s * PR[off + i]); t.explain = { formula: `f(1) = ${a}; f(n) = f(n − 1) ${sgn(s)} p_{${off ? 'n' : 'n − 1'}}; ${PRIME_ROW}`, steps: t.map((v, i) => i ? `f(${i + 1}) = ${t[i - 1]} ${sgn(s)} ${PR[off + i - 1]} = ${v}` : `f(1) = ${a}`) }; return t; }
  ,dAlt: () => { const a = rnd(-5, 30), p = rnd(2, 9) * sg(); let q; do q = rnd(2, 9) * sg(); while (p + q === 0); const t = rec(a, (x, i) => x + (i % 2 ? q : p)); t.explain = { formula: `f(1) = ${a}; f(n) = \\begin{cases}f(n − 1) ${sgn(p)} ${ab(p)}, & n\\text{ even}\\\\\\\\ f(n − 1) ${sgn(q)} ${ab(q)}, & n\\text{ odd}\\end{cases}`, steps: t.map((v, j) => { if (!j) return `f(1) = ${a}`; const d = j % 2 ? p : q; return `f(${j + 1}) = ${t[j - 1]} ${sgn(d)} ${ab(d)} = ${v}`; }) }; return t; }
  ,dPowOff: () => { const a = rnd(1, 60), p = pk([2, 3]), o = rnd(2, 4), s = sg(), t = rec(a, (x, i) => x + s * (o + i) ** p), sh = o - 2; t.explain = { formula: `f(1) = ${a}; f(n) = f(n − 1) ${sgn(s)} (${sh ? 'n + ' + sh : 'n'})^${p}`, steps: t.map((v, i) => i ? `f(${i + 1}) = ${t[i - 1]} ${sgn(s)} ${o + i - 1}^${p} = ${v}` : `f(1) = ${a}`) }; return t; }
  /* ---- recurrence & operations ---- */
  ,lin2: () => { const q = pk([1, 2, 3, -1]), p = q === -1 ? 3 : pk([1, 2, 3]), t = [rnd(1, 4), rnd(1, 5)]; while (t.length < 6) t.push(p * t[t.length - 1] + q * t[t.length - 2]); t.explain = { formula: `f(1) = ${t[0]}, f(2) = ${t[1]}; f(n) = ${co(p)}f(n − 1) ${sgn(q)} ${co(q)}f(n − 2)`, steps: t.map((v, j) => j < 2 ? `f(${j + 1}) = ${v}` : `f(${j + 1}) = ${p} × ${pv(t[j - 1])} ${sgn(q)} ${ab(q)} × ${pv(t[j - 2])} = ${v}`) }; return t; }
  ,fibOff: () => { const c = rnd(1, 5) * sg(), t = [rnd(1, 5), rnd(1, 6)]; while (t.length < 6) t.push(t[t.length - 1] + t[t.length - 2] + c); t.explain = { formula: `f(1) = ${t[0]}, f(2) = ${t[1]}; f(n) = f(n − 1) + f(n − 2) ${sgn(c)} ${ab(c)}`, steps: t.map((v, j) => j < 2 ? `f(${j + 1}) = ${v}` : `f(${j + 1}) = ${pv(t[j - 1])} + ${pv(t[j - 2])} ${sgn(c)} ${ab(c)} = ${v}`) }; return t; }
  ,tribo: () => { const t = [rnd(1, 3), rnd(1, 4), rnd(2, 5)]; while (t.length < 6) t.push(t[t.length - 1] + t[t.length - 2] + t[t.length - 3]); t.explain = { formula: `f(1) = ${t[0]}, f(2) = ${t[1]}, f(3) = ${t[2]}; f(n) = f(n − 1) + f(n − 2) + f(n − 3)`, steps: t.map((v, j) => j < 3 ? `f(${j + 1}) = ${v}` : `f(${j + 1}) = ${t[j - 1]} + ${t[j - 2]} + ${t[j - 3]} = ${v}`) }; return t; }
  ,recIdx: () => { const m = pk([2, 3, -2]), s = sg(), a = rnd(1, 4), t = rec(a, (x, i) => m * x + s * (i + 2)); t.explain = { formula: `f(1) = ${a}; f(n) = ${m}f(n − 1) ${sgn(s)} n`, steps: t.map((v, i) => i ? `f(${i + 1}) = ${m} × ${pv(t[i - 1])} ${sgn(s)} ${i + 1} = ${v}` : `f(1) = ${a}`) }; return t; }
  ,cycle3: () => { const p = pk([2, 3]), q = rnd(3, 9), r = rnd(1, 5), a = rnd(2, 7), t = rec(a, (x, i) => i % 3 === 0 ? x * p : i % 3 === 1 ? x + q : x - r); t.explain = { formula: `f(1) = ${a}; f(n) = \\begin{cases}${p}f(n − 1), & n \\equiv 2 \\pmod 3\\\\\\\\ f(n − 1) + ${q}, & n \\equiv 0 \\pmod 3\\\\\\\\ f(n − 1) − ${r}, & n \\equiv 1 \\pmod 3\\end{cases}`, steps: t.map((v, j) => { if (!j) return `f(1) = ${a}`; const k = (j - 1) % 3; return `f(${j + 1}) = ${k === 0 ? `${t[j - 1]} × ${p}` : k === 1 ? `${t[j - 1]} + ${q}` : `${t[j - 1]} − ${r}`} = ${v}`; }) }; return t; }
  ,halfPlus: () => { const c = rnd(1, 6), k = rnd(1, 3) * sg(), a = 2 * c + 32 * k, t = rec(a, x => x / 2 + c); t.explain = { formula: `f(1) = ${a}; f(n) = f(n − 1) ÷ 2 + ${c}`, steps: t.map((v, i) => i ? `f(${i + 1}) = ${t[i - 1]} ÷ 2 + ${c} = ${v}` : `f(1) = ${a}`) }; return t; }
  ,sumAll: () => { const t = [rnd(1, 4), rnd(1, 6)]; while (t.length < 6) t.push(t.reduce((x, y) => x + y, 0)); t.explain = { formula: `f(1) = ${t[0]}, f(2) = ${t[1]}; f(n) = f(1) + f(2) + \\cdots + f(n − 1) \\quad (n \\ge 3)`, steps: t.map((v, j) => j < 2 ? `f(${j + 1}) = ${v}` : `f(${j + 1}) = ${t.slice(0, j).join(' + ')} = ${v}`) }; return t; }
  /* ---- interleaved / alternating ---- */
  ,derivedEven: () => { const a = rnd(2, 8), d = rnd(2, 6) * sg(), m = pk([2, 3]), c = rnd(1, 6) * sg(), t = []; for (let i = 0; i < 6; i++) t.push(i % 2 ? m * t[i - 1] + c : a + d * (i / 2)); t.explain = { formula: `f(2k − 1) = ${a} ${sgn(d)} ${ab(d)}(k − 1); f(2k) = ${m}f(2k − 1) ${sgn(c)} ${ab(c)}`, steps: t.map((v, i) => i % 2 ? `f(${i + 1}) = ${m} × ${pv(t[i - 1])} ${sgn(c)} ${ab(c)} = ${v}` : `f(${i + 1}) = ${a} ${sgn(d)} ${ab(d)}(${i / 2}) = ${v}`) }; return t; }
  ,altSign: () => { const sq = rnd(0, 1), s = sg(), a = rnd(2, 6), b = rnd(-3, 8), c = rnd(-4, 6), cs = sq ? [c, 0, 1] : [b, a], base = n => sq ? n * n + c : a * n + b, t = S(i => (i % 2 ? -s : s) * base(i + 1)); t.explain = { formula: `f(n) = (−1)^{${s > 0 ? 'n + 1' : 'n'}} (${polynomial(cs)})`, steps: t.map((v, i) => `f(${i + 1}) = (−1)^{${i + 1}${s > 0 ? ' + 1' : ''}} × (${polyAt(cs, i + 1)}) = ${v}`) }; return t; }
  /* ---- powers, primes, 1/n ---- */
  ,quad: () => { const a = rnd(1, 4), b = rnd(1, 6) * sg(), c = rnd(1, 8) * sg(), cs = [c, b, a], t = S(i => a * (i + 1) ** 2 + b * (i + 1) + c); t.explain = { formula: `f(n) = ${polynomial(cs)}`, steps: t.map((v, i) => `f(${i + 1}) = ${polyAt(cs, i + 1)} = ${v}`) }; return t; }
  ,cubic: () => { const a = pk([1, 1, 2]), b = rnd(1, 5) * sg(), c = rnd(0, 6) * sg(), cs = [c, b, 0, a], t = S(i => a * (i + 1) ** 3 + b * (i + 1) + c); t.explain = { formula: `f(n) = ${polynomial(cs)}`, steps: t.map((v, i) => `f(${i + 1}) = ${polyAt(cs, i + 1)} = ${v}`) }; return t; }
  ,figurate: () => { const K = pk(FIGURATE), o = rnd(0, 2), t = S(i => K.f(i + 1 + o)); t.explain = { formula: o ? `f(n) = g(n + ${o}); g(m) = ${K.s('m')}` : `f(n) = ${K.s('n')}`, steps: t.map((v, i) => `f(${i + 1}) = ${o ? `g(${i + 1 + o}) = ` : ''}${K.s(i + 1 + o)} = ${v}`) }; return t; }
  ,cumPow: () => { const p = pk([2, 3]), s0 = pk([0, 0, 2, -2, 5]), t = rec(1 + s0, (x, i) => x + (i + 2) ** p); t.explain = { formula: `f(n) = \\sum_{k = 1}^{n} k^${p}${s0 ? ` ${sgn(s0)} ${ab(s0)}` : ''}`, steps: t.map((v, i) => i ? `f(${i + 1}) = ${t[i - 1]} + ${i + 1}^${p} = ${v}` : `f(1) = 1${s0 ? ` ${sgn(s0)} ${ab(s0)}` : ''} = ${v}`) }; return t; }
  ,expLin: () => { const r = pk([2, 3, 4]), kind = pk(['n', 'n2', 'c']), b = rnd(1, 4) * sg(), c = rnd(1, 6) * sg(), s = sg(), add = n => kind === 'n' ? b * n : kind === 'n2' ? s * n * n : c, addStr = n => kind === 'n' ? `${sgn(b)} ${ab(b)} × ${n}` : kind === 'n2' ? `${sgn(s)} ${n}^2` : `${sgn(c)} ${ab(c)}`, t = S(i => r ** (i + 1) + add(i + 1)); t.explain = { formula: `f(n) = ${r}^n ${kind === 'n' ? `${sgn(b)} ${co(b)}n` : kind === 'n2' ? `${sgn(s)} n^2` : `${sgn(c)} ${ab(c)}`}`, steps: t.map((v, i) => `f(${i + 1}) = ${r}^${i + 1} ${addStr(i + 1)} = ${v}`) }; return t; }
  ,fact: () => { const o = rnd(0, 1), kind = pk(['c', 'n']), c = rnd(1, 4) * sg(), s = sg(), add = n => kind === 'c' ? c : s * n, t = S(i => FACT[i + 1 + o] + add(i + 1)), fn = o ? '(n + 1)!' : 'n!'; t.explain = { formula: `f(n) = ${fn} ${kind === 'c' ? `${sgn(c)} ${ab(c)}` : `${sgn(s)} n`}`, steps: t.map((v, i) => `f(${i + 1}) = ${i + 1 + o}! ${kind === 'c' ? `${sgn(c)} ${ab(c)}` : `${sgn(s)} ${i + 1}`} = ${FACT[i + 1 + o]} ${kind === 'c' ? `${sgn(c)} ${ab(c)}` : `${sgn(s)} ${i + 1}`} = ${v}`) }; return t; }
  ,recipShift: () => { const c = pk([840, 2520, 5040]), o = rnd(1, 2), t = S(i => c / (i + 1 + o)); t.explain = { formula: `f(n) = ${c} ÷ (n + ${o})`, steps: t.map((v, i) => `f(${i + 1}) = ${c} ÷ ${i + 1 + o} = ${v}`) }; return t; }
  ,primeOp: () => { const a = pk([1, 2, 3]), b = a === 1 ? rnd(1, 5) * sg() : rnd(-4, 5), s = rnd(0, 5), t = S(i => a * PR[s + i] + b), tail = b ? ` ${sgn(b)} ${ab(b)}` : ''; t.explain = { formula: `f(n) = ${co(a)}p_{${s ? 'n + ' + s : 'n'}}${tail}; ${PRIME_ROW}`, steps: t.map((v, i) => `f(${i + 1}) = ${a === 1 ? '' : a + ' × '}${PR[s + i]}${tail} = ${v}`) }; return t; }
  ,prodGap: () => { const g = pk([2, 3, 4]), o = rnd(0, 3), t = S(i => (i + 1 + o) * (i + 1 + o + g)); t.explain = { formula: o ? `f(n) = (n + ${o})(n + ${o + g})` : `f(n) = n(n + ${g})`, steps: t.map((v, i) => `f(${i + 1}) = ${i + 1 + o} × ${i + 1 + o + g} = ${v}`) }; return t; }
  ,prodThree: () => { const o = rnd(0, 2), t = S(i => (i + 1 + o) * (i + 2 + o) * (i + 3 + o)); t.explain = { formula: o ? `f(n) = (n + ${o})(n + ${o + 1})(n + ${o + 2})` : 'f(n) = n(n + 1)(n + 2)', steps: t.map((v, i) => `f(${i + 1}) = ${i + 1 + o} × ${i + 2 + o} × ${i + 3 + o} = ${v}`) }; return t; }
  /* ---- number patterns ---- */
  ,primeSum: () => { const kind = pk(['+', '×']), s = rnd(0, 7), t = S(i => kind === '+' ? PR[s + i] + PR[s + i + 1] : PR[s + i] * PR[s + i + 1]); t.explain = { formula: `f(n) = p_{${s ? 'n + ' + s : 'n'}} ${kind} p_{n + ${s + 1}}; ${PRIME_ROW}`, steps: t.map((v, i) => `f(${i + 1}) = ${PR[s + i]} ${kind} ${PR[s + i + 1]} = ${v}`) }; return t; }
  ,sieve: () => { const [list, text] = LISTS[pk(Object.keys(LISTS))], st = rnd(0, 4), t = list.slice(st, st + 6); t.explain = { formula: text, steps: t.map((v, i) => `f(${i + 1}) = ${v}`) }; return t; }
  ,fibSq: () => { const o = rnd(0, 3), t = S(i => FIBS[o + i] ** 2); t.explain = { formula: `f(n) = F_{${o ? 'n + ' + o : 'n'}}^2; F_1 = F_2 = 1; F_k = F_{k − 1} + F_{k − 2}`, steps: t.map((v, i) => `f(${i + 1}) = ${FIBS[o + i]}^2 = ${v}`) }; return t; }
  ,divisor: () => { const kind = pk(['count', 'sum']), s = rnd(1, 14), t = S(i => { const d = divisors(s + i); return kind === 'count' ? d.length : d.reduce((x, y) => x + y, 0); }); t.explain = { formula: kind === 'count' ? `the number of positive divisors of ${s}, ${s + 1}, ${s + 2}, and so on` : `the sum of the positive divisors of ${s}, ${s + 1}, ${s + 2}, and so on`, steps: t.map((v, i) => { const d = divisors(s + i); return `f(${i + 1}) = ${kind === 'count' ? d.length : d.join(' + ')} = ${v}`; }) }; return t; }
  /* ---- entangled / nested composition ---- */
  ,entProd: () => { const ix = shuffle(F.map((_, i) => i)), [f1, f2] = ix.slice(0, 2).map(i => F[i]), a = rnd(1, 5), t = S(i => f1(a + i) * f2(a + i)); t.explain = { formula: `F_1(n) = ${F_LABELS[ix[0]]}; F_2(n) = ${F_LABELS[ix[1]]}; therefore f(n) = F_1(n) × F_2(n)`, steps: t.map((v, i) => { const n = a + i; return `f(${i + 1}): n = ${n}; F_1(${n}) = ${f1(n)}; F_2(${n}) = ${f2(n)}; ${f1(n)} × ${f2(n)} = ${v}`; }) }; return t; }
  ,entDiff: () => { const ix = shuffle(F.map((_, i) => i)), [f1, f2, f3] = ix.slice(0, 3).map(i => F[i]), a = rnd(1, 5), t = S(i => f1(f2(a + i)) - f3(a + i)); t.explain = { formula: `F_1(n) = ${F_LABELS[ix[0]]}; F_2(n) = ${F_LABELS[ix[1]]}; F_3(n) = ${F_LABELS[ix[2]]}; therefore f(n) = F_1(F_2(n)) − F_3(n)`, steps: t.map((v, i) => { const n = a + i, inner = f2(n), outer = f1(inner), extra = f3(n); return `f(${i + 1}): n = ${n}; F_2(${n}) = ${inner}; F_1(${inner}) = ${outer}; F_3(${n}) = ${extra}; ${outer} − ${pv(extra)} = ${v}`; }) }; return t; }
  ,nestedPure: () => { const ix = shuffle(F.map((_, i) => i)), [f1, f2, f3] = ix.slice(0, 3).map(i => F[i]), a = rnd(1, 4), t = S(i => f1(f2(f3(a + i)))); t.explain = { formula: `F_1(n) = ${F_LABELS[ix[0]]}; F_2(n) = ${F_LABELS[ix[1]]}; F_3(n) = ${F_LABELS[ix[2]]}; therefore f(n) = F_1(F_2(F_3(n)))`, steps: t.map((v, i) => { const n = a + i, x = f3(n), y = f2(x); return `f(${i + 1}): n = ${n}; F_3(${n}) = ${x}; F_2(${x}) = ${y}; F_1(${y}) = ${v}`; }) }; return t; }
  ,entParity: () => { const ix = shuffle(F.map((_, i) => i)), [f1, f2, f3] = ix.slice(0, 3).map(i => F[i]), t = S(i => (i % 2 ? f3(i + 1) : f1(f2(i + 1)))); t.explain = { formula: `F_1(n) = ${F_LABELS[ix[0]]}; F_2(n) = ${F_LABELS[ix[1]]}; F_3(n) = ${F_LABELS[ix[2]]}; f(n) = \\begin{cases}F_1(F_2(n)), & n\\text{ odd}\\\\\\\\ F_3(n), & n\\text{ even}\\end{cases}`, steps: t.map((v, i) => { const n = i + 1; return i % 2 ? `f(${n}) = F_3(${n}) = ${v}` : `f(${n}) = F_1(F_2(${n})) = F_1(${f2(n)}) = ${v}`; }) }; return t; }
};
const GROUPS = {
  basic: ['Arithmetic & geometric', '＋', ['arith', 'geom', 'geomDown']],
  diff: ['Growing differences', '↗', ['dArith', 'dGeom', 'dPow', 'dTri', 'dFib', 'dPrime', 'dAlt', 'dPowOff']],
  rec: ['Recurrence & operations', '↻', ['fib', 'altOp', 'affine', 'mulAdd', 'mulHalf', 'lin2', 'fibOff', 'tribo', 'recIdx', 'cycle3', 'halfPlus', 'sumAll']],
  inter: ['Two interleaved rules', '⇄', ['inter', 'parity', 'sqPrev', 'derivedEven', 'altSign']],
  pow: ['Powers, primes, 1/n', '²', ['poly', 'pron', 'recip', 'prime', 'quad', 'cubic', 'figurate', 'cumPow', 'expLin', 'fact', 'recipShift', 'primeOp', 'prodGap', 'prodThree']],
  num: ['Number patterns', '#', ['primeSum', 'sieve', 'fibSq', 'divisor']],
  entangled: ['Entangled functions', '∑', ['entangled', 'nested', 'entProd', 'entDiff', 'nestedPure', 'entParity']]
};
const valid = t => t.every(x => Number.isInteger(x) && Math.abs(x) < 1e5) && new Set(t).size > 3;
function seqQ(id) {
  let pool = GROUPS[id][2];
  if (id === 'entangled') { const d = db.settings.difficulty; if (d === 'hard') pool = ['entangled', 'entProd', 'entDiff']; else if (d === 'expert') pool = ['nested', 'nestedPure', 'entParity']; }
  const family = pk(pool); let t; do t = FAM[family](); while (!valid(t));
  const h = rnd(0, 9) < 7 ? 5 : rnd(0, 4), ans = t[h], dl = Math.abs(t[2] - t[1]) || 3;
  const o = mcq(id, t.map((x, i) => i === h ? '?' : x).join(', '), ans, () => ans + pk([-1, 1, -2, 2, 10, -10, dl, -dl, dl + 1, -dl - 1, rnd(-9, 9)]));
  o.seq = t.map((x, i) => i === h ? null : x); o.fullSeq = t; o.position = h; o.family = family; o.explanation = explanation(family, t, t.explain); return o;
}
const TOPICS = Object.fromEntries(Object.entries(GROUPS).map(([id, [label, icon]]) => [id, { label, icon, gen: () => seqQ(id) }]));
[...new Set(BANK.map(b => b.topic))].forEach(t => TOPICS['bank:' + t] = { label: t,
  gen() { const p = BANK.filter(b => b.topic === t), it = p[rnd(0, p.length - 1)], ans = it.choices[it.answer], c = shuffle([...it.choices]);
    return { topic: 'bank:' + t, q: it.q, choices: c, answer: c.indexOf(ans) }; } });

const questionKey = q => JSON.stringify([q.topic, q.family, q.q, q.position ?? null, q.fullSeq || null]);
function nextUniqueQuestion(seen) {
    let q;
    for (let attempt = 0; attempt < 100; attempt++) {
      q = pick();
      if (!seen.has(questionKey(q))) {
        seen.add(questionKey(q));
        return q;
      }
    }
    // Keep the requested question count even when a narrow custom filter has a small pool.
    return q;
}
function seededQuestions(count, seed) {
  const seen = new Set(), previousContext = generationContext;
  generationContext = { recent: [] };
  const questions = withRng(makeRng(seed), () => Array.from({ length: count }, () => {
    const q = nextUniqueQuestion(seen);
    generationContext.recent.push(q.family || q.topic);
    if (generationContext.recent.length > 2) generationContext.recent.shift();
    return q;
  }));
  generationContext = previousContext;
  return questions;
}
function exportPracticePdf() {
      const count = Math.max(1, Math.floor(Number(db.settings.n) || 10));
      const requestedSeed = $('#pdfCurrentSeed').checked ? run?.seed || normalizeSeed($('#seedInput').value) : 0;
      if ($('#pdfCurrentSeed').checked && !requestedSeed) {
        alert('Start a seeded run or enter a seed before using the current seed.');
        return;
      }
      const seed = requestedSeed || newSeed(), seen = new Set();
      const questions = seededQuestions(count, seed);
      const includeSolutions = $('#pdfSolutions').checked, includeHints = $('#pdfHints').checked;
    const questionBlocks = questions.map((q, index) => {
      const choices = q.choices?.map((choice, choiceIndex) => `<span><b>${choiceIndex + 1}</b>${esc(choice)}</span>`).join('') || '<span class="answer-line">Answer: ____________________</span>';
      const hint = includeHints && q.explanation?.formula ? `<p class="pdf-hint"><b>Hint:</b> ${formulaMarkup(q.explanation.formula)}</p>` : '';
      return `<article class="pdf-question"><h2>Question ${index + 1}</h2><p class="topic">${esc(TOPICS[q.topic]?.label || q.topic)} · ${esc(q.family || 'sequence')}</p><p class="sequence-question">${esc(q.q)}</p><div class="pdf-choices">${choices}</div>${hint}</article>`;
    }).join('');
    const solutionBlocks = questions.map((q, index) => `<article class="pdf-solution"><h2>Question ${index + 1} solution</h2><p class="topic">${esc(TOPICS[q.topic]?.label || q.topic)} · ${esc(q.family || 'sequence')}</p>${q.fullSeq ? `<div class="pdf-sequence">${q.fullSeq.map((value, position) => `<span class="${position === q.position ? 'missing' : ''}"><b>P${position + 1}</b>${value}</span>`).join('')}</div><div class="pdf-formula">${formulaMarkup(q.explanation?.formula || 'Sequence rule')}</div><ol>${(q.explanation?.steps || []).map(step => `<li>\\(${latex(step)}\\)</li>`).join('')}</ol><p class="pdf-answer">Correct answer: <strong>${esc(q.correct || q.choices?.[q.answer] || '')}</strong></p>` : `<p>${esc(q.q)}</p>`}</article>`).join('');
    const printWindow = window.open('', '_blank');
    if (!printWindow) { alert('Please allow pop-ups to generate the PDF.'); return; }
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(String(seed))}`;
    const solutionSection = includeSolutions ? `<section class="solutions"><h1>Solutions</h1><p class="meta">Use the positional substitutions to check each answer.</p>${solutionBlocks}</section>` : '';
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>TCAS Sequence Trainer · Practice Sheet</title>
      <style>
        @page{size:A4;margin:15mm}*{box-sizing:border-box}body{margin:0;color:#171717;font:13px Arial,sans-serif}h1{margin:0 0 5px;font:700 25px Georgia,serif}h2{margin:0 0 7px;padding-bottom:5px;border-bottom:1px solid #c8d1da;font:700 17px Georgia,serif}.meta,.topic{color:#5d6872}.meta{margin:0 0 20px}.pdf-header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:18px}.seed{margin:8px 0 0;font:700 15px monospace;color:#145498}.seed-qr{width:90px;height:90px;image-rendering:auto}.pdf-question,.pdf-solution{page-break-inside:avoid;border:1px solid #d5dce2;border-radius:7px;padding:12px 14px;margin:0 0 12px}.sequence-question{margin:10px 0 14px;font:700 15px monospace;letter-spacing:.02em}.pdf-choices{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}.pdf-choices span{min-height:32px;padding:8px;border:1px solid #c6ced5;border-radius:5px;font:12px monospace}.pdf-choices b{display:block;color:#145498;font-size:9px;margin-bottom:3px}.answer-line{grid-column:1/-1}.pdf-hint{padding:8px 10px;border-left:3px solid #c97f50;background:#fff7f1}.solutions{page-break-before:always}.pdf-sequence{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0}.pdf-sequence span{position:relative;display:grid;place-items:center;min-width:52px;min-height:42px;padding:11px 7px 15px;border:1px solid #bcc6cf;border-radius:5px;font:700 15px monospace}.pdf-sequence span b{position:absolute;bottom:2px;color:#6b7680;font:8px monospace}.pdf-sequence .missing{border:2px solid #c97f50;color:#c97f50}.pdf-formula{padding:9px 12px;border-left:3px solid #145498;background:#f2f5f8;font-size:16px;line-height:1.55}.formula-row{display:block}.pdf-solution ol{margin:10px 0;padding-left:28px}.pdf-solution li{padding:6px 0;border-bottom:1px solid #e1e5e8;page-break-inside:avoid}.pdf-answer{margin:12px 0 0}.footer{margin-top:20px;color:#7a858d;font-size:10px}@media print{.solutions{page-break-before:always}.pdf-question,.pdf-solution{break-inside:avoid}}
      </style><script>window.MathJax={tex:{inlineMath:[['\\\\(','\\\\)']],displayMath:[['\\\\[','\\\\]']]}};</script><script defer src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js"></script>
      </head><body><header class="pdf-header"><div><h1>TCAS Sequence Trainer</h1><p class="meta">Practice sheet · ${count} questions · ${esc(db.settings.difficulty)} difficulty · ${esc(db.settings.composition)} composition</p><p class="seed">Seed: <strong>${seed}</strong></p></div><img class="seed-qr" src="${qrUrl}" alt="QR code for seed ${seed}"></header><main><section>${questionBlocks}</section>${solutionSection}</main><p class="footer">Generated from the trainer settings. Enter the seed in the trainer to reproduce this exact question set.</p><script>window.addEventListener('load',()=>{const wait=()=>window.MathJax?.startup?.promise?window.MathJax.startup.promise.then(()=>window.print()):setTimeout(wait,100);wait()});</script></body></html>`);
    printWindow.document.close();
}

/* ============ STORAGE ============ */
const KEY = 'sprint-exam-v1';
let db = { topics: {}, sessions: [], tags: {}, settings: { n: 10, scale: 1, mode: 'choice', difficulty: 'mixed', composition: 'balanced', training: false, tagFilter: 'all', configOpen: true, off: [], statFilter: 'all', pdfSolutions: true, pdfHints: false } };
try { const x = JSON.parse(localStorage.getItem(KEY)); if (x) db = { ...db, ...x, settings: { ...db.settings, ...x.settings } }; } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };

/* ============ HELPERS ============ */
const $ = s => document.querySelector(s);
const fmt = ms => { const s = ms / 1000; return s >= 60 ? `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}` : s.toFixed(2); };
const acc = t => t && t.n ? t.c / t.n : null;
const enabled = () => Object.keys(TOPICS).filter(id => !db.settings.off.includes(id));
function weight(id) { // weak or slow or unseen topics appear more often
  const t = db.topics[id]; if (!t || t.n < 3) return 2.5;
  const avg = t.ms / t.n, all = Object.values(db.topics).filter(x => x.n), mean = all.reduce((s, x) => s + x.ms / x.n, 0) / all.length;
  const difficulty = 1 - t.c / t.n, overdue = t.due && t.due <= Date.now() ? 2 : 0;
  return db.settings.training ? 1 + 8 * difficulty + overdue : 1 + 4 * difficulty + Math.max(0, Math.min(1.5, avg / mean - 1));
}
function pick() {
  let ids = enabled();
  if (db.settings.tagFilter && db.settings.tagFilter !== 'all') {
      const tagged = new Set(db.tags?.[db.settings.tagFilter] || []);
      const taggedIds = ids.filter(id => tagged.has(id) || (GROUPS[id]?.[2] || []).some(family => tagged.has(family)));
    if (taggedIds.length) ids = taggedIds;
  }
  if (db.settings.training) {
    const due = ids.filter(id => !db.topics[id]?.due || db.topics[id].due <= Date.now());
    if (due.length) ids = due;
  }
  const currentContext = generationContext || run;
  if (currentContext?.recent?.length) {
    const fresh = ids.filter(id => !currentContext.recent.includes(id));
    if (fresh.length) ids = fresh;
  }
  if (db.settings.difficulty === 'hard' && ids.includes('entangled')) ids = ['entangled'];
  if (db.settings.difficulty === 'expert' && ids.includes('entangled')) ids = ['entangled'];
  if (db.settings.difficulty === 'normal') ids = ids.filter(id => id !== 'entangled');
  if (db.settings.difficulty === 'mixed' && db.settings.composition === 'balanced') ids = ids.filter(id => id !== 'entangled');
  if (db.settings.difficulty === 'mixed' && db.settings.composition === 'light') ids = ids.filter(id => id !== 'entangled' && id !== 'pow');
  if (!ids.length) ids = enabled();
  const w = ids.map(weight); let r = randomValue() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < ids.length; i++) if ((r -= w[i]) <= 0) return TOPICS[ids[i]].gen();
  return TOPICS[ids[0]].gen();
}

/* ============ DASHBOARD ============ */
function renderDash() {
  const N = db.settings.n, same = db.sessions.filter(s => s.n === N), last5 = same.slice(-5);
  $('#pb').textContent = same.length ? fmt(Math.min(...same.map(s => s.final))) : '--';
  $('#ao5').textContent = last5.length === 5 ? fmt(last5.reduce((a, s) => a + s.final, 0) / 5) : '--';
  $('#runs').textContent = db.sessions.length;
  const filter = db.settings.statFilter || 'all';
  const rows = Object.keys(TOPICS).filter(id => db.topics[id]?.n).map(id => ({ id, t: db.topics[id] }))
    .filter(r => filter === 'all' || (filter === 'weak' ? acc(r.t) < .8 : acc(r.t) >= .8))
    .sort((a, b) => acc(a.t) - acc(b.t));
  $('#stats').innerHTML = rows.length ? `<div class="row head"><span>Topic</span><span class="m">Acc</span><span class="m">Avg s</span><span class="m">Qs</span></div>` +
    rows.map((r, i) => `<div class="row ${i === 0 && acc(r.t) < .9 ? 'weak' : ''}"><span>${TOPICS[r.id].label}${i === 0 && acc(r.t) < .9 ? '<em class="tag">FOCUS</em>' : ''}</span><span class="m">${Math.round(acc(r.t) * 100)}%</span><span class="m">${(r.t.ms / r.t.n / 1000).toFixed(1)}</span><span class="m">${r.t.n}</span><div class="bar"><i style="width:${acc(r.t) * 100}%"></i></div></div>`).join('')
    : '<p class="empty">Complete a run to see accuracy and speed per topic. Weak topics are served more often automatically.</p>';
  $('#hist').innerHTML = db.sessions.length ? db.sessions.slice(-6).reverse().map(s => `<div class="row" style="grid-template-columns:1fr 80px 64px"><span>${new Date(s.d).toLocaleDateString()} · ${s.n}Q</span><span class="m">${fmt(s.final)}</span><span class="m">${Math.round(s.c / s.n * 100)}%</span></div>`).join('') : '<p class="empty">No runs yet.</p>';
  const chart = db.sessions.slice(-8);
  $('#chart').innerHTML = chart.length ? chart.map(s => `<div class="chart-col"><i style="height:${Math.max(8, s.c / s.n * 100)}%" title="${Math.round(s.c / s.n * 100)}% accuracy"></i><span>${Math.round(s.c / s.n * 100)}%</span></div>`).join('') : '<p class="empty">Complete runs to see your record chart.</p>';
  const weak = Object.entries(db.topics).filter(([, t]) => t.n && acc(t) < .8).sort((a, b) => acc(a[1]) - acc(b[1])).slice(0, 3);
  $('#guide').innerHTML = weak.length ? `<p>Prioritize ${weak.map(([id]) => `<b>${TOPICS[id]?.label || id}</b>`).join(', ')}. Slow down on the first difference, then explain the rule aloud before choosing.</p>` : '<p>Keep mixing topics. Aim for 90% accuracy before pushing the difficulty higher.</p>';
  const frequency = Object.entries(db.topics).filter(([, t]) => t.n).sort((a, b) => b.n - a.n);
  $('#frequency').innerHTML = frequency.length ? frequency.map(([id, t]) => `<div class="freq-row"><span>${TOPICS[id]?.label || id}</span><b>${t.n}</b><i style="width:${Math.min(100, t.n / Math.max(...frequency.map(([, x]) => x.n)) * 100)}%"></i><small>${t.due && t.due > Date.now() ? 'scheduled' : 'due now'}</small></div>`).join('') : '<p class="empty">Frequency appears after your first run.</p>';
  const tagSelect = $('#selTagFilter');
  if (tagSelect) {
    tagSelect.innerHTML = '<option value="all">All functions</option>' + Object.keys(db.tags || {}).sort().map(tag => `<option value="${esc(tag)}">${esc(tag)}</option>`).join('');
    tagSelect.value = db.settings.tagFilter || 'all';
  }
}
function renderTopics() {
  $('#topicList').innerHTML = Object.entries(TOPICS).map(([id, t]) => `<label class="topic"><input type="checkbox" data-id="${id}" ${db.settings.off.includes(id) ? '' : 'checked'}><span class="topic-icon">${t.icon || '•'}</span>${t.label}</label>`).join('');
  document.querySelectorAll('#topicList input').forEach(el => el.onchange = () => {
    const off = new Set(db.settings.off); el.checked ? off.delete(el.dataset.id) : off.add(el.dataset.id);
    db.settings.off = [...off]; $('#btnStart').disabled = !enabled().length; $('#btnPdf').disabled = !enabled().length; save();
  });
  $('#btnStart').disabled = !enabled().length;
  $('#btnPdf').disabled = !enabled().length;
}

/* ============ RUN (focus mode) ============ */
let run = null, generationContext = null, raf = 0;
const stage = $('#stage');
function start(seedValue) {
  if (!enabled().length) return;
  const seed = normalizeSeed(seedValue || newSeed());
  run = { n: db.settings.n, seed, rng: makeRng(seed), i: 0, c: 0, wrong: 0, streak: 0, best: 0, t0: 0, qt: 0, by: {}, answers: [], recent: [], seen: new Set(), q: null, locked: false, state: 'ready' };
  stage.classList.remove('solution-focus');
  document.body.classList.add('focus'); stage.hidden = false; closeSettings();
  stage.innerHTML = `<div class="clock idle" id="clock">0.00</div><p class="meta">Press <b>SPACE</b> to begin · ${run.n} questions · Seed <b>${run.seed}</b> · Esc to cancel</p>`;
}
function begin() { run.state = 'go'; run.t0 = performance.now(); tick(); next(); }
function revealSeedSolutions(seedValue) {
  if (!enabled().length) return;
  const seed = normalizeSeed(seedValue);
  if (!seed) { $('#seedInput').focus(); return; }
  const questions = seededQuestions(Math.max(1, Math.floor(Number(db.settings.n) || 10)), seed);
  run = { n: questions.length, seed, i: questions.length, c: 0, wrong: 0, streak: 0, best: 0, t0: performance.now(), qt: 0, by: {}, answers: questions.map(q => ({ q: q.q, seq: q.seq, fullSeq: q.fullSeq, position: q.position, topic: q.topic, family: q.family, explanation: q.explanation, chosen: '—', correct: q.choices?.[q.answer] || '', ok: null, time: 0 })), recent: [], seen: new Set(), q: null, locked: true, state: 'done', preview: true };
  document.body.classList.add('focus'); stage.hidden = false; closeSettings();
  finish(true);
}
function tick() { const c = $('#clock'); if (c) c.textContent = fmt(performance.now() - run.t0); raf = requestAnimationFrame(tick); }
function next() {
  run.q = withRng(run.rng, () => nextUniqueQuestion(run.seen)); run.locked = false; run.qt = performance.now();
  run.recent.push(run.q.family || run.q.topic); if (run.recent.length > 2) run.recent.shift();
  const q = run.q, typed = db.settings.mode === 'type';
  const body = q.seq ? `<div class="seq animate-in">${q.seq.map(x => `<i class="${x === null ? 'gap' : ''}">${x === null ? '?' : x}</i>`).join('')}</div>` : `<div class="q animate-in">${q.q}</div>`;
  const inp = typed ? `<input class="ans-input animate-in" id="ans" type="text" autocomplete="off" placeholder="Answer ↵" aria-label="Answer"><div class="reveal" id="rev"></div>`
    : `<div class="choices animate-in">${q.choices.map((c, i) => `<button class="ch" data-i="${i}"><kbd>${i + 1}</kbd>${c}</button>`).join('')}</div>`;
  stage.innerHTML = `<div class="prog" style="width:${run.i / run.n * 100}%"></div>
  <div class="clock" id="clock">${fmt(performance.now() - run.t0)}</div>
  <div class="meta animate-in"><span>Q <b>${run.i + 1}/${run.n}</b></span><span>Streak <b>${run.streak}</b></span><span>Miss <b>${run.wrong}</b></span></div>${body}${inp}`;
  if (typed) { const a = $('#ans'); a.focus(); a.onkeydown = e => { if (e.key === 'Enter' && a.value.trim()) submit(a.value); }; }
  else stage.querySelectorAll('.ch').forEach(b => b.onclick = () => answer(+b.dataset.i));
}
function judge(ok, delay) {
  run.locked = true;
  const dt = performance.now() - run.qt, id = run.q.topic;
  const currentAnswer = run.answers[run.answers.length - 1]; if (currentAnswer) currentAnswer.time = dt;
  const t = db.topics[id] || (db.topics[id] = { n: 0, c: 0, ms: 0 }); t.n++; t.ms += dt; if (ok) t.c++;
  t.ease = ok ? Math.min(2.5, (t.ease || 1.3) + .08) : Math.max(1, (t.ease || 1.3) - .2);
  t.due = Date.now() + (ok ? t.ease * 86400000 : 15 * 60000);
  const b = run.by[id] || (run.by[id] = { n: 0, c: 0, ms: 0 }); b.n++; b.ms += dt; if (ok) b.c++;
  run.i++; ok ? (run.c++, run.streak++, run.best = Math.max(run.best, run.streak)) : (run.wrong++, run.streak = 0);
  setTimeout(() => run && (run.i >= run.n ? finish() : next()), delay);
}
function answer(i) {
  if (!run || run.locked || run.state !== 'go' || i >= run.q.choices.length) return;
  const ok = i === run.q.answer, bs = stage.querySelectorAll('.ch');
  run.answers.push({ q: run.q.q, seq: run.q.seq, fullSeq: run.q.fullSeq, position: run.q.position, topic: run.q.topic, family: run.q.family, explanation: run.q.explanation, chosen: run.q.choices[i], correct: run.q.choices[run.q.answer], ok });
  bs[run.q.answer].classList.add('ok'); if (!ok) bs[i].classList.add('bad');
  judge(ok, ok ? 220 : 800);
}
function submit(v) {
  if (!run || run.locked || run.state !== 'go') return;
  const norm = x => String(x).trim().replace(/[−–]/g, '-').replace(/\s+/g, '').toLowerCase();
  const right = run.q.choices[run.q.answer], ok = norm(v) === norm(right), a = $('#ans');
  a.disabled = true; a.classList.add(ok ? 'ok' : 'bad'); if (!ok) $('#rev').textContent = 'Answer: ' + right;
  run.answers.push({ q: run.q.q, seq: run.q.seq, fullSeq: run.q.fullSeq, position: run.q.position, topic: run.q.topic, family: run.q.family, explanation: run.q.explanation, chosen: v, correct: right, ok });
  judge(ok, ok ? 220 : 1100);
}
function finish(preview = false) {
  cancelAnimationFrame(raf);
  const total = performance.now() - run.t0, final = total + run.wrong * 2000;
  const prev = db.sessions.filter(s => s.n === run.n), pb = !prev.length || final < Math.min(...prev.map(s => s.final));
  if (!preview) { db.sessions.push({ d: Date.now(), n: run.n, c: run.c, wrong: run.wrong, total, final, seed: run.seed, answers: run.answers }); save(); }
  const rows = Object.entries(run.by).map(([id, b]) => `<div class="row" style="grid-template-columns:1fr 60px 60px"><span>${TOPICS[id]?.label || id}</span><span class="m">${Math.round(b.c / b.n * 100)}%</span><span class="m">${(b.ms / b.n / 1000).toFixed(1)}s</span></div>`).join('');
  const cards = run.answers.map((a, i) => `<button class="review-card ${a.ok === true ? 'right' : a.ok === false ? 'wrong' : 'preview'}" data-review="${i}"><span class="card-number">${a.ok === true ? '✓' : a.ok === false ? '×' : '→'}</span><span><b>Q${i + 1} · ${a.ok === null ? 'Solution' : a.ok ? 'Correct' : 'Incorrect'}</b><small>${esc(TOPICS[a.topic]?.label || a.topic)} · ${esc(a.family || 'sequence')} · ⏱ ${fmt(a.time || 0)}</small></span><span class="card-arrow">→</span></button>`).join('');
  stage.innerHTML = `<div class="clock animate-in ${pb ? 'pb' : ''}">${fmt(final)}</div>
  <p class="meta">${preview ? 'Solution reveal' : pb ? '<b class="pb">NEW PERSONAL BEST</b>' : 'Final time'} · Seed <b>${run.seed}</b></p>
  <div class="result-grid"><div><span>Accuracy</span><b>${Math.round(run.c / run.n * 100)}%</b></div><div><span>Avg / Q</span><b>${(total / run.n / 1000).toFixed(2)}s</b></div><div><span>Best streak</span><b>${run.best}</b></div></div>
  <div style="width:min(600px,100%)">${rows}</div><section class="review-layout"><div class="review-list"><h3>Answer review</h3>${cards}</div><aside class="solution-pane" id="solutionPane"><div class="solution-empty">Select an answer card to inspect its solution.</div></aside></section>
  <div class="actions"><button class="btn-primary" id="again">Again</button><button class="btn-secondary" id="home">Home</button></div>`;
  const openSolution = index => {
    const a = run.answers[index], pane = $('#solutionPane');
    stage.classList.add('solution-focus');
    stage.querySelectorAll('.review-card').forEach(item => item.classList.remove('selected'));
    stage.querySelector(`[data-review="${index}"]`).classList.add('selected');
    pane.classList.remove('solution-in'); void pane.offsetWidth; pane.classList.add('solution-in');
    pane.innerHTML = `<div class="solution-head"><div><span class="eyebrow">${a.ok === null ? 'Seed solution' : a.ok ? 'Correct response' : 'Incorrect response'}</span><h2>Question ${index + 1}</h2></div><span class="solution-status ${a.ok === null ? '' : a.ok ? 'good' : 'bad'}">${a.ok === null ? '→' : a.ok ? '✓' : '×'}</span></div>
      <p class="solution-topic">${esc(TOPICS[a.topic]?.label || a.topic)} · ${esc(a.family || 'sequence')}</p>
      ${a.fullSeq ? `<div class="solution-sequence">${a.fullSeq.map((x, p) => `<span class="${p === a.position ? 'missing' : ''}">${p === a.position ? esc(a.correct) : x}<small>P${p + 1}</small></span>`).join('')}</div><p class="position-note">The missing value was position ${a.position + 1}.</p><div class="math-block">${formulaMarkup(a.explanation?.formula || 'Sequence rule')}</div><ol class="solution-steps">${(a.explanation?.steps || []).map((step, s) => `<li style="--step:${s}"><span>${s + 1}</span><span class="math-step">\\(${latex(step)}\\)</span></li>`).join('')}</ol>` : `<p class="math-block">${esc(a.q)}</p>`}
      <div class="answer-compare">${a.ok === null ? '' : `<span>Your answer<strong class="${a.ok ? 'correct-text' : 'incorrect-text'}">${esc(a.chosen)}</strong></span>`}<span>Correct answer<strong>${esc(a.correct)}</strong></span></div>
      <button class="tag-action" data-tag-family="${esc(a.topic)}">＋ Save function tag</button>`;
    pane.querySelector('.tag-action').onclick = () => openTagDialog(a.family || a.topic, pane.querySelector('.tag-action'));
    if (window.MathJax?.typesetPromise) window.MathJax.typesetPromise([pane]);
  };
  stage.querySelectorAll('.review-card').forEach((card, i) => card.onclick = () => openSolution(i));
  run.state = 'done'; $('#again').onclick = start; $('#home').onclick = quit; $('#again').focus();
}
let tagContext = null;
function openTagDialog(family, button) {
  tagContext = { family, button };
  const dialog = $('#tagDialog');
  $('#tagName').value = family;
  dialog.hidden = false;
  requestAnimationFrame(() => { $('#tagName').focus(); $('#tagName').select(); });
}
function closeTagDialog() {
  $('#tagDialog').hidden = true;
  tagContext = null;
}
$('#tagForm').onsubmit = e => {
  e.preventDefault();
  const name = $('#tagName').value.trim();
  if (!name || !tagContext) return;
  db.tags[name] = [...new Set([...(db.tags[name] || []), tagContext.family])];
  save(); renderDash();
  tagContext.button.textContent = `✓ Saved as ${name}`;
  closeTagDialog();
};
$('#tagCancel').onclick = closeTagDialog;
$('#tagCancelSecondary').onclick = closeTagDialog;
$('#tagDialog').onclick = e => { if (e.target === e.currentTarget) closeTagDialog(); };
function quit() { cancelAnimationFrame(raf); run = null; stage.classList.remove('solution-focus'); stage.hidden = true; stage.innerHTML = ''; document.body.classList.remove('focus'); renderDash(); }

/* ============ SETTINGS + INPUT ============ */
const layout = $('#layout'), toggleSettings = () => layout.classList.toggle('settings-open'), closeSettings = () => layout.classList.remove('settings-open');
$('#btnSet').onclick = toggleSettings; $('#btnClose').onclick = closeSettings; $('#btnStart').onclick = () => start();
$('#btnSeedStart').onclick = () => {
  const seed = normalizeSeed($('#seedInput').value);
  if (!seed) { $('#seedInput').focus(); return; }
  start(seed);
};
$('#btnSeedSolutions').onclick = () => revealSeedSolutions(normalizeSeed($('#seedInput').value));
$('#qrInput').onchange = async e => {
  const file = e.target.files?.[0]; e.target.value = '';
  if (!file) return;
  if (!('BarcodeDetector' in window)) { alert('QR scanning is not supported in this browser. Enter the seed number printed beside the QR code.'); return; }
  try {
    const detector = new BarcodeDetector({ formats: ['qr_code'] });
    const codes = await detector.detect(await createImageBitmap(file));
    const seed = codes[0]?.rawValue?.match(/\d+/)?.[0];
    if (!seed) throw new Error('No numeric seed found');
    $('#seedInput').value = normalizeSeed(seed);
    start(seed);
  } catch (error) {
    alert(`Could not read a numeric seed from that QR code: ${error.message}`);
  }
};
$('#btnPdf').onclick = exportPracticePdf;
$('#pdfSolutions').checked = db.settings.pdfSolutions !== false;
$('#pdfHints').checked = !!db.settings.pdfHints;
$('#pdfCurrentSeed').checked = !!db.settings.pdfCurrentSeed;
$('#pdfCurrentSeed').onchange = e => { db.settings.pdfCurrentSeed = e.target.checked; save(); };
$('#pdfSolutions').onchange = e => { db.settings.pdfSolutions = e.target.checked; save(); };
$('#pdfHints').onchange = e => { db.settings.pdfHints = e.target.checked; save(); };
$('#selMode').value = db.settings.mode || 'choice'; $('#selMode').onchange = e => { db.settings.mode = e.target.value; save(); };
$('#selDifficulty').value = db.settings.difficulty || 'mixed'; $('#selDifficulty').onchange = e => { db.settings.difficulty = e.target.value; save(); };
$('#selComposition').value = db.settings.composition || 'balanced'; $('#selComposition').onchange = e => { db.settings.composition = e.target.value; save(); };
$('#chkTraining').checked = !!db.settings.training; $('#chkTraining').onchange = e => { db.settings.training = e.target.checked; save(); renderDash(); };
$('#selTagFilter').onchange = e => { db.settings.tagFilter = e.target.value; save(); };
$('#problemConfig').open = db.settings.configOpen !== false;
$('#problemConfig').ontoggle = e => { db.settings.configOpen = e.target.open; save(); };
$('#selStatFilter').value = db.settings.statFilter || 'all'; $('#selStatFilter').onchange = e => { db.settings.statFilter = e.target.value; save(); renderDash(); };
const presetCounts = new Set(['5', '10', '20', '30', '50']), customN = $('#customN');
const syncQuestionCount = () => {
  const isCustom = !presetCounts.has(String(db.settings.n));
  $('#selN').value = isCustom ? 'custom' : String(db.settings.n);
  customN.hidden = !isCustom;
  if (isCustom) customN.value = db.settings.n;
};
$('#selN').onchange = e => {
  if (e.target.value === 'custom') { customN.hidden = false; customN.value = db.settings.n; customN.focus(); return; }
  db.settings.n = +e.target.value; customN.hidden = true; save(); renderDash();
};
customN.onchange = e => {
  const n = Math.max(1, Math.floor(Number(e.target.value) || 1));
  db.settings.n = n; e.target.value = n; save(); renderDash();
};
syncQuestionCount();
const applyScale = v => { document.documentElement.style.setProperty('--font-scale', v); $('#scaleVal').textContent = Math.round(v * 100) + '%'; };
$('#rngScale').value = db.settings.scale; applyScale(db.settings.scale);
$('#rngScale').oninput = e => { db.settings.scale = +e.target.value; applyScale(db.settings.scale); save(); };
$('#btnReset').onclick = () => { if (confirm('Erase all stats and settings?')) { localStorage.removeItem(KEY); location.reload(); } };

addEventListener('keydown', e => {
  if (e.target.matches('select,input[type=range],.ans-input') && e.key !== 'Escape') return;
  if (!$('#tagDialog').hidden) {
    if (e.key === 'Escape') closeTagDialog();
    return;
  }
  if (run) {
    if (e.key === 'Escape') return quit();
    if (e.code === 'Space') { e.preventDefault(); if (run.state === 'ready') begin(); else if (run.state === 'done') start(); }
    else if (/^[1-5]$/.test(e.key)) answer(+e.key - 1);
    return;
  }
  if (e.key === 'Escape') closeSettings();
  else if (e.key.toLowerCase() === 't') toggleSettings();
  else if (e.code === 'Space' && !e.target.matches('button,input')) { e.preventDefault(); start(); }
});

renderTopics(); renderDash();
