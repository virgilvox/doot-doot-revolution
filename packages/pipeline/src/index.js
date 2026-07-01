// pipeline: the chart engine router. Picks the analysis path for the chosen
// engine, awaits any heavy model, applies fallback, reports progress through
// hooks, and runs the charter for each requested difficulty. This is where an
// engine name becomes a real technique.
//
// Engines are limited to those with a working in-browser method:
//   quick  onset + tempo, lane bias off, fast.
//   drum   per-band onsets bias lane choice. the default.
//   stem   isolate the drum stem over WebGPU, then chart the drums. falls back
//          to drum on the full mix when WebGPU is unavailable, and the result
//          records which path actually ran.
// There is no neural step-author engine, because no in-browser step-placement
// model can be loaded and run.

import { analyze, estimateTempo } from '@doot-games/analysis';
import { generate as charterGenerate, DIFFS } from '@doot-games/charter';
import { isolateDrums } from '@doot-games/stems';

export const ENGINES = {
  quick: { name: 'Quick', desc: 'On-device onset and tempo. Instant.', time: '~5s', laneBias: 'none' },
  drum: { name: 'Drum-Aware', desc: 'Per-band onsets, weighted to the beat.', time: '~15s', laneBias: 'drum' },
  stem: { name: 'Stem-Split', desc: 'Isolates the drum stem via WebGPU, then charts the drums.', time: '~60s', laneBias: 'drum' }
};

const noop = () => {};

// Resolve analysis, tempo, and the analysis to chart from for an engine. Handles
// the stem isolation step and its fallback. Returns everything the charter needs
// plus engineUsed describing the path that ran.
async function prepare(source, options, hooks) {
  const stage = hooks.stage || noop, progress = hooks.progress || noop, status = hooks.status || noop;
  const engine = options.engine || 'drum';

  stage('decode');
  let analysis = source.analysis || analyze(source.buffer);
  stage('tempo');
  let tempo = source.tempo || estimateTempo(analysis);
  if (options.bpm) tempo = { bpm: options.bpm, offset: tempo.offset, fps: tempo.fps };

  let chartFrom = analysis, laneBias = ENGINES[engine] ? ENGINES[engine].laneBias : 'drum', engineUsed;
  if (engine === 'quick') engineUsed = 'quick (onset+tempo)';
  else if (engine === 'stem') {
    stage('isolate');
    let drums = null;
    try { drums = await isolateDrums(source.buffer, { onStatus: status, onProgress: (p) => progress(p, 'isolating drums') }); } catch (e) { drums = null; }
    if (drums) { chartFrom = analyze(drums); engineUsed = 'stem-split (drums isolated)'; }
    else { engineUsed = 'drum-aware (stem fallback)'; status('stem isolation unavailable, charting the full mix'); }
    laneBias = 'drum';
  } else { engineUsed = 'drum-aware'; laneBias = 'drum'; }

  return { analysis, tempo, chartFrom, laneBias, engine, engineUsed };
}

// Generate charts for one or more difficulties from a source. Returns
// { charts, engineUsed, analysis, tempo }. source: { buffer, analysis?, tempo?,
// title? }. options: { engine, difficulties[] | difficulty, bpm?, seed? }.
export async function generate(source, options = {}, hooks = {}) {
  const stage = hooks.stage || noop, progress = hooks.progress || noop;
  const diffs = options.difficulties || (options.difficulty ? [options.difficulty] : ['basic']);
  const prep = await prepare(source, options, hooks);

  stage('place');
  const charts = {};
  for (let i = 0; i < diffs.length; i++) {
    const df = diffs[i];
    if (!DIFFS[df]) continue;
    charts[df] = charterGenerate(prep.chartFrom, prep.tempo, {
      difficulty: df, laneBias: prep.laneBias, engine: prep.engine, engineUsed: prep.engineUsed,
      seed: options.seed || source.title || 'ddr'
    });
    progress(0.4 + (i + 1) / diffs.length * 0.5, 'placing ' + df);
  }
  stage('balance');
  return { charts, engineUsed: prep.engineUsed, analysis: prep.analysis, tempo: prep.tempo };
}

// Convenience: generate a single chart and return it directly.
export async function generateChart(source, options = {}, hooks = {}) {
  const df = options.difficulty || 'basic';
  const out = await generate(source, Object.assign({}, options, { difficulties: [df] }), hooks);
  return out.charts[df];
}
