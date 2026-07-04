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
  reg: { bass: [38, 52], pad: [55, 74], arp: [67, 84], lead: [67, 88] },
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

export const SONGBOOK = [plasticSunrise, midnightVending];
