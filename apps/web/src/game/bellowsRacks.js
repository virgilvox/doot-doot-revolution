// Genre voice racks for the bellows audio engine. Each rack maps the composer's nine
// abstract voices (bass, pad, arp, lead, counter, kick, snare, hat, perc) to real
// bellowsjs synth engines + effect chains tuned for a specific dance sub-genre, so the
// built-in songs sound distinct from one another rather than one synth in different keys.
//
// A preset is data: per-voice { engine, params, gain, pan, poly, fx, send }, plus send
// buses (reverb/delay) and a master chain. buildRack instantiates it against a booted
// Bellows and returns the live Instrument handles the conductor schedules notes on.

// note: drum "pitch" is a nominal MIDI for the drum engines (they are pitched but we key
// them low); perc maps to clap or tom depending on the preset.
const PRESETS = {
  // hard, bright, aggressive: driving FM lead over a snarling saw bass (Neon Tiger)
  synthcore: {
    buses: { verb: ['fdn', { size: 1.1, decay: 1.6, damp: 4600, mix: 1 }], delay: ['tapeDelay', { time: 0.19, feedback: 0.3, mix: 1 }] },
    master: [['compressor', { threshold: -15, ratio: 3.5, attack: 0.005, release: 0.15, knee: 8 }], ['limiter', { threshold: -0.7 }]],
    voices: {
      bass: { engine: 'va', params: { shape: 0, cutoff: 720, resonance: 0.38, envAmount: 1.5, decay: 0.18, sustain: 0.4, sub: 0.6, detune: 8 }, gain: 0.5, fx: [['saturator', { drive: 1.7, tone: -0.25 }]] },
      pad: { engine: 'wavetable', params: { position: 0.35, scanRate: 0.3, scanDepth: 0.25, attack: 0.4, sustain: 0.85, release: 1, cutoff: 1900, resonance: 0.2 }, gain: 0.12, poly: 6, send: { verb: 0.55 } },
      arp: { engine: 'pluck', params: { damp: 0.35, pickPos: 0.2, decay: 0.5 }, gain: 0.19, send: { verb: 0.3, delay: 0.45 } },
      lead: { engine: 'fm', params: { ops: 4, algorithm: 4, ratio2: 2, ratio3: 3.5, ratio4: 7, feedback: 0.32, brightness: 0.6, decay: 0.3, sustain: 0.5 }, gain: 0.2, fx: [['chorus', { rate: 2.2, depth: 0.4, mix: 0.3 }]], send: { verb: 0.35, delay: 0.32 } },
      counter: { engine: 'va', params: { shape: 2, cutoff: 1600, detune: 6, decay: 0.3, sustain: 0.45 }, gain: 0.1, poly: 3, send: { verb: 0.4 } },
      kick: { engine: 'kick', params: { decay: 0.3, pitchDecay: 0.05, drive: 2, clickTune: 8 }, gain: 0.92 },
      snare: { engine: 'snare', params: { decay: 0.17, tone: 0.55, snap: 0.06 }, gain: 0.5, send: { verb: 0.16 } },
      hat: { engine: 'hat', params: { decay: 0.05, tone: 1.2 }, gain: 0.24 },
      perc: { engine: 'clap', params: { decay: 0.13, tone: 1600 }, gain: 0.3, send: { verb: 0.2 } }
    }
  },
  // retro 80s: warm saw bass, glassy wavetable pad, singing FM lead, plate space (Plastic Sunrise)
  synthwave: {
    buses: { verb: ['plate', { decay: 0.66, damping: 0.5, mix: 1 }], delay: ['tapeDelay', { time: 0.36, feedback: 0.32, wow: 0.25, saturation: 0.3, mix: 1 }] },
    master: [['compressor', { threshold: -18, ratio: 3.5, knee: 6, attack: 0.006, release: 0.16 }], ['limiter', { threshold: -0.8 }]],
    voices: {
      bass: { engine: 'va', params: { shape: 0, cutoff: 520, resonance: 0.5, envAmount: 1.6, decay: 0.24, sustain: 0.45, sub: 0.5, drift: 0.2 }, gain: 0.46, fx: [['saturator', { drive: 1.5, tone: -0.3 }]] },
      pad: { engine: 'wavetable', params: { position: 0.5, scanRate: 0.25, scanDepth: 0.3, attack: 0.5, sustain: 0.9, release: 1.4, cutoff: 2100 }, gain: 0.15, poly: 6, send: { verb: 0.65 } },
      arp: { engine: 'pluck', params: { damp: 0.45, pickPos: 0.25, decay: 0.6 }, gain: 0.18, send: { verb: 0.35, delay: 0.45 } },
      lead: { engine: 'fm', params: { ops: 4, algorithm: 4, ratio2: 2.5, ratio3: 5, ratio4: 7, feedback: 0.28, brightness: 0.5, decay: 0.35, sustain: 0.55 }, gain: 0.21, fx: [['chorus', { rate: 2.5, depth: 0.5, mix: 0.4 }]], send: { verb: 0.4, delay: 0.34 } },
      counter: { engine: 'va', params: { shape: 3, cutoff: 1400, detune: 4, decay: 0.4, sustain: 0.5 }, gain: 0.1, poly: 3, send: { verb: 0.45 } },
      kick: { engine: 'kick', params: { decay: 0.35, pitchDecay: 0.08, drive: 2, clickTune: 6 }, gain: 0.88 },
      snare: { engine: 'snare', params: { decay: 0.19, tone: 0.6, snap: 0.08 }, gain: 0.5, send: { verb: 0.22 } },
      hat: { engine: 'hat', params: { decay: 0.06, tone: 1.1 }, gain: 0.25 },
      perc: { engine: 'clap', params: { decay: 0.16, tone: 1400 }, gain: 0.3, send: { verb: 0.28 } }
    }
  },
  // four-on-the-floor groove: square sub bass with sidechain-feel comp, plucky stabs (Glow Worm Disco)
  house: {
    buses: { verb: ['plate', { decay: 0.42, damping: 0.55, mix: 1 }], delay: ['delay', { timeL: 0.25, timeR: 0.33, feedback: 0.36, crossFeedback: 0.2, mix: 1 }] },
    master: [['compressor', { threshold: -18, ratio: 3, attack: 0.008, release: 0.28 }], ['limiter', { threshold: -0.8 }]],
    voices: {
      bass: { engine: 'va', params: { shape: 1, cutoff: 440, resonance: 0.42, envAmount: 0.8, decay: 0.28, sustain: 0.2, detune: 3 }, gain: 0.46, fx: [['compressor', { threshold: -12, ratio: 6, attack: 0.003, release: 0.11, makeup: 3 }]] },
      pad: { engine: 'additive', params: { decay: 6, rolloff: 0.6, attack: 0.1, release: 1 }, gain: 0.12, poly: 6, send: { verb: 0.5 } },
      arp: { engine: 'wavetable', params: { position: 0.25, attack: 0.005, decay: 0.16, sustain: 0.1, release: 0.18, cutoff: 3600, resonance: 0.3 }, gain: 0.17, fx: [['flanger', { rate: 1.4, depth: 0.5, feedback: 0.25, mix: 0.28 }]], send: { verb: 0.28, delay: 0.35 } },
      lead: { engine: 'wavetable', params: { position: 0.4, scanRate: 0.15, scanDepth: 0.2, attack: 0.01, sustain: 0.7, release: 0.24, cutoff: 4200 }, gain: 0.19, send: { verb: 0.32, delay: 0.3 } },
      counter: { engine: 'va', params: { shape: 2, cutoff: 1500, detune: 5, decay: 0.3 }, gain: 0.09, poly: 3, send: { verb: 0.4 } },
      kick: { engine: 'kick', params: { decay: 0.4, pitchDecay: 0.08, drive: 2.1, clickTune: 8 }, gain: 0.92 },
      snare: { engine: 'clap', params: { decay: 0.18, spread: 0.02, tone: 1800 }, gain: 0.42, send: { verb: 0.24 } },
      hat: { engine: 'hat', params: { decay: 0.045, tone: 1.4 }, gain: 0.3 },
      perc: { engine: 'tom', params: { decay: 0.2, sweep: 0.06, noise: 0.3 }, gain: 0.26, send: { verb: 0.3 } }
    }
  },
  // euphoric, high-energy: punchy FM bass, chorused wavetable lead, stabby strings (Arcade Heart)
  eurobeat: {
    buses: { verb: ['plate', { decay: 0.6, damping: 0.45, mix: 1 }], delay: ['delay', { timeL: 0.25, timeR: 0.333, feedback: 0.3, mix: 1 }] },
    master: [['compressor', { threshold: -16, ratio: 5, knee: 8, attack: 0.005, release: 0.15, makeup: 4 }], ['limiter', { threshold: -0.6 }]],
    voices: {
      bass: { engine: 'fm', params: { ops: 4, algorithm: 5, ratio2: 2, ratio3: 3, ratio4: 4.5, feedback: 0.15, decay: 0.22, sustain: 0.3 }, gain: 0.44, fx: [['saturator', { drive: 2, tone: 0.1, output: -2 }]] },
      pad: { engine: 'additive', params: { decay: 1.4, rolloff: 0.7, attack: 0.03, release: 0.5 }, gain: 0.12, poly: 6, send: { verb: 0.5 } },
      arp: { engine: 'pluck', params: { damp: 0.3, decay: 0.45 }, gain: 0.18, send: { verb: 0.28, delay: 0.4 } },
      lead: { engine: 'wavetable', params: { position: 0.7, scanRate: 0.2, scanDepth: 0.15, attack: 0.01, sustain: 0.8, release: 0.3, cutoff: 4600 }, gain: 0.2, fx: [['chorus', { rate: 4, depth: 0.5, mix: 0.5 }]], send: { verb: 0.35, delay: 0.32 } },
      counter: { engine: 'westcoast', params: { foldAmount: 0.25, foldStages: 2, foldEnv: 0.4, lpgColor: 0.5, attack: 0.05, sustain: 0.7, release: 0.4 }, gain: 0.1, poly: 3, send: { verb: 0.4 } },
      kick: { engine: 'kick', params: { decay: 0.45, pitchDecay: 0.12, drive: 3, clickTune: 12 }, gain: 0.95 },
      snare: { engine: 'snare', params: { decay: 0.16, tone: 0.6, snap: 0.05 }, gain: 0.5, send: { verb: 0.2 } },
      hat: { engine: 'hat', params: { decay: 0.05, tone: 1.3 }, gain: 0.28 },
      perc: { engine: 'clap', params: { decay: 0.14, tone: 2000 }, gain: 0.34, send: { verb: 0.22 } }
    }
  },
  // fast and hard: distorted pluck bass, dense FM stabs, breakbeat kit (Bubblegum Riot / Sugar Static)
  breakcore: {
    buses: { verb: ['fdn', { size: 1.4, decay: 2, damp: 3800, chorus: 0.3, mix: 1 }], delay: ['multitap', { time: 0.14, feedback: 0.28, spread: 0.4, diffusion: 0.4, mix: 1 }] },
    master: [['compressor', { threshold: -14, ratio: 3.5, attack: 0.004, release: 0.12, knee: 6 }], ['limiter', { threshold: -0.6 }]],
    voices: {
      bass: { engine: 'pluck', params: { damp: 0.28, pickPos: 0.12, decay: 1.1 }, gain: 0.48, fx: [['saturator', { drive: 2.2, tone: -0.4, output: -3 }], ['eq', { b0freq: 60, b0gain: 4, b5freq: 8500, b5gain: -8 }]] },
      pad: { engine: 'harmonic', params: { brightness: 0.7, evenOdd: 0.3, attack: 0.05, release: 0.4 }, gain: 0.1, poly: 5, send: { verb: 0.6 } },
      arp: { engine: 'fm', params: { ops: 2, algorithm: 2, ratio2: 3.5, feedback: 0.2, decay: 0.12, sustain: 0.1 }, gain: 0.17, send: { verb: 0.3, delay: 0.4 } },
      lead: { engine: 'fm', params: { ops: 4, algorithm: 3, ratio2: 2, ratio3: 4, feedback: 0.35, brightness: 0.7, decay: 0.2, sustain: 0.4 }, gain: 0.19, fx: [['saturator', { drive: 1.6, tone: 0.1 }]], send: { verb: 0.34, delay: 0.36 } },
      counter: { engine: 'va', params: { shape: 0, cutoff: 1800, detune: 8, decay: 0.25 }, gain: 0.09, poly: 3, send: { verb: 0.4 } },
      kick: { engine: 'kick', params: { decay: 0.24, pitchDecay: 0.04, drive: 2.7, clickTune: 6 }, gain: 0.92 },
      snare: { engine: 'snare', params: { decay: 0.13, tone: 0.5, snap: 0.04 }, gain: 0.52, send: { verb: 0.18 } },
      hat: { engine: 'hat', params: { decay: 0.04, tone: 1.5 }, gain: 0.28 },
      perc: { engine: 'tom', params: { decay: 0.14, sweep: 0.05, noise: 0.4 }, gain: 0.3, send: { verb: 0.24 } }
    }
  },
  // warm and smooth: rounded electric-piano FM, soft strings, gentle groove (Midnight Vending)
  citypop: {
    buses: { verb: ['plate', { decay: 0.55, damping: 0.6, bandwidth: 0.7, mix: 1 }], delay: ['delay', { timeL: 0.3, timeR: 0.45, feedback: 0.28, damping: 6000, mix: 1 }] },
    master: [['compressor', { threshold: -20, ratio: 2.5, attack: 0.01, release: 0.25 }], ['limiter', { threshold: -1 }]],
    voices: {
      bass: { engine: 'va', params: { shape: 2, cutoff: 560, resonance: 0.3, envAmount: 0.8, decay: 0.3, sustain: 0.5, sub: 0.4 }, gain: 0.44, fx: [['saturator', { drive: 1.2, tone: -0.4 }]] },
      pad: { engine: 'string', params: { bow: 0.7, sustain: 1, damp: 0.35, dispersion: 0.2 }, gain: 0.12, poly: 6, send: { verb: 0.65 } },
      arp: { engine: 'fm', params: { ops: 2, algorithm: 1, ratio2: 1, level2: 0.6, feedback: 0.1, attack: 0.004, decay: 0.5, sustain: 0.1 }, gain: 0.17, send: { verb: 0.4, delay: 0.4 } },
      lead: { engine: 'fm', params: { ops: 4, algorithm: 4, ratio2: 1, ratio3: 2, ratio4: 3, level2: 0.7, feedback: 0.12, brightness: 0.4, decay: 0.6, sustain: 0.4 }, gain: 0.2, fx: [['chorus', { rate: 1.8, depth: 0.4, mix: 0.35 }]], send: { verb: 0.42, delay: 0.32 } },
      counter: { engine: 'string', params: { bow: 0.5, sustain: 0.9, damp: 0.4 }, gain: 0.09, poly: 3, send: { verb: 0.5 } },
      kick: { engine: 'kick', params: { decay: 0.34, pitchDecay: 0.06, drive: 1.6, clickTune: 5 }, gain: 0.82 },
      snare: { engine: 'snare', params: { decay: 0.2, tone: 0.65, snap: 0.1 }, gain: 0.44, send: { verb: 0.28 } },
      hat: { engine: 'hat', params: { decay: 0.055, tone: 1 }, gain: 0.22 },
      perc: { engine: 'tom', params: { decay: 0.22, sweep: 0.07, noise: 0.25 }, gain: 0.24, send: { verb: 0.32 } }
    }
  },
  // lo-fi retro game: square/pulse leads, plain saw bass, no master glue (Metronomicon)
  chiptune: {
    buses: { verb: ['fdn', { size: 0.8, decay: 1, damp: 6000, mix: 1 }], delay: ['delay', { timeL: 0.19, timeR: 0.19, feedback: 0.3, mix: 1 }] },
    master: [['limiter', { threshold: -0.5 }]],
    voices: {
      bass: { engine: 'va', params: { shape: 0, sub: 0.4, cutoff: 900, resonance: 0.1, decay: 0.25, sustain: 0.3 }, gain: 0.42 },
      pad: { engine: 'va', params: { shape: 1, cutoff: 2200, resonance: 0.1, attack: 0.02, decay: 0.4, sustain: 0.5, release: 0.3 }, gain: 0.09, poly: 5, send: { verb: 0.4 } },
      arp: { engine: 'va', params: { shape: 1, cutoff: 5000, resonance: 0.2, attack: 0.004, decay: 0.1, sustain: 0.05, release: 0.08 }, gain: 0.17, send: { delay: 0.4 } },
      lead: { engine: 'fm', params: { ops: 2, algorithm: 1, ratio2: 1.5, level2: 0.6, feedback: 0.2, attack: 0.001, decay: 0.14, sustain: 0.4 }, gain: 0.2, send: { verb: 0.3, delay: 0.32 } },
      counter: { engine: 'va', params: { shape: 1, cutoff: 3000, decay: 0.2 }, gain: 0.09, poly: 3, send: { verb: 0.3 } },
      kick: { engine: 'kick', params: { decay: 0.16, drive: 1.2, clickTune: 3 }, gain: 0.85 },
      snare: { engine: 'snare', params: { decay: 0.09, tone: 0.4 }, gain: 0.5 },
      hat: { engine: 'hat', params: { decay: 0.03, tone: 1.6 }, gain: 0.26 },
      perc: { engine: 'noise', params: { color: 0, filterMode: 1, cutoff: 3000, decay: 0.08 }, gain: 0.24 }
    }
  }
};

// demo genre string -> preset key. Falls back to synthwave.
const GENRE_MAP = {
  'Synthcore': 'synthcore', 'Disco House': 'house', 'Happy Hardcore': 'breakcore',
  'City Pop': 'citypop', 'Eurobeat': 'eurobeat', 'Synthwave': 'synthwave',
  'Breakcore': 'breakcore', 'Test Pattern': 'chiptune',
  'Melodic Trance': 'synthwave', 'Future Bass': 'eurobeat'
};

export function presetForGenre(genre) { return GENRE_MAP[genre] || 'synthwave'; }

// endless mood -> preset (the perpetual stream picks a mood; give each a danceable rack)
const MOOD_PRESET = { pulse: 'house', neon: 'synthwave', glass: 'citypop', circuit: 'synthcore' };
export function presetForMood(mood) { return MOOD_PRESET[mood] || 'house'; }

// nominal drum pitches (the engines are pitched; keep them low and fixed)
export const DRUM_PITCH = { kick: 36, snare: 38, hat: 42, perc: 39 };

// default stereo placement per voice so the arrangement has width and the center is not
// crowded (lead/bass/kick/snare stay centered; a preset can override with its own pan)
const DEFAULT_PAN = { arp: -0.24, counter: 0.24, hat: 0.14, perc: -0.16, pad: 0 };

// Instantiate a preset against a booted Bellows. Returns { voices, buses, dispose }.
export function buildRack(b, presetKey) {
  const p = PRESETS[presetKey] || PRESETS.synthwave;
  const buses = {};
  for (const [name, spec] of Object.entries(p.buses || {})) buses[name] = b.bus([spec], { level: 1 });
  const voices = {};
  for (const [name, v] of Object.entries(p.voices)) {
    const inst = b.voice(v.engine, v.params || {}, v.poly ? { polyphony: v.poly } : undefined).gain(v.gain ?? 0.3);
    if (v.pan != null) inst.pan(v.pan);
    else if (DEFAULT_PAN[name] != null) inst.pan(DEFAULT_PAN[name]);
    if (v.fx) inst.fx(...v.fx);
    if (v.send) for (const [bn, lvl] of Object.entries(v.send)) if (buses[bn]) inst.send(buses[bn], lvl);
    voices[name] = inst;
  }
  if (p.master) b.masterFx(...p.master);
  b.masterGain(p.masterGain ?? 0.92);
  return { voices, buses, preset: presetKey };
}
