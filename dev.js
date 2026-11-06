'use strict';
const KEY = 'sprint-exam-v1';
const $ = s => document.querySelector(s);
const esc = x => String(x).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const families = [
  ['arith','Arithmetic progression','f(n) = a + d(n − 1)','4, 9, 14, 19, 24, 29'],
  ['geom','Geometric progression','f(n) = a × rⁿ⁻¹','3, 6, 12, 24, 48, 96'],
  ['geomDown','Descending geometric','f(n) = a ÷ rⁿ⁻¹','320, 80, 20, 5, 1.25, 0.3125'],
  ['dArith','Growing differences','Add a difference that changes by a constant','2, 5, 9, 14, 20, 27'],
  ['dGeom','Geometric differences','Add a difference that multiplies','2, 4, 10, 28, 82, 244'],
  ['dPow','Power differences','f(1) = 1; f(n) = f(n − 1) + (n − 1)²','1, 2, 6, 15, 31, 56'],
  ['fib','Fibonacci recurrence','f(n) = f(n − 1) + f(n − 2)','1, 2, 3, 5, 8, 13'],
  ['altOp','Alternating operations','Alternate multiplication and addition','3, 9, 14, 42, 47, 141'],
  ['affine','Affine recurrence','f(1) = 2; f(n) = 3f(n − 1) − 1','2, 5, 14, 41, 122, 365'],
  ['mulAdd','Multiply after adding','(previous ± 1) × position','2, 6, 21, 88, 445, 2676'],
  ['mulHalf','Multiply then halve','previous × position ÷ 2','4, 4, 6, 12, 30, 90'],
  ['inter','Interleaved rules','Two sequences alternate positions','2, 6, 5, 18, 8, 54'],
  ['parity','Parity functions','Two functions alternate by position','1, 8, 9, 64, 25, 216'],
  ['sqPrev','Square previous','Linear term followed by a square','3, 9, 6, 36, 9, 81'],
  ['poly','Polynomial','f(n) = (n + 1)²','1, 4, 9, 16, 25, 36'],
  ['pron','Product of neighbours','f(n) = n(n + 1)','2, 6, 12, 20, 30, 42'],
  ['recip','Reciprocal','f(n) = constant ÷ n','60, 30, 20, 15, 12, 10'],
  ['prime','Prime powers','Prime sequence, optionally squared','2, 3, 5, 7, 11, 13'],
  ['entangled','Entangled composition','f(n) = F1(F2(n)) + F3(n)','11, 23, 39, 59, 83, 111'],
  ['nested','Nested composition','f(n) = F1(F2(F3(n))) + F4(n)','9, 35, 101, 225, 429, 719']
];
const htmlExample = f => `<article class="function-card" data-family="${f[0]}"><div class="function-card-head"><span class="topic-icon">ƒ</span><div><h3>${esc(f[1])}</h3><span class="function-id">${f[0]}</span></div></div><div class="math-block">${esc(f[2])}</div><p><b>Example:</b> ${esc(f[3])}</p><button class="btn-secondary try-family" data-family="${f[0]}">Try this family</button></article>`;
function renderPreview(family) {
  const f = families.find(x => x[0] === family) || families[0];
  $('#preview').innerHTML = `<div class="preview-badge">${esc($('#devDifficulty').value)} preset</div><h2>${esc(f[1])}</h2><div class="math-block">${esc(f[2])}</div><div class="preview-seq">${f[3].split(', ').map((x, i) => `<span><b>P${i + 1}</b>${x}</span>`).join('')}</div><p class="hint">Generated preview uses the ${esc(f[0])} family. Use the trainer for randomized values and scoring.</p>`;
}
function updateStorage() {
  let data = null; try { data = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  $('#storageStatus').textContent = data ? `${data.sessions?.length || 0} sessions · ${Object.keys(data.topics || {}).length} topic records · ${Object.keys(data.tags || {}).length} tags` : 'No local trainer data found.';
}
$('#devFamily').innerHTML = families.map(f => `<option value="${f[0]}">${f[1]}</option>`).join('');
$('#catalogCount').textContent = `${families.length} families`;
$('#catalogList').innerHTML = families.map(htmlExample).join('');
$('#generate').onclick = () => renderPreview($('#devFamily').value);
$('#devFamily').onchange = () => renderPreview($('#devFamily').value);
$('#generateAll').onclick = () => { document.querySelector('.catalog').scrollIntoView({ behavior: 'smooth' }); document.querySelectorAll('.function-card').forEach((el, i) => { el.style.animationDelay = `${i * 20}ms`; el.classList.add('catalog-in'); }); };
document.querySelectorAll('.try-family').forEach(btn => btn.onclick = () => { $('#devFamily').value = btn.dataset.family; renderPreview(btn.dataset.family); window.scrollTo({ top: 0, behavior: 'smooth' }); });
$('#exportData').onclick = () => { const blob = new Blob([localStorage.getItem(KEY) || '{}'], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'tcas-sequence-trainer-data.json'; a.click(); URL.revokeObjectURL(a.href); };
$('#clearData').onclick = () => { if (confirm('Clear all trainer data?')) { localStorage.removeItem(KEY); updateStorage(); } };
renderPreview(families[0][0]); updateStorage();
