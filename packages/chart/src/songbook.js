// songbook: hand-composed built-in songs. Unlike the generative composer (compose.js,
// which is right for the endless stream), each track here is authored music: a real key
// and tempo, an ordered form of sections with intentional chord progressions, an arranged
// set of layers per section, and written melodies and basslines with actual hooks.
//
// compileSong turns that authored data into the same PIECE shape the charter (chartFromPiece)
// and the bellows player consume, so the prebuilt songs are compositions, not walks. The
// accompaniment the author does not spell out (pad voicings, a bass groove, a chord-tone
// arp, the dance kit) is filled in on the grid, on the beat, to serve the written parts.

/* ---------------- note + chord notation ---------------- */

const NOTE_PC = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
// note name + octave to midi, C4 = 60
function noteToMidi(tok) { const m = tok.match(/^([A-G][#b]?)(-?\d)$/); return m ? 12 * (parseInt(m[2], 10) + 1) + NOTE_PC[m[1]] : null; }

const QUAL = {
  '': [0, 4, 7], maj: [0, 4, 7], m: [0, 3, 7], min: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8],
  '5': [0, 7], sus2: [0, 2, 7], sus4: [0, 5, 7], '6': [0, 4, 7, 9], m6: [0, 3, 7, 9],
  '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], m7b5: [0, 3, 6, 10], dim7: [0, 3, 6, 9],
  add9: [0, 4, 7, 14], '9': [0, 4, 7, 10, 14], m9: [0, 3, 7, 10, 14], maj9: [0, 4, 7, 11, 14]
};
// 'Am7' -> { rootPc, ivs }
function parseChord(sym) { const m = sym.match(/^([A-G][#b]?)(.*)$/); const rootPc = NOTE_PC[m[1]]; return { rootPc, ivs: QUAL[m[2]] ?? QUAL[''] }; }

// expand a chord list where 'Am*2' means hold for 2 bars -> one symbol per bar
function expandChords(list) { const out = []; for (const c of list) { const m = c.match(/^(.*)\*(\d+)$/); if (m) { for (let i = 0; i < +m[2]; i++) out.push(m[1]); } else out.push(c); } return out; }

// parse a line: space-separated tokens, '|' = bar boundary (snaps position to the bar).
// token '<note><oct>:<steps>' plays a note; '-:<steps>' rests; steps are 16ths.
function parseLine(str, startStep, vel) {
  const out = []; let step = 0;
  for (const tok of str.trim().split(/\s+/)) {
    if (tok === '|') { step = Math.round(step / 16) * 16; continue; }
    const m = tok.match(/^(-|[A-G][#b]?-?\d):(\d+)$/); if (!m) continue;
    const dur = parseInt(m[2], 10);
    if (m[1] !== '-') { const midi = noteToMidi(m[1]); if (midi != null) out.push({ step: startStep + step, midi, dur, vel }); }
    step += dur;
  }
  return out;
}

/* ---------------- accompaniment fills (on-grid, composed) ---------------- */

const SPB = 16;
function addEv(map, step, ev) { (map[step] || (map[step] = [])).push(ev); }
function pcToMidiNear(pc, ref) { return pc + 12 * Math.round((ref - pc) / 12); }

// nearest-motion pad voicing across a chord change, in a register window
function voiceChord(rootPc, ivs, prev, lo, hi) {
  const out = [];
  ivs.slice(0, 4).forEach((iv, i) => {
    const pc = (rootPc + iv) % 12;
    let ref = prev && prev[i] != null ? prev[i] : lo + ((i + 0.5) * (hi - lo)) / 4;
    let mdi = pcToMidiNear(pc, ref); while (mdi < lo) mdi += 12; while (mdi > hi) mdi -= 12; out.push(mdi);
  });
  return out;
}

// sustained pad chord held until the next chord change
function fillPad(events, chords, barBase, reg) {
  let prev = null, b = 0;
  while (b < chords.length) {
    let span = 1; while (b + span < chords.length && chords[b + span] === chords[b]) span++;
    const c = parseChord(chords[b]); const v = voiceChord(c.rootPc, c.ivs, prev, reg[0], reg[1]); prev = v;
    addEv(events.pad, (barBase + b) * SPB, { midis: v, dur: span * SPB - 1, vel: 0.62 });
    b += span;
  }
}

// bass grooves per genre: which 16th steps fire and which chord tone (0 root, 7 fifth,
// 12 octave). Composed rhythms, not euclidean. The bass follows the chord root register.
const BASS_GROOVE = {
  synthwave: [[0, 0], [4, 0], [7, 12], [8, 0], [12, 0], [14, 7]],
  synthcore: [[0, 0], [2, 0], [4, 0], [6, 0], [8, 0], [10, 12], [12, 0], [14, 0]],
  house: [[2, 0], [6, 0], [10, 0], [14, 0], [0, 0], [8, 0]],
  citypop: [[0, 0], [3, 7], [6, 0], [8, 12], [11, 7], [14, 0]],
  eurobeat: [[0, 0], [2, 0], [4, 0], [6, 0], [8, 0], [10, 0], [12, 0], [14, 0]],
  breakcore: [[0, 0], [3, 0], [6, 12], [8, 0], [11, 0], [14, 7]]
};
function fillBass(events, chords, barBase, reg, genre, its) {
  const groove = BASS_GROOVE[genre] || BASS_GROOVE.synthwave;
  for (let b = 0; b < chords.length; b++) {
    const c = parseChord(chords[b]); const root = pcToMidiNear(c.rootPc, (reg[0] + reg[1]) / 2);
    for (const [s, tone] of groove) {
      let mdi = root + tone; while (mdi > reg[1] + 12) mdi -= 12; while (mdi < reg[0]) mdi += 12;
      addEv(events.bass, (barBase + b) * SPB + s, { midi: mdi, dur: 2, vel: 0.72 + 0.18 * its });
    }
  }
}

// chord-tone arpeggio: an up (or up-down at peak) figure in 16ths over the chord tones
function fillArp(events, chords, barBase, reg, its) {
  const stepEvery = its > 0.7 ? 1 : 2;
  for (let b = 0; b < chords.length; b++) {
    const c = parseChord(chords[b]); const tones = c.ivs.map((iv) => pcToMidiNear((c.rootPc + iv) % 12, reg[0]));
    const pool = []; for (const t of tones) { let m = t; while (m < reg[0]) m += 12; while (m > reg[1]) m -= 12; pool.push(m); } pool.sort((a, z) => a - z);
    let idx = 0, dir = 1;
    for (let s = 0; s < SPB; s += stepEvery) {
      addEv(events.arp, (barBase + b) * SPB + s, { midi: pool[idx % pool.length], dur: stepEvery, vel: 0.5 + 0.35 * its });
      idx += dir; if (idx >= pool.length - 1 || idx <= 0) { if (its > 0.7) dir *= -1; else idx = 0; }
    }
  }
}

// the danceable dance kit: four-on-the-floor kick, backbeat snare, steady hats, offbeat
// perc, on-grid fills. Same shape as compose.js genDrums so both feels are identical.
function fillDrums(events, active, barBase, nBars, its) {
  const fourOnFloor = its > 0.4, hatStep = its > 0.7 ? 1 : 2, perc = its > 0.55;
  for (let bb = 0; bb < nBars; bb++) {
    const bar = barBase + bb, lastBar = bb === nBars - 1;
    for (let s = 0; s < SPB; s++) {
      const step = bar * SPB + s;
      let kick = fourOnFloor ? s % 4 === 0 : s === 0 || s === 8;
      if (its > 0.7 && lastBar && s === 14) kick = true;
      if (active.has('kick') && kick) addEv(events.kick, step, { vel: 0.86 + 0.14 * its });
      if (active.has('snare') && (s === 4 || s === 12)) addEv(events.snare, step, { vel: 0.8 });
      if (active.has('snare') && lastBar && its > 0.6 && (s === 14 || s === 15)) addEv(events.snare, step, { vel: 0.45 });
      if (active.has('hat') && s % hatStep === 0) addEv(events.hat, step, { vel: 0.3 + 0.22 * its, open: s % 4 === 2 && s % 8 === 6 });
      if (active.has('perc') && perc && s % 4 === 2) addEv(events.perc, step, { vel: 0.34 + 0.24 * its });
    }
  }
}

/* ---------------- the compiler ---------------- */

// layers a section names control what plays; intensity (for kit density + hats) is derived
// from how full the arrangement is unless the section sets it explicitly.
function intensityFromLayers(active) {
  let n = 0; for (const v of ['kick', 'snare', 'hat', 'bass', 'arp', 'lead', 'pad']) if (active.has(v)) n++;
  return Math.max(0.28, Math.min(1, 0.18 + n * 0.12));
}

export function compileSong(song) {
  const bpm = song.bpm, secPerBar = (4 * 60) / bpm;
  const reg = song.reg || { bass: [36, 50], pad: [55, 74], arp: [67, 86], lead: [67, 88] };
  const events = { bass: {}, pad: {}, arp: {}, lead: {}, counter: {}, kick: {}, snare: {}, hat: {}, perc: {} };
  const bars = [], sections = [];
  let barBase = 0;
  song.form.forEach((sec, si) => {
    const active = new Set(sec.layers);
    const its = sec.intensity != null ? sec.intensity : intensityFromLayers(active);
    const chords = expandChords(sec.chords);
    const n = chords.length;
    sections.push({ index: si, bars: n, intensity: its, active, name: sec.tag || 'SECTION' });
    for (let b = 0; b < n; b++) { const c = parseChord(chords[b]); bars.push({ degree: 0, pcs: c.ivs.map((iv) => (c.rootPc + iv) % 12), rootPc: c.rootPc, label: chords[b], sectionIndex: si, intensity: its }); }
    if (active.has('pad')) fillPad(events, chords, barBase, reg.pad);
    if (active.has('bass') && !sec.bassLine) fillBass(events, chords, barBase, reg.bass, song.genreKey || song.genre, its);
    if (active.has('arp')) fillArp(events, chords, barBase, reg.arp, its);
    if (active.has('kick') || active.has('snare') || active.has('hat')) fillDrums(events, active, barBase, n, its);
    const start = barBase * SPB;
    if (sec.bassLine && active.has('bass')) for (const nt of parseLine(sec.bassLine, start, 0.82)) addEv(events.bass, nt.step, { midi: nt.midi, dur: nt.dur, vel: nt.vel });
    if (sec.lead && active.has('lead')) for (const nt of parseLine(sec.lead, start, 0.85)) addEv(events.lead, nt.step, { midi: nt.midi, dur: nt.dur, vel: nt.vel });
    if (sec.harmony && active.has('lead')) for (const nt of parseLine(sec.harmony, start, 0.6)) addEv(events.counter, nt.step, { midi: nt.midi, dur: nt.dur, vel: nt.vel });
    barBase += n;
  });
  const totalBars = barBase, totalSteps = totalBars * SPB;
  return {
    seed: song.id, tempo: bpm, secPerBar, rootPc: bars[0] ? bars[0].rootPc : 0, STEPS_PER_BAR: SPB,
    totalBars, totalSteps, sections, bars, events, genre: song.genre, composed: true,
    summary: { degree: 0, rootPc: bars[0] ? bars[0].rootPc : 0 }
  };
}
