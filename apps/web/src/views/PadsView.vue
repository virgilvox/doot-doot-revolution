<template>
  <div class="view"><div class="view-inner">
    <div class="scr-head"><button class="btn white sm" @click="back">&larr; Back</button><h1>Controls</h1></div>
    <div class="panel">
      <div class="row">
        <div class="rl"><div class="t">Connected gamepad</div><div class="d gp-status">{{ detect }}</div></div>
        <div class="rc"><span class="sw-toggle" :class="{ on: padOn, kfocus: fi === 0 }" role="switch" @click="togglePad"></span><span class="eyebrow">enable pad</span></div>
      </div>
      <div class="eyebrow" style="margin:16px 0 10px">Bind each lane. Click a slot, then press a key or a gamepad button.</div>
      <div class="bind-grid">
        <div v-for="l in 4" :key="l" class="bind">
          <div class="ar" v-html="arrows[l - 1]"></div>
          <div style="font-family:var(--fd);font-weight:800;font-size:13px;margin-bottom:6px">{{ names[l - 1] }}</div>
          <div style="font-family:var(--fu);font-size:11px;color:#7d7aa0;margin-bottom:8px">{{ labels[l - 1] }}</div>
          <button class="bindbtn" :class="{ listening: listening === l - 1, kfocus: fi === l }" @click="bind(l - 1)">{{ listening === l - 1 ? 'press key / button…' : 'Bind' }}</button>
        </div>
      </div>
      <div class="eyebrow" style="margin-top:14px">Keyboard defaults: arrow keys. Start = Enter, Back = Escape.</div>
    </div>
  </div></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { arrowSVG, LANE_DIRS } from '@doot-games/noteskin';
import { input } from '../game/singletons.js';
import { useRovingFocus } from '../composables/useRovingFocus.js';

const router = useRouter();
const arrows = LANE_DIRS.map((d) => arrowSVG(d));
const names = input.LANE_NAMES;
const labels = ref(names.map((_, l) => input.describe(l)));
const padOn = ref(input.padEnabled());
const listening = ref(-1);
const detect = ref('None detected. Press a button on a controller to wake it.');

function refresh() { labels.value = names.map((_, l) => input.describe(l)); }
function bind(l) { listening.value = l; input.listen(l); }
function togglePad() { padOn.value = !padOn.value; input.setPadEnabled(padOn.value); }
function back() { input.cancelListen(); router.push({ name: 'select' }); }

const offBound = input.on('bound', () => { listening.value = -1; refresh(); });
let timer = 0;
function poll() { const gp = input.connectedPad(); detect.value = gp ? ('Connected: ' + gp.id) : 'None detected. Press a button on a controller to wake it.'; }
onMounted(() => { timer = setInterval(poll, 500); poll(); });
onBeforeUnmount(() => { clearInterval(timer); input.cancelListen(); offBound(); });

// Controller focus over the enable toggle (0) and the four lane binders (1..4).
const { index: fi } = useRovingFocus({ size: () => 5, onConfirm: (i) => (i === 0 ? togglePad() : bind(i - 1)), onCancel: back });
</script>
