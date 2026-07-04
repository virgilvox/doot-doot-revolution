<template>
  <div class="view player-setup"><div class="view-inner">
    <div class="scr-head"><button class="btn white sm" @click="back">&larr; Back</button><h1>Players</h1></div>

    <div class="panel ps-panel">
      <div class="ps-song"><span class="ps-title">{{ song?.title }}</span><span class="ps-diff" :style="{ background: diffColor }">{{ diffName }}</span></div>

      <div class="ps-choose">
        <div class="ps-prompt">How many players?</div>
        <div class="ps-stepper">
          <button class="ps-arrow" :disabled="count <= 1" @click="dec" aria-label="fewer players">&#9664;</button>
          <div class="ps-num" :key="count" :style="{ color: color(0) }">{{ count }}</div>
          <button class="ps-arrow" :disabled="count >= maxPlayers" @click="inc" aria-label="more players">&#9654;</button>
        </div>
        <div class="ps-mode" :style="{ color: count > 1 ? color(0) : '' }">{{ count === 1 ? 'Solo' : 'Versus' }}</div>
      </div>

      <div class="ps-players">
        <div v-for="i in count" :key="i" class="ps-card" :style="{ '--pc': color(i - 1) }">
          <span class="ps-badge">P{{ i }}</span>
          <span class="ps-dev">{{ dev(i - 1).label }}</span>
          <span class="ps-keys" :style="{ color: color(i - 1) }">{{ dev(i - 1).keys }}</span>
        </div>
      </div>

      <div v-if="!hasPads" class="ps-note">{{ note }}</div>

      <button class="btn green ps-dance" :disabled="busy" @click="start">{{ busy ? '…' : 'DANCE' }}</button>
      <div class="eyebrow ps-hint">&#9664; &#9654; change &middot; A / Enter to dance &middot; B / Esc back</div>
    </div>
  </div></div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { go } from '../game/screen.js';
import { DIFFS } from '@doot-games/chart';
import { DIFF_VAR } from '../styles/tokens.js';
import { input, engine } from '../game/singletons.js';
import { useChart } from '../composables/useChart.js';
import { useScope } from '../composables/useNavigation.js';
import { pendingSetup, setPlay, setMatch } from '../game/play.js';
import { PLAYER_COLORS } from '../game/roster.js';

const { ensureChart } = useChart();
const setup = pendingSetup.value || {};
const song = setup.song;
const difficulty = setup.difficulty || 'basic';
const diffName = computed(() => (DIFFS[difficulty] || {}).name || difficulty);
const diffColor = `var(${DIFF_VAR[difficulty] || '--green'})`;

function cleanId(id) { return String(id || 'Controller').replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 22) || 'Controller'; }
// devices to assign, controllers first then the two keyboards; capped at four players
const padList = ref(input.pads());
const order = computed(() => [
  ...padList.value.map((p) => ({ device: p.device, label: cleanId(p.id), keys: 'Gamepad' })),
  { device: 'keyboard', label: 'Keyboard', keys: '← ↓ ↑ →' },
  { device: 'keyboard2', label: 'Keyboard', keys: 'A S W D' }
].slice(0, 4));
const maxPlayers = computed(() => order.value.length);
const hasPads = computed(() => padList.value.length > 0);
const dev = (i) => order.value[i] || { label: '—', keys: '' };

const count = ref(1);
const busy = ref(false);
const color = (i) => PLAYER_COLORS[i] || PLAYER_COLORS[0];
function inc() { if (count.value < maxPlayers.value) { count.value++; engine.cursor(1); } }
function dec() { if (count.value > 1) { count.value--; engine.cursor(-1); } }
const note = computed(() => (count.value === 1
  ? 'No controllers detected — playing on the keyboard (arrow keys). Plug in gamepads for up to 4 players.'
  : 'No controllers detected — P1 uses the arrow keys, P2 uses W A S D. Plug in gamepads for up to 4 players.'));

let aborted = false;
async function start() {
  if (busy.value || !song) return; busy.value = true; engine.cursor(1);
  try {
    const n = count.value;
    if (n === 1) {
      const chart = await ensureChart(song, difficulty);
      if (aborted) return;
      setPlay(song, chart); // solo: any device controls the one player
    } else {
      const built = [];
      for (let i = 0; i < n; i++) { const chart = await ensureChart(song, difficulty); built.push({ device: order.value[i].device, difficulty, chart }); }
      if (aborted) return;
      setMatch(song, built);
    }
    go('game');
  } finally { busy.value = false; }
}
function back() { go('select'); }

useScope({
  move: (dir) => { if (dir === 'left') dec(); else if (dir === 'right') inc(); },
  confirm: start,
  cancel: back
});

let timer = 0;
onMounted(() => {
  if (!song) { go('select'); return; }
  // controllers can wake up while this screen is open; keep the device list live
  timer = setInterval(() => { padList.value = input.pads(); if (count.value > maxPlayers.value) count.value = maxPlayers.value; }, 500);
});
onBeforeUnmount(() => { aborted = true; clearInterval(timer); });
</script>

<style scoped>
.player-setup :deep(.view-inner) { align-items: center; justify-content: center; }
/* .panel is a plain block, so establish the flex column here or the gap/align do nothing */
.ps-panel { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 22px; width: min(440px, 94vw); padding: clamp(26px, 4vw, 36px); }

.ps-song { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center; }
.ps-title { font-family: var(--fd); font-weight: 800; font-size: clamp(21px, 4vw, 27px); }
.ps-diff { font-family: var(--fd); font-weight: 800; font-size: 12px; color: #fff; text-transform: uppercase; letter-spacing: .5px; padding: 3px 12px; border-radius: 999px; border: 2px solid var(--ink); }

/* the count picker as one balanced, centered unit */
.ps-choose { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.ps-prompt { font-family: var(--fu); font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 1.6px; color: #7d7aa0; }
.ps-stepper { display: flex; align-items: center; justify-content: center; gap: 20px; }
.ps-arrow { flex: none; width: 54px; height: 54px; display: grid; place-items: center; border: 3px solid var(--ink); border-radius: var(--r2); background: #fff; color: var(--ink); font-size: 18px; cursor: pointer; box-shadow: 0 4px 0 var(--ink-2); transition: transform .1s, box-shadow .1s; }
.ps-arrow:hover:not(:disabled) { transform: translateY(-1px); }
.ps-arrow:active:not(:disabled) { transform: translateY(4px); box-shadow: 0 0 0 var(--ink-2); }
.ps-arrow:disabled { opacity: .3; box-shadow: none; cursor: default; }
.ps-num { width: 66px; text-align: center; font-family: var(--fd); font-weight: 800; font-size: clamp(70px, 15vw, 84px); line-height: 1; text-shadow: 0 4px 0 var(--ink-2); animation: numpop .26s var(--sp); }
@keyframes numpop { 0% { transform: scale(1.3); } 60% { transform: scale(.95); } 100% { transform: scale(1); } }
.ps-mode { font-family: var(--fd); font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; color: #7d7aa0; }

.ps-players { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
.ps-card { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 108px; padding: 12px 16px; background: #fff; border: 3px solid var(--ink); border-radius: var(--r2); box-shadow: 0 4px 0 var(--ink-2); }
.ps-badge { font-family: var(--fd); font-weight: 800; color: #fff; background: var(--pc); border: 2px solid var(--ink); border-radius: 999px; padding: 1px 14px; font-size: 14px; }
.ps-dev { font-family: var(--fu); font-weight: 800; font-size: 12px; color: var(--ink); }
.ps-keys { font-family: var(--fd); font-weight: 800; font-size: 13px; letter-spacing: 2px; }

.ps-note { font-family: var(--fu); font-weight: 600; font-size: 12px; line-height: 1.45; color: #7d5a2e; background: var(--cream); border: 2px solid var(--ink); border-radius: var(--r2); padding: 10px 14px; max-width: 360px; }
.ps-dance { font-size: 18px; padding: 12px 46px; }
.ps-hint { text-align: center; letter-spacing: 1px; }
</style>
