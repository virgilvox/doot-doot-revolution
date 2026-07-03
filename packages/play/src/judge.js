// judge: timing windows, judgment, scoring, combo, life, and hold handling. Pure
// logic driven by song time, no DOM and no audio. The renderer reads its public
// fields (lastJudge, combo, holdActive, life, score) each frame.
//
// Timing windows are the modern StepMania 5 defaults, verified against
// src/Player.cpp: Marvelous 22.5ms, Perfect 45ms, Great 90ms, Good 135ms,
// Boo 180ms (half-windows). Freeze release grace is 0.25s, also from the source.

// Half-window in seconds per judgment.
export const WINDOWS = { marvelous: 0.0225, perfect: 0.045, great: 0.090, good: 0.135, boo: 0.180 };
// Freeze may be released for up to this long before it drops.
export const HOLD_GRACE = 0.25;
// Accuracy weight per judgment, normalized so an all-Marvelous run is 100%.
const ACC = { marvelous: 1, perfect: 0.9, great: 0.6, good: 0.3, boo: 0.1, miss: 0 };
// Life delta per judgment on the dance gauge (0..100).
const LIFE = { marvelous: 1, perfect: 1, great: 0.5, good: 0, boo: -2, miss: -4 };
const ORDER = ['marvelous', 'perfect', 'great', 'good', 'boo', 'miss'];

// DDR-flavored grade from accuracy percent. Full combo is reported separately.
export function gradeFor(accuracyPct) {
  if (accuracyPct >= 99) return 'AAA';
  if (accuracyPct >= 93) return 'AA';
  if (accuracyPct >= 80) return 'A';
  if (accuracyPct >= 65) return 'B';
  if (accuracyPct >= 45) return 'C';
  return 'D';
}

export class Judge {
  constructor(chart, options = {}) {
    this.notes = chart.notes.map((n, i) => ({
      t: n.t, lane: n.lane, dur: n.dur || 0, quant: n.quant, i,
      judged: false, holding: false, dropped: false, done: false, releaseAt: null
    }));
    this.W = WINDOWS;
    this.maxScore = options.maxScore || 1000000;
    this.counts = { marvelous: 0, perfect: 0, great: 0, good: 0, boo: 0, miss: 0 };
    this.holdsHeld = 0; this.holdsDropped = 0;
    this.combo = 0; this.maxCombo = 0; this.score = 0; this.holdBonus = 0; this.life = 50; this.lastJudge = null;
    this.total = this.notes.length || 1; this._accSum = 0; this._judgedCount = 0;
    this.holdActive = [null, null, null, null];
    this.onJudge = options.onJudge || null;
    this._now = options.now || (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  }

  // Register a tap at song time t on a lane. Returns the judgment name or null.
  hit(lane, t) {
    let best = -1, bd = 1e9;
    for (let k = 0; k < this.notes.length; k++) {
      const n = this.notes[k];
      if (n.lane !== lane || n.judged) continue;
      const d = Math.abs(n.t - t);
      if (d < bd) { bd = d; best = k; }
    }
    if (best < 0 || bd > this.W.boo) return null;
    const n = this.notes[best];
    const type = bd <= this.W.marvelous ? 'marvelous' : bd <= this.W.perfect ? 'perfect' : bd <= this.W.great ? 'great' : bd <= this.W.good ? 'good' : 'boo';
    n.judged = type; n.dt = t - n.t;
    this._apply(type, n.dt);
    if (n.dur > 0 && type !== 'boo') { n.holding = true; this.holdActive[lane] = n; }
    return type;
  }

  // Advance to song time t. held is the current per-lane key-down state, used for
  // the freeze release grace. Sweeps missed taps and finishes or drops holds.
  update(t, held = [false, false, false, false]) {
    for (let l = 0; l < 4; l++) {
      const n = this.holdActive[l];
      if (!n) continue;
      const tail = n.t + n.dur;
      if (held[l]) { n.releaseAt = null; }
      else if (n.releaseAt == null) { n.releaseAt = t; }
      // Measure the release only up to the tail, so a release beyond the grace
      // window still drops the freeze even if updates skip past the tail.
      if (n.releaseAt != null && (Math.min(t, tail) - n.releaseAt) > HOLD_GRACE && !n.dropped) { this._dropHold(l, n); continue; }
      if (t >= tail && !n.dropped) { n.holding = false; n.done = true; this.holdActive[l] = null; this.holdsHeld++; this.holdBonus += 200; this._rescore(); this.life = Math.min(100, this.life + 1); }
    }
    for (let k = 0; k < this.notes.length; k++) {
      const n = this.notes[k];
      if (n.judged) continue;
      if (t > n.t + this.W.boo) { n.judged = 'miss'; this._apply('miss', 0); }
    }
  }

  _dropHold(l, n) { n.holding = false; n.dropped = true; n.done = true; this.holdActive[l] = null; this.holdsDropped++; this.combo = 0; this.life = Math.max(0, this.life - 2); this.lastJudge = { type: 'drop', at: this._now() }; if (this.onJudge) this.onJudge({ type: 'drop', combo: 0 }); }

  _apply(type, dt) {
    this.counts[type]++; this._judgedCount++;
    // ITG combo rule: Marvelous, Perfect, and Great keep the combo; Good, Boo, and Miss break it.
    if (type === 'good' || type === 'boo' || type === 'miss') this.combo = 0;
    else { this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo); }
    this.life = Math.max(0, Math.min(100, this.life + LIFE[type]));
    this._accSum += ACC[type];
    this._rescore();
    this.lastJudge = { type, at: this._now(), dt: dt || 0 };
    if (this.onJudge) this.onJudge({ type, combo: this.combo });
  }

  // Score is accuracy over the note total plus a flat bonus for freezes fully
  // held. Kept in one place so a completed hold and a judged tap agree.
  _rescore() { this.score = Math.round(this.maxScore * (this._accSum / this.total)) + this.holdBonus; }

  accuracy() { return this._accSum / this.total * 100; }

  results() {
    const acc = this.accuracy();
    return {
      counts: this.counts, holdsHeld: this.holdsHeld, holdsDropped: this.holdsDropped,
      maxCombo: this.maxCombo, score: this.score, accuracy: acc, grade: gradeFor(acc),
      fullCombo: this.counts.miss === 0 && this.counts.boo === 0, total: this.total, order: ORDER
    };
  }
}
