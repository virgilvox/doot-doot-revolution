// useSession: one play. Builds a Judge per player, runs the countdown, and drives the
// render and judge loop off the audio clock, exposing reactive per-player score/combo/life
// and the results. One song and one clock for everyone; input is routed to the player that
// owns the sending device (single-player has one "all"-device player that catches every
// input). Carries the abort-epoch guard so quitting or restarting mid-countdown never
// plays onto a screen the player already left. Also runs the endless "perpetual" mode
// (single-player): the same loop, but a conductor keeps composing and charting ahead.

import { reactive, markRaw } from 'vue';
import { Judge } from '@doot-games/play';
import { createTiming } from '@doot-games/chart';
import { engine, input } from '../game/singletons.js';
import { settings } from '../game/settings.js';
import { bus } from '../game/bus.js';
import { ensureBuffer } from '../game/audio.js';
import { createConductor } from '../game/conductor.js';
import { makePlayers, playerForDevice, standings } from '../game/roster.js';

// hit tick pitch per judgment: brighter for a better hit
const TICK_FREQ = { marvelous: 1245, perfect: 1046, great: 880, good: 740, boo: 620 };

function createSession() {
  const state = reactive({
    playing: false, count: '', progress: 0, elapsed: 0, endless: false, multi: false,
    players: [], song: null, results: null,
    // single-player aliases (mirror players[0]) so single-player HUD/readers stay simple
    score: 0, combo: 0, life: 50, judge: null, chart: null
  });
  let raf = 0, active = false, epoch = 0, subs = [], fields = [], timing = null;
  let endless = false, conductor = null, replay = null;
  const off = () => settings.offsetMs / 1000;

  function setFields(fs) { fields = (fs || []).filter(Boolean); }
  function attachField(f) { fields = f ? [f] : []; } // back-compat: single field

  // one reactive player entry; the Judge and chart are markRaw so the 60fps loop is not
  // slowed by deep Vue proxying of their note arrays
  function playerEntry(index, cfg, chart, judgeOpts) {
    const judge = new Judge(chart, judgeOpts || {});
    return {
      index, label: cfg.label || 'P' + (index + 1), color: cfg.color || null, device: cfg.device,
      difficulty: cfg.difficulty, judge: markRaw(judge), chart: markRaw(chart), score: 0, combo: 0, life: 50
    };
  }
  function syncAliases() { const p = state.players[0]; if (!p) return; state.judge = p.judge; state.chart = p.chart; state.score = p.score; state.combo = p.combo; state.life = p.life; }
  function resizeFields() { for (const f of fields) if (f) { f.resize(); f.setReducedMotion(settings.reducedMotion); } }

  function wireInput() {
    subs.push(bus.on('lane:down', ({ lane, device }) => {
      if (!active) return;
      const pi = playerForDevice(state.players, device); if (pi < 0) return;
      const p = state.players[pi];
      const type = p.judge.hit(lane, engine.time() + off());
      if (type && fields[pi]) fields[pi].hit(lane, type, engine.time());
      if (type) engine.tick(TICK_FREQ[type] || 880);
    }));
  }

  // load audio (imported songs) or nothing (composed songs play from the live synth),
  // then prepare, count down, and begin the loop. shared by every start path.
  async function begin(mine, song, firstChart, onPlay) {
    timing = createTiming(firstChart);
    if (!song._piece) { const buf = song.buffer || await ensureBuffer(song); if (mine !== epoch || !buf) return false; engine.load(buf); }
    engine.applyVolumes();
    wireInput();
    await engine.resume(); if (mine !== epoch) return false;
    resizeFields();
    await countdown(() => mine === epoch); if (mine !== epoch) return false;
    onPlay();
    active = true; state.playing = true; loop();
    return true;
  }

  async function start(song, chart) {
    stop(); const mine = ++epoch; endless = false; state.endless = false; state.multi = false;
    state.song = markRaw(song); state.results = null; state.progress = 0;
    state.players = [playerEntry(0, { device: 'all', difficulty: chart.difficulty }, chart)];
    syncAliases();
    replay = () => start(song, chart);
    await begin(mine, song, chart, () => { if (song._piece) engine.playPiece(song._piece); else engine.play(0); });
  }

  // Local multiplayer: configs = [{ device, difficulty, chart }]. Every chart is charted
  // from the same song, so all share one timing and one clock.
  async function startMatch(song, configs) {
    stop(); const mine = ++epoch; endless = false; state.endless = false; state.multi = true;
    state.song = markRaw(song); state.results = null; state.progress = 0;
    const tagged = makePlayers(configs);
    state.players = tagged.map((p, i) => playerEntry(i, p, configs[i].chart));
    syncAliases();
    replay = () => startMatch(song, configs);
    await begin(mine, song, configs[0].chart, () => { if (song._piece) engine.playPiece(song._piece); else engine.play(0); });
  }

  // Perpetual mode: an endless, evolving stream (single-player). cfg = { mood, seed, bpm, difficulty }.
  async function startEndless(cfg) {
    stop(); const mine = ++epoch; endless = true; state.endless = true; state.multi = false;
    conductor = createConductor(cfg);
    const chart = conductor.initialChart();
    const song = { title: 'Perpetual', artist: (cfg.mood || 'endless').toUpperCase(), bpm: conductor.tempo, endless: true, difficulty: cfg.difficulty };
    state.song = markRaw(song); state.results = null; state.progress = 0; state.elapsed = 0;
    state.players = [playerEntry(0, { device: 'all', difficulty: cfg.difficulty }, chart, { endless: true })];
    conductor.bindJudge(state.players[0].judge);
    syncAliases();
    replay = null; // endless does not restart
    timing = createTiming(chart);
    engine.applyVolumes();
    wireInput();
    await engine.resume(); if (mine !== epoch) return;
    resizeFields();
    conductor.pump(0, 8);
    await countdown(() => mine === epoch); if (mine !== epoch) return;
    engine.playPiece(conductor.piece, { source: { extend: conductor.extendOne } });
    active = true; state.playing = true; loop();
  }

  function countdown(alive) {
    return new Promise((res) => {
      const steps = ['3', '2', '1', 'GO']; let i = 0;
      const step = () => { if (!alive()) { res(); return; } if (i >= steps.length) { state.count = ''; res(); return; } state.count = steps[i++]; setTimeout(step, 600); };
      step();
    });
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    if (!active) return;
    const t = engine.time();
    if (endless && conductor) {
      conductor.pump(t, 4);
      const p0 = state.players[0];
      const cut = p0.judge.pruneBefore(t - 2);            // drop notes behind the playhead
      if (cut) p0.chart.notes.splice(0, cut);             // in lockstep with judge.notes
      conductor.pruneEvents(engine.schedStep);
    }
    const beat = timing ? timing.timeToBeat(t) : undefined;
    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      const held = p.device === 'all' ? input.held() : input.heldFor(p.device);
      p.judge.update(t, held);
      if (fields[i]) fields[i].render(t, p.chart, { speed: settings.speed, judge: p.judge, held, beat });
      p.score = p.judge.score; p.combo = p.judge.combo; p.life = p.judge.life;
    }
    syncAliases();
    if (endless) state.elapsed = Math.max(0, t);
    else { const dur = engine.duration(); state.progress = dur ? Math.min(1, t / dur) : 0; if (dur > 0 && t >= dur + 0.6) end(); else if (dur <= 0) console.warn('[END-GUARD] loop active but engine.duration()=0 at t=', t.toFixed(2)); }
  }

  function stop() { epoch++; active = false; state.playing = false; if (raf) cancelAnimationFrame(raf); raf = 0; subs.forEach((u) => u && u()); subs = []; endless = false; conductor = null; engine.stop(); }
  function restart() { if (replay && !state.endless) replay(); }
  function quit() { if (state.playing) end(); }
  function end() {
    console.warn('[END] called; multi=', state.multi, 'players=', state.players.length, 'elapsed=', state.elapsed);
    if (state.multi) {
      const players = standings(state.players.map((p) => ({ index: p.index, label: p.label, color: p.color, difficulty: p.difficulty, ...p.judge.results() })));
      state.results = { multi: true, players };
    } else {
      const results = state.players[0].judge.results();
      if (state.endless) results.elapsed = state.elapsed;
      state.results = results;
    }
    stop();
    bus.emit('game:end', { results: state.results, song: state.song, chart: state.chart });
  }

  return { state, start, startMatch, startEndless, stop, restart, quit, attachField, setFields };
}

export const session = createSession();
