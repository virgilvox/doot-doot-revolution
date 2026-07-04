// Authored built-in songs. Real keys, progressions, and written melodies with hooks,
// arranged as intro / verse / chorus / bridge / outro. Phrases are reused so the hooks
// repeat and stay memorable, the way a song does. compileSong (songbook.js) turns each
// into a playable, chartable PIECE. These are compositions, not generated walks.

/* ---- Plastic Sunrise: synthwave in A minor, 116 bpm, i-VI-III-VII ---- */
const PS_VERSE = 'A4:4 C5:4 E5:6 D5:2 | C5:4 A4:4 F4:6 A4:2 | E5:4 G5:4 E5:6 C5:2 | D5:4 B4:4 G4:6 B4:2 | A4:4 C5:4 E5:6 D5:2 | C5:4 A4:4 F4:6 A4:2 | E5:4 G5:4 C6:6 B5:2 | A5:8 -:8';
const PS_HOOK = 'A5:4 A5:2 G5:2 F5:4 A5:4 | B5:4 B5:2 A5:2 G5:4 B5:4 | C6:4 B5:4 A5:8 | E5:4 A5:4 C6:6 B5:2 | A5:4 A5:2 G5:2 F5:4 A5:4 | B5:4 B5:2 A5:2 G5:4 D6:4 | C6:4 E6:4 D6:8 | C6:4 B5:4 A5:8';
const PS_BRIDGE = 'D5:4 F5:4 A5:6 G5:2 | E5:4 G5:4 B5:6 A5:2 | C5:4 E5:4 G5:6 E5:2 | E5:4 G#5:4 B5:8 | D5:4 F5:4 A5:6 G5:2 | E5:4 G#5:4 B5:6 C6:2 | A5:8 E5:8 | -:16';

const plasticSunrise = {
  id: 'plastic-sunrise', title: 'Plastic Sunrise', artist: 'Coil Garden', genre: 'Synthwave', genreKey: 'synthwave', mood: 'pulse', bpm: 116,
  form: [
    { tag: 'INTRO', chords: ['Am', 'F', 'C', 'G'], layers: ['pad', 'arp'] },
    { tag: 'VERSE', chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G'], layers: ['bass', 'kick', 'hat', 'pad', 'lead'], lead: PS_VERSE },
    { tag: 'CHORUS', chords: ['F', 'G', 'Am', 'Am', 'F', 'G', 'C', 'G'], layers: ['bass', 'kick', 'snare', 'hat', 'perc', 'pad', 'arp', 'lead'], lead: PS_HOOK },
    { tag: 'VERSE', chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G'], layers: ['bass', 'kick', 'snare', 'hat', 'pad', 'arp', 'lead'], lead: PS_VERSE },
    { tag: 'CHORUS', chords: ['F', 'G', 'Am', 'Am', 'F', 'G', 'C', 'G'], layers: ['bass', 'kick', 'snare', 'hat', 'perc', 'pad', 'arp', 'lead'], lead: PS_HOOK },
    { tag: 'BRIDGE', chords: ['Dm', 'Am', 'C', 'G', 'Dm', 'E', 'Am', 'Am'], layers: ['bass', 'kick', 'hat', 'pad', 'lead'], lead: PS_BRIDGE },
    { tag: 'CHORUS', chords: ['F', 'G', 'Am', 'Am', 'F', 'G', 'C', 'G'], layers: ['bass', 'kick', 'snare', 'hat', 'perc', 'pad', 'arp', 'lead'], lead: PS_HOOK },
    { tag: 'OUTRO', chords: ['Am', 'F', 'C', 'G'], layers: ['pad', 'arp'] }
  ]
};

/* ---- Midnight Vending: city pop in F major, 110 bpm, jazzy sevenths ---- */
const MV_VERSE = 'A4:2 C5:2 F5:4 E5:4 C5:4 | D5:2 F5:2 A5:4 G5:6 E5:2 | C5:2 E5:2 G5:4 F5:4 D5:4 | C5:4 A4:4 G4:8 | A4:2 C5:2 F5:4 E5:4 C5:4 | D5:2 F5:2 A5:4 G5:6 B5:2 | A5:4 G5:4 E5:4 C5:4 | F5:8 -:8';
const MV_HOOK = 'F5:2 G5:2 A5:4 A5:2 G5:2 F5:4 | E5:2 F5:2 G5:4 E5:6 C5:2 | D5:2 E5:2 F5:4 A5:4 G5:4 | A5:8 F5:6 A5:2 | C6:2 A5:2 G5:4 F5:4 A5:4 | Bb5:2 A5:2 G5:4 E5:6 F5:2 | G5:4 A5:4 C6:4 A5:4 | F5:8 -:8';
const MV_BRIDGE = 'D5:2 F5:2 Bb5:4 A5:4 F5:4 | C5:2 E5:2 A5:4 G5:6 E5:2 | D5:2 F5:2 G5:4 C5:4 E5:4 | F5:8 A5:8 | G5:2 Bb5:2 D6:4 C6:4 A5:4 | G5:2 Bb5:2 C6:4 A5:6 F5:2 | E5:4 G5:4 C6:8 | A5:8 -:8';

const midnightVending = {
  id: 'midnight-vending', title: 'Midnight Vending', artist: 'Tako Tako', genre: 'City Pop', genreKey: 'citypop', mood: 'glass', bpm: 110,
  // warm, mid-register arp and a lead that tops out at C6 so nothing reads as piercing
  reg: { bass: [38, 52], pad: [53, 72], arp: [53, 72], lead: [65, 84] },
  form: [
    { tag: 'INTRO', chords: ['Fmaj7', 'Am7', 'Gm7', 'C7'], layers: ['pad', 'arp'] },
    { tag: 'VERSE', chords: ['Fmaj7', 'Am7', 'Gm7', 'C7', 'Fmaj7', 'Dm7', 'Gm7', 'C7'], layers: ['bass', 'kick', 'hat', 'pad', 'lead'], lead: MV_VERSE },
    { tag: 'CHORUS', chords: ['Dm7', 'Gm7', 'C7', 'Fmaj7', 'Dm7', 'Gm7', 'C7', 'Fmaj7'], layers: ['bass', 'kick', 'snare', 'hat', 'perc', 'pad', 'arp', 'lead'], lead: MV_HOOK },
    { tag: 'VERSE', chords: ['Fmaj7', 'Am7', 'Gm7', 'C7', 'Fmaj7', 'Dm7', 'Gm7', 'C7'], layers: ['bass', 'kick', 'snare', 'hat', 'pad', 'arp', 'lead'], lead: MV_VERSE },
    { tag: 'CHORUS', chords: ['Dm7', 'Gm7', 'C7', 'Fmaj7', 'Dm7', 'Gm7', 'C7', 'Fmaj7'], layers: ['bass', 'kick', 'snare', 'hat', 'perc', 'pad', 'arp', 'lead'], lead: MV_HOOK },
    { tag: 'BRIDGE', chords: ['Bbmaj7', 'Am7', 'Gm7', 'C7', 'Bbmaj7', 'C7', 'Am7', 'Dm7'], layers: ['bass', 'kick', 'hat', 'pad', 'lead'], lead: MV_BRIDGE },
    { tag: 'CHORUS', chords: ['Dm7', 'Gm7', 'C7', 'Fmaj7', 'Dm7', 'Gm7', 'C7', 'Fmaj7'], layers: ['bass', 'kick', 'snare', 'hat', 'perc', 'pad', 'arp', 'lead'], lead: MV_HOOK },
    { tag: 'OUTRO', chords: ['Fmaj7', 'Am7', 'Gm7', 'C7'], layers: ['pad', 'arp'] }
  ]
};

/* ---- Neon Tiger: synthcore in A minor, 158 bpm, driving i-VII-VI ---- */
const NT_VERSE = 'A5:4 E5:2 F5:2 E5:4 C5:4 | D5:4 B4:2 D5:2 G5:4 B4:4 | C5:4 A4:2 C5:2 F5:4 A4:4 | B4:4 D5:4 G5:8 | A5:4 E5:2 F5:2 E5:4 C5:4 | D5:4 B4:2 D5:2 G5:4 B4:4 | C5:4 E5:2 G5:2 A5:4 B5:4 | C6:4 B5:4 A5:8';
const NT_HOOK = 'E5:2 A5:2 C6:4 B5:4 A5:4 | F5:2 A5:2 C6:4 A5:4 F5:4 | E5:2 G5:2 C6:4 B5:4 G5:4 | D5:2 G5:2 B5:4 C6:2 B5:2 A5:2 | E5:2 A5:2 C6:4 B5:4 A5:4 | F5:2 A5:2 C6:4 A5:4 F5:4 | G5:2 B5:2 C6:4 B5:4 G5:4 | G5:4 B5:4 A5:8';
const NT_BRIDGE = 'D5:4 F5:4 A5:6 G5:2 | E5:4 A5:4 C6:8 | E5:4 G#5:4 B5:6 A5:2 | E5:4 G#5:4 A5:8 | D5:4 F5:4 A5:6 G5:2 | E5:4 G#5:4 B5:6 C6:2 | B5:4 A5:4 E5:4 A5:4 | A5:8 -:8';
const neonTiger = {
  id: 'neon-tiger', title: 'Neon Tiger', artist: 'VOLTKID', genre: 'Synthcore', genreKey: 'synthcore', mood: 'circuit', bpm: 158,
  reg: { bass: [33, 47], pad: [52, 71], arp: [55, 74], lead: [64, 84] },
  form: [
    { tag: 'INTRO', chords: ['Am', 'G', 'F', 'G'], layers: ['pad', 'arp'] },
    { tag: 'VERSE', chords: ['Am', 'G', 'F', 'G', 'Am', 'G', 'F', 'G'], layers: ['bass', 'kick', 'hat', 'pad', 'lead'], lead: NT_VERSE },
    { tag: 'DROP', chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'G'], layers: ['bass', 'kick', 'snare', 'hat', 'perc', 'pad', 'arp', 'lead'], lead: NT_HOOK },
    { tag: 'VERSE', chords: ['Am', 'G', 'F', 'G', 'Am', 'G', 'F', 'G'], layers: ['bass', 'kick', 'snare', 'hat', 'pad', 'arp', 'lead'], lead: NT_VERSE },
    { tag: 'DROP', chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'G'], layers: ['bass', 'kick', 'snare', 'hat', 'perc', 'pad', 'arp', 'lead'], lead: NT_HOOK },
    { tag: 'BRIDGE', chords: ['Dm', 'Am', 'E', 'Am', 'Dm', 'E', 'Am', 'Am'], layers: ['bass', 'kick', 'hat', 'pad', 'lead'], lead: NT_BRIDGE },
    { tag: 'DROP', chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'G'], layers: ['bass', 'kick', 'snare', 'hat', 'perc', 'pad', 'arp', 'lead'], lead: NT_HOOK },
    { tag: 'OUTRO', chords: ['Am', 'G', 'F', 'G'], layers: ['pad', 'arp'] }
  ]
};

/* ---- Glow Worm Disco: disco house in A minor, 124 bpm, ii-V sevenths ---- */
const GW_VERSE = 'A4:2 C5:2 E5:4 D5:2 C5:2 A4:4 | B4:2 D5:2 G5:4 F5:2 D5:2 B4:4 | C5:2 E5:2 G5:4 E5:2 C5:2 G4:4 | A4:2 C5:2 E5:6 -:2 | A4:2 C5:2 E5:4 D5:2 C5:2 A4:4 | B4:2 D5:2 G5:4 F5:2 D5:2 B4:4 | C5:2 E5:2 A5:4 G5:2 E5:2 C5:4 | A4:4 E5:4 A5:8';
const GW_HOOK = 'E5:2 A5:2 A5:2 G5:2 E5:4 C5:2 | D5:2 G5:2 G5:2 F5:2 D5:4 B4:2 | C5:2 E5:2 G5:4 E5:2 D5:2 C5:2 | A4:2 C5:2 E5:6 A5:2 | E5:2 A5:2 A5:2 G5:2 E5:4 C5:2 | D5:2 G5:2 B5:2 A5:2 G5:4 E5:2 | F5:2 A5:2 C6:4 A5:2 G5:2 E5:2 | A5:8 -:8';
const GW_BRIDGE = 'D5:2 F5:2 A5:4 C6:2 A5:2 F5:4 | C5:2 E5:2 G5:4 B5:2 G5:2 E5:4 | B4:2 D5:2 F5:4 A5:2 F5:2 D5:4 | E5:4 G5:4 B5:4 A5:4 | A5:2 C6:2 A5:4 G5:2 E5:4 C5:2 | D5:2 F5:2 A5:6 G5:2 | E5:4 C5:4 A4:8 | -:16';
const glowWormDisco = {
  id: 'glow-worm-disco', title: 'Glow Worm Disco', artist: 'Pixel Mori', genre: 'Disco House', genreKey: 'house', mood: 'pulse', bpm: 124,
  reg: { bass: [36, 50], pad: [55, 72], arp: [60, 79], lead: [64, 84] },
  form: [
    { tag: 'INTRO', chords: ['Am7', 'Dm7', 'G7', 'Cmaj7'], layers: ['pad', 'arp'] },
    { tag: 'VERSE', chords: ['Am7', 'Dm7', 'G7', 'Cmaj7', 'Fmaj7', 'Dm7', 'E7', 'Am7'], layers: ['bass', 'kick', 'hat', 'pad', 'arp', 'lead'], lead: GW_VERSE },
    { tag: 'CHORUS', chords: ['Fmaj7', 'G7', 'Cmaj7', 'Am7', 'Fmaj7', 'G7', 'E7', 'Am7'], layers: ['bass', 'kick', 'snare', 'hat', 'perc', 'pad', 'arp', 'lead'], lead: GW_HOOK },
    { tag: 'VERSE', chords: ['Am7', 'Dm7', 'G7', 'Cmaj7', 'Fmaj7', 'Dm7', 'E7', 'Am7'], layers: ['bass', 'kick', 'snare', 'hat', 'pad', 'arp', 'lead'], lead: GW_VERSE },
    { tag: 'CHORUS', chords: ['Fmaj7', 'G7', 'Cmaj7', 'Am7', 'Fmaj7', 'G7', 'E7', 'Am7'], layers: ['bass', 'kick', 'snare', 'hat', 'perc', 'pad', 'arp', 'lead'], lead: GW_HOOK },
    { tag: 'BRIDGE', chords: ['Dm7', 'G7', 'Cmaj7', 'Fmaj7', 'Bm7b5', 'E7', 'Am7', 'Am7'], layers: ['bass', 'kick', 'hat', 'pad', 'arp', 'lead'], lead: GW_BRIDGE },
    { tag: 'CHORUS', chords: ['Fmaj7', 'G7', 'Cmaj7', 'Am7', 'Fmaj7', 'G7', 'E7', 'Am7'], layers: ['bass', 'kick', 'snare', 'hat', 'perc', 'pad', 'arp', 'lead'], lead: GW_HOOK },
    { tag: 'OUTRO', chords: ['Am7', 'Dm7', 'G7', 'Cmaj7'], layers: ['pad', 'arp'] }
  ]
};

/* ---- Bubblegum Riot: happy hardcore in C major, 160 bpm, I-V-vi-IV ---- */
const BR_VERSE = 'C5:4 E5:2 G5:2 E5:4 C5:4 | D5:4 G5:2 B5:2 G5:4 D5:4 | E5:4 A5:2 C6:2 A5:4 E5:4 | F5:4 A5:4 G5:8 | C5:4 E5:2 G5:2 E5:4 C5:4 | D5:4 G5:2 B5:2 G5:4 D5:4 | E5:4 G5:2 A5:2 C6:4 B5:4 | C6:4 G5:4 E5:8';
const BR_HOOK = 'G5:2 C6:2 C6:2 B5:2 G5:4 E5:2 | D5:2 G5:2 B5:4 G5:2 D5:2 B4:2 | C5:2 E5:2 A5:4 G5:2 E5:2 C5:2 | F5:2 A5:2 C6:6 G5:2 | G5:2 C6:2 C6:2 B5:2 G5:4 E5:2 | D5:2 G5:2 B5:4 D6:2 B5:2 G5:2 | A5:2 C6:2 B5:4 A5:2 G5:2 E5:2 | C6:8 G5:8';
const BR_BRIDGE = 'A5:4 G5:2 E5:2 D5:4 C5:4 | F5:4 E5:2 C5:2 A4:4 F5:4 | G5:4 A5:2 B5:2 C6:4 B5:4 | G5:4 E5:4 C5:8 | A5:4 G5:2 E5:2 D5:4 C5:4 | F5:4 A5:2 C6:2 B5:4 G5:4 | A5:4 B5:4 C6:8 | -:16';
const bubblegumRiot = {
  id: 'bubblegum-riot', title: 'Bubblegum Riot', artist: 'FizzPop', genre: 'Happy Hardcore', genreKey: 'eurobeat', mood: 'circuit', bpm: 160,
  reg: { bass: [36, 50], pad: [55, 74], arp: [67, 84], lead: [64, 86] },
  form: [
    { tag: 'INTRO', chords: ['C', 'G', 'Am', 'F'], layers: ['pad', 'arp'] },
    { tag: 'VERSE', chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F'], layers: ['bass', 'kick', 'hat', 'pad', 'lead'], lead: BR_VERSE },
    { tag: 'DROP', chords: ['F', 'C', 'G', 'Am', 'F', 'C', 'G', 'G'], layers: ['bass', 'kick', 'snare', 'hat', 'perc', 'pad', 'arp', 'lead'], lead: BR_HOOK },
    { tag: 'VERSE', chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F'], layers: ['bass', 'kick', 'snare', 'hat', 'pad', 'arp', 'lead'], lead: BR_VERSE },
    { tag: 'DROP', chords: ['F', 'C', 'G', 'Am', 'F', 'C', 'G', 'G'], layers: ['bass', 'kick', 'snare', 'hat', 'perc', 'pad', 'arp', 'lead'], lead: BR_HOOK },
    { tag: 'BRIDGE', chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'G'], layers: ['bass', 'kick', 'hat', 'pad', 'lead'], lead: BR_BRIDGE },
    { tag: 'DROP', chords: ['F', 'C', 'G', 'Am', 'F', 'C', 'G', 'G'], layers: ['bass', 'kick', 'snare', 'hat', 'perc', 'pad', 'arp', 'lead'], lead: BR_HOOK },
    { tag: 'OUTRO', chords: ['C', 'G', 'Am', 'F'], layers: ['pad', 'arp'] }
  ]
};

/* ---- Arcade Heart: eurobeat in D minor, 152 bpm, i-VI-III-VII ---- */
const AH_VERSE = 'D5:4 A4:2 D5:2 F5:4 E5:4 | Bb4:4 D5:2 F5:2 A5:4 G5:4 | F5:4 A5:2 C6:2 A5:4 F5:4 | E5:4 A5:4 D5:8 | D5:4 A4:2 D5:2 F5:4 E5:4 | Bb4:4 D5:2 F5:2 A5:4 G5:4 | F5:4 A5:2 C6:2 D6:4 C6:4 | A5:4 F5:4 D5:8';
const AH_HOOK = 'A5:2 D6:2 C6:2 A5:2 F5:4 A5:2 | G5:2 Bb5:2 A5:2 G5:2 F5:4 D5:2 | E5:2 G5:2 A5:4 C6:2 A5:2 G5:2 | F5:2 A5:2 D6:6 C6:2 | A5:2 D6:2 C6:2 A5:2 F5:4 A5:2 | G5:2 Bb5:2 A5:2 G5:2 F5:4 A5:2 | Bb5:2 C6:2 D6:4 C6:2 A5:2 G5:2 | A5:8 D5:8';
const AH_BRIDGE = 'D5:4 F5:4 A5:6 G5:2 | Bb5:4 A5:2 G5:2 F5:4 D5:4 | C5:4 E5:4 G5:6 F5:2 | A5:4 C6:4 A5:8 | D5:4 F5:4 A5:6 G5:2 | Bb5:4 C6:2 D6:2 C6:4 A5:4 | G5:4 A5:4 D5:8 | -:16';
const arcadeHeart = {
  id: 'arcade-heart', title: 'Arcade Heart', artist: 'DJ Spritz', genre: 'Eurobeat', genreKey: 'eurobeat', mood: 'neon', bpm: 152,
  reg: { bass: [36, 50], pad: [53, 72], arp: [60, 79], lead: [62, 86] },
  form: [
    { tag: 'INTRO', chords: ['Dm', 'Bb', 'F', 'C'], layers: ['pad', 'arp'] },
    { tag: 'VERSE', chords: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'F', 'A'], layers: ['bass', 'kick', 'hat', 'pad', 'lead'], lead: AH_VERSE },
    { tag: 'CHORUS', chords: ['Bb', 'F', 'C', 'Dm', 'Bb', 'F', 'A', 'A'], layers: ['bass', 'kick', 'snare', 'hat', 'perc', 'pad', 'arp', 'lead'], lead: AH_HOOK },
    { tag: 'VERSE', chords: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'F', 'A'], layers: ['bass', 'kick', 'snare', 'hat', 'pad', 'arp', 'lead'], lead: AH_VERSE },
    { tag: 'CHORUS', chords: ['Bb', 'F', 'C', 'Dm', 'Bb', 'F', 'A', 'A'], layers: ['bass', 'kick', 'snare', 'hat', 'perc', 'pad', 'arp', 'lead'], lead: AH_HOOK },
    { tag: 'BRIDGE', chords: ['Gm', 'Dm', 'Bb', 'F', 'Gm', 'A', 'Dm', 'Dm'], layers: ['bass', 'kick', 'hat', 'pad', 'lead'], lead: AH_BRIDGE },
    { tag: 'CHORUS', chords: ['Bb', 'F', 'C', 'Dm', 'Bb', 'F', 'A', 'A'], layers: ['bass', 'kick', 'snare', 'hat', 'perc', 'pad', 'arp', 'lead'], lead: AH_HOOK },
    { tag: 'OUTRO', chords: ['Dm', 'Bb', 'F', 'C'], layers: ['pad', 'arp'] }
  ]
};

/* ---- Sugar Static: hard dance in A minor, 150 bpm, driving minor ---- */
const SS_VERSE = 'A4:2 A4:2 E5:4 A4:2 C5:2 A4:4 | F4:2 F4:2 C5:4 F4:2 A4:2 F4:4 | D5:2 D5:2 A5:4 F5:2 D5:2 A4:4 | E5:4 G5:4 A5:8 | A4:2 A4:2 E5:4 A4:2 C5:2 A4:4 | F4:2 F4:2 C5:4 F4:2 A4:2 F4:4 | D5:2 F5:2 A5:4 C6:2 A5:2 G5:2 | E5:4 A5:4 A4:8';
const SS_HOOK = 'A5:2 A5:2 G5:2 E5:2 A5:4 C6:2 | A5:2 F5:2 E5:2 C5:2 F5:4 A5:2 | G5:2 E5:2 D5:2 E5:2 G5:4 B5:2 | A5:2 E5:2 A5:6 C6:2 | A5:2 A5:2 G5:2 E5:2 A5:4 C6:2 | A5:2 F5:2 E5:2 C5:2 F5:4 A5:2 | B5:2 A5:2 G5:2 E5:2 A5:4 B5:2 | C6:4 B5:4 A5:8';
const SS_BRIDGE = 'A4:4 C5:4 E5:6 D5:2 | F4:4 A4:4 C5:8 | D5:4 F5:4 A5:6 G5:2 | E5:4 G#5:4 A5:8 | A4:4 C5:4 E5:6 D5:2 | F5:4 E5:2 D5:2 C5:4 A4:4 | E5:4 G#5:4 A5:8 | -:16';
const sugarStatic = {
  id: 'sugar-static', title: 'Sugar Static', artist: 'Maho', genre: 'Breakcore', genreKey: 'breakcore', mood: 'circuit', bpm: 150,
  reg: { bass: [33, 47], pad: [52, 71], arp: [55, 74], lead: [64, 84] },
  form: [
    { tag: 'INTRO', chords: ['Am', 'F', 'Dm', 'E'], layers: ['pad', 'arp'] },
    { tag: 'VERSE', chords: ['Am', 'F', 'Dm', 'E', 'Am', 'F', 'Dm', 'E'], layers: ['bass', 'kick', 'hat', 'pad', 'lead'], lead: SS_VERSE },
    { tag: 'DROP', chords: ['Am', 'F', 'C', 'E', 'Am', 'F', 'Dm', 'E'], layers: ['bass', 'kick', 'snare', 'hat', 'perc', 'pad', 'arp', 'lead'], lead: SS_HOOK },
    { tag: 'VERSE', chords: ['Am', 'F', 'Dm', 'E', 'Am', 'F', 'Dm', 'E'], layers: ['bass', 'kick', 'snare', 'hat', 'pad', 'arp', 'lead'], lead: SS_VERSE },
    { tag: 'DROP', chords: ['Am', 'F', 'C', 'E', 'Am', 'F', 'Dm', 'E'], layers: ['bass', 'kick', 'snare', 'hat', 'perc', 'pad', 'arp', 'lead'], lead: SS_HOOK },
    { tag: 'BRIDGE', chords: ['Am', 'F', 'Dm', 'E', 'Am', 'E', 'Am', 'Am'], layers: ['bass', 'kick', 'hat', 'pad', 'lead'], lead: SS_BRIDGE },
    { tag: 'DROP', chords: ['Am', 'F', 'C', 'E', 'Am', 'F', 'Dm', 'E'], layers: ['bass', 'kick', 'snare', 'hat', 'perc', 'pad', 'arp', 'lead'], lead: SS_HOOK },
    { tag: 'OUTRO', chords: ['Am', 'F', 'Dm', 'E'], layers: ['pad', 'arp'] }
  ]
};

/* ---- Metronomicon: chiptune in C major, 140 bpm, I-vi-IV-V ---- */
const MT_VERSE = 'C5:4 E5:4 G5:4 E5:4 | A4:4 C5:4 E5:4 C5:4 | F4:4 A4:4 C5:4 A4:4 | G4:4 B4:4 D5:8 | C5:4 E5:4 G5:4 E5:4 | A4:4 C5:4 E5:4 G5:4 | F5:4 E5:4 D5:4 C5:4 | G4:4 B4:4 C5:8';
const MT_HOOK = 'G5:2 E5:2 C5:2 E5:2 G5:4 A5:2 | E5:2 C5:2 A4:2 C5:2 E5:4 G5:2 | F5:2 A5:2 C6:2 A5:2 F5:4 A5:2 | G5:2 B5:2 D6:2 B5:2 G5:4 D5:2 | G5:2 E5:2 C5:2 E5:2 G5:4 A5:2 | E5:2 C5:2 A4:2 C5:2 E5:4 G5:2 | F5:2 E5:2 D5:2 C5:2 D5:4 B4:2 | C5:8 G5:8';
const MT_BRIDGE = 'A4:4 B4:4 C5:4 D5:4 | E5:4 D5:4 C5:4 B4:4 | A4:4 G4:4 F4:6 E4:2 | D4:4 G4:4 C5:8 | A4:4 B4:4 C5:4 D5:4 | E5:4 F5:4 G5:6 A5:2 | G5:4 F5:4 E5:4 D5:4 | C5:8 -:8';
const metronomicon = {
  id: 'metronomicon', title: 'Metronomicon', artist: 'DDR Engine', genre: 'Test Pattern', genreKey: 'chiptune', mood: 'neon', bpm: 140,
  reg: { bass: [36, 50], pad: [55, 74], arp: [60, 79], lead: [60, 86] },
  form: [
    { tag: 'INTRO', chords: ['C', 'Am', 'F', 'G'], layers: ['pad', 'arp'] },
    { tag: 'VERSE', chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G'], layers: ['bass', 'kick', 'hat', 'lead'], lead: MT_VERSE },
    { tag: 'CHORUS', chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G'], layers: ['bass', 'kick', 'snare', 'hat', 'perc', 'pad', 'arp', 'lead'], lead: MT_HOOK },
    { tag: 'VERSE', chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G'], layers: ['bass', 'kick', 'snare', 'hat', 'arp', 'lead'], lead: MT_VERSE },
    { tag: 'CHORUS', chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G'], layers: ['bass', 'kick', 'snare', 'hat', 'perc', 'pad', 'arp', 'lead'], lead: MT_HOOK },
    { tag: 'BRIDGE', chords: ['Am', 'Em', 'F', 'C', 'Dm', 'G', 'C', 'C'], layers: ['bass', 'kick', 'hat', 'pad', 'lead'], lead: MT_BRIDGE },
    { tag: 'CHORUS', chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G'], layers: ['bass', 'kick', 'snare', 'hat', 'perc', 'pad', 'arp', 'lead'], lead: MT_HOOK },
    { tag: 'OUTRO', chords: ['C', 'Am', 'F', 'G'], layers: ['pad', 'arp'] }
  ]
};

/* ---- Aurora Drift: melodic trance in E minor, 136 bpm, i-VI-III-VII ---- */
const AD_VERSE = 'B4:4 E5:2 G5:2 B5:4 A5:4 | C5:4 E5:2 G5:2 E5:4 C5:4 | B4:4 D5:2 G5:2 B5:4 D6:4 | A5:4 F#5:4 D5:8 | B4:4 E5:2 G5:2 B5:4 A5:4 | C5:4 E5:2 G5:2 E5:4 C5:4 | D5:4 F#5:2 A5:2 B5:4 C6:4 | B5:4 G5:4 E5:8';
const AD_HOOK = 'E5:2 G5:2 B5:4 A5:2 G5:2 E5:4 | D5:2 G5:2 B5:4 A5:2 G5:2 D5:4 | E5:2 A5:2 C6:4 B5:2 A5:2 F#5:2 | G5:4 B5:4 D6:8 | E5:2 G5:2 B5:4 A5:2 G5:2 E5:4 | D5:2 G5:2 B5:4 D6:2 B5:2 G5:2 | A5:2 B5:2 C6:4 B5:2 A5:2 G5:2 | B5:8 E5:8';
const AD_BRIDGE = 'A4:4 C5:4 E5:6 D5:2 | B4:4 D5:4 G5:8 | C5:4 E5:4 G5:6 F#5:2 | B4:4 D#5:4 F#5:8 | A4:4 C5:4 E5:6 D5:2 | B4:4 D5:2 F#5:2 A5:4 G5:4 | E5:4 B4:4 E5:8 | -:16';
const auroraDrift = {
  id: 'aurora-drift', title: 'Aurora Drift', artist: 'Lumen', genre: 'Melodic Trance', genreKey: 'synthwave', mood: 'neon', bpm: 136,
  reg: { bass: [35, 49], pad: [54, 73], arp: [59, 78], lead: [64, 84] },
  form: [
    { tag: 'INTRO', chords: ['Em', 'C', 'G', 'D'], layers: ['pad', 'arp'] },
    { tag: 'VERSE', chords: ['Em', 'C', 'G', 'D', 'Em', 'C', 'G', 'D'], layers: ['bass', 'kick', 'hat', 'pad', 'lead'], lead: AD_VERSE },
    { tag: 'CHORUS', chords: ['C', 'G', 'D', 'Em', 'C', 'G', 'D', 'D'], layers: ['bass', 'kick', 'snare', 'hat', 'perc', 'pad', 'arp', 'lead'], lead: AD_HOOK },
    { tag: 'VERSE', chords: ['Em', 'C', 'G', 'D', 'Em', 'C', 'G', 'D'], layers: ['bass', 'kick', 'snare', 'hat', 'pad', 'arp', 'lead'], lead: AD_VERSE },
    { tag: 'CHORUS', chords: ['C', 'G', 'D', 'Em', 'C', 'G', 'D', 'D'], layers: ['bass', 'kick', 'snare', 'hat', 'perc', 'pad', 'arp', 'lead'], lead: AD_HOOK },
    { tag: 'BRIDGE', chords: ['Am', 'C', 'G', 'B', 'Am', 'C', 'B', 'B'], layers: ['bass', 'kick', 'hat', 'pad', 'lead'], lead: AD_BRIDGE },
    { tag: 'CHORUS', chords: ['C', 'G', 'D', 'Em', 'C', 'G', 'D', 'D'], layers: ['bass', 'kick', 'snare', 'hat', 'perc', 'pad', 'arp', 'lead'], lead: AD_HOOK },
    { tag: 'OUTRO', chords: ['Em', 'C', 'G', 'D'], layers: ['pad', 'arp'] }
  ]
};

/* ---- Candy Circuit: future bass in C major, 148 bpm, I-V-vi-IV ---- */
const CC_VERSE = 'C5:4 E5:2 G5:2 C6:4 B5:4 | B4:4 D5:2 G5:2 B5:4 D5:4 | A4:4 C5:2 E5:2 A5:4 G5:4 | F5:4 A5:4 C6:8 | C5:4 E5:2 G5:2 C6:4 B5:4 | B4:4 D5:2 G5:2 B5:4 D5:4 | A4:4 C5:2 E5:2 A5:4 C6:4 | G5:4 E5:4 C5:8';
const CC_HOOK = 'A5:2 C6:2 C6:2 B5:2 A5:4 G5:2 | G5:2 E5:2 G5:4 C6:2 G5:2 E5:2 | D5:2 G5:2 B5:4 D6:2 B5:2 G5:2 | A5:2 C6:2 D6:4 C6:2 A5:2 F5:2 | A5:2 C6:2 C6:2 B5:2 A5:4 G5:2 | G5:2 E5:2 G5:4 C6:2 G5:2 E5:2 | D5:2 G5:2 B5:4 A5:2 G5:2 E5:2 | C6:8 G5:8';
const CC_BRIDGE = 'A5:4 G5:2 E5:2 C5:4 E5:4 | F5:4 A5:2 C6:2 A5:4 F5:4 | G5:4 E5:2 C5:2 E5:4 G5:4 | D5:4 G5:4 B5:8 | A5:4 G5:2 E5:2 C5:4 E5:4 | F5:4 A5:2 C6:2 D6:4 C6:4 | B5:4 A5:4 G5:4 E5:4 | C6:8 -:8';
const candyCircuit = {
  id: 'candy-circuit', title: 'Candy Circuit', artist: 'Miku Modem', genre: 'Future Bass', genreKey: 'eurobeat', mood: 'circuit', bpm: 148,
  reg: { bass: [36, 50], pad: [55, 74], arp: [60, 79], lead: [62, 86] },
  form: [
    { tag: 'INTRO', chords: ['C', 'G', 'Am', 'F'], layers: ['pad', 'arp'] },
    { tag: 'VERSE', chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F'], layers: ['bass', 'kick', 'hat', 'pad', 'lead'], lead: CC_VERSE },
    { tag: 'DROP', chords: ['F', 'C', 'G', 'Am', 'F', 'C', 'G', 'G'], layers: ['bass', 'kick', 'snare', 'hat', 'perc', 'pad', 'arp', 'lead'], lead: CC_HOOK },
    { tag: 'VERSE', chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F'], layers: ['bass', 'kick', 'snare', 'hat', 'pad', 'arp', 'lead'], lead: CC_VERSE },
    { tag: 'DROP', chords: ['F', 'C', 'G', 'Am', 'F', 'C', 'G', 'G'], layers: ['bass', 'kick', 'snare', 'hat', 'perc', 'pad', 'arp', 'lead'], lead: CC_HOOK },
    { tag: 'BRIDGE', chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'G'], layers: ['bass', 'kick', 'hat', 'pad', 'lead'], lead: CC_BRIDGE },
    { tag: 'DROP', chords: ['F', 'C', 'G', 'Am', 'F', 'C', 'G', 'G'], layers: ['bass', 'kick', 'snare', 'hat', 'perc', 'pad', 'arp', 'lead'], lead: CC_HOOK },
    { tag: 'OUTRO', chords: ['C', 'G', 'Am', 'F'], layers: ['pad', 'arp'] }
  ]
};

export const SONGBOOK = [plasticSunrise, midnightVending, neonTiger, glowWormDisco, bubblegumRiot, arcadeHeart, sugarStatic, metronomicon, auroraDrift, candyCircuit];
