// useChart: lazy analysis and chart generation shared by select, difficulty, and
// add. Mirrors the vanilla app helpers, persisting generated charts for library
// songs so they are not recomputed next time.

import { analyze, estimateTempo } from '@doot-games/chart';
import { generate as charterGenerate } from '@doot-games/chart';
import { engine, library } from '../game/singletons.js';

export function useChart() {
  async function ensureAnalysis(song) {
    if (song._analysis) return;
    let buf = song.buffer; if (!buf) { buf = await engine.decode(await song.audio.arrayBuffer()); song.buffer = buf; }
    const an = analyze(buf); let tp;
    if (song.bpm) tp = { bpm: song.bpm, offset: song.offset || 0, fps: an.sr / an.hop };
    else { tp = estimateTempo(an); song.bpm = tp.bpm; song.offset = tp.offset; }
    song._analysis = an; song._tempo = tp; if (!song.duration) song.duration = buf.duration;
  }
  async function ensureChart(song, diff) {
    if (song.charts && song.charts[diff]) return song.charts[diff];
    await ensureAnalysis(song);
    const laneBias = song._engine === 'quick' ? 'none' : 'drum';
    const ch = charterGenerate(song._analysis, song._tempo, { difficulty: diff, laneBias, engine: song._engine || 'drum', engineUsed: (song._engine === 'quick' ? 'quick (onset+tempo)' : 'drum-aware'), seed: song.title });
    song.charts = song.charts || {}; song.charts[diff] = ch;
    if (song.source !== 'demo' && song.audio) { const { _analysis, _tempo, buffer, ...rest } = song; library.put(rest).catch(() => {}); }
    return ch;
  }
  return { ensureAnalysis, ensureChart };
}
