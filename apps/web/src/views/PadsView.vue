<template>
  <div class="view"><div class="view-inner">
    <div class="scr-head"><button class="btn white sm" @click="back">&larr; Back</button><h1>Controls</h1></div>
    <div class="panel">
      <div class="row">
        <div class="rl"><div class="t">Gamepad input</div><div class="d gp-status">{{ padStatus }}</div></div>
        <div class="rc"><span class="sw-toggle" :class="{ on: padOn }" role="switch" :aria-checked="padOn" @click="togglePad"></span><span class="eyebrow">enable pads</span></div>
      </div>

      <div class="eyebrow" style="margin:16px 0 4px">Remap a device to set every button in order, or click a single slot to change just that one. A d-pad or arrow that comes through as an analog axis works too; press it during Remap to bind it.</div>
      <div class="eyebrow note">If a controller never appears here, it may need a system driver before the browser can see it (for example an Xbox 360 wired pad on macOS). Use the live readout under each controller to tell a driver problem from a mapping one.</div>

      <div v-for="dev in devices" :key="dev.device" class="device">
        <div class="dev-head">
          <span class="dev-name">{{ dev.label }}</span>
          <span class="eyebrow">{{ dev.kind }}</span>
          <button class="btn yellow sm remap" @click="startWizard(dev)">Remap</button>
        </div>
        <div class="bind-grid">
          <div v-for="s in slots" :key="s.slot" class="bind">
            <div class="ar" v-if="s.arrow" v-html="s.arrow"></div>
            <div class="ar glyph" v-else>{{ s.glyph }}</div>
            <div class="bind-name">{{ s.name }}</div>
            <button class="bindbtn" :class="{ listening: isListening(dev.device, s.slot) }" @click="bind(dev.device, s.slot)">{{ isListening(dev.device, s.slot) ? 'press…' : label(dev.device, s.slot) }}</button>
          </div>
        </div>

        <div v-if="dev.kind === 'controller' && rawMap[dev.key]" class="diag">
          <div class="diag-head">Live readout &middot; mapping: {{ rawMap[dev.key].mapping || 'non-standard' }}</div>
          <div class="diag-row">
            <span class="diag-lbl">Buttons</span>
            <span v-for="(p, i) in rawMap[dev.key].buttons" :key="i" class="pip" :class="{ on: p }">{{ i }}</span>
          </div>
          <div v-if="rawMap[dev.key].axes.length" class="diag-row">
            <span class="diag-lbl">Axes</span>
            <span v-for="(v, i) in rawMap[dev.key].axes" :key="i" class="axv" :class="{ act: Math.abs(v) >= 0.5 }">{{ i }}: {{ v.toFixed(2) }}</span>
          </div>
          <div class="eyebrow diag-hint">Press each panel. If nothing here reacts, the pad is not reaching the browser. If a button lights or an axis swings, Remap can bind it.</div>
        </div>
      </div>

      <div class="eyebrow" style="margin-top:14px">Keyboard defaults: arrow keys, Start = Enter, Select = Escape. Controllers default to the d-pad, Start, and Select buttons.</div>
    </div>
  </div></div>

  <div v-if="wizard" class="wiz-scrim" @click.self="cancelWizard">
    <div class="wiz" role="dialog" aria-modal="true">
      <div class="wiz-dev">{{ wizard.label }}</div>
      <div class="wiz-step">Step {{ wizard.i + 1 }} of {{ slots.length }}</div>
      <div class="wiz-ar" v-if="curStep.arrow" v-html="curStep.arrow"></div>
      <div class="wiz-ar glyph" v-else>{{ curStep.glyph }}</div>
      <div class="wiz-name">Press <b>{{ curStep.name }}</b></div>
      <div class="wiz-hint">Press the key or button you want for {{ curStep.name }}. Currently {{ label(wizard.device, curStep.slot) }}.</div>
      <div class="wiz-btns">
        <button class="btn white sm" @click="skipStep">Skip</button>
        <button class="btn white sm" @click="cancelWizard">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { go } from '../game/screen.js';
import { arrowSVG, LANE_DIRS } from '@doot-games/render';
import { input } from '../game/singletons.js';

const arrows = LANE_DIRS.map((d) => arrowSVG(d));
// the mapping order: the four lanes 0..3, then Start and Select (the 'back' slot)
const slots = [
  { slot: 0, name: input.LANE_NAMES[0], arrow: arrows[0] },
  { slot: 1, name: input.LANE_NAMES[1], arrow: arrows[1] },
  { slot: 2, name: input.LANE_NAMES[2], arrow: arrows[2] },
  { slot: 3, name: input.LANE_NAMES[3], arrow: arrows[3] },
  { slot: 'start', name: 'START', glyph: '▶' },
  { slot: 'back', name: 'SELECT', glyph: '◆' },
];

const padOn = ref(input.padEnabled());
const padList = ref(input.pads());
const rawMap = ref({});        // deviceKey -> live { mapping, buttons, axes } for the readout
const listening = ref(null);   // { device, slot } for a single-slot rebind
const wizard = ref(null);      // { device, label, i } while the guided remap runs
const rev = ref(0);            // bumps after a rebind so labels recompute

// keyboard first, then a section per connected controller
const devices = computed(() => {
  rev.value; // reactivity tie so the list refreshes after a rebind
  const out = [{ device: 'keyboard', label: 'Keyboard', kind: 'keyboard' }];
  for (const p of padList.value) out.push({ device: p.device, key: p.key, label: cleanId(p.id), kind: 'controller' });
  return out;
});
function cleanId(id) { return String(id || 'Controller').replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim() || 'Controller'; }

function label(device, slot) { rev.value; return input.describe(device, slot); }
function isListening(device, slot) { return !!listening.value && listening.value.device === device && listening.value.slot === slot; }
function bind(device, slot) { if (wizard.value) return; listening.value = { device, slot }; input.listen(device, slot); }
function togglePad() { padOn.value = !padOn.value; input.setPadEnabled(padOn.value); }
function back() { input.cancelListen(); go('select'); }

// guided remap: walk every slot in order, advancing as each is captured
const curStep = computed(() => slots[wizard.value ? wizard.value.i : 0]);
function startWizard(dev) { listening.value = null; wizard.value = { device: dev.device, label: dev.label, i: 0 }; input.listen(dev.device, slots[0].slot); }
function advanceWizard() {
  const w = wizard.value; if (!w) return;
  if (w.i + 1 >= slots.length) { input.cancelListen(); wizard.value = null; return; }
  w.i += 1; input.listen(w.device, slots[w.i].slot);
}
function skipStep() { input.cancelListen(); advanceWizard(); }
function cancelWizard() { input.cancelListen(); wizard.value = null; }

const padStatus = computed(() => (padList.value.length ? padList.value.length + ' connected' : 'None. Press a button on a controller to wake it.'));

const offBound = input.on('bound', () => { rev.value++; if (wizard.value) advanceWizard(); else listening.value = null; });
let timer = 0, raf = 0;
function poll() { padList.value = input.pads(); }
// live readout: sample raw pad state every frame so pressing a panel reacts at once
function tick() { const m = {}; for (const r of input.rawPads()) m[r.key] = r; rawMap.value = m; raf = requestAnimationFrame(tick); }
onMounted(() => { timer = setInterval(poll, 500); poll(); raf = requestAnimationFrame(tick); });
onBeforeUnmount(() => { clearInterval(timer); cancelAnimationFrame(raf); input.cancelListen(); offBound(); });
</script>

<style scoped>
.device { margin-top: 14px; border-top: 2px dashed rgba(34, 32, 63, .16); padding-top: 12px; }
.dev-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 10px; }
.dev-name { font-family: var(--fd); font-weight: 800; font-size: 15px; }
.dev-head .remap { margin-left: auto; }
.bind-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; }
.bind { text-align: center; }
.bind .ar { width: 42px; height: 42px; margin: 0 auto 2px; }
.bind .ar.glyph { display: flex; align-items: center; justify-content: center; font-size: 24px; color: var(--ink); }
.bind-name { font-family: var(--fd); font-weight: 800; font-size: 12px; margin-bottom: 6px; }
.bindbtn { width: 100%; font-family: var(--fu); font-weight: 700; font-size: 12px; padding: 8px 6px; border: 2px solid var(--ink); border-radius: var(--r2); background: #fff; cursor: pointer; }
.bindbtn.listening { background: var(--yellow); animation: bpulse 1s infinite; }
@keyframes bpulse { 50% { opacity: .55; } }
@media (max-width: 560px) { .bind-grid { grid-template-columns: repeat(3, 1fr); } }

.note { margin-top: 6px; opacity: .8; }
.diag { margin-top: 12px; padding: 10px 12px; border: 2px dashed rgba(34, 32, 63, .18); border-radius: var(--r2); background: rgba(34, 32, 63, .03); }
.diag-head { font-family: var(--fu); font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; opacity: .7; margin-bottom: 8px; }
.diag-row { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; margin-bottom: 6px; }
.diag-lbl { font-family: var(--fu); font-weight: 700; font-size: 11px; width: 58px; opacity: .6; }
.pip { font-family: var(--fu); font-weight: 700; font-size: 10px; min-width: 20px; text-align: center; padding: 2px 4px; border: 1.5px solid rgba(34, 32, 63, .25); border-radius: 5px; color: rgba(34, 32, 63, .5); }
.pip.on { background: var(--green, #3ec46d); border-color: var(--ink); color: #fff; }
.axv { font-family: var(--fu); font-weight: 700; font-size: 10px; padding: 2px 5px; border: 1.5px solid rgba(34, 32, 63, .25); border-radius: 5px; color: rgba(34, 32, 63, .55); }
.axv.act { background: var(--yellow); border-color: var(--ink); color: var(--ink); }
.diag-hint { margin-top: 4px; }

.wiz-scrim { position: fixed; inset: 0; background: rgba(34, 32, 63, .5); display: flex; align-items: center; justify-content: center; z-index: 50; }
.wiz { background: var(--paper, #fff); border: 3px solid var(--ink); border-radius: var(--r3, 18px); padding: 26px 30px; width: min(420px, 90vw); text-align: center; box-shadow: 6px 6px 0 var(--ink); }
.wiz-dev { font-family: var(--fd); font-weight: 800; font-size: 18px; }
.wiz-step { font-family: var(--fu); font-weight: 700; font-size: 12px; opacity: .7; margin: 2px 0 14px; text-transform: uppercase; letter-spacing: .04em; }
.wiz-ar { width: 72px; height: 72px; margin: 0 auto 8px; }
.wiz-ar.glyph { display: flex; align-items: center; justify-content: center; font-size: 52px; color: var(--ink); }
.wiz-name { font-family: var(--fd); font-weight: 800; font-size: 22px; }
.wiz-name b { color: var(--pink, #e5387a); }
.wiz-hint { font-family: var(--fu); font-size: 12px; opacity: .75; margin: 8px 0 18px; }
.wiz-btns { display: flex; gap: 10px; justify-content: center; }
</style>
