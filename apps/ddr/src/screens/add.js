// Add a Song: pull audio, pick an engine and difficulties, generate, then review
// and edit the result before saving. The review step embeds the editor package
// and fits inside the console frame.

import { analyze, estimateTempo } from '@doot-games/analysis';
import { DIFFS } from '@doot-games/charter';
import { ENGINES, generate } from '@doot-games/pipeline';
import { computeRadar } from '@doot-games/radar';
import { createEditor } from '@doot-games/editor';
import { DIFF_VAR } from '@doot-games/ui';
import { $, $$, on, toast, fmtTime } from '../dom.js';

const ENGINE_UI = {
  quick: { ic: 'Q', color: '--green', time: '~5s', q: 2, cls: '' },
  drum: { ic: 'D', color: '--blue', time: '~15s', q: 2, cls: '' },
  stem: { ic: 'S', color: '--purple', time: '~60s', q: 3, cls: 'q' }
};
const STAGE_LABELS = ['Decode & resample', 'Detect tempo', 'Isolate drums · WebGPU', 'Place steps per subdivision', 'Balance feet & write .doot'];
const STAGE_INDEX = { decode: 0, tempo: 1, isolate: 2, place: 3, balance: 4 };

export function createAdd(ctx) {
  const { App, engine, library, router, play } = ctx;
  let engineSel = 'drum', diffSet = new Set(['basic', 'difficult', 'expert']), stages = [], editor = null;

  function setup() {
    $$('.src-tab').forEach((b) => on(b, 'click', () => {
      if (b.disabled) return; const s = b.dataset.src;
      $$('.src-tab').forEach((x) => x.classList.toggle('on', x === b));
      $$('.src-pane').forEach((p) => p.classList.toggle('on', p.dataset.src === s));
    }));
    const fi = $('#file'); on($('#drop'), 'click', () => fi.click());
    on(fi, 'change', (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); });
    on($('#drop'), 'dragover', (e) => { e.preventDefault(); $('#drop').style.background = 'rgba(155,92,255,.10)'; });
    on($('#drop'), 'dragleave', () => { $('#drop').style.background = ''; });
    on($('#drop'), 'drop', (e) => { e.preventDefault(); $('#drop').style.background = ''; const f = e.dataTransfer.files[0]; if (f) handleFile(f); });
    buildEngines(); buildDiffs();
    on($('#genBtn'), 'click', run);
    on($('#runCancel'), 'click', () => $('#addRun').classList.remove('on'));
    on($('#reviewBtn'), 'click', openReview);
    on($('#reviewBack'), 'click', closeReview);
    on($('#reviewPlay'), 'click', preview);
    on($('#saveBtn'), 'click', save);
  }

  function buildEngines() {
    const wrap = $('#engines'); wrap.innerHTML = '';
    Object.keys(ENGINE_UI).forEach((k) => {
      const U = ENGINE_UI[k], E = ENGINES[k]; let m = ''; for (let i = 0; i < 3; i++) m += `<i class="${i < U.q ? 'f' : ''}"></i>`;
      const b = document.createElement('div'); b.className = 'engine' + (k === engineSel ? ' on' : ''); b.dataset.e = k;
      b.innerHTML = `<div class="en-ic" style="background:var(${U.color})">${U.ic}</div>` +
        `<div class="en-b"><div class="en-t">${E.name}</div><div class="en-d">${E.desc}</div></div>` +
        `<div class="en-m"><span>${U.time}</span><div class="emeter ${U.cls}">${m}</div></div>`;
      on(b, 'click', () => { engineSel = k; $$('.engine', wrap).forEach((x) => x.classList.toggle('on', x === b)); if (App.draft) App.draft.engine = k; });
      wrap.appendChild(b);
    });
  }
  function buildDiffs() {
    const wrap = $('#genDiffs'); wrap.innerHTML = '';
    Object.keys(DIFFS).forEach((df) => {
      const D = DIFFS[df], onNow = diffSet.has(df);
      const b = document.createElement('button'); b.type = 'button'; b.className = 'gchip' + (onNow ? ' on' : ''); b.textContent = D.name;
      if (onNow) b.style.background = `var(${DIFF_VAR[df]})`;
      on(b, 'click', () => { if (diffSet.has(df)) { diffSet.delete(df); b.classList.remove('on'); b.style.background = ''; } else { diffSet.add(df); b.classList.add('on'); b.style.background = `var(${DIFF_VAR[df]})`; } });
      wrap.appendChild(b);
    });
  }

  async function handleFile(file) {
    $('#genBtn').disabled = true;
    try {
      await engine.resume(); const buf = await engine.decode(await file.arrayBuffer());
      const an = analyze(buf), tp = estimateTempo(an), name = file.name.replace(/\.[^.]+$/, '');
      App.draft = { file, buffer: buf, analysis: an, tempo: tp, engine: engineSel, charts: {} };
      $('#mTitle').value = name; if ($('#mArtist').value === '') $('#mArtist').value = 'Unknown';
      $('#mBpm').value = Math.round(tp.bpm); $('#mLen').value = fmtTime(buf.duration);
      $('#genBtn').disabled = false; toast('Loaded · ~' + Math.round(tp.bpm) + ' BPM · ' + fmtTime(buf.duration));
    } catch (e) { console.error(e); toast('Could not decode this file'); }
  }

  function openRun() { const box = $('#stages'); box.innerHTML = STAGE_LABELS.map((l, i) => `<div class="stg"><span class="tick">${i + 1}</span><span class="lbl">${l}</span></div>`).join(''); stages = [...box.children]; $('#runDone').classList.remove('on'); bar(0); $('#addRun').classList.add('on'); }
  function setStage(i, state, msg) { const el = stages[i]; if (!el) return; el.classList.remove('run', 'on'); const t = el.querySelector('.tick'); if (state === 'run') el.classList.add('run'); else if (state === 'done') { el.classList.add('on'); t.textContent = '✓'; } else if (state === 'skip') { el.style.opacity = '.55'; t.textContent = '–'; } if (msg) el.querySelector('.lbl').textContent = msg; }
  function bar(p) { $('#runBar').style.width = Math.round(Math.max(0, Math.min(1, p)) * 100) + '%'; }
  const tick = () => new Promise((r) => setTimeout(r, 16));

  async function run() {
    const d = App.draft; if (!d) { toast('Load a file first'); return; }
    const diffs = [...diffSet]; if (!diffs.length) { toast('Pick at least one difficulty'); return; }
    d.engine = engineSel;
    const bpm = parseFloat($('#mBpm').value) || d.tempo.bpm;
    openRun(); await tick();
    if (engineSel !== 'stem') setStage(2, 'skip', 'Isolate drums · not needed');

    const hooks = {
      stage: (name) => { const i = STAGE_INDEX[name]; if (i == null) return; if (i > 0 && engineSel !== 'stem' && i >= 3) { /* keep */ } setStage(i, 'run'); },
      progress: (p) => bar(p),
      status: (msg) => setStage(2, 'run', 'Isolate drums · ' + msg)
    };

    try {
      const out = await generate({ buffer: d.buffer, analysis: d.analysis, tempo: d.tempo, title: $('#mTitle').value }, { engine: engineSel, difficulties: diffs, bpm, seed: $('#mTitle').value }, hooks);
      d.charts = out.charts; d.engineUsed = out.engineUsed;
      for (let i = 0; i <= 4; i++) if (stages[i] && !stages[i].classList.contains('skip') && !stages[i].classList.contains('on')) setStage(i, 'done');
      if (engineSel === 'stem') setStage(2, 'done', 'Isolate drums · ' + (out.engineUsed.indexOf('isolated') >= 0 ? 'done' : 'unavailable, used mix'));
      bar(1); $('#doneTag').textContent = '✓ Chart ready · ' + Object.keys(d.charts).length + ' difficult' + (Object.keys(d.charts).length === 1 ? 'y' : 'ies'); $('#runDone').classList.add('on');
    } catch (e) { console.error(e); toast('Charting failed: ' + e.message); $('#addRun').classList.remove('on'); }
  }

  function openReview() {
    const d = App.draft; if (!d || !Object.keys(d.charts).length) { toast('Generate a chart first'); return; }
    $('#addRun').classList.remove('on');
    $('#reviewPath').textContent = d.engineUsed || 'drum-aware';
    // Show the overlay before mounting so the editor's canvases measure a real
    // size rather than the zero size of a hidden element.
    $('#addReview').style.display = 'flex';
    if (editor) editor.destroy();
    editor = createEditor($('#edHost'), {
      charts: d.charts, difficulty: Object.keys(d.charts).includes('expert') ? 'expert' : Object.keys(d.charts)[0],
      audioBuffer: d.buffer, audioContext: engine.ensure(), onChange: (charts) => { d.charts = charts; }
    });
  }
  function closeReview() { if (editor) { editor.destroy(); editor = null; } $('#addReview').style.display = 'none'; }

  function preview() {
    const d = App.draft; if (!d) return; const charts = editor ? editor.getCharts() : d.charts;
    const df = charts.expert ? 'expert' : Object.keys(charts)[0], bpm = parseFloat($('#mBpm').value) || d.tempo.bpm;
    const song = { id: 'draft-preview', title: $('#mTitle').value || 'Preview', artist: $('#mArtist').value || '', bpm, offset: d.tempo.offset || 0, source: 'file', duration: d.buffer.duration, buffer: d.buffer, charts, audio: d.file };
    closeReview(); play(song, charts[df]);
  }

  async function save() {
    const d = App.draft; if (!d) return; const charts = editor ? editor.getCharts() : d.charts;
    if (!Object.keys(charts).length) { toast('Generate a chart first'); return; }
    Object.keys(charts).forEach((df) => { charts[df].radar = computeRadar(charts[df]); charts[df].count = charts[df].notes.length; });
    const bpm = parseFloat($('#mBpm').value) || d.tempo.bpm;
    const rec = { id: 'song-' + Date.now(), title: $('#mTitle').value || 'Untitled', artist: $('#mArtist').value || 'Unknown', bpm, offset: d.tempo.offset || 0, source: 'file', createdAt: Date.now(), duration: d.buffer.duration, audio: d.file, charts };
    await library.put(rec); toast('Saved to library'); closeReview(); router.show('library');
  }

  return { setup };
}
