<template>
  <div class="view results-view">
    <div class="view-inner results-inner">
      <!-- local multiplayer: a versus scorecard per player, ranked -->
      <template v-if="isMulti">
        <h1 class="res-title">{{ state.song?.title }} &middot; Versus</h1>
        <div class="vs-verdict" :style="{ color: verdictColor }">{{ verdict }}</div>
        <div class="vs-cards">
          <div v-for="(p, i) in results.players" :key="p.index" class="vs-card" :class="{ win: p.winner }" :style="{ '--pc': p.color, animationDelay: (0.15 + i * 0.1) + 's' }">
            <div class="vs-rank">{{ p.winner ? '★ WINNER' : '#' + p.rank }}</div>
            <div class="vs-tag">{{ p.label }}</div>
            <div class="vs-score">{{ pad(vsScore(p)) }}</div>
            <div class="vs-sub">{{ (p.accuracy || 0).toFixed(1) }}% &middot; {{ p.grade || '-' }}</div>
            <div class="vs-sub">{{ (DIFFS[p.difficulty] || {}).name }}</div>
          </div>
        </div>
      </template>

      <template v-else>
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
      </template>
      <div class="res-cta">
        <button class="btn" :class="{ kfocus: index === 0 }" @click="retry">RETRY</button>
        <button class="btn white sm" :class="{ kfocus: index === 1 }" @click="toSelect">Song select</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { go, navTrail } from '../game/screen.js';
import { DIFFS } from '@doot-games/chart';
import { session } from '../composables/useSession.js';
import { useRovingFocus } from '../composables/useRovingFocus.js';
import { setPlay } from '../game/play.js';
import { engine } from '../game/singletons.js';

const state = session.state;
const results = computed(() => state.results);
const isMulti = computed(() => !!(results.value && results.value.multi));
const winner = computed(() => (isMulti.value ? results.value.players.find((p) => p.winner) : null));
const verdict = computed(() => (isMulti.value ? (winner.value ? winner.value.label + ' WINS!' : "IT'S A TIE!") : ''));
const verdictColor = computed(() => (winner.value ? winner.value.color : 'var(--ink)'));
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
// versus: count every player's score up together
const prog = ref(0);
function countUpMulti() { const dur = 850, start = performance.now(); const step = (t) => { const p = Math.min(1, (t - start) / dur), e = 1 - Math.pow(1 - p, 3); prog.value = e; if (p < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }
const vsScore = (p) => Math.round((p.score || 0) * prog.value);

// for an endless run, pendingPlay still holds the run config, so replaying it just
// re-enters the game; a fixed song replays its own chart
function retry() { if (isMulti.value || state.song?.endless) { go('game'); return; } if (state.song && state.chart) { setPlay(state.song, state.chart); go('game'); } }
function toSelect() { go('select'); }
const { index } = useRovingFocus({ size: () => 2, onConfirm: (i) => (i === 0 ? retry() : toSelect()), onCancel: toSelect });

onMounted(() => {
  if (!results.value) { console.warn('[BOUNCE] Results mounted with no results; playing=', session.state.playing, 'song=', session.state.song?.title, 'trail:', navTrail.join('>')); go('select'); return; }
  requestAnimationFrame(() => { revealed.value = true; });
  if (isMulti.value) { engine.fanfare(true); countUpMulti(); return; }
  engine.fanfare((results.value.accuracy || 0) >= 65); // triumphant for a good run, gentle otherwise
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
.vs-verdict { font-family: var(--fd); font-weight: 800; font-size: clamp(30px, 6vw, 46px); text-shadow: 0 4px 0 var(--ink-2); animation: verdict-pop .5s var(--sp) both; }
@keyframes verdict-pop { 0% { transform: scale(.35); opacity: 0; } 60% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
.vs-cards { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; }
.vs-card { min-width: 150px; padding: 14px 18px; border: 3px solid var(--ink); border-radius: var(--r3); background: #fff; border-top: 8px solid var(--pc); display: flex; flex-direction: column; align-items: center; gap: 4px; animation: card-fade .45s ease both; }
@keyframes card-fade { from { opacity: 0; } to { opacity: 1; } }
.vs-card.win { box-shadow: 0 11px 0 var(--pc); transform: translateY(-6px) scale(1.05); z-index: 1; }
.vs-rank { font-family: var(--fu); font-weight: 800; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: var(--pc); }
.vs-tag { font-family: var(--fd); font-weight: 800; font-size: 20px; color: var(--pc); }
.vs-score { font-family: var(--fd); font-weight: 800; font-size: 24px; }
.vs-sub { font-family: var(--fu); font-weight: 700; font-size: 12px; color: #605d84; }
</style>
