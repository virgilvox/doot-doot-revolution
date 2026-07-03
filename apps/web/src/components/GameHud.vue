<template>
  <div class="hud" aria-hidden="true">
    <div class="hud-score">{{ scoreText }}</div>
    <div class="hud-life"><i :style="{ width: life + '%', background: lifeColor }"></i></div>
    <div v-if="count" class="count">{{ count }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
const props = defineProps({ score: Number, life: Number, count: String });
const scoreText = computed(() => String(Math.max(0, Math.round(props.score || 0))).padStart(8, '0'));
const lifeColor = computed(() => (props.life < 25 ? '#FF7A8A' : props.life < 55 ? '#FFC83D' : '#89f0d8'));
</script>

<style scoped>
.hud { position: absolute; inset: 0; pointer-events: none; z-index: 6; }
.hud-score { position: absolute; top: 10px; left: 50%; transform: translateX(-50%); font-family: var(--fd); font-weight: 800; font-size: 22px; letter-spacing: 2px; color: #fff; text-shadow: 0 2px 0 var(--ink-2); }
.hud-life { position: absolute; top: 40px; left: 50%; transform: translateX(-50%); width: min(220px, 44vw); height: 10px; border: 2.5px solid #fff; border-radius: 999px; overflow: hidden; }
.hud-life i { display: block; height: 100%; transition: width .12s; }
.count { position: absolute; inset: 0; display: grid; place-items: center; font-family: var(--fd); font-weight: 800; font-size: clamp(60px, 16vw, 140px); color: #fff; text-shadow: 0 6px 0 var(--ink-2); }
</style>
