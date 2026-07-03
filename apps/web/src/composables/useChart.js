// useChart: lazy analysis and chart generation shared by select, difficulty, and
// add. Composed built-ins chart straight from their piece (instant, perfectly
// synced); imported audio is decoded, analyzed, and charted, then persisted so it is
// not recomputed next time.

import { analyze, estimateTempo } from '@doot-games/chart';
import { generate as charterGenerate, chartFromPiece } from '@doot-games/chart';
import { library } from '../game/singletons.js';
import { ensureBuffer } from '../game/audio.js';

export function useChart() {
  async function ensureAnalysis(song) {
    if (song._analysis) return;
    const buf = await ensureBuffer(song); if (!buf) return;
    const an = analyze(buf); let tp;
    if (song.bpm) tp = { bpm: song.bpm, offset: song.offset || 0, fps: an.sr / an.hop };
    else { tp = estimateTempo(an); song.bpm = tp.bpm; song.offset = tp.offset; }
    song._analysis = an; song._tempo = tp; if (!song.duration) song.duration = buf.duration;
  }
  async function ensureChart(song, diff) {
    if (song.charts && song.charts[diff]) return song.charts[diff];
    song.charts = song.charts || {};
    if (song._piece) { const ch = chartFromPiece(song._piece, diff); song.charts[diff] = ch; return ch; }
    await ensureAnalysis(song);
    const laneBias = song._engine === 'quick' ? 'none' : 'drum';
    const ch = charterGenerate(song._analysis, song._tempo, { difficulty: diff, laneBias, engine: song._engine || 'drum', engineUsed: (song._engine === 'quick' ? 'quick (onset+tempo)' : 'drum-aware'), seed: song.title });
    song.charts[diff] = ch;
    if (song.source !== 'demo' && song.audio) { const { _analysis, _tempo, buffer, _piece, ...rest } = song; library.put(rest).catch(() => {}); }
    return ch;
  }
  return { ensureAnalysis, ensureChart };
}
