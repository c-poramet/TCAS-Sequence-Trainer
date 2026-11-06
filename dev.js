'use strict';
const KEY = 'sprint-exam-v1';
const $ = s => document.querySelector(s);
const esc = x => String(x).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const latex = x => String(x).replace(/×/g, '\\times ').replace(/÷/g, '\\div ').replace(/−/g, '-').replace(/⁻¹/g, '^{-1}').replace(/²/g, '^2').replace(/³/g, '^3').replace(/\bn = /g, 'n\\,=\\,');
const formulaMarkup = x => `<span class="formula-stack">${String(x).split(';').map(part => part.trim()).filter(Boolean).map(part => `<span class="formula-row">\\(${latex(part)}\\)</span>`).join('')}</span>`;
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
  ['nested','Nested composition','f(n) = F1(F2(F3(n))) + F4(n)','9, 35, 101, 225, 429, 719']
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
