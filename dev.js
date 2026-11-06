'use strict';
const KEY = 'sprint-exam-v1';
const $ = s => document.querySelector(s);
const esc = x => String(x).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const latex = x => String(x).replace(/×/g, '\\times ').replace(/÷/g, '\\div ').replace(/−/g, '-').replace(/⁻¹/g, '^{-1}').replace(/²/g, '^2').replace(/³/g, '^3').replace(/\bn = /g, 'n\\,=\\,');
const formulaMarkup = x => !/[=^()]/.test(String(x)) ? `<span class="rule-prose">${esc(x)}</span>` : `<span class="formula-stack">${String(x).split(';').map(part => part.trim()).filter(Boolean).map(part => `<span class="formula-row">\\(${latex(part)}\\)</span>`).join('')}</span>`;
const families = [
  ['arith','Arithmetic progression','f(n) = 5n − 1','4, 9, 14, 19, 24, 29'],
  ['geom','Geometric progression','f(n) = 3 × 2^{n − 1}','3, 6, 12, 24, 48, 96'],
  ['geomDown','Descending geometric','f(n) = 320 ÷ 4^{n − 1}','320, 80, 20, 5, 1.25, 0.3125'],
  ['dArith','Growing differences','f(n) = 1/2 n² + 1/2 n + 1','2, 5, 9, 14, 20, 27'],
  ['dGeom','Geometric differences','f(n) = 3^{n − 1} + 1','2, 4, 10, 28, 82, 244'],
  ['dPow','Power differences','f(1) = 1; f(n) = f(n − 1) + (n − 1)²','1, 2, 6, 15, 31, 56'],
  ['fib','Fibonacci recurrence','f(n) = f(n − 1) + f(n − 2)','1, 2, 3, 5, 8, 13'],
  ['altOp','Alternating operations','f(1) = 3; odd steps × 3; even steps + 5','3, 9, 14, 42, 47, 141'],
  ['affine','Affine recurrence','f(1) = 2; f(n) = 3f(n − 1) − 1','2, 5, 14, 41, 122, 365'],
  ['mulAdd','Multiply after adding','f(1) = 2; f(n) = (f(n − 1) + 1)n','2, 6, 21, 88, 445, 2676'],
  ['mulHalf','Multiply then halve','f(1) = 4; f(n) = f(n − 1) × n ÷ 2','4, 4, 6, 12, 30, 90'],
  ['inter','Interleaved rules','f(2k − 1) = A(k); f(2k) = B(k)','2, 6, 5, 18, 8, 54'],
  ['parity','Parity functions','Odd positions use F₁(n); even positions use F₂(n)','1, 8, 9, 64, 25, 216'],
  ['sqPrev','Square previous','f(2k − 1) = 3 + k − 1; f(2k) = f(2k − 1)²','3, 9, 6, 36, 9, 81'],
  ['poly','Polynomial','f(n) = n² + 2n + 1 = (n + 1)²','1, 4, 9, 16, 25, 36'],
  ['pron','Product of neighbours','f(n) = n² + n','2, 6, 12, 20, 30, 42'],
  ['recip','Reciprocal','f(n) = constant ÷ n','60, 30, 20, 15, 12, 10'],
  ['prime','Prime powers','Prime sequence, optionally squared','2, 3, 5, 7, 11, 13'],
  ['entangled','Entangled composition','f(n) = F1(F2(n)) + F3(n)','11, 23, 39, 59, 83, 111'],
  ['nested','Nested composition','f(n) = F1(F2(F3(n))) + F4(n)','9, 35, 101, 225, 429, 719'],
  ["dTri","Triangular differences","f(1) = 20; f(n) = f(n − 1) + \\frac{(n − 1)n}{2}","20, 21, 24, 30, 40, 55"],
  ["dFib","Fibonacci differences","f(1) = 18; f(n) = f(n − 1) − F_{n − 1}; F_k \\text{ is the Fibonacci sequence } 1, 1, 2, 3, 5, \\ldots","18, 17, 16, 14, 11, 6"],
  ["dPrime","Prime differences","f(1) = 11; f(n) = f(n − 1) + p_{n}; p_k \\text{ is the }k\\text{-th prime}","11, 14, 19, 26, 37, 50"],
  ["dAlt","Alternating differences","f(1) = 5; f(n) = \\begin{cases}f(n − 1) + 6, & n\\text{ even}\\\\\\\\ f(n − 1) − 3, & n\\text{ odd}\\end{cases}","5, 11, 8, 14, 11, 17"],
  ["dPowOff","Shifted power differences","f(1) = 57; f(n) = f(n − 1) + (n)^3","57, 65, 92, 156, 281, 497"],
  ["lin2","Second-order linear recurrence","f(1) = 1, f(2) = 4; f(n) = 3f(n − 1) + 2f(n − 2)","1, 4, 14, 50, 178, 634"],
  ["fibOff","Fibonacci with constant offset","f(1) = 4, f(2) = 6; f(n) = f(n − 1) + f(n − 2) + 1","4, 6, 11, 18, 30, 49"],
  ["tribo","Tribonacci recurrence","f(1) = 3, f(2) = 2, f(3) = 2; f(n) = f(n − 1) + f(n − 2) + f(n − 3)","3, 2, 2, 7, 11, 20"],
  ["recIdx","Recurrence with index term","f(1) = 1; f(n) = 3f(n − 1) + n","1, 5, 18, 58, 179, 543"],
  ["cycle3","Three-step operation cycle","f(1) = 7; f(n) = \\begin{cases}2f(n − 1), & n \\equiv 2 \\pmod 3\\\\\\\\ f(n − 1) + 3, & n \\equiv 0 \\pmod 3\\\\\\\\ f(n − 1) − 3, & n \\equiv 1 \\pmod 3\\end{cases}","7, 14, 17, 14, 28, 31"],
  ["halfPlus","Halve then add","f(1) = 102; f(n) = f(n − 1) ÷ 2 + 3","102, 54, 30, 18, 12, 9"],
  ["sumAll","Sum of all previous terms","f(1) = 1, f(2) = 1; f(n) = f(1) + f(2) + \\cdots + f(n − 1) \\quad (n \\ge 3)","1, 1, 2, 4, 8, 16"],
  ["derivedEven","Even terms derived from odd","f(2k − 1) = 5 − 2(k − 1); f(2k) = 3f(2k − 1) + 4","5, 19, 3, 13, 1, 7"],
  ["altSign","Alternating sign","f(n) = (−1)^{n} (n^2 + 1)","-2, 5, -10, 17, -26, 37"],
  ["quad","General quadratic","f(n) = 2n^2 + 2n + 7","11, 19, 31, 47, 67, 91"],
  ["cubic","Cubic polynomial","f(n) = 2n^3 − 2n","0, 12, 48, 120, 240, 420"],
  ["figurate","Figurate numbers","f(n) = n(n + 1)(n + 2) ÷ 6","1, 4, 10, 20, 35, 56"],
  ["cumPow","Running sum of powers","f(n) = \\sum_{k = 1}^{n} k^3","1, 9, 36, 100, 225, 441"],
  ["expLin","Exponential plus a term","f(n) = 2^n − 2n","0, 0, 2, 8, 22, 52"],
  ["fact","Factorial plus a term","f(n) = (n + 1)! + 4","6, 10, 28, 124, 724, 5044"],
  ["recipShift","Shifted reciprocal","f(n) = 5040 ÷ (n + 1)","2520, 1680, 1260, 1008, 840, 720"],
  ["primeOp","Scaled primes","f(n) = 3p_{n + 5}; p_k \\text{ is the }k\\text{-th prime}","39, 51, 57, 69, 87, 93"],
  ["prodGap","Product with a gap","f(n) = (n + 2)(n + 6)","21, 32, 45, 60, 77, 96"],
  ["prodThree","Product of three consecutive","f(n) = (n + 2)(n + 3)(n + 4)","60, 120, 210, 336, 504, 720"],
  ["primeSum","Prime sums and products","f(n) = p_{n + 5} × p_{n + 6}; p_k \\text{ is the }k\\text{-th prime}","221, 323, 437, 667, 899, 1147"],
  ["sieve","Filtered integers","the positive integers that are not multiples of 5, in increasing order","6, 7, 8, 9, 11, 12"],
  ["fibSq","Squared Fibonacci","f(n) = F_{n + 1}^2; F_1 = F_2 = 1; F_k = F_{k − 1} + F_{k − 2}","1, 4, 9, 25, 64, 169"],
  ["divisor","Divisor counts and sums","the sum of the positive divisors of 13, 14, 15, and so on","14, 24, 24, 31, 18, 39"],
  ["entProd","Entangled product","F_1(n) = n + 2; F_2(n) = n² − 1; f(n) = F_1(n) × F_2(n)","0, 12, 40, 90, 168, 280"],
  ["entDiff","Entangled difference","F_1(n) = n + 2; F_2(n) = 2n + 1; F_3(n) = 3n − 1; f(n) = F_1(F_2(n)) − F_3(n)","0, -1, -2, -3, -4, -5"],
  ["nestedPure","Pure nested chain","F_1(n) = 2n; F_2(n) = 3n − 1; F_3(n) = n² − 1; f(n) = F_1(F_2(F_3(n)))","16, 46, 88, 142, 208, 286"],
  ["entParity","Entangled by parity","F_1(n) = 2n + 1; F_2(n) = 2n; F_3(n) = 3n − 1; f(n) = \\begin{cases}F_1(F_2(n)), & n\\text{ odd}\\\\\\\\ F_3(n), & n\\text{ even}\\end{cases}","5, 5, 13, 11, 21, 17"]
];
const htmlExample = f => `<article class="function-card" data-family="${f[0]}"><div class="function-card-head"><span class="topic-icon">ƒ</span><div><h3>${esc(f[1])}</h3><span class="function-id">${f[0]}</span></div></div><div class="math-block">${formulaMarkup(f[2])}</div><p><b>Example:</b> ${esc(f[3])}</p><button class="btn-secondary try-family" data-family="${f[0]}">Try this family</button></article>`;
function renderPreview(family) {
  const f = families.find(x => x[0] === family) || families[0];
  $('#preview').innerHTML = `<div class="preview-badge">${esc($('#devDifficulty').value)} preset</div><h2>${esc(f[1])}</h2><div class="math-block">${formulaMarkup(f[2])}</div><div class="preview-seq">${f[3].split(', ').map((x, i) => `<span><b>P${i + 1}</b>${x}</span>`).join('')}</div><p class="hint">Generated preview uses the ${esc(f[0])} family. Use the trainer for randomized values and scoring.</p>`;
  if (window.MathJax?.typesetPromise) window.MathJax.typesetPromise([$('#preview')]);
}
function updateStorage() {
  let data = null; try { data = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  $('#storageStatus').textContent = data ? `${data.sessions?.length || 0} sessions · ${Object.keys(data.topics || {}).length} topic records · ${Object.keys(data.tags || {}).length} tags` : 'No local trainer data found.';
}
function printableSequence(family, count, values) {
  const n = Math.max(3, Math.min(20, Number(count) || 6));
  const seed = values.map(Number);
  const out = seed.slice(0, n);
  if (out.length >= n) return out;
  const generators = {
    arith: i => 5 * (i + 1) - 1,
    geom: i => 3 * 2 ** i,
    geomDown: i => 320 / 4 ** i,
    dArith: i => i === 0 ? 2 : out[i - 1] + i + 2,
    dGeom: i => i === 0 ? 2 : out[i - 1] + 2 * 3 ** i,
    dPow: i => i === 0 ? 1 : out[i - 1] + i ** 2,
    fib: i => i < 2 ? seed[i] : out[i - 1] + out[i - 2],
    affine: i => i === 0 ? 2 : 3 * out[i - 1] - 1,
    poly: i => (i + 1) ** 2,
    pron: i => (i + 1) * (i + 2),
    recip: i => 60 / (i + 1),
    prime: i => [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61][i]
  };
  const generator = generators[family];
  while (out.length < n && generator) out.push(generator(out.length));
  return out.length ? out : seed;
}
function generatePdf() {
  const f = families.find(x => x[0] === $('#devFamily').value) || families[0];
  const values = printableSequence(f[0], $('#devCount').value, f[3].split(', '));
  const missing = values.map((value, i) => i % 3 === 1 ? null : value);
  const sequenceHtml = missing.map((value, i) => `<span class="${value === null ? 'blank' : ''}"><b>P${i + 1}</b>${value === null ? '?' : esc(value)}</span>`).join('');
  const solutionHtml = values.map((value, i) => `<div class="step"><b>${i + 1}.</b><span>\\(f(${i + 1}) = ${value}\\)</span></div>`).join('');
  const printWindow = window.open('', '_blank');
  if (!printWindow) { alert('Please allow pop-ups to generate the PDF.'); return; }
  printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>TCAS Sequence Trainer · ${esc(f[1])}</title>
    <style>
      @page{size:A4;margin:16mm 15mm}*{box-sizing:border-box}body{margin:0;color:#171717;font:14px Arial,sans-serif}h1{margin:0 0 5px;font:700 25px Georgia,serif}h2{margin:24px 0 10px;padding-bottom:5px;border-bottom:2px solid #145498;font:700 18px Georgia,serif}.meta{color:#555;margin:0 0 18px}.formula{padding:12px 14px;border-left:4px solid #145498;background:#f2f5f8;font-size:18px;line-height:1.7}.formula-row{display:block}.sequence{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 22px}.sequence span{position:relative;display:grid;place-items:center;min-width:62px;min-height:48px;padding:13px 8px 17px;border:1px solid #bbb;border-radius:6px;font:700 18px monospace}.sequence b{position:absolute;bottom:3px;color:#777;font:9px monospace}.sequence .blank{border:2px dashed #c97f50;color:#c97f50}.instructions{color:#555}.solution{page-break-before:always}.step{display:flex;gap:10px;align-items:baseline;padding:9px 0;border-bottom:1px solid #ddd;page-break-inside:avoid}.step b{min-width:22px;color:#145498}.footer{margin-top:24px;color:#777;font-size:11px}@media print{.solution{page-break-before:always}}
    </style>
    <script>window.MathJax={tex:{inlineMath:[['\\\\(','\\\\)']],displayMath:[['\\\\[','\\\\]']]}};</script><script defer src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js"></script>
    </head><body><header><h1>TCAS Sequence Trainer</h1><p class="meta">${esc(f[1])} · ${esc($('#devDifficulty').value)} difficulty · ${values.length} positions</p></header>
    <main><h2>Practice question</h2><p class="instructions">Complete the missing positions using the function rule.</p><div class="formula">${formulaMarkup(f[2])}</div><div class="sequence">${sequenceHtml}</div>
    <section class="solution"><h2>Solutions</h2><p class="instructions">Each position is shown using the selected function rule.</p>${solutionHtml}</section></main><p class="footer">Generated from the TCAS Sequence Trainer developer lab.</p>
    <script>window.addEventListener('load',()=>{const wait=()=>window.MathJax?.startup?.promise?window.MathJax.startup.promise.then(()=>window.print()):setTimeout(wait,100);wait()});</script></body></html>`);
  printWindow.document.close();
}
$('#devFamily').innerHTML = families.map(f => `<option value="${f[0]}">${f[1]}</option>`).join('');
$('#catalogCount').textContent = `${families.length} families`;
$('#catalogList').innerHTML = families.map(htmlExample).join('');
$('#generate').onclick = () => renderPreview($('#devFamily').value);
$('#generatePdf').onclick = generatePdf;
$('#devFamily').onchange = () => renderPreview($('#devFamily').value);
$('#generateAll').onclick = () => { document.querySelector('.catalog').scrollIntoView({ behavior: 'smooth' }); document.querySelectorAll('.function-card').forEach((el, i) => { el.style.animationDelay = `${i * 20}ms`; el.classList.add('catalog-in'); }); };
document.querySelectorAll('.try-family').forEach(btn => btn.onclick = () => { $('#devFamily').value = btn.dataset.family; renderPreview(btn.dataset.family); window.scrollTo({ top: 0, behavior: 'smooth' }); });
$('#exportData').onclick = () => { const blob = new Blob([localStorage.getItem(KEY) || '{}'], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'tcas-sequence-trainer-data.json'; a.click(); URL.revokeObjectURL(a.href); };
$('#clearData').onclick = () => { if (confirm('Clear all trainer data?')) { localStorage.removeItem(KEY); updateStorage(); } };
renderPreview(families[0][0]); updateStorage();
if (window.MathJax?.startup?.promise) window.MathJax.startup.promise.then(() => window.MathJax.typesetPromise([document.querySelector('#catalogList')]));
