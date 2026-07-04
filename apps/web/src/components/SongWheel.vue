<template>
  <div class="wheel-board">
    <div class="wheel-reticle" aria-hidden="true"></div>
    <div class="wheel-cursor" aria-hidden="true"></div>
    <button v-for="c in cards" :key="c.song.id" class="card" :class="{ sel: c.o === 0, endless: c.song.endless }" :style="c.style" @click="$emit('pick', c.i)">
      <div class="cv" :style="c.song.endless ? null : { background: cover(c.i) }">{{ c.song.endless ? '∞' : letter(c.song) }}</div>
      <div class="ci"><div class="t">{{ c.song.title }}<span v-if="c.song.endless" class="inf" aria-hidden="true">∞</span></div><div class="a">{{ c.song.artist }}</div></div>
      <div class="cb">{{ c.song.endless ? '∞' : (Math.round(c.song.bpm) || '-') }}</div>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { covGrad } from '../game/covers.js';

const props = defineProps({ songs: Array, sel: Number });
defineEmits(['pick']);
const WIN = 6, K = 5.2, SPREAD = 52;

const cards = computed(() => {
  const n = props.songs.length;
  return props.songs.map((song, i) => {
    let o = i - props.sel; if (o > n / 2) o -= n; if (o < -n / 2) o += n; const ao = Math.abs(o);
    const tx = 22 + K * o * o, ty = o * SPREAD, sc = Math.max(.66, 1 - ao * .05), op = Math.max(.18, 1 - ao * .14);
    return { song, i, o, style: { display: ao > WIN ? 'none' : '', transform: `translate(${tx}px, calc(-50% + ${ty}px)) scale(${sc})`, opacity: op, zIndex: 60 - ao * 4 } };
  });
});
const cover = (i) => covGrad(i);
const letter = (s) => (s.title || '?')[0].toUpperCase();
</script>

<style scoped>
/* The Endless tile reads as a special mode, not just another song: a spectrum cover
   with an infinity mark, an outline glow that breathes, and a sheen that sweeps across. */
/* Always on, selected or not, so the tile visibly stands apart in the wheel: a breathing
   outline glow and a slow rotating sparkle across the spectrum cover. */
.card.endless { position: relative; overflow: hidden; border-color: #6b4cff; animation: endless-glow 2.4s ease-in-out infinite; }
.card.endless .cv { position: relative; overflow: hidden; background: conic-gradient(from 210deg, #7c5cff, #ff5ab0, #ffd23f, #22d3c5, #7c5cff); color: #fff; text-shadow: 0 2px 6px rgba(0, 0, 0, .45); }
.card.endless .cv::after { content: ''; position: absolute; inset: -45%; background: conic-gradient(from 0deg, transparent 0deg, rgba(255, 255, 255, .5) 26deg, transparent 62deg, transparent 360deg); animation: endless-spin 3.4s linear infinite; pointer-events: none; }
.card.endless .t { display: inline-flex; align-items: center; }
.card.endless .t .inf { margin-left: 6px; font-weight: 800; color: #7c5cff; }
.card.endless .cb { color: #7c5cff; }
/* the sweeping sheen fires only when the endless tile is the selected card */
.card.endless.sel::after { content: ''; position: absolute; inset: 0; border-radius: inherit; background: linear-gradient(115deg, transparent 36%, rgba(255, 255, 255, .62) 50%, transparent 64%); transform: translateX(-130%); animation: endless-sheen 2.4s ease-in-out infinite; pointer-events: none; z-index: 2; }
@keyframes endless-glow {
  0%, 100% { box-shadow: 0 6px 0 var(--ink-2), 0 0 15px rgba(124, 92, 255, .5); }
  50% { box-shadow: 0 6px 0 var(--ink-2), 0 0 28px rgba(255, 90, 176, .75); }
}
@keyframes endless-spin { to { transform: rotate(360deg); } }
@keyframes endless-sheen { 0% { transform: translateX(-130%); } 55%, 100% { transform: translateX(130%); } }
</style>
