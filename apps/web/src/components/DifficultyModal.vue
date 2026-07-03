<template>
  <teleport to="body">
    <div class="dm-scrim" @click.self="$emit('close')">
      <div class="panel dm-card">
        <div class="eyebrow">{{ song.title }} &middot; {{ players > 1 ? 'set up players' : 'pick a difficulty' }}</div>
        <div v-if="!song.endless" class="dm-players">
          <span class="eyebrow">Players</span>
          <div class="pcount"><button v-for="n in 4" :key="n" :class="{ on: players === n }" @click="setPlayers(n)">{{ n }}</button></div>
        </div>
        <div class="dm-body">
          <div class="dm-list">
            <template v-if="players <= 1">
              <button v-for="(df, i) in diffs" :key="df" class="dcard" :class="{ sel: i === idx }" @click="idx = i" @dblclick="confirm">
                <span class="nm" :style="{ background: cssVar(df) }">{{ D(df).name }}</span>
                <span class="ft" :style="{ color: cssVar(df) }">{{ foot(df) }}</span>
                <span class="meta">{{ meta(df) }}</span>
              </button>
            </template>
            <template v-else>
              <div v-for="(cfg, pi) in configs" :key="pi" class="prow" :style="{ '--pc': PLAYER_COLORS[pi] }">
                <span class="ptag">P{{ pi + 1 }}</span>
                <select class="psel" v-model="cfg.device"><option v-for="d in deviceOpts" :key="d.device" :value="d.device">{{ d.label }}</option></select>
                <select class="psel" v-model="cfg.difficulty"><option v-for="df in diffs" :key="df" :value="df">{{ D(df).name }}</option></select>
              </div>
            </template>
          </div>
          <div class="dm-side" v-if="players <= 1">
            <div class="radar-card"><GrooveRadar :radar="radar" /><div class="legend"><div v-for="[k, label] in AXES" :key="k"><span>{{ label }}</span><span class="v">{{ Math.round((radar[k] || 0) * 200) }}</span></div></div></div>
          </div>
        </div>
        <div class="dm-cta">
          <button class="btn white sm" @click="$emit('close')">Back</button>
          <button class="btn green" :disabled="busy" @click="confirm">{{ busy ? '…' : 'DANCE' }}</button>
        </div>
        <div class="eyebrow dm-hint">Move with Up / Down, DANCE with A / Enter, Back with B / Esc</div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, reactive, computed, onBeforeUnmount } from 'vue';
import { go } from '../game/screen.js';
import { DIFFS, nominalRadar, MOOD_ORDER } from '@doot-games/chart';
import { DIFF_VAR } from '../styles/tokens.js';
import { AXES } from '@doot-games/chart';
import GrooveRadar from './GrooveRadar.vue';
import { useChart } from '../composables/useChart.js';
import { useScope } from '../composables/useNavigation.js';
import { setPlay, setEndless, setMatch } from '../game/play.js';
import { input } from '../game/singletons.js';
import { PLAYER_COLORS } from '../game/roster.js';

const props = defineProps({ song: Object });
const emit = defineEmits(['close']);
const { ensureChart } = useChart();

const diffs = Object.keys(DIFFS);
const idx = ref(Math.max(0, diffs.indexOf('basic')));
const busy = ref(false);

// local multiplayer: pick 1-4 players, each a device + difficulty. Devices default to
// keyboard (arrows), keyboard (WASD), then any connected pads.
const players = ref(1);
const configs = reactive([]);
const deviceOpts = ref(input.devices());
function setPlayers(n) {
  players.value = n;
  const devs = input.devices(); deviceOpts.value = devs;
  configs.splice(0);
  for (let i = 0; i < n; i++) configs.push({ device: (devs[i] && devs[i].device) || 'keyboard', difficulty: 'basic' });
}

const D = (df) => DIFFS[df];
const cssVar = (df) => `var(${DIFF_VAR[df]})`;
const made = (df) => props.song.charts && props.song.charts[df];
const foot = (df) => { const m = made(df); return m ? m.foot : D(df).foot; };
const meta = (df) => { const m = made(df); return m ? (m.count + ' notes · ' + m.engineUsed) : 'generates on start'; };
const radar = computed(() => { const m = made(diffs[idx.value]); return (m && m.radar) || nominalRadar(diffs[idx.value]); });

let aborted = false;
onBeforeUnmount(() => { aborted = true; });
async function confirm() {
  if (busy.value) return; busy.value = true;
  try {
    const df = diffs[idx.value];
    if (props.song.endless) {
      // start an endless run: a random dance mood + tempo, evolving forever
      const mood = MOOD_ORDER[Math.floor(Math.random() * MOOD_ORDER.length)];
      const bpm = 128 + Math.floor(Math.random() * 5) * 8; // 128..160
      setEndless({ mood, seed: Math.floor(Math.random() * 1e6), bpm, difficulty: df });
      emit('close'); go('game'); return;
    }
    if (players.value <= 1) {
      const chart = await ensureChart(props.song, df);
      if (aborted) return; // player pressed Back while the chart was generating
      setPlay(props.song, chart);
    } else {
      // chart each player's difficulty from the same song, then start the match
      const built = [];
      for (const cfg of configs) { const chart = await ensureChart(props.song, cfg.difficulty); built.push({ device: cfg.device, difficulty: cfg.difficulty, chart }); }
      if (aborted) return;
      setMatch(props.song, built);
    }
    emit('close');
    go('game');
  } finally { busy.value = false; }
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
.dm-players { display: flex; align-items: center; gap: 12px; }
.pcount { display: flex; gap: 6px; }
.pcount button { width: 34px; height: 34px; border: 2px solid var(--ink); border-radius: var(--r2); background: #fff; font-family: var(--fd); font-weight: 800; cursor: pointer; }
.pcount button.on { background: var(--ink); color: #fff; }
.prow { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 2px solid var(--ink); border-radius: var(--r2); border-left: 7px solid var(--pc); }
.ptag { font-family: var(--fd); font-weight: 800; color: #fff; background: var(--pc); border-radius: 999px; padding: 2px 9px; font-size: 13px; }
.psel { flex: 1; min-width: 0; padding: 6px 8px; border: 2px solid var(--ink); border-radius: var(--r2); font-family: var(--fu); font-weight: 700; font-size: 12px; background: #fff; cursor: pointer; }
@media (max-width: 560px) { .dm-body { grid-template-columns: 1fr; } }
</style>
