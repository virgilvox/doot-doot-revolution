// Synthesized demo songs so the wheel is populated and everything is playable
// with no file. A per-track seed varies the drum pattern so each charts
// differently.

import { analyze, estimateTempo } from '@doot-games/chart';
import { generate } from '@doot-games/chart';

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function synth(engine, bpm, seed, secs) {
  engine.ensure(); const ctx = engine.ctx, sr = ctx.sampleRate, rnd = mulberry32(seed);
  const buf = ctx.createBuffer(1, Math.floor(secs * sr), sr), d = buf.getChannelData(0), beat = 60 / bpm;
  const hit = (t, freq, dur, amp, noise) => { const st = Math.floor(t * sr), n = Math.floor(dur * sr); for (let i = 0; i < n && st + i < d.length && st >= 0; i++) { const e = Math.exp(-i / (dur * sr) * 5); d[st + i] += (noise ? (rnd() * 2 - 1) : Math.sin(2 * Math.PI * freq * i / sr)) * e * amp; } };
  const kickHalf = rnd() > 0.55, hatDiv = rnd() > 0.5 ? 4 : 2, fillEvery = rnd() > 0.5 ? 8 : 4, ghost = rnd() > 0.6;
  const root = [55, 58.27, 61.74, 49][Math.floor(rnd() * 4)];
  const bars = Math.ceil(secs / beat);
  for (let b = 0; b < bars; b++) {
    const t = b * beat;
    hit(t, 60, 0.18, 0.9, false);
    if (kickHalf && b % 2 === 0) hit(t + beat / 2, 60, 0.14, 0.6, false);
    if (b % 2 === 1) hit(t, 190, 0.12, 0.6, true);
    if (ghost && b % 4 === 2) hit(t + beat * 0.75, 190, 0.06, 0.25, true);
    for (let h = 0; h < hatDiv; h++) hit(t + beat * h / hatDiv, 9000, 0.03, 0.18, true);
    if (b % 2 === 0) hit(t, root, 0.22, 0.35, false);
    if (b % fillEvery === fillEvery - 1) { for (let k = 0; k < 4; k++) hit(t + beat * (0.5 + k / 8), 7000, 0.028, 0.3, true); }
  }
  for (let i = 0; i < d.length; i++) d[i] = Math.max(-1, Math.min(1, d[i]));
  return buf;
}

const DEFS = [
  { id: 'neon-tiger', title: 'Neon Tiger', artist: 'VOLTKID', genre: 'Synthcore', bpm: 172, seed: 0x1a2b, secs: 15 },
  { id: 'glow-worm-disco', title: 'Glow Worm Disco', artist: 'Pixel Mori', genre: 'Disco House', bpm: 138, seed: 0x51c7, secs: 15 },
  { id: 'bubblegum-riot', title: 'Bubblegum Riot', artist: 'FizzPop', genre: 'Happy Hardcore', bpm: 160, seed: 0x77a1, secs: 14 },
  { id: 'midnight-vending', title: 'Midnight Vending', artist: 'Tako Tako', genre: 'City Pop', bpm: 150, seed: 0x2d9e, secs: 15 },
  { id: 'arcade-heart', title: 'Arcade Heart', artist: 'DJ Spritz', genre: 'Eurobeat', bpm: 182, seed: 0xbe11, secs: 14 },
  { id: 'plastic-sunrise', title: 'Plastic Sunrise', artist: 'Coil Garden', genre: 'Synthwave', bpm: 145, seed: 0x3f42, secs: 15 },
  { id: 'sugar-static', title: 'Sugar Static', artist: 'Maho', genre: 'Breakcore', bpm: 128, seed: 0x9c60, secs: 14 },
  { id: 'metronomicon', title: 'Metronomicon', artist: 'DDR Engine', genre: 'Test Pattern', bpm: 128, seed: 0x0001, secs: 18 }
];

export function makeDemos(engine) {
  return DEFS.map((def) => {
    const buf = synth(engine, def.bpm, def.seed, def.secs), an = analyze(buf);
    const tp = { bpm: def.bpm, offset: estimateTempo(an).offset, fps: an.sr / an.hop };
    const song = {
      id: 'demo-' + def.id, title: def.title, artist: def.artist, genre: def.genre, bpm: def.bpm, offset: tp.offset,
      source: 'demo', duration: buf.duration, createdAt: 0, buffer: buf, _analysis: an, _tempo: tp, _engine: 'drum', charts: {}
    };
    ['basic', 'difficult', 'expert'].forEach((df) => { song.charts[df] = generate(an, tp, { difficulty: df, laneBias: 'drum', engine: 'drum', engineUsed: 'drum-aware', seed: song.title }); });
    return song;
  });
}
