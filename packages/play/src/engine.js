// engine: Web Audio playback and the master clock. The audio hardware clock
// (ctx.currentTime) is the single source of truth for song time; the renderer and
// the judge both read it through here, so audio and visuals never drift. Songs play
// two ways: imported audio through a buffer source (play/load), and composed songs
// through a live subtractive synth scheduled a little ahead of the clock (playPiece)
// — only the sounding voices ever exist, so dense generated music is cheap. A
// composed song can carry a `source.extend()` hook so the scheduler keeps pulling
// new bars forever (the perpetual stream).

import { createSynthChain, scheduleStep, pieceStepDur } from './synth.js';

const LOOKAHEAD = 0.15; // seconds scheduled ahead of the clock
const TICK = 25;        // scheduler timer, ms

export class AudioEngine {
  constructor() {
    this.ctx = null; this.buffer = null; this.src = null;
    this.master = null; this.music = null; this.sfx = null;
    this.startAt = 0; this.pauseAt = 0; this.playing = false; this._onend = null;
    this.previewSrc = null; this.previewGain = null;
    // live synth scheduler (game)
    this.synth = null; this.schedTimer = null; this.schedStep = 0; this.schedNext = 0;
    this._piece = null; this._pieceDur = 0; this._stepDur = 0; this._source = null;
    // live synth preview (select wheel)
    this.previewSynth = null; this.previewTimer = null; this.previewStep = 0; this.previewNext = 0; this.previewFrom = 0; this._prPiece = null; this._prStepDur = 0;
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
  latencyMs() { if (!this.ctx) return 0; return Math.round((this.ctx.outputLatency || this.ctx.baseLatency || 0) * 1000); }

  setVolumes(v) { Object.assign(this.volumes, v); this.applyVolumes(); }
  applyVolumes() { if (!this.ctx) return; this.master.gain.value = this.volumes.master; this.music.gain.value = this.volumes.music; this.sfx.gain.value = this.volumes.sfx; }

  resume() { this._ensure(); if (this.ctx.state === 'suspended') return this.ctx.resume(); return Promise.resolve(); }
  async decode(arrayBuffer) { this._ensure(); return await this.ctx.decodeAudioData(arrayBuffer.slice(0)); }
  load(buffer) { this.buffer = buffer; }

  // Imported-audio playback via a buffer source.
  play(fromSec = 0) {
    this._ensure(); this.stop(); this.stopPreview(0.1);
    const s = this.ctx.createBufferSource(); s.buffer = this.buffer; s.connect(this.music);
    s.onended = () => { if (this.playing && this._onend) this._onend(); };
    this.startAt = this.ctx.currentTime - fromSec; s.start(0, Math.max(0, fromSec));
    this.src = s; this.playing = true; this._piece = null;
  }

  // Composed-song playback via the live synth. `source.extend()`, if present, is
  // called when the scheduler reaches the end of the composed material, letting a
  // conductor append more bars for an endless stream.
  playPiece(piece, { from = 0, onEnd = null, source = null } = {}) {
    this._ensure(); this.stop(); this.stopPreview(0.1);
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this._stepDur = pieceStepDur(piece);
    this._piece = piece; this._pieceDur = piece.totalSteps * this._stepDur; this._source = source; this._onend = onEnd;
    this.synth = createSynthChain(this.ctx, piece.M, piece.tempo, this.music);
    const startAt = this.ctx.currentTime + 0.12;
    this.startAt = startAt; this.schedStep = from; this.schedNext = startAt + from * this._stepDur;
    this.buffer = null; this.playing = true;
    this._scheduler();
  }
  _scheduler() {
    if (!this.playing || !this.synth) return;
    while (this.schedNext < this.ctx.currentTime + LOOKAHEAD) {
      if (this.schedStep >= this._piece.totalSteps) {
        if (this._source && this._source.extend) this._source.extend();
        if (this.schedStep >= this._piece.totalSteps) break; // finite song: nothing more to schedule
      }
      scheduleStep(this.ctx, this.synth, this._piece, this.schedStep, this.schedNext);
      this.schedNext += this._stepDur; this.schedStep++;
    }
    const done = !this._source && this.schedStep >= this._piece.totalSteps;
    this.schedTimer = done ? null : setTimeout(() => this._scheduler(), TICK);
  }

  stop() {
    if (this.src) { try { this.src.onended = null; this.src.stop(); } catch (e) {} this.src = null; }
    if (this.schedTimer) { clearTimeout(this.schedTimer); this.schedTimer = null; }
    if (this.synth) { this.synth.dispose(0.06); this.synth = null; }
    this._piece = null; this._source = null; this.playing = false;
  }

  // A looping, faded song preview on the music bus for the select wheel, independent
  // of the game clock. Imported songs preview from a decoded buffer; composed songs
  // preview from the live synth (previewPiece). Real playback stops either.
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

  // Live preview of a composed piece: loop the piece from a hook point, faded in,
  // on its own synth chain so it never touches the game scheduler.
  previewPiece(piece, { fromStep = 0, fadeIn = 0.4 } = {}) {
    this._ensure();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.stopPreview(0.25);
    this._prStepDur = pieceStepDur(piece); this._prPiece = piece; this.previewFrom = fromStep;
    this.previewSynth = createSynthChain(this.ctx, piece.M, piece.tempo, this.music, { gain: 0.9 });
    this.previewSynth.fadeIn(fadeIn);
    this.previewStep = fromStep; this.previewNext = this.ctx.currentTime + 0.12;
    this._previewScheduler();
  }
  _previewScheduler() {
    if (!this.previewSynth) return;
    while (this.previewNext < this.ctx.currentTime + LOOKAHEAD) {
      if (this.previewStep >= this._prPiece.totalSteps) this.previewStep = this.previewFrom; // loop the hook window
      scheduleStep(this.ctx, this.previewSynth, this._prPiece, this.previewStep, this.previewNext);
      this.previewNext += this._prStepDur; this.previewStep++;
    }
    this.previewTimer = setTimeout(() => this._previewScheduler(), TICK);
  }

  // Fade out and stop any preview (buffer or synth). Safe to call when none is set.
  stopPreview(fade = 0.28) {
    const s = this.previewSrc, g = this.previewGain;
    this.previewSrc = null; this.previewGain = null;
    if (s && this.ctx) { const t = this.ctx.currentTime; try { if (g) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t); g.gain.exponentialRampToValueAtTime(0.0001, t + fade); } s.stop(t + fade + 0.05); } catch (e) {} }
    if (this.previewTimer) { clearTimeout(this.previewTimer); this.previewTimer = null; }
    if (this.previewSynth) { this.previewSynth.dispose(fade); this.previewSynth = null; this._prPiece = null; }
  }

  time() { if (!this.ctx || !this.playing) return this.pauseAt; return this.ctx.currentTime - this.startAt; }
  duration() { if (this._piece) return this._pieceDur; return this.buffer ? this.buffer.duration : 0; }
  beat(bpm, offsetSec) { return (this.time() - offsetSec) / (60 / bpm); }
  onended(fn) { this._onend = fn; }

  tick(freq = 880) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, this.ctx.currentTime + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.08);
    o.connect(g); g.connect(this.sfx); o.start(); o.stop(this.ctx.currentTime + 0.09);
  }

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

  // a short shaped note on the sfx bus
  _note(freq, at, dur, type = 'triangle', peak = 0.16) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g); g.connect(this.sfx); o.start(at); o.stop(at + dur + 0.05);
  }

  // results sting: a bright ascending major arpeggio with a shimmer for a win/good run,
  // or a soft two-note resolve otherwise. Plays on the sfx bus.
  fanfare(win = true) {
    this._ensure(); if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const t = this.ctx.currentTime + 0.02;
    if (win) {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this._note(f, t + i * 0.085, 0.55, 'triangle', 0.16)); // C E G C
      this._note(1567.98, t + 0.34, 0.7, 'sine', 0.07); // G6 shimmer
    } else {
      this._note(523.25, t, 0.4, 'triangle', 0.13);       // C5
      this._note(392.0, t + 0.15, 0.6, 'triangle', 0.13); // G4
    }
  }
}

export function createEngine() { return new AudioEngine(); }
