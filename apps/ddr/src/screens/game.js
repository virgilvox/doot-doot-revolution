// Gameplay: one play session. Decodes audio, runs a 3-2-1 count, then plays and
// drives the render and judge loop off the audio clock until the song ends. The
// screen is thin; the judging, timing, and drawing all live in packages.

import { Judge } from '@doot-games/judge';
import { $, clamp01, fmtScore } from '../dom.js';

const BLAST = { marvelous: '#89f0d8', perfect: '#89f0d8', great: '#86EE72', good: '#8fc0ff' };

export function createSession(ctx) {
  const { engine, input, settings, notefield, bus } = ctx;
  let raf = 0, active = false, subs = [], song = null, chart = null, judge = null;
  // Each start bumps the epoch. stop() bumps it too, so a start that is quit or
  // restarted mid-await sees a stale epoch after decode or the countdown and bails
  // out instead of playing onto a screen the player already left.
  let epoch = 0;

  function hud() {
    if ($('#gpScore')) return; const top = $('.gp-top'); if (!top) return; const acts = $('.acts', top);
    const el = document.createElement('div'); el.style.cssText = 'margin:0 auto;text-align:center;color:#fff';
    el.innerHTML = '<div id="gpScore" style="font-family:var(--fd);font-weight:800;font-size:22px;letter-spacing:2px;text-shadow:0 2px 0 var(--ink-2)">00000000</div>' +
      '<div style="width:min(200px,40vw);height:10px;border:2.5px solid #fff;border-radius:999px;overflow:hidden;margin:3px auto 0"><i id="gpLife" style="display:block;height:100%;width:50%;background:#89f0d8;transition:width .12s"></i></div>';
    top.insertBefore(el, acts);
  }
  const off = () => settings.get('offsetMs') / 1000;

  async function start(s, c) {
    stop(); const mine = ++epoch; song = s; chart = c; judge = new Judge(c);
    let buf = s.buffer; if (!buf) { buf = await engine.decode(await s.audio.arrayBuffer()); if (mine !== epoch) return; s.buffer = buf; }
    engine.load(buf); engine.applyVolumes();
    $('#gpTitle').textContent = s.title || 'Untitled';
    $('#gpSub').textContent = (s.artist || '') + ' · ' + Math.round(c.bpm) + ' BPM · ' + c.difficulty;
    hud(); notefield.resize();

    subs.push(input.on('down', ({ lane }) => {
      if (!active) return;
      const type = judge.hit(lane, engine.time() + off());
      if (type && BLAST[type]) notefield.blast(lane, BLAST[type], engine.time());
      engine.tick();
    }));

    await engine.resume(); if (mine !== epoch) return;
    await countdown(); if (mine !== epoch) return;
    engine.play(0); active = true; loop();
  }

  function countdown() {
    return new Promise((res) => {
      const el = $('#gpCount'), steps = ['3', '2', '1', 'GO']; let i = 0; el.style.display = 'grid';
      const step = () => { if (i >= steps.length) { el.style.display = 'none'; return res(); } el.textContent = steps[i++]; setTimeout(step, 600); };
      step();
    });
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    if (!active) return;
    const t = engine.time(), held = input.laneDown();
    judge.update(t, held);
    notefield.render(t, chart, { speed: settings.get('speed'), judge, held });
    const dur = engine.duration();
    const p = $('#gpProg'); if (p) p.style.width = clamp01(t / (dur || 1)) * 100 + '%';
    const sc = $('#gpScore'); if (sc) sc.textContent = fmtScore(judge.score);
    const lf = $('#gpLife'); if (lf) { lf.style.width = judge.life + '%'; lf.style.background = judge.life < 25 ? '#FF7A8A' : judge.life < 55 ? '#FFC83D' : '#89f0d8'; }
    if (t >= dur + 0.6) { end(); }
  }

  function stop() { epoch++; active = false; if (raf) cancelAnimationFrame(raf); raf = 0; subs.forEach((u) => u && u()); subs = []; if (engine) engine.stop(); }
  function restart() { if (song && chart) start(song, chart); }
  function end() { const results = judge.results(); stop(); bus.emit('game:end', { results, song, chart }); }

  return { start, stop, restart };
}
