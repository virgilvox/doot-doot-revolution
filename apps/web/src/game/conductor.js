// conductor: drives the endless "perpetual" stream. It holds ONE composed piece that
// grows in place — each new phrase is composed (evolving the melodies against a fixed
// key/tempo/mood, ferrule's perpetual trick) and its events are appended to the piece
// the engine's live synth is already scheduling, while its chart notes are appended to
// the growing chart and Judge in lockstep. Old events and notes are pruned behind the
// playhead so a run of any length stays bounded. No buffers, no seams: the live synth
// plays one continuous, ever-extending piece.

import { composePiece, chartFromPiece, mixSeed } from '@doot-games/chart';

const SEG_BARS = 8; // phrase length per extension

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// slow energy waves so the stream builds and breaks instead of sitting flat
function intensityFor(i) { return clamp(0.55 + 0.32 * Math.sin(i * 0.6) + 0.1 * Math.sin(i * 1.9), 0.3, 1); }

export function createConductor({ mood, seed, bpm, difficulty }) {
  const piece = composePiece(mood, mixSeed(seed, 0), { bpm, bars: SEG_BARS, intensity: 0.5, sectionIndex: 0 });
  const rootPc = piece.rootPc, tempo = piece.tempo;      // fixed for the whole run
  const secPerBar = 4 * 60 / tempo;
  let prevSummary = piece.summary, idx = 0;
  let chart = null, judge = null;

  function initialChart() {
    const ch = chartFromPiece(piece, difficulty);
    chart = { bpm: tempo, offset: 0, bpms: [{ beat: 0, bpm: tempo }], stops: [], difficulty, notes: ch.notes.slice(), duration: 0 };
    return chart;
  }
  function bindJudge(j) { judge = j; }

  function extendOne() {
    idx++;
    const stepOff = piece.totalSteps, barOff = piece.totalBars;
    const seg = composePiece(mood, mixSeed(seed, idx), { bpm, bars: SEG_BARS, rootPc, intensity: intensityFor(idx), sectionIndex: (idx % 3) + 1, evolveFrom: prevSummary });
    // append synth events (absolute step keys) onto the piece the engine is playing
    for (const v in seg.events) { const src = seg.events[v], dst = piece.events[v]; for (const s in src) dst[+s + stepOff] = src[s]; }
    piece.totalBars += seg.totalBars; piece.totalSteps += seg.totalSteps;
    prevSummary = seg.summary;
    // append chart notes (absolute time/beat) onto chart + judge together
    if (chart && judge) {
      const segNotes = chartFromPiece(seg, difficulty).notes;
      const tOff = barOff * secPerBar, beatOff = barOff * 4;
      const notes = segNotes.map((n) => { const m = { ...n, t: n.t + tOff, beat: n.beat + beatOff }; if (n.endBeat != null) m.endBeat = n.endBeat + beatOff; return m; });
      for (const n of notes) chart.notes.push(n);
      judge.appendNotes(notes);
    }
  }

  // keep composed material at least `aheadSec` beyond the playhead
  function pump(songTime, aheadSec) {
    let guard = 0;
    while (piece.totalBars * secPerBar < songTime + aheadSec && guard++ < 8) extendOne();
  }
  // drop synth event steps well behind the scheduler to bound memory
  function pruneEvents(schedStep) {
    const cut = schedStep - 32; if (cut <= 0) return;
    for (const v in piece.events) { const m = piece.events[v]; for (const s in m) { if (+s < cut) delete m[s]; } }
  }

  return { piece, tempo, mood, initialChart, bindJudge, extendOne, pump, pruneEvents };
}
