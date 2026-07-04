// The built-in songs. Two kinds now share the wheel: hand-composed tracks from the
// songbook (real progressions, written melodies, verse/chorus/bridge form) compiled by
// compileSong, and generative tracks from composePiece (the endless-style composer) for
// the ones not yet hand-composed. Both compile to the same PIECE, so both chart the same
// way and both play live through their bellows genre rack. Composing and charting are pure
// and instant; the audio plays from code, no render.

import { composePiece, chartFromPiece, compileSong, SONGBOOK } from '@doot-games/chart';

const TARGET_SECONDS = 96;

// generative tracks (not yet hand-composed). plastic-sunrise and midnight-vending now
// live in the songbook as real compositions.
const DEFS = [
  { id: 'neon-tiger', title: 'Neon Tiger', artist: 'VOLTKID', genre: 'Synthcore', mood: 'circuit', bpm: 158, seed: 0x1a2b },
  { id: 'glow-worm-disco', title: 'Glow Worm Disco', artist: 'Pixel Mori', genre: 'Disco House', mood: 'pulse', bpm: 126, seed: 0x51c7 },
  { id: 'bubblegum-riot', title: 'Bubblegum Riot', artist: 'FizzPop', genre: 'Happy Hardcore', mood: 'circuit', bpm: 160, seed: 0x77a1 },
  { id: 'arcade-heart', title: 'Arcade Heart', artist: 'DJ Spritz', genre: 'Eurobeat', mood: 'neon', bpm: 150, seed: 0xbe11 },
  { id: 'sugar-static', title: 'Sugar Static', artist: 'Maho', genre: 'Breakcore', mood: 'circuit', bpm: 150, seed: 0x9c60 },
  { id: 'metronomicon', title: 'Metronomicon', artist: 'DDR Engine', genre: 'Test Pattern', mood: 'neon', bpm: 140, seed: 0x0001 }
];

// build a wheel song from a compiled/composed PIECE + display metadata
function buildSong(piece, meta) {
  const duration = piece.totalSteps * (60 / piece.tempo / 4);
  const song = {
    id: 'demo-' + meta.id, title: meta.title, artist: meta.artist, genre: meta.genre, bpm: piece.tempo,
    offset: 0, source: 'demo', duration, createdAt: 0,
    _piece: piece, _mood: meta.mood, _engine: meta.engine, _bellows: true, charts: {}
  };
  ['basic', 'difficult', 'expert'].forEach((df) => { song.charts[df] = chartFromPiece(piece, df); });
  return song;
}

export function makeDemos() {
  const composed = SONGBOOK.map((s) => buildSong(compileSong(s), { id: s.id, title: s.title, artist: s.artist, genre: s.genre, mood: s.mood, engine: 'composed' }));
  const generative = DEFS.map((def) => buildSong(
    composePiece(def.mood, def.seed, { bpm: def.bpm, targetSeconds: TARGET_SECONDS }),
    { id: def.id, title: def.title, artist: def.artist, genre: def.genre, mood: def.mood, engine: 'compose' }
  ));
  return [...composed, ...generative];
}
