<template>
  <div class="view-fill game-view">
    <div class="stage game-stage">
      <NoteField ref="field" :rec-frac="0.16" />
      <div class="gp-top">
        <div class="song"><div class="t">{{ song?.title || '-' }}</div><div class="s">{{ sub }}</div></div>
        <div class="acts"><button class="btn white sm" @click="restart">Restart</button><button class="btn white sm" @click="quit">Quit</button></div>
      </div>
      <div class="gp-prog"><i :style="{ width: (state.progress * 100) + '%' }"></i></div>
      <GameHud :score="state.score" :life="state.life" :count="state.count" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { go } from '../game/screen.js';
import NoteField from '../components/NoteField.vue';
import GameHud from '../components/GameHud.vue';
import { session } from '../composables/useSession.js';
import { useScope } from '../composables/useNavigation.js';
import { pendingPlay } from '../game/play.js';

const field = ref(null);
const state = session.state;
const song = computed(() => state.song);
const sub = computed(() => state.chart ? `${state.song?.artist || ''} · ${Math.round(state.chart.bpm)} BPM · ${state.chart.difficulty}` : '');

function quit() { session.stop(); go('select'); }
function restart() { session.restart(); }

useScope({ cancel: quit });

onMounted(() => {
  session.attachField(field.value);
  const p = pendingPlay.value;
  if (p) session.start(p.song, p.chart);
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
