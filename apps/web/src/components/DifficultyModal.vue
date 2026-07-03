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
          <button class="btn green" :disabled="busy" @click="confirm">{{ busy ? '…' : 'DANCE' }}</button>
        </div>
        <div class="eyebrow dm-hint">Move with Up / Down, DANCE with A / Enter, Back with B / Esc</div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { DIFFS, nominalRadar } from '@doot-games/charter';
import { DIFF_VAR } from '@doot-games/ui';
import { AXES } from '@doot-games/radar';
import GrooveRadar from './GrooveRadar.vue';
import { useChart } from '../composables/useChart.js';
import { useScope } from '../composables/useNavigation.js';
import { setPlay } from '../game/play.js';

const props = defineProps({ song: Object });
const emit = defineEmits(['close']);
const router = useRouter();
const { ensureChart } = useChart();

const diffs = Object.keys(DIFFS);
const idx = ref(Math.max(0, diffs.indexOf('expert')));
const busy = ref(false);

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
    const chart = await ensureChart(props.song, df);
    if (aborted) return; // player pressed Back while the chart was generating
    setPlay(props.song, chart);
    emit('close');
    router.push({ name: 'game' });
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
@media (max-width: 560px) { .dm-body { grid-template-columns: 1fr; } }
</style>
