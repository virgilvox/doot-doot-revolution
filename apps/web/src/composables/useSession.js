// useSession: one play. Builds a Judge, runs the countdown, and drives the render
// and judge loop off the audio clock, exposing reactive score/combo/life and the
// results. Carries the abort-epoch guard so quitting or restarting mid-countdown
// never plays onto a screen the player already left. One session at a time. Also
// runs the endless "perpetual" mode (startEndless): the same loop, but a conductor
// keeps composing and charting ahead, and old notes/events are pruned, so it never
// ends until the player quits.

import { reactive, markRaw } from 'vue';
import { Judge } from '@doot-games/play';
import { createTiming } from '@doot-games/chart';
import { engine, input } from '../game/singletons.js';
import { settings } from '../game/settings.js';
import { bus } from '../game/bus.js';
import { ensureBuffer } from '../game/audio.js';
import { createConductor } from '../game/conductor.js';

// hit tick pitch per judgment: brighter for a better hit
const TICK_FREQ = { marvelous: 1245, perfect: 1046, great: 880, good: 740, boo: 620 };

function createSession() {
  const state = reactive({ playing: false, score: 0, combo: 0, life: 50, count: '', progress: 0, elapsed: 0, endless: false, judge: null, chart: null, song: null, results: null });
  let raf = 0, active = false, epoch = 0, subs = [], field = null, timing = null;
  let endless = false, conductor = null;
  const off = () => settings.offsetMs / 1000;

  function attachField(f) { field = f; }

  function wireInput(judge) {
    subs.push(bus.on('lane:down', ({ lane }) => {
      if (!active) return;
      const type = judge.hit(lane, engine.time() + off());
      if (type && field) field.hit(lane, type, engine.time());
      if (type) engine.tick(TICK_FREQ[type] || 880); // sound only on a real note, brighter for a better hit
    }));
  }

  async function start(song, chart) {
    stop(); const mine = ++epoch;
    // markRaw so Vue does not deep-proxy the chart's note array, the song's buffers,
    // or the Judge instance the 60fps loop touches every frame.
    state.song = markRaw(song); state.chart = markRaw(chart); state.results = null; state.score = 0; state.combo = 0; state.life = 50; state.progress = 0; state.endless = false;
    const judge = new Judge(chart); state.judge = markRaw(judge);
    timing = createTiming(chart); // beat<->time map, so variable-BPM charts scroll right
    // imported songs need a decoded buffer; composed songs play from the live synth
    if (!song._piece) { const buf = song.buffer || await ensureBuffer(song); if (mine !== epoch || !buf) return; engine.load(buf); }
    engine.applyVolumes();
    wireInput(judge);
    await engine.resume(); if (mine !== epoch) return;
    if (field) { field.resize(); field.setReducedMotion(settings.reducedMotion); }
    await countdown(() => mine === epoch); if (mine !== epoch) return;
    if (song._piece) engine.playPiece(song._piece); else engine.play(0);
    active = true; state.playing = true; loop();
  }

  // Perpetual mode: an endless, evolving stream. cfg = { mood, seed, bpm, difficulty }.
  async function startEndless(cfg) {
    stop(); const mine = ++epoch;
    conductor = createConductor(cfg); endless = true;
    const chart = conductor.initialChart();
    const song = { title: 'Perpetual', artist: (cfg.mood || 'endless').toUpperCase(), bpm: conductor.tempo, endless: true, difficulty: cfg.difficulty };
    state.song = markRaw(song); state.chart = markRaw(chart); state.results = null; state.score = 0; state.combo = 0; state.life = 50; state.progress = 0; state.elapsed = 0; state.endless = true;
    const judge = new Judge(chart, { endless: true }); state.judge = markRaw(judge);
    conductor.bindJudge(judge);
    timing = createTiming(chart);
    engine.applyVolumes();
    wireInput(judge);
    await engine.resume(); if (mine !== epoch) return;
    if (field) { field.resize(); field.setReducedMotion(settings.reducedMotion); }
    conductor.pump(0, 8); // prime ~8s of music and notes before the count
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
    const t = engine.time(), held = input.held();
    if (endless && conductor) {
      conductor.pump(t, 4);                                    // keep music + notes ~4s ahead
      const cut = state.judge.pruneBefore(t - 2);              // drop notes behind the playhead
      if (cut) state.chart.notes.splice(0, cut);              // in lockstep with judge.notes
      conductor.pruneEvents(engine.schedStep);                // drop old synth events
    }
    state.judge.update(t, held);
    if (field) field.render(t, state.chart, { speed: settings.speed, judge: state.judge, held, beat: timing ? timing.timeToBeat(t) : undefined });
    state.score = state.judge.score; state.combo = state.judge.combo; state.life = state.judge.life;
    if (endless) { state.elapsed = Math.max(0, t); }
    else { const dur = engine.duration(); state.progress = dur ? Math.min(1, t / dur) : 0; if (t >= dur + 0.6) end(); }
  }

  function stop() { epoch++; active = false; state.playing = false; if (raf) cancelAnimationFrame(raf); raf = 0; subs.forEach((u) => u && u()); subs = []; endless = false; conductor = null; engine.stop(); }
  function restart() { if (state.song && state.chart && !state.song.endless) start(state.song, state.chart); }
  function quit() { if (state.playing) end(); }
  function end() {
    const results = state.judge.results();
    if (state.endless) results.elapsed = state.elapsed;
    state.results = results; stop();
    bus.emit('game:end', { results, song: state.song, chart: state.chart });
  }

  return { state, start, startEndless, stop, restart, quit, attachField };
}

export const session = createSession();
