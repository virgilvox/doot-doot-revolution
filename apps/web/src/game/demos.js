// The built-in songs, all hand-composed in the songbook (real progressions, written
// melodies, verse/chorus/bridge form) and compiled to a PIECE by compileSong. Composing
// and charting are pure and instant, so the wheel shows full songs with correct foot
// ratings at boot; the audio plays live through each song's bellows genre rack, from code,
// no render. (The generative composer is used by Endless, not here.)

import { chartFromPiece, compileSong, SONGBOOK } from '@doot-games/chart';

// build a wheel song from a compiled PIECE + display metadata
function buildSong(piece, meta) {
  const duration = piece.totalSteps * (60 / piece.tempo / 4);
  const song = {
    id: 'demo-' + meta.id, title: meta.title, artist: meta.artist, genre: meta.genre, bpm: piece.tempo,
    offset: 0, source: 'demo', duration, createdAt: 0,
    _piece: piece, _mood: meta.mood, _engine: 'composed', _bellows: true, charts: {}
  };
  ['basic', 'difficult', 'expert'].forEach((df) => { song.charts[df] = chartFromPiece(piece, df); });
  return song;
}

export function makeDemos() {
  return SONGBOOK.map((s) => buildSong(compileSong(s), { id: s.id, title: s.title, artist: s.artist, genre: s.genre, mood: s.mood }));
}
