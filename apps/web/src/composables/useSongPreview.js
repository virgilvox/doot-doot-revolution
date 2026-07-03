// useSongPreview: on the song-select wheel, play a looping, faded preview of the
// highlighted track so the screen is not silent and the player can hear a song
// before choosing it. Debounced so spinning the wheel stays quiet (only a settled
// selection previews), decode-race guarded so a slow decode never plays onto a
// song the player already scrolled past, and stopped when the view unmounts. The
// engine stops it on its own when real playback starts, so entering a song is clean.

import { watch, onBeforeUnmount } from 'vue';
import { engine } from '../game/singletons.js';

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
    const mine = ++token;
    let buf = song.buffer;
    if (!buf) {
      if (!song.audio) return; // nothing decodable (e.g. a record with no audio)
      try { buf = await engine.decode(await song.audio.arrayBuffer()); }
      catch (e) { return; }
      if (mine !== token) return; // the selection moved on while we were decoding
      song.buffer = buf;
    }
    if (mine !== token) return;
    engine.preview(buf, { start: startPoint(buf), loopLen: LOOP_LEN });
  }

  function schedule(song) {
    if (timer) clearTimeout(timer);
    token++; // invalidate any in-flight decode from the previous selection
    if (!song) { engine.stopPreview(); timer = 0; return; }
    // keep the current preview playing through the settle, then crossfade
    timer = setTimeout(() => playFor(song), SETTLE_MS);
  }

  const unwatch = watch(currentSong, (song) => schedule(song), { immediate: true });

  function stop() { if (timer) clearTimeout(timer); timer = 0; token++; engine.stopPreview(); }
  onBeforeUnmount(() => { unwatch(); stop(); });

  return { stop };
}
