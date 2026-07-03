// useSession: one play. Builds a Judge, runs the countdown, and drives the render
// and judge loop off the audio clock, exposing reactive score/combo/life and the
// results. Carries the abort-epoch guard so quitting or restarting mid-countdown
// never plays onto a screen the player already left. One session at a time.

import { reactive, markRaw } from 'vue';
import { Judge } from '@doot-games/judge';
import { createTiming } from '@doot-games/charter';
import { engine, input, settings, bus } from '../game/singletons.js';

// hit tick pitch per judgment: brighter for a better hit
const TICK_FREQ = { marvelous: 1245, perfect: 1046, great: 880, good: 740, boo: 620 };

function createSession() {
  const state = reactive({ playing: false, score: 0, combo: 0, life: 50, count: '', progress: 0, judge: null, chart: null, song: null, results: null });
  let raf = 0, active = false, epoch = 0, subs = [], field = null, timing = null;
  const off = () => settings.get('offsetMs') / 1000;

  function attachField(f) { field = f; }

  async function start(song, chart) {
    stop(); const mine = ++epoch;
    // markRaw so Vue does not deep-proxy the chart's note array, the song's
    // analysis buffers, or the Judge instance the 60fps loop touches every frame.
    state.song = markRaw(song); state.chart = markRaw(chart); state.results = null; state.score = 0; state.combo = 0; state.life = 50; state.progress = 0;
    const judge = new Judge(chart); state.judge = markRaw(judge);
    timing = createTiming(chart); // beat<->time map, so variable-BPM charts scroll right
    let buf = song.buffer; if (!buf) { buf = await engine.decode(await song.audio.arrayBuffer()); if (mine !== epoch) return; song.buffer = buf; }
    engine.load(buf); engine.applyVolumes();
    subs.push(bus.on('lane:down', ({ lane }) => {
      if (!active) return;
      const type = judge.hit(lane, engine.time() + off());
      if (type && field) field.hit(lane, type, engine.time());
      if (type) engine.tick(TICK_FREQ[type] || 880); // sound only on a real note, brighter for a better hit
    }));
    await engine.resume(); if (mine !== epoch) return;
    if (field) { field.resize(); field.setReducedMotion(settings.get('reducedMotion')); }
    await countdown(() => mine === epoch); if (mine !== epoch) return;
    engine.play(0); active = true; state.playing = true; loop();
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
    const t = engine.time(), held = input.laneDown();
    state.judge.update(t, held);
    if (field) field.render(t, state.chart, { speed: settings.get('speed'), judge: state.judge, held, beat: timing ? timing.timeToBeat(t) : undefined });
    state.score = state.judge.score; state.combo = state.judge.combo; state.life = state.judge.life;
    const dur = engine.duration(); state.progress = dur ? Math.min(1, t / dur) : 0;
    if (t >= dur + 0.6) end();
  }

  function stop() { epoch++; active = false; state.playing = false; if (raf) cancelAnimationFrame(raf); raf = 0; subs.forEach((u) => u && u()); subs = []; engine.stop(); }
  function restart() { if (state.song && state.chart) start(state.song, state.chart); }
  function end() { const results = state.judge.results(); state.results = results; stop(); bus.emit('game:end', { results, song: state.song, chart: state.chart }); }

  return { state, start, stop, restart, attachField };
}

export const session = createSession();
