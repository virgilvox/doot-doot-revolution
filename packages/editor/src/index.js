// editor: the embeddable review and edit widget. It shows a narrow vertical
// notefield strip that mirrors gameplay orientation, a horizontal density
// timeline with a draggable playhead, a small toolbar (difficulty tabs, edit or
// select, snap, zoom, play or pause), and a readout. The whole thing fits in its
// container with no page scroll.
//
// It takes charts, the decoded audio, and an onChange callback, and it returns
// edited charts. It embeds the notefield renderer and the noteskin, and does its
// own minimal audio playback so it depends on nothing but rendering.

import { createNotefield } from '@doot-games/notefield';

const SNAPS = [[4, '4th'], [8, '8th'], [12, '12th'], [16, '16th']];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function quantOf(beat) { const subs = [1, 2, 3, 4, 6, 8, 12, 16]; for (let i = 0; i < subs.length; i++) { const d = subs[i]; if (Math.abs(beat * d - Math.round(beat * d)) < 0.02) return d; } return 16; }
function denomToNote(d) { return ({ 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48, 16: 64 })[d] || 64; }

export function createEditor(container, opts = {}) {
  const charts = {};
  Object.keys(opts.charts || {}).forEach((k) => { charts[k] = cloneChart(opts.charts[k]); });
  const diffKeys = Object.keys(charts);
  let active = opts.difficulty && charts[opts.difficulty] ? opts.difficulty : diffKeys[0];
  const audioBuffer = opts.audioBuffer || null;
  const onChange = opts.onChange || (() => {});
  const doc = container.ownerDocument || document;

  let ctxA = opts.audioContext || null, src = null, startCtx = 0, playing = false;
  let playTime = 0, mode = 'edit', snap = 16, speed = opts.speed || 2.2;
  const duration = (charts[active] && charts[active].duration) || (audioBuffer && audioBuffer.duration) || 30;

  const undo = [], redo = [];

  container.classList.add('editor');
  container.innerHTML = template(diffKeys, active);
  const el = {
    tabs: container.querySelector('.ed-tabs'),
    modeSeg: container.querySelector('[data-seg=mode]'),
    snapBox: container.querySelector('.ed-snap'),
    strip: container.querySelector('.ed-strip canvas'),
    mini: container.querySelector('.ed-mini canvas'),
    play: container.querySelector('[data-act=play]'),
    zoomIn: container.querySelector('[data-act=zoomin]'),
    zoomOut: container.querySelector('[data-act=zoomout]'),
    read: container.querySelector('.ed-read'),
    undo: container.querySelector('[data-act=undo]'),
    redo: container.querySelector('[data-act=redo]')
  };

  // narrow strip: playhead centered so past and future notes are visible
  const field = createNotefield(el.strip, { recFrac: 0.5, maxGap: 46, maxLaneW: 40, spread: 1, minRecY: 30 });

  function chart() { return charts[active]; }
  function period() { return 60 / chart().bpm; }
  function beatToTime(b) { return chart().offset + b * period(); }
  function timeToBeat(t) { return (t - chart().offset) / period(); }
  function snapStep() { return snap === 12 ? 1 / 3 : 4 / snap; }
  function snapBeat(b) { const s = snapStep(); return Math.round(b / s) * s; }

  function sizeCanvas(c, cssW, cssH) {
    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    c.style.width = cssW + 'px'; c.style.height = cssH + 'px';
    c.width = Math.round(cssW * dpr); c.height = Math.round(cssH * dpr);
  }
  function layoutCanvases() {
    const stripH = clamp(Math.round((typeof window !== 'undefined' ? window.innerHeight : 700) * 0.42), 240, 380);
    sizeCanvas(el.strip, 200, stripH);
    field.resize();
    const miniW = Math.max(120, el.mini.parentElement.clientWidth || 300);
    sizeCanvas(el.mini, miniW, 46);
    drawMini();
  }

  // ----- audio -----
  function ensureCtx() { if (!ctxA) ctxA = new (window.AudioContext || window.webkitAudioContext)(); if (ctxA.state === 'suspended') ctxA.resume(); return ctxA; }
  function play() {
    if (!audioBuffer) return; ensureCtx(); stopAudio();
    src = ctxA.createBufferSource(); src.buffer = audioBuffer; src.connect(ctxA.destination);
    startCtx = ctxA.currentTime - playTime; src.start(0, clamp(playTime, 0, duration)); playing = true; el.play.textContent = 'Pause';
  }
  function stopAudio() { if (src) { try { src.onended = null; src.stop(); } catch (e) {} src = null; } }
  function pause() { playing = false; stopAudio(); el.play.textContent = 'Play'; }
  function togglePlay() { if (playing) pause(); else play(); }

  // ----- editing -----
  function pushUndo() { undo.push(JSON.stringify(chart().notes)); if (undo.length > 100) undo.shift(); redo.length = 0; }
  function applyNotes(json) { chart().notes = JSON.parse(json); recount(); onChange(getCharts()); }
  function doUndo() { if (!undo.length) return; redo.push(JSON.stringify(chart().notes)); applyNotes(undo.pop()); }
  function doRedo() { if (!redo.length) return; undo.push(JSON.stringify(chart().notes)); applyNotes(redo.pop()); }

  function noteAt(lane, beat) {
    const s = snapStep() * 0.55;
    const ns = chart().notes;
    for (let i = 0; i < ns.length; i++) if (ns[i].lane === lane && Math.abs(ns[i].beat - beat) <= s) return i;
    return -1;
  }
  function addNote(lane, beat) {
    const b = snapBeat(beat); if (b < 0) return;
    const note = { t: beatToTime(b), beat: b, lane, dur: 0, quant: denomToNote(quantOf(b)), type: 'tap' };
    chart().notes.push(note); chart().notes.sort((a, b2) => a.t - b2.t || a.lane - b2.lane); recount(); onChange(getCharts());
  }
  function removeAt(idx) { chart().notes.splice(idx, 1); recount(); onChange(getCharts()); }
  function setHold(idx, endBeat) {
    const n = chart().notes[idx]; const eb = snapBeat(endBeat);
    if (eb <= n.beat) { n.type = 'tap'; n.dur = 0; delete n.endBeat; }
    else { n.type = 'hold'; n.endBeat = eb; n.dur = (eb - n.beat) * period(); }
    recount(); onChange(getCharts());
  }
  function recount() {
    const c = chart(); c.count = c.notes.length;
    let holds = 0; for (const n of c.notes) if (n.dur > 0) holds++;
    c._holds = holds;
    renderRead();
  }

  // pointer on the strip: map to lane + beat, then add, remove, move, or hold
  let drag = null;
  function pointerToCell(ev) {
    const r = el.strip.getBoundingClientRect();
    const x = (ev.clientX - r.left), y = (ev.clientY - r.top);
    const g = field.geom(); let lane = Math.round((x - g.startX) / g.gap); lane = clamp(lane, 0, 3);
    const t = field.timeAtY(y, playTime, chart(), speed);
    return { lane, beat: timeToBeat(t) };
  }
  function onStripDown(ev) {
    ev.preventDefault();
    const cell = pointerToCell(ev), idx = noteAt(cell.lane, snapBeat(cell.beat));
    if (mode === 'select') { if (idx >= 0) { pushUndo(); removeAt(idx); } return; }
    pushUndo();
    if (idx >= 0) drag = { kind: 'move', idx, startBeat: chart().notes[idx].beat, lane: cell.lane };
    else { addNote(cell.lane, cell.beat); const ni = noteAt(cell.lane, snapBeat(cell.beat)); drag = { kind: 'new', idx: ni, startBeat: snapBeat(cell.beat), lane: cell.lane }; }
  }
  function onStripMove(ev) {
    if (!drag) return; ev.preventDefault();
    const cell = pointerToCell(ev);
    if (drag.kind === 'new' || drag.kind === 'hold') { if (Math.abs(cell.beat - drag.startBeat) > snapStep() * 0.75) { drag.kind = 'hold'; setHold(drag.idx, cell.beat); } }
    else if (drag.kind === 'move') { const n = chart().notes[drag.idx]; if (n) { n.lane = clamp(Math.round(cell.lane), 0, 3); n.beat = snapBeat(cell.beat); n.t = beatToTime(n.beat); onChange(getCharts()); } }
  }
  function onStripUp() { drag = null; }

  // wheel scrubs time
  function onWheel(ev) { ev.preventDefault(); if (playing) pause(); const dt = (ev.deltaY > 0 ? 1 : -1) * snapStep() * period(); playTime = clamp(playTime + dt, 0, duration); }

  // ----- timeline minimap -----
  function drawMini() {
    const c = el.mini, g = c.getContext('2d'), W = c.width, H = c.height; g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(34,32,63,.06)'; g.fillRect(0, 0, W, H);
    const ns = chart().notes, arr = new Float32Array(W);
    for (const n of ns) { const x = Math.floor(n.t / Math.max(0.001, duration) * W); if (x >= 0 && x < W) arr[x] += 1 + (n.dur > 0 ? 0.5 : 0); }
    let mx = 1; for (let i = 0; i < W; i++) if (arr[i] > mx) mx = arr[i];
    g.fillStyle = '#9B5CFF'; for (let i = 0; i < W; i++) { const h = arr[i] / mx * H; if (h > 0) g.fillRect(i, H - h, 1, h); }
    const px = Math.floor(playTime / Math.max(0.001, duration) * W);
    g.fillStyle = '#FFC83D'; g.fillRect(px - 1, 0, 2, H);
    g.strokeStyle = '#22203F'; g.lineWidth = 2; g.strokeRect(1, 1, W - 2, H - 2);
  }
  function onMiniSeek(ev) {
    const r = el.mini.getBoundingClientRect(); const x = clamp(ev.clientX - r.left, 0, r.width);
    if (playing) pause(); playTime = clamp(x / r.width * duration, 0, duration);
  }

  // ----- readout -----
  function renderRead() {
    const c = chart(), nps = c.count / Math.max(1, duration);
    el.read.innerHTML =
      '<div class="fact"><span>NPS</span><b>' + nps.toFixed(1) + '</b></div>' +
      '<div class="fact"><span>Steps</span><b>' + c.count + '</b></div>' +
      '<div class="fact"><span>Holds</span><b>' + (c._holds || c.notes.filter((n) => n.dur > 0).length) + '</b></div>' +
      '<div class="fact"><span>Engine</span><b style="font-size:12px">' + (c.engineUsed || c.engine || 'drum') + '</b></div>';
  }

  // ----- loop -----
  let raf = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    if (playing && ctxA) { playTime = ctxA.currentTime - startCtx; if (playTime >= duration) { playTime = duration; pause(); } }
    field.render(playTime, chart(), { speed, beats: true, showFeedback: false });
    drawPlayhead();
    drawMini();
  }
  function drawPlayhead() {
    const g = el.strip.getContext('2d');
    const gm = field.geom();
    g.save(); g.strokeStyle = 'rgba(255,200,61,.9)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, gm.recY); g.lineTo(gm.w, gm.recY); g.stroke(); g.restore();
  }

  // ----- wiring -----
  el.tabs.querySelectorAll('.ed-tab').forEach((b) => b.addEventListener('click', () => setDifficulty(b.dataset.df)));
  el.modeSeg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.m; el.modeSeg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); }));
  el.snapBox.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { snap = +b.dataset.s; el.snapBox.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); }));
  el.play.addEventListener('click', togglePlay);
  el.zoomIn.addEventListener('click', () => { speed = clamp(speed + 0.4, 1, 6); });
  el.zoomOut.addEventListener('click', () => { speed = clamp(speed - 0.4, 1, 6); });
  el.undo.addEventListener('click', doUndo);
  el.redo.addEventListener('click', doRedo);
  el.strip.addEventListener('pointerdown', (e) => { el.strip.setPointerCapture(e.pointerId); onStripDown(e); });
  el.strip.addEventListener('pointermove', onStripMove);
  el.strip.addEventListener('pointerup', onStripUp);
  el.strip.addEventListener('wheel', onWheel, { passive: false });
  el.mini.addEventListener('pointerdown', (e) => { el.mini.setPointerCapture(e.pointerId); onMiniSeek(e); });
  el.mini.addEventListener('pointermove', (e) => { if (e.buttons) onMiniSeek(e); });
  const keyHandler = (e) => {
    if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    else if (e.key === 'ArrowRight') { if (playing) pause(); playTime = clamp(playTime + snapStep() * period(), 0, duration); }
    else if (e.key === 'ArrowLeft') { if (playing) pause(); playTime = clamp(playTime - snapStep() * period(), 0, duration); }
    else if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); doUndo(); }
    else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); doRedo(); }
  };
  container.setAttribute('tabindex', '0');
  container.addEventListener('keydown', keyHandler);
  const onResize = () => layoutCanvases();
  if (typeof window !== 'undefined') window.addEventListener('resize', onResize);

  function setDifficulty(df) { if (!charts[df]) return; if (playing) pause(); active = df; el.tabs.querySelectorAll('.ed-tab').forEach((b) => b.classList.toggle('on', b.dataset.df === df)); recount(); }
  function getCharts() { return charts; }
  function destroy() { pause(); if (raf) cancelAnimationFrame(raf); if (typeof window !== 'undefined') window.removeEventListener('resize', onResize); container.removeEventListener('keydown', keyHandler); field.disconnect(); container.innerHTML = ''; }

  // observe() re-measures if the strip is mounted hidden and shown later.
  layoutCanvases(); field.observe(); recount(); frame();
  return { getCharts, setDifficulty, destroy, get active() { return active; } };
}

function cloneChart(c) { const cp = JSON.parse(JSON.stringify(c)); cp.notes = cp.notes || []; return cp; }

function template(diffKeys, active) {
  const tabs = diffKeys.map((df) => '<button class="ed-tab' + (df === active ? ' on' : '') + '" data-df="' + df + '" style="background:var(--d-' + shortDiff(df) + ')">' + df + '</button>').join('');
  const snaps = SNAPS.map(([v, label], i) => '<button data-s="' + v + '"' + (v === 16 ? ' class="on"' : '') + '>' + label + '</button>').join('');
  return (
    '<div class="ed-top">' +
    '<div class="ed-tabs">' + tabs + '</div>' +
    '<div class="ed-tools">' +
    '<div class="ed-seg" data-seg="mode"><button data-m="edit" class="on">Edit</button><button data-m="select">Select</button></div>' +
    '<div class="ed-snap"><span class="eyebrow" style="font-size:9px">Snap</span>' + snaps + '</div>' +
    '<button class="btn white sm" data-act="zoomout">-</button><button class="btn white sm" data-act="zoomin">+</button>' +
    '<button class="btn white sm" data-act="undo">Undo</button><button class="btn white sm" data-act="redo">Redo</button>' +
    '<button class="btn green sm" data-act="play">Play</button>' +
    '</div></div>' +
    '<div class="ed-body">' +
    '<div class="ed-strip"><canvas></canvas></div>' +
    '<div class="ed-side">' +
    '<div class="ed-read"></div>' +
    '<div class="ed-mini"><canvas></canvas></div>' +
    '<div class="ed-hint">Scrub with the wheel, the timeline, or the arrow keys. In Edit, click a lane to add or remove an arrow, and drag down from an arrow to make a hold. Space plays.</div>' +
    '</div></div>'
  );
}
function shortDiff(df) { return ({ beginner: 'beg', basic: 'bas', difficult: 'dif', expert: 'exp', challenge: 'cha' })[df] || 'bas'; }
