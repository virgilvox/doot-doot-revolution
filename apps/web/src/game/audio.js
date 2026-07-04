// ensureBuffer: decode and cache an AudioBuffer for an IMPORTED song (one that
// carries an audio blob). Composed built-ins do not use this — they play through
// the engine's live synth (engine.playPiece / previewPiece) with no buffer at all,
// so there is nothing to render or decode.

import { engine } from './singletons.js';
import { renderPieceBellows } from './bellowsRender.js';

export async function ensureBuffer(song) {
  if (!song) return null;
  if (song.buffer) return song.buffer;
  // bellows-backed composed songs render their piece to a buffer through bellowsjs
  if (song._bellows && song._piece) { song.buffer = await renderPieceBellows(song._piece, engine.ensure()); return song.buffer; }
  if (!song.audio) return null;
  const buf = await engine.decode(await song.audio.arrayBuffer());
  if (buf) song.buffer = buf;
  return buf;
}
