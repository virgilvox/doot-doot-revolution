<template>
  <div class="view-fill game-view">
    <div class="stage game-stage">
      <ShaderBackground v-if="settings.background" :mood="bgMood" :seed="bgSeed" />

      <div v-if="state.loading" class="ld-ov"><span class="ld-spin" aria-hidden="true"></span><span>Preparing audio…</span></div>

      <!-- single player -->
      <template v-if="!isMatch">
        <NoteField ref="soloField" :rec-frac="0.16" :lane-bg="laneBg" />
        <GameHud :score="state.score" :life="state.life" :count="state.count" />
      </template>

      <!-- local multiplayer: one field per player, side by side, each with its own HUD -->
      <template v-else>
        <div class="mp-fields">
          <div v-for="i in playerCount" :key="i" class="mp-col" :class="{ last: i === playerCount }">
            <NoteField :ref="(el) => setMpField(el, i - 1)" :rec-frac="0.2" :lane-bg="laneBg" />
            <div class="mp-head" :style="{ '--pc': color(i - 1) }">
              <div class="mp-row"><span class="mp-tag">P{{ i }}</span><span class="mp-sc">{{ scoreText(i - 1) }}</span></div>
              <div class="mp-life"><i :style="{ width: life(i - 1) + '%', background: color(i - 1) }"></i></div>
              <div class="mp-combo" v-if="combo(i - 1) > 2">{{ combo(i - 1) }}</div>
            </div>
          </div>
        </div>
        <div class="count mp-count" v-if="state.count">{{ state.count }}</div>
      </template>

      <div class="gp-top">
        <div class="song"><div class="t">{{ song?.title || '-' }}</div><div class="s">{{ sub }}</div></div>
        <div class="acts"><button class="btn white sm" @click="restart">Restart</button><button class="btn white sm" @click="quit">Quit</button></div>
      </div>
      <div class="gp-prog" v-if="!state.endless"><i :style="{ width: (state.progress * 100) + '%' }"></i></div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { go, navTrail } from '../game/screen.js';
import NoteField from '../components/NoteField.vue';
import ShaderBackground from '../components/ShaderBackground.vue';
import GameHud from '../components/GameHud.vue';
import { session } from '../composables/useSession.js';
import { useScope } from '../composables/useNavigation.js';
import { pendingPlay } from '../game/play.js';
import { settings } from '../game/settings.js';
import { PLAYER_COLORS } from '../game/roster.js';

const state = session.state;
const soloField = ref(null);
const mpFields = [];
function setMpField(el, i) { if (el) mpFields[i] = el; }

// the pending play decides single-player vs match; read once at mount
const pending = pendingPlay.value || {};
const isMatch = !!pending.match;
const playerCount = isMatch ? pending.players.length : 1;

const color = (i) => PLAYER_COLORS[i] || PLAYER_COLORS[0];
const player = (i) => state.players[i] || null;
const scoreText = (i) => String(Math.max(0, Math.round(player(i)?.score || 0))).padStart(7, '0');
const combo = (i) => player(i)?.combo || 0;
const life = (i) => Math.max(0, Math.min(100, player(i)?.life || 0));

// the generative background tracks the song (composed mood, endless mood, or seed)
const MOOD_MAP = { pulse: 'AURORA', neon: 'ACID', glass: 'GLASS', circuit: 'CIRCUIT' };
const bgMood = computed(() => { const m = state.song?._mood || (state.song?.endless ? (state.song?.artist || '').toLowerCase() : ''); return MOOD_MAP[m] || undefined; });
const bgSeed = computed(() => state.song?.title || state.song?.id || 'doot');
const laneBg = computed(() => (settings.background ? 'rgba(9,8,24,0.58)' : 'rgba(255,255,255,0.05)'));
const song = computed(() => state.song);
const fmtT = (s) => { s = Math.max(0, s | 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const sub = computed(() => {
  if (isMatch) return `${playerCount} players · versus`;
  const a = state.song?.artist, art = a && a.toLowerCase() !== 'unknown' ? a : null;
  if (state.endless) return [art, `${Math.round(state.chart?.bpm || 0)} BPM`, state.song?.difficulty, fmtT(state.elapsed)].filter(Boolean).join(' · ');
  return state.chart ? [art, `${Math.round(state.chart.bpm)} BPM`, state.chart.difficulty].filter(Boolean).join(' · ') : '';
});

// endless and versus quit to a results/standings screen; a solo fixed song abandons
function quit() { if (state.endless || state.multi) session.quit(); else { session.stop(); go('select'); } }
function restart() { session.restart(); }
useScope({ cancel: quit });

onMounted(() => {
  if (isMatch) {
    session.setFields(mpFields);
    session.startMatch(pending.song, pending.players);
  } else {
    session.attachField(soloField.value);
    const p = pending;
    if (p && p.endless) session.startEndless(p.config);
    else if (p && p.song) session.start(p.song, p.chart);
    else { console.warn('[BOUNCE] GameView no pending play:', JSON.stringify(pending), 'trail:', navTrail.join('>')); go('select'); }
  }
});
onBeforeUnmount(() => session.stop());
</script>

<style scoped>
.game-view { padding: clamp(8px, 1.5vw, 16px); }
.ld-ov { position: absolute; inset: 0; z-index: 20; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; color: #fff; font-family: var(--fd); font-weight: 800; font-size: 20px; background: rgba(9, 8, 24, .55); backdrop-filter: blur(2px); }
.ld-spin { width: 34px; height: 34px; border: 4px solid rgba(255, 255, 255, .3); border-top-color: #fff; border-radius: 50%; animation: spin .8s linear infinite; }
.game-stage { flex: 1; min-height: 0; position: relative; border: 3px solid var(--ink); border-radius: var(--r3); overflow: hidden; background: linear-gradient(180deg, #3A2A6E, #241a49); }
.game-stage :deep(canvas) { position: absolute; inset: 0; width: 100%; height: 100%; }
/* multiplayer: a positioned column per player so each notefield canvas fills its own
   column rather than the whole stage */
.mp-fields { position: absolute; inset: 0; display: flex; }
.mp-col { position: relative; flex: 1; border-right: 3px solid rgba(255, 255, 255, .14); }
.mp-col.last { border-right: none; }
.mp-head { position: absolute; top: 6px; left: 0; right: 0; z-index: 6; display: flex; flex-direction: column; align-items: center; gap: 3px; pointer-events: none; }
.mp-row { display: flex; align-items: center; gap: 6px; }
.mp-tag { font-family: var(--fd); font-weight: 800; font-size: 12px; color: #fff; background: var(--pc); border: 2px solid var(--ink); border-radius: 999px; padding: 0 7px; }
.mp-sc { font-family: var(--fd); font-weight: 800; font-size: 15px; color: #fff; letter-spacing: 1px; text-shadow: 0 2px 0 var(--ink-2); }
.mp-life { width: min(120px, 60%); height: 7px; border: 2px solid #fff; border-radius: 999px; overflow: hidden; }
.mp-life i { display: block; height: 100%; transition: width .12s; }
.mp-combo { font-family: var(--fd); font-weight: 800; font-size: 13px; color: var(--pc); text-shadow: 0 1px 0 var(--ink-2); }
.mp-count { position: absolute; inset: 0; z-index: 8; display: grid; place-items: center; font-family: var(--fd); font-weight: 800; font-size: clamp(60px, 16vw, 140px); color: #fff; text-shadow: 0 6px 0 var(--ink-2); pointer-events: none; }
</style>
