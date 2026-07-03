<template>
  <div class="wheel-board">
    <div class="wheel-reticle" aria-hidden="true"></div>
    <div class="wheel-cursor" aria-hidden="true"></div>
    <button v-for="c in cards" :key="c.song.id" class="card" :class="{ sel: c.o === 0 }" :style="c.style" @click="$emit('pick', c.i)">
      <div class="cv" :style="{ background: cover(c.i) }">{{ letter(c.song) }}</div>
      <div class="ci"><div class="t">{{ c.song.title }}</div><div class="a">{{ c.song.artist }}</div></div>
      <div class="cb">{{ Math.round(c.song.bpm) || '-' }}</div>
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
