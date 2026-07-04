// useSongPreview: on the song-select wheel, play a looping, faded preview of the
// highlighted track so the screen is not silent and the player can hear a song
// before choosing it. Debounced so spinning the wheel stays quiet (only a settled
// selection previews), decode-race guarded so a slow decode never plays onto a
// song the player already scrolled past, and stopped when the view unmounts. The
// engine stops it on its own when real playback starts, so entering a song is clean.

import { watch, onBeforeUnmount } from 'vue';
import { engine } from '../game/singletons.js';
import { ensureBuffer } from '../game/audio.js';
import { previewPieceLive, stopLive, bootBellows } from '../game/bellowsConductor.js';

const SETTLE_MS = 350; // let the wheel settle before a preview fades in
const LOOP_LEN = 26;   // seconds of the looped window for full-length songs

// Where to start a full-length track: a hook about a third of the way in, leaving
// room for the loop window. Short buffers (the synth demos, brief clips) play from
// the top since they are already loop-length.
function startPoint(buffer) {
  const d = buffer.duration;
  if (d <= 45) return 0;
  return Math.min(d * 0.32, d - LOOP_LEN - 1);
}

export function useSongPreview(currentSong) {
  let timer = 0, token = 0;

  async function playFor(song) {
    if (!song || song.endless) return; // the endless tile has nothing to preview
    const mine = ++token;
    // composed songs preview live through bellows with the same genre rack as playback,
    // looping from a hook a third in, so a song sounds the same before and after picking it
    if (song._piece) {
      engine.stopPreview(); // stop any buffer preview
      await bootBellows(); if (mine !== token) return; // scrolled past while the worklet warmed
      const fromStep = Math.floor(song._piece.totalSteps * 0.33 / 16) * 16;
      await previewPieceLive(song._piece, song.genre, { fromStep });
      return;
    }
    stopLive(0.2); // leaving a bellows preview for an imported buffer
    let buf = song.buffer;
    if (!buf) {
      try { buf = await ensureBuffer(song); } // decodes an imported blob
      catch (e) { return; }
      if (!buf || mine !== token) return; // moved on while decoding
    }
    if (mine !== token) return;
    engine.preview(buf, { start: startPoint(buf), loopLen: LOOP_LEN });
  }

  function schedule(song) {
    if (timer) clearTimeout(timer);
    token++; // invalidate any in-flight decode from the previous selection
    if (!song) { engine.stopPreview(); stopLive(0.2); timer = 0; return; }
    // keep the current preview playing through the settle, then crossfade
    timer = setTimeout(() => playFor(song), SETTLE_MS);
  }

  const unwatch = watch(currentSong, (song) => schedule(song), { immediate: true });

  function stop() { if (timer) clearTimeout(timer); timer = 0; token++; engine.stopPreview(); stopLive(0.2); }
  onBeforeUnmount(() => { unwatch(); stop(); });

  return { stop };
}
