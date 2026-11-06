'use strict';
/* ============ QUESTION ENGINE ============
   Add generators:  TOPICS.myid = {label:'My topic', gen: () => mcq('myid', question, answer, () => distractor)}
   Add fixed questions to BANK: {topic:'Verbal', q:'...', choices:['a','b','c','d'], answer:0}  (answer = index)
   Every question returns {topic, q, choices[], answer(index)}. */
const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function mcq(topic, q, ans, near) {
  const s = new Set([ans]); let g = 0;
  while (s.size < 4 && g++ < 80) s.add(near());
  const c = shuffle([...s]);
  return { topic, q, choices: c.map(String), answer: c.indexOf(ans) };
}
const BANK = []; // fixed questions go here

const TOPICS = {
  series: { label: 'Number series', gen() {
    const k = rnd(0, 3), a = rnd(1, 9), d = rnd(2, 9); let s, ans;
    if (k === 0) { s = [0,1,2,3,4].map(i => a + d * i); ans = a + d * 5; }
    else if (k === 1) { const r = rnd(2, 3); s = [0,1,2,3,4].map(i => a * r ** i); ans = a * r ** 5; }
    else if (k === 2) { s = [1,2,3,4,5].map(i => i * i + a); ans = 36 + a; }
    else { const y = rnd(1, 9); s = [a, y]; for (let i = 2; i < 5; i++) s.push(s[i-1] + s[i-2]); ans = s[3] + s[4]; }
    return mcq('series', s.join(',  ') + ',  ?', ans, () => ans + rnd(-9, 9));
  }},
  arith: { label: 'Mental arithmetic', gen() {
    const a = rnd(6, 19), b = rnd(3, 12), c = rnd(5, 60), sub = rnd(0, 1), ans = sub ? a * b - c : a * b + c;
    return mcq('arith', `${a} × ${b} ${sub ? '−' : '+'} ${c}`, ans, () => ans + rnd(-12, 12));
  }}
};
[...new Set(BANK.map(b => b.topic))].forEach(t => TOPICS['bank:' + t] = { label: t,
  gen() { const p = BANK.filter(b => b.topic === t), it = p[rnd(0, p.length - 1)], ans = it.choices[it.answer], c = shuffle([...it.choices]);
    return { topic: 'bank:' + t, q: it.q, choices: c, answer: c.indexOf(ans) }; } });

/* ============ STORAGE ============ */
const KEY = 'sprint-exam-v1';
let db = { topics: {}, sessions: [], settings: { n: 20, scale: 1, off: [] } };
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
  return 1 + 4 * (1 - t.c / t.n) + Math.max(0, Math.min(1.5, avg / mean - 1));
}
function pick() {
  const ids = enabled(), w = ids.map(weight); let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < ids.length; i++) if ((r -= w[i]) <= 0) return TOPICS[ids[i]].gen();
  return TOPICS[ids[0]].gen();
}

/* ============ DASHBOARD ============ */
function renderDash() {
  const N = db.settings.n, same = db.sessions.filter(s => s.n === N), last5 = same.slice(-5);
  $('#pb').textContent = same.length ? fmt(Math.min(...same.map(s => s.final))) : '--';
  $('#ao5').textContent = last5.length === 5 ? fmt(last5.reduce((a, s) => a + s.final, 0) / 5) : '--';
  $('#runs').textContent = db.sessions.length;
  const rows = Object.keys(TOPICS).filter(id => db.topics[id]?.n).map(id => ({ id, t: db.topics[id] })).sort((a, b) => acc(a.t) - acc(b.t));
  $('#stats').innerHTML = rows.length ? `<div class="row head"><span>Topic</span><span class="m">Acc</span><span class="m">Avg s</span><span class="m">Qs</span></div>` +
    rows.map((r, i) => `<div class="row ${i === 0 && acc(r.t) < .9 ? 'weak' : ''}"><span>${TOPICS[r.id].label}${i === 0 && acc(r.t) < .9 ? '<em class="tag">FOCUS</em>' : ''}</span><span class="m">${Math.round(acc(r.t) * 100)}%</span><span class="m">${(r.t.ms / r.t.n / 1000).toFixed(1)}</span><span class="m">${r.t.n}</span><div class="bar"><i style="width:${acc(r.t) * 100}%"></i></div></div>`).join('')
    : '<p class="empty">Complete a run to see accuracy and speed per topic. Weak topics are served more often automatically.</p>';
  $('#hist').innerHTML = db.sessions.length ? db.sessions.slice(-6).reverse().map(s => `<div class="row" style="grid-template-columns:1fr 80px 64px"><span>${new Date(s.d).toLocaleDateString()} · ${s.n}Q</span><span class="m">${fmt(s.final)}</span><span class="m">${Math.round(s.c / s.n * 100)}%</span></div>`).join('') : '<p class="empty">No runs yet.</p>';
}
function renderTopics() {
  $('#topicList').innerHTML = Object.entries(TOPICS).map(([id, t]) => `<label class="topic"><input type="checkbox" data-id="${id}" ${db.settings.off.includes(id) ? '' : 'checked'}>${t.label}</label>`).join('');
  document.querySelectorAll('#topicList input').forEach(el => el.onchange = () => {
    const off = new Set(db.settings.off); el.checked ? off.delete(el.dataset.id) : off.add(el.dataset.id);
    db.settings.off = [...off]; $('#btnStart').disabled = !enabled().length; save();
  });
  $('#btnStart').disabled = !enabled().length;
}

/* ============ RUN (focus mode) ============ */
let run = null, raf = 0;
const stage = $('#stage');
function start() {
  if (!enabled().length) return;
  run = { n: db.settings.n, i: 0, c: 0, wrong: 0, streak: 0, best: 0, t0: 0, qt: 0, by: {}, q: null, locked: false, state: 'ready' };
  document.body.classList.add('focus'); stage.hidden = false; closeSettings();
  stage.innerHTML = `<div class="clock idle" id="clock">0.00</div><p class="meta">Press <b>SPACE</b> to begin · ${run.n} questions · Esc to cancel</p>`;
}
function begin() { run.state = 'go'; run.t0 = performance.now(); tick(); next(); }
function tick() { const c = $('#clock'); if (c) c.textContent = fmt(performance.now() - run.t0); raf = requestAnimationFrame(tick); }
function next() {
  run.q = pick(); run.locked = false; run.qt = performance.now();
  stage.innerHTML = `<div class="prog" style="width:${run.i / run.n * 100}%"></div>
  <div class="clock" id="clock">${fmt(performance.now() - run.t0)}</div>
  <div class="meta animate-in"><span>Q <b>${run.i + 1}/${run.n}</b></span><span>Streak <b>${run.streak}</b></span><span>Miss <b>${run.wrong}</b></span></div>
  <div class="q animate-in">${run.q.q}</div>
  <div class="choices animate-in">${run.q.choices.map((c, i) => `<button class="ch" data-i="${i}"><kbd>${i + 1}</kbd>${c}</button>`).join('')}</div>`;
  stage.querySelectorAll('.ch').forEach(b => b.onclick = () => answer(+b.dataset.i));
}
function answer(i) {
  if (!run || run.locked || run.state !== 'go' || i >= run.q.choices.length) return;
  run.locked = true;
  const dt = performance.now() - run.qt, ok = i === run.q.answer, id = run.q.topic;
  const t = db.topics[id] || (db.topics[id] = { n: 0, c: 0, ms: 0 }); t.n++; t.ms += dt; if (ok) t.c++;
  const b = run.by[id] || (run.by[id] = { n: 0, c: 0, ms: 0 }); b.n++; b.ms += dt; if (ok) b.c++;
  run.i++; ok ? (run.c++, run.streak++, run.best = Math.max(run.best, run.streak)) : (run.wrong++, run.streak = 0);
  const bs = stage.querySelectorAll('.ch'); bs[run.q.answer].classList.add('ok'); if (!ok) bs[i].classList.add('bad');
  setTimeout(() => run && (run.i >= run.n ? finish() : next()), ok ? 220 : 800);
}
function finish() {
  cancelAnimationFrame(raf);
  const total = performance.now() - run.t0, final = total + run.wrong * 2000;
  const prev = db.sessions.filter(s => s.n === run.n), pb = !prev.length || final < Math.min(...prev.map(s => s.final));
  db.sessions.push({ d: Date.now(), n: run.n, c: run.c, wrong: run.wrong, total, final }); save();
  const rows = Object.entries(run.by).map(([id, b]) => `<div class="row" style="grid-template-columns:1fr 60px 60px"><span>${TOPICS[id]?.label || id}</span><span class="m">${Math.round(b.c / b.n * 100)}%</span><span class="m">${(b.ms / b.n / 1000).toFixed(1)}s</span></div>`).join('');
  stage.innerHTML = `<div class="clock animate-in ${pb ? 'pb' : ''}">${fmt(final)}</div>
  <p class="meta">${pb ? '<b class="pb">NEW PERSONAL BEST</b>' : 'Final time'} · ${fmt(total)} + ${run.wrong} × 2s</p>
  <div class="result-grid"><div><span>Accuracy</span><b>${Math.round(run.c / run.n * 100)}%</b></div><div><span>Avg / Q</span><b>${(total / run.n / 1000).toFixed(2)}s</b></div><div><span>Best streak</span><b>${run.best}</b></div></div>
  <div style="width:min(420px,100%)">${rows}</div>
  <div class="actions"><button class="btn-primary" id="again">Again</button><button class="btn-secondary" id="home">Home</button></div>`;
  run.state = 'done'; $('#again').onclick = start; $('#home').onclick = quit; $('#again').focus();
}
function quit() { cancelAnimationFrame(raf); run = null; stage.hidden = true; stage.innerHTML = ''; document.body.classList.remove('focus'); renderDash(); }

/* ============ SETTINGS + INPUT ============ */
const layout = $('#layout'), toggleSettings = () => layout.classList.toggle('settings-open'), closeSettings = () => layout.classList.remove('settings-open');
$('#btnSet').onclick = toggleSettings; $('#btnClose').onclick = closeSettings; $('#btnStart').onclick = start;
$('#selN').value = db.settings.n; $('#selN').onchange = e => { db.settings.n = +e.target.value; save(); renderDash(); };
const applyScale = v => { document.documentElement.style.setProperty('--font-scale', v); $('#scaleVal').textContent = Math.round(v * 100) + '%'; };
$('#rngScale').value = db.settings.scale; applyScale(db.settings.scale);
$('#rngScale').oninput = e => { db.settings.scale = +e.target.value; applyScale(db.settings.scale); save(); };
$('#btnReset').onclick = () => { if (confirm('Erase all stats and settings?')) { localStorage.removeItem(KEY); location.reload(); } };

addEventListener('keydown', e => {
  if (e.target.matches('select,input[type=range]') && e.key !== 'Escape') return;
  if (run) {
    if (e.key === 'Escape') return quit();
    if (e.code === 'Space') { e.preventDefault(); if (run.state === 'ready') begin(); else if (run.state === 'done') start(); }
    else if (/^[1-4]$/.test(e.key)) answer(+e.key - 1);
    return;
  }
  if (e.key === 'Escape') closeSettings();
  else if (e.key.toLowerCase() === 't') toggleSettings();
  else if (e.code === 'Space' && !e.target.matches('button,input')) { e.preventDefault(); start(); }
});

renderTopics(); renderDash();
