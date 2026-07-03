<template>
  <teleport to="body">
    <div class="dm-scrim" @click.self="$emit('close')">
      <div class="panel dm-card">
        <div class="eyebrow">{{ song.title }} &middot; pick a difficulty</div>
        <div class="dm-body">
          <div class="dm-list">
            <button v-for="(df, i) in diffs" :key="df" class="dcard" :class="{ sel: i === idx }" @click="idx = i" @dblclick="confirm">
              <span class="nm" :style="{ background: cssVar(df) }">{{ D(df).name }}</span>
              <span class="ft" :style="{ color: cssVar(df) }">{{ foot(df) }}</span>
              <span class="meta">{{ meta(df) }}</span>
            </button>
          </div>
          <div class="dm-side">
            <div class="radar-card"><GrooveRadar :radar="radar" /><div class="legend"><div v-for="[k, label] in AXES" :key="k"><span>{{ label }}</span><span class="v">{{ Math.round((radar[k] || 0) * 200) }}</span></div></div></div>
          </div>
        </div>
        <div class="dm-cta">
          <button class="btn white sm" @click="$emit('close')">Back</button>
          <button class="btn green" @click="confirm">{{ song.endless ? 'DANCE' : 'NEXT' }}</button>
        </div>
        <div class="eyebrow dm-hint">Move with Up / Down, {{ song.endless ? 'DANCE' : 'continue' }} with A / Enter, Back with B / Esc</div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, computed } from 'vue';
import { go } from '../game/screen.js';
import { DIFFS, nominalRadar, MOOD_ORDER, AXES } from '@doot-games/chart';
import { DIFF_VAR } from '../styles/tokens.js';
import GrooveRadar from './GrooveRadar.vue';
import { useScope } from '../composables/useNavigation.js';
import { setEndless, setSetup } from '../game/play.js';

const props = defineProps({ song: Object });
const emit = defineEmits(['close']);

const diffs = Object.keys(DIFFS);
const idx = ref(Math.max(0, diffs.indexOf('basic')));

const D = (df) => DIFFS[df];
const cssVar = (df) => `var(${DIFF_VAR[df]})`;
const made = (df) => props.song.charts && props.song.charts[df];
const foot = (df) => { const m = made(df); return m ? m.foot : D(df).foot; };
const meta = (df) => { const m = made(df); return m ? (m.count + ' notes · ' + m.engineUsed) : 'generates on start'; };
const radar = computed(() => { const m = made(diffs[idx.value]); return (m && m.radar) || nominalRadar(diffs[idx.value]); });

function confirm() {
  const df = diffs[idx.value];
  if (props.song.endless) {
    // start an endless run: a random dance mood + tempo, evolving forever
    const mood = MOOD_ORDER[Math.floor(Math.random() * MOOD_ORDER.length)];
    const bpm = 128 + Math.floor(Math.random() * 5) * 8; // 128..160
    setEndless({ mood, seed: Math.floor(Math.random() * 1e6), bpm, difficulty: df });
    emit('close'); go('game'); return;
  }
  // hand the song + difficulty to the player-setup screen (count + input devices)
  setSetup(props.song, df);
  emit('close'); go('players');
}

useScope({
  move: (dir) => { const n = diffs.length; if (dir === 'up') idx.value = (idx.value - 1 + n) % n; else if (dir === 'down') idx.value = (idx.value + 1) % n; },
  confirm,
  cancel: () => emit('close')
});
</script>

<style scoped>
.dm-scrim { position: fixed; inset: 0; z-index: 200; display: grid; place-items: center; background: rgba(20, 18, 44, .5); backdrop-filter: blur(4px); padding: 20px; overflow: auto; }
.dm-card { width: min(620px, 96vw); max-height: calc(100dvh - 40px); overflow: auto; display: flex; flex-direction: column; gap: 12px; }
.dm-body { display: grid; grid-template-columns: 1.1fr 1fr; gap: 14px; }
.dm-list { display: flex; flex-direction: column; gap: 10px; }
.dm-list .dcard { flex-direction: row; align-items: center; gap: 10px; transition: transform .12s var(--sp), box-shadow .12s, background .12s; }
.dm-list .dcard .ft { margin-left: auto; font-size: 30px; }
/* clean selected state: lift plus the yellow highlight used by the wheel, not a
   second black outline stacked on the border */
.dm-list .dcard.sel { outline: none; transform: translateY(-2px); box-shadow: 0 9px 0 var(--ink-2); background: var(--yellow); }
.dm-cta { display: flex; justify-content: flex-end; gap: 10px; }
.dm-hint { text-align: center; }
@media (max-width: 560px) { .dm-body { grid-template-columns: 1fr; } }
</style>
