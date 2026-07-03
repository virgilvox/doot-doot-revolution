<template>
  <div class="view"><div class="view-inner">
    <div class="scr-head"><button class="btn white sm" @click="back">&larr; Back</button><h1>Controls</h1></div>
    <div class="panel">
      <div class="row">
        <div class="rl"><div class="t">Gamepad input</div><div class="d gp-status">{{ padStatus }}</div></div>
        <div class="rc"><span class="sw-toggle" :class="{ on: padOn }" role="switch" :aria-checked="padOn" @click="togglePad"></span><span class="eyebrow">enable pads</span></div>
      </div>

      <div class="eyebrow" style="margin:16px 0 4px">Each device keeps its own map. Click a slot, then press its key or button.</div>

      <div v-for="dev in devices" :key="dev.device" class="device">
        <div class="dev-head"><span class="dev-name">{{ dev.label }}</span><span class="eyebrow">{{ dev.kind }}</span></div>
        <div class="bind-grid">
          <div v-for="l in 4" :key="l" class="bind">
            <div class="ar" v-html="arrows[l - 1]"></div>
            <div class="bind-name">{{ names[l - 1] }}</div>
            <button class="bindbtn" :class="{ listening: isListening(dev.device, l - 1) }" @click="bind(dev.device, l - 1)">{{ isListening(dev.device, l - 1) ? 'press…' : label(dev.device, l - 1) }}</button>
          </div>
        </div>
      </div>

      <div class="eyebrow" style="margin-top:14px">Keyboard defaults: arrow keys. Start = Enter, Back = Escape. Controllers default to the d-pad.</div>
    </div>
  </div></div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { go } from '../game/screen.js';
import { arrowSVG, LANE_DIRS } from '@doot-games/render';
import { input } from '../game/singletons.js';

const arrows = LANE_DIRS.map((d) => arrowSVG(d));
const names = input.LANE_NAMES;
const padOn = ref(input.padEnabled());
const padList = ref(input.pads());
const listening = ref(null);   // { device, slot }
const rev = ref(0);            // bumps after a rebind so labels recompute

// keyboard first, then a section per connected controller
const devices = computed(() => {
  rev.value; // reactivity tie so the list refreshes after a rebind
  const out = [{ device: 'keyboard', label: 'Keyboard', kind: 'keyboard' }];
  for (const p of padList.value) out.push({ device: p.device, label: cleanId(p.id), kind: 'controller' });
  return out;
});
function cleanId(id) { return String(id || 'Controller').replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim() || 'Controller'; }

function label(device, lane) { rev.value; return input.describe(device, lane); }
function isListening(device, lane) { return !!listening.value && listening.value.device === device && listening.value.slot === lane; }
function bind(device, lane) { listening.value = { device, slot: lane }; input.listen(device, lane); }
function togglePad() { padOn.value = !padOn.value; input.setPadEnabled(padOn.value); }
function back() { input.cancelListen(); go('select'); }

const padStatus = computed(() => (padList.value.length ? padList.value.length + ' connected' : 'None. Press a button on a controller to wake it.'));

const offBound = input.on('bound', () => { listening.value = null; rev.value++; });
let timer = 0;
function poll() { padList.value = input.pads(); }
onMounted(() => { timer = setInterval(poll, 500); poll(); });
onBeforeUnmount(() => { clearInterval(timer); input.cancelListen(); offBound(); });
</script>

<style scoped>
.device { margin-top: 14px; border-top: 2px dashed rgba(34, 32, 63, .16); padding-top: 12px; }
.dev-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 10px; }
.dev-name { font-family: var(--fd); font-weight: 800; font-size: 15px; }
.bind-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.bind { text-align: center; }
.bind .ar { width: 42px; margin: 0 auto 2px; }
.bind-name { font-family: var(--fd); font-weight: 800; font-size: 12px; margin-bottom: 6px; }
.bindbtn { width: 100%; font-family: var(--fu); font-weight: 700; font-size: 12px; padding: 8px 6px; border: 2px solid var(--ink); border-radius: var(--r2); background: #fff; cursor: pointer; }
.bindbtn.listening { background: var(--yellow); animation: bpulse 1s infinite; }
@keyframes bpulse { 50% { opacity: .55; } }
</style>
