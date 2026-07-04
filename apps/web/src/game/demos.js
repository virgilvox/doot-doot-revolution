// The built-in songs. Each is a full-length, deterministically composed dance track
// (functional-harmony chords, Euclidean drums, chord-tone arps and a Markov lead —
// see @doot-games/chart's compose). Composing and charting are pure and instant, so
// the wheel shows real songs with correct foot ratings at boot; the audio is
// rendered lazily on first preview/play (game/audio.js). Tempos sit in the 126-160
// dance range with a four-on-the-floor backbone so the charts fall on the beat.

import { composePiece, chartFromPiece } from '@doot-games/chart';

const TARGET_SECONDS = 96; // DDR/StepMania-length

const DEFS = [
  { id: 'neon-tiger', title: 'Neon Tiger', artist: 'VOLTKID', genre: 'Synthcore', mood: 'circuit', bpm: 158, seed: 0x1a2b },
  { id: 'glow-worm-disco', title: 'Glow Worm Disco', artist: 'Pixel Mori', genre: 'Disco House', mood: 'pulse', bpm: 126, seed: 0x51c7 },
  { id: 'bubblegum-riot', title: 'Bubblegum Riot', artist: 'FizzPop', genre: 'Happy Hardcore', mood: 'circuit', bpm: 160, seed: 0x77a1 },
  { id: 'midnight-vending', title: 'Midnight Vending', artist: 'Tako Tako', genre: 'City Pop', mood: 'glass', bpm: 132, seed: 0x2d9e },
  { id: 'arcade-heart', title: 'Arcade Heart', artist: 'DJ Spritz', genre: 'Eurobeat', mood: 'neon', bpm: 150, seed: 0xbe11 },
  { id: 'plastic-sunrise', title: 'Plastic Sunrise', artist: 'Coil Garden', genre: 'Synthwave', mood: 'pulse', bpm: 128, seed: 0x3f42 },
  { id: 'sugar-static', title: 'Sugar Static', artist: 'Maho', genre: 'Breakcore', mood: 'circuit', bpm: 150, seed: 0x9c60 },
  { id: 'metronomicon', title: 'Metronomicon', artist: 'DDR Engine', genre: 'Test Pattern', mood: 'neon', bpm: 140, seed: 0x0001 }
];

export function makeDemos() {
  return DEFS.map((def) => {
    const piece = composePiece(def.mood, def.seed, { bpm: def.bpm, targetSeconds: TARGET_SECONDS });
    const duration = piece.totalSteps * (60 / def.bpm / 4);
    const song = {
      id: 'demo-' + def.id, title: def.title, artist: def.artist, genre: def.genre, bpm: def.bpm,
      // every built-in plays live through bellows with a genre-specific voice rack
      offset: 0, source: 'demo', duration, createdAt: 0, _piece: piece, _mood: def.mood, _engine: 'bellows', _bellows: true, charts: {}
    };
    ['basic', 'difficult', 'expert'].forEach((df) => { song.charts[df] = chartFromPiece(piece, df); });
    return song;
  });
}
