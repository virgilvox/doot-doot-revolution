// engine: Web Audio playback and the master clock. The audio hardware clock
// (ctx.currentTime) is the single source of truth for song time; the renderer
// and the judge both read it through here, so audio and visuals never drift.

export class AudioEngine {
  constructor() {
    this.ctx = null; this.buffer = null; this.src = null;
    this.master = null; this.music = null; this.sfx = null;
    this.startAt = 0; this.pauseAt = 0; this.playing = false; this._onend = null;
    this.previewSrc = null; this.previewGain = null;
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
    this._ensure(); this.stop(); this.stopPreview(0.1);
    const s = this.ctx.createBufferSource(); s.buffer = this.buffer; s.connect(this.music);
    s.onended = () => { if (this.playing && this._onend) this._onend(); };
    this.startAt = this.ctx.currentTime - fromSec; s.start(0, Math.max(0, fromSec));
    this.src = s; this.playing = true;
  }
  stop() { if (this.src) { try { this.src.onended = null; this.src.stop(); } catch (e) {} this.src = null; } this.playing = false; }

  // A looping, faded song preview on the music bus for the select wheel. It is
  // fully independent of the game buffer and the master clock, so previewing a
  // track never disturbs a session's timing. Starting a new preview crossfades out
  // the previous one; real playback (play) stops it. loopLen, when the buffer is
  // longer, loops a window from start rather than the whole track.
  preview(buffer, { start = 0, loopLen = 0, fadeIn = 0.35, gain = 1 } = {}) {
    if (!buffer) return;
    this._ensure();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.stopPreview(0.25);
    const g = this.ctx.createGain(); g.gain.value = 0.0001; g.connect(this.music);
    const s = this.ctx.createBufferSource(); s.buffer = buffer; s.loop = true;
    if (loopLen > 0 && buffer.duration > loopLen) { s.loopStart = Math.max(0, start); s.loopEnd = Math.min(buffer.duration, start + loopLen); }
    s.connect(g);
    s.onended = () => { try { g.disconnect(); } catch (e) {} };
    const t = this.ctx.currentTime, at = Math.max(0, Math.min(start, buffer.duration - 0.05));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t + fadeIn);
    s.start(0, at);
    this.previewSrc = s; this.previewGain = g;
  }

  // Fade out and stop the current preview, if any. Safe to call when none is set.
  stopPreview(fade = 0.28) {
    const s = this.previewSrc, g = this.previewGain;
    this.previewSrc = null; this.previewGain = null;
    if (!s || !this.ctx) return;
    const t = this.ctx.currentTime;
    try {
      if (g) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t); g.gain.exponentialRampToValueAtTime(0.0001, t + fade); }
      s.stop(t + fade + 0.05);
    } catch (e) {}
  }

  // Current song time in seconds, read from the audio clock.
  time() { if (!this.ctx || !this.playing) return this.pauseAt; return this.ctx.currentTime - this.startAt; }
  duration() { return this.buffer ? this.buffer.duration : 0; }
  // Beat position given the chart's bpm and first-beat offset.
  beat(bpm, offsetSec) { return (this.time() - offsetSec) / (60 / bpm); }
  onended(fn) { this._onend = fn; }

  // A short hit blip on the sfx bus. freq lets callers brighten the tick for a
  // better judgment (a Marvelous rings higher than a Good).
  tick(freq = 880) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, this.ctx.currentTime + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.08);
    o.connect(g); g.connect(this.sfx); o.start(); o.stop(this.ctx.currentTime + 0.09);
  }

  // A short, soft cursor blip for menu navigation (cycling the song wheel). A
  // quick upward chirp on a triangle wave, gentler than the gameplay tick so it
  // does not fatigue on fast scrolling. dir < 0 (moving up the list) rings higher.
  cursor(dir = 1) {
    this._ensure(); if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const t = this.ctx.currentTime, base = dir < 0 ? 640 : 500;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(base, t);
    o.frequency.exponentialRampToValueAtTime(base * 1.5, t + 0.05);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + 0.12);
  }
}

export function createEngine() { return new AudioEngine(); }
