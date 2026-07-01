// engine: Web Audio playback and the master clock. The audio hardware clock
// (ctx.currentTime) is the single source of truth for song time; the renderer
// and the judge both read it through here, so audio and visuals never drift.

export class AudioEngine {
  constructor() {
    this.ctx = null; this.buffer = null; this.src = null;
    this.master = null; this.music = null; this.sfx = null;
    this.startAt = 0; this.pauseAt = 0; this.playing = false; this._onend = null;
    this.volumes = { master: 0.9, music: 0.85, sfx: 0.7 };
  }
  _ensure() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain(); this.music = this.ctx.createGain(); this.sfx = this.ctx.createGain();
    this.music.connect(this.master); this.sfx.connect(this.master); this.master.connect(this.ctx.destination);
    this.applyVolumes();
  }
  ensure() { this._ensure(); return this.ctx; }
  // outputLatency (or baseLatency) in milliseconds, for a first-guess offset.
  latencyMs() { if (!this.ctx) return 0; return Math.round((this.ctx.outputLatency || this.ctx.baseLatency || 0) * 1000); }

  setVolumes(v) { Object.assign(this.volumes, v); this.applyVolumes(); }
  applyVolumes() { if (!this.ctx) return; this.master.gain.value = this.volumes.master; this.music.gain.value = this.volumes.music; this.sfx.gain.value = this.volumes.sfx; }

  resume() { this._ensure(); if (this.ctx.state === 'suspended') return this.ctx.resume(); return Promise.resolve(); }
  async decode(arrayBuffer) { this._ensure(); return await this.ctx.decodeAudioData(arrayBuffer.slice(0)); }
  load(buffer) { this.buffer = buffer; }

  play(fromSec = 0) {
    this._ensure(); this.stop();
    const s = this.ctx.createBufferSource(); s.buffer = this.buffer; s.connect(this.music);
    s.onended = () => { if (this.playing && this._onend) this._onend(); };
    this.startAt = this.ctx.currentTime - fromSec; s.start(0, Math.max(0, fromSec));
    this.src = s; this.playing = true;
  }
  stop() { if (this.src) { try { this.src.onended = null; this.src.stop(); } catch (e) {} this.src = null; } this.playing = false; }

  // Current song time in seconds, read from the audio clock.
  time() { if (!this.ctx || !this.playing) return this.pauseAt; return this.ctx.currentTime - this.startAt; }
  duration() { return this.buffer ? this.buffer.duration : 0; }
  // Beat position given the chart's bpm and first-beat offset.
  beat(bpm, offsetSec) { return (this.time() - offsetSec) / (60 / bpm); }
  onended(fn) { this._onend = fn; }

  // A short hit blip on the sfx bus, optional feedback for a tap.
  tick() {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'square'; o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, this.ctx.currentTime + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.08);
    o.connect(g); g.connect(this.sfx); o.start(); o.stop(this.ctx.currentTime + 0.09);
  }
}

export function createEngine() { return new AudioEngine(); }
