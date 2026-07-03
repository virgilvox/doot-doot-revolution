<template>
  <div class="view-fill game-view">
    <div class="stage game-stage">
      <ShaderBackground v-if="settings.background" :mood="bgMood" :seed="bgSeed" />
      <NoteField ref="field" :rec-frac="0.16" :lane-bg="laneBg" />
      <div class="gp-top">
        <div class="song"><div class="t">{{ song?.title || '-' }}</div><div class="s">{{ sub }}</div></div>
        <div class="acts"><button class="btn white sm" @click="restart">Restart</button><button class="btn white sm" @click="quit">Quit</button></div>
      </div>
      <div class="gp-prog" v-if="!state.endless"><i :style="{ width: (state.progress * 100) + '%' }"></i></div>
      <GameHud :score="state.score" :life="state.life" :count="state.count" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { go } from '../game/screen.js';
import NoteField from '../components/NoteField.vue';
import ShaderBackground from '../components/ShaderBackground.vue';
import GameHud from '../components/GameHud.vue';
import { session } from '../composables/useSession.js';
import { useScope } from '../composables/useNavigation.js';
import { pendingPlay } from '../game/play.js';
import { settings } from '../game/settings.js';

const field = ref(null);
const state = session.state;

// The generative background's look tracks the song: composed songs carry a music
// mood, the endless run carries its mood, and the seed comes from the title so each
// track has its own evolving vibe. When the background is on, the lanes darken so
// arrows stay readable over the visuals.
const MOOD_MAP = { pulse: 'AURORA', neon: 'ACID', glass: 'GLASS', circuit: 'CIRCUIT' };
const bgMood = computed(() => { const m = state.song?._mood || (state.song?.endless ? (state.song?.artist || '').toLowerCase() : ''); return MOOD_MAP[m] || undefined; });
const bgSeed = computed(() => state.song?.title || state.song?.id || 'doot');
const laneBg = computed(() => (settings.background ? 'rgba(9,8,24,0.58)' : 'rgba(255,255,255,0.05)'));
const song = computed(() => state.song);
const fmtT = (s) => { s = Math.max(0, s | 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const sub = computed(() => {
  if (state.endless) return `${state.song?.artist || ''} · ${Math.round(state.chart?.bpm || 0)} BPM · ${state.song?.difficulty} · ${fmtT(state.elapsed)}`;
  return state.chart ? `${state.song?.artist || ''} · ${Math.round(state.chart.bpm)} BPM · ${state.chart.difficulty}` : '';
});

function quit() { if (state.endless) session.quit(); else { session.stop(); go('select'); } }
function restart() { session.restart(); }

useScope({ cancel: quit });

onMounted(() => {
  session.attachField(field.value);
  const p = pendingPlay.value;
  if (p && p.endless) session.startEndless(p.config);
  else if (p) session.start(p.song, p.chart);
  else go('select');
});

// Leaving the game (quit, nav, or route change) must halt the play so a finished
// session cannot route to results after the player already left.
onBeforeUnmount(() => session.stop());
</script>

<style scoped>
.game-view { padding: clamp(8px, 1.5vw, 16px); }
.game-stage { flex: 1; min-height: 0; position: relative; border: 3px solid var(--ink); border-radius: var(--r3); overflow: hidden; background: linear-gradient(180deg, #3A2A6E, #241a49); }
.game-stage :deep(canvas) { position: absolute; inset: 0; width: 100%; height: 100%; }
</style>
