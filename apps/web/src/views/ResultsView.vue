<template>
  <div class="view results-view">
    <div class="view-inner results-inner">
      <h1 class="res-title">{{ title }}</h1>
      <div class="grade" :class="{ 'grade-in': showGrade }" :style="{ color: gradeColor }">{{ results?.grade || '-' }}</div>
      <div class="res-stats">
        <div class="stat-big"><span>Accuracy</span><b>{{ shownAcc.toFixed(2) }}%</b></div>
        <div class="stat-big"><span>Score</span><b>{{ pad(shownScore) }}</b></div>
      </div>
      <div class="pill" :class="{ fc: results && results.fullCombo }">{{ comboText }}</div>
      <div class="judges">
        <div v-for="r in rows" :key="r.name" class="jrow">
          <span class="jn">{{ r.name }}</span>
          <span class="jbar"><i :style="{ width: (revealed ? pct(r.count) : 0) + '%', background: `var(${r.color})` }"></i></span>
          <span class="jc">{{ r.count }}</span>
        </div>
      </div>
      <div class="res-cta">
        <button class="btn" :class="{ kfocus: index === 0 }" @click="retry">RETRY</button>
        <button class="btn white sm" :class="{ kfocus: index === 1 }" @click="toSelect">Song select</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { go } from '../game/screen.js';
import { DIFFS } from '@doot-games/charter';
import { session } from '../composables/useSession.js';
import { useRovingFocus } from '../composables/useRovingFocus.js';
import { setPlay } from '../game/play.js';

const state = session.state;
const results = computed(() => state.results);
const title = computed(() => state.song ? `${state.song.title} · ${(DIFFS[state.chart?.difficulty] || {}).name || ''}` : 'Results');
const comboText = computed(() => results.value ? (results.value.fullCombo ? 'FULL COMBO' : results.value.maxCombo + ' MAX COMBO') : '');
const gradeColor = computed(() => { const a = results.value?.accuracy || 0; return a >= 93 ? 'var(--teal)' : a >= 80 ? 'var(--blue)' : a >= 45 ? 'var(--purple)' : 'var(--pink)'; });
const total = computed(() => results.value?.total || 1);
const rows = computed(() => {
  const c = results.value?.counts || {};
  return [
    { name: 'Marvelous', count: c.marvelous || 0, color: '--teal' },
    { name: 'Perfect', count: c.perfect || 0, color: '--blue' },
    { name: 'Great', count: c.great || 0, color: '--green' },
    { name: 'Good', count: c.good || 0, color: '--purple' },
    { name: 'Boo', count: c.boo || 0, color: '--orange' },
    { name: 'Miss', count: c.miss || 0, color: '--red' }
  ];
});
const pct = (n) => Math.round(n / total.value * 100);
const pad = (n) => String(Math.max(0, Math.round(n))).padStart(8, '0');

// reveal: bars grow and the numbers count up, so the screen pays the run off
const revealed = ref(false);
const showGrade = ref(false);
const shownAcc = ref(0);
const shownScore = ref(0);
function countUp() {
  const acc = results.value.accuracy, sc = results.value.score, dur = 750, start = performance.now();
  const step = (t) => { const p = Math.min(1, (t - start) / dur), e = 1 - Math.pow(1 - p, 3); shownAcc.value = acc * e; shownScore.value = Math.round(sc * e); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

function retry() { if (state.song && state.chart) { setPlay(state.song, state.chart); go('game'); } }
function toSelect() { go('select'); }
const { index } = useRovingFocus({ size: () => 2, onConfirm: (i) => (i === 0 ? retry() : toSelect()), onCancel: toSelect });

onMounted(() => {
  if (!results.value) { go('select'); return; }
  requestAnimationFrame(() => { revealed.value = true; });
  countUp();
  // slam the grade in after the tallies and numbers have counted up: the payoff
  setTimeout(() => { showGrade.value = true; }, 820);
});
</script>

<style scoped>
.results-view :deep(.view-inner) { align-items: center; text-align: center; }
.results-inner { align-items: center; gap: var(--s3); justify-content: center; }
.res-title { color: var(--ink); font-size: clamp(20px, 4vw, 30px); }
.grade { opacity: 0; }
.grade.grade-in { animation: grade-pop .5s var(--sp) forwards; }
@keyframes grade-pop { 0% { transform: scale(.3); opacity: 0; } 60% { transform: scale(1.14); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
.res-stats { display: flex; gap: clamp(16px, 4vw, 40px); }
.stat-big { display: flex; flex-direction: column; align-items: center; }
.stat-big span { font-family: var(--fu); font-weight: 800; text-transform: uppercase; letter-spacing: 1.4px; font-size: 11px; color: #605d84; }
.stat-big b { font-family: var(--fd); font-weight: 800; font-size: clamp(22px, 4vw, 32px); }
.pill.fc { animation: fc-pulse 1s ease-in-out infinite; background: var(--yellow); }
@keyframes fc-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
.res-cta { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 8px; }
.jbar > i { transition: width .6s var(--ease); }
</style>
