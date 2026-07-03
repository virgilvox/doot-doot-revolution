<template>
  <div class="view">
    <div class="view-inner">
      <div class="frame"><div class="scn sel-scn">
        <div class="sel-top">
          <h1><span class="tbadge"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#22203F" d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.6" fill="#22203F"/><circle cx="16.5" cy="16" r="2.6" fill="#22203F"/></svg></span> SELECT MUSIC</h1>
          <div class="right">
            <button class="btn yellow sm" @click="go('add')">+ Add Song</button>
            <span class="sortpill">SORT &middot; <b>GROUP</b></span>
            <span class="scount">{{ songs.all.length }}</span>
          </div>
        </div>
        <div class="sel-body">
          <div class="hero" v-if="cur">
            <div class="banner" :style="{ background: covGrad(songs.sel) }">
              <div class="big-l">{{ (cur.title || '?')[0].toUpperCase() }}</div>
              <div class="eq"><i></i><i></i><i></i><i></i></div>
              <div><div class="bt">{{ cur.title }}</div><div class="ba">{{ cur.artist }}<template v-if="cur.genre"> · {{ cur.genre }}</template></div></div>
            </div>
            <div class="facts">
              <div class="fact"><span>BPM</span><b>{{ Math.round(cur.bpm) || '-' }}</b></div>
              <div class="fact"><span>Length</span><b>{{ cur.duration ? fmtTime(cur.duration) : '-' }}</b></div>
              <div class="fact"><span>Charted</span><b>{{ engineLabel }}</b></div>
              <div class="fact"><span>Source</span><b>{{ cur.source || 'file' }}</b></div>
            </div>
            <div class="radar-card">
              <GrooveRadar :radar="radar" />
              <div class="legend"><div v-for="[k, label] in AXES" :key="k"><span>{{ label }}</span><span class="v">{{ Math.round((radar[k] || 0) * 200) }}</span></div></div>
            </div>
            <div class="diffs">
              <div v-for="df in diffs" :key="df" class="diff" @click="open">
                <div class="nm" :style="{ background: `var(${DIFF_VAR[df]})` }">{{ DIFFS[df].name }}</div>
                <div class="ft">{{ (cur.charts && cur.charts[df] ? cur.charts[df].foot : DIFFS[df].foot) }}</div>
              </div>
            </div>
            <div class="cta">
              <button class="btn green" @click="open">DANCE</button>
            </div>
          </div>
          <SongWheel :songs="songs.all" :sel="songs.sel" @pick="onPick" @wheel.prevent="onWheel" />
        </div>
        <div class="sel-foot">
          <span class="k"><span class="btnk" style="background:#9a97c0">B</span>Exit</span>
          <span class="k"><span class="btnk" style="background:var(--green)">A</span>Select</span>
          <span class="k"><span class="btnk" style="background:var(--yellow)">&#9650;&#9660;</span>Move</span>
          <span class="k"><span class="btnk" style="background:var(--blue);color:#fff">&#9654;</span>Menu</span>
          <span class="user">Player 1</span>
        </div>
      </div></div>
    </div>
    <DifficultyModal v-if="modalOpen && cur" :song="cur" @close="modalOpen = false" />
  </div>
</template>

<style scoped>
/* Select grows to its content instead of the 16:9 lock, and the scn flows in the
   frame (the vanilla app did this via #s-select overrides that the Vue port lost).
   The wheel column then fills the row so the reel centers with no dead space. */
.frame { aspect-ratio: auto; }
:deep(.scn) { position: static; }
:deep(.wheel-board) { min-height: clamp(300px, 46vh, 560px); }
</style>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { go } from '../game/screen.js';
import { DIFFS, nominalRadar } from '@doot-games/chart';
import { DIFF_VAR } from '../styles/tokens.js';
import { AXES } from '@doot-games/chart';
import { covGrad, fmtTime } from '../game/covers.js';
import GrooveRadar from '../components/GrooveRadar.vue';
import SongWheel from '../components/SongWheel.vue';
import DifficultyModal from '../components/DifficultyModal.vue';
import { useSongsStore } from '../stores/songs.js';
import { useScope } from '../composables/useNavigation.js';
import { navFocus } from '../game/navFocus.js';
import { engine } from '../game/singletons.js';

const songs = useSongsStore();
const modalOpen = ref(false);
const cur = computed(() => songs.current);
const diffs = Object.keys(DIFFS);
const radar = computed(() => { const s = cur.value; if (!s) return {}; const m = s.charts && s.charts.expert; return (m && m.radar) || nominalRadar('expert'); });
const engineLabel = computed(() => { const s = cur.value; const m = s && s.charts && s.charts.expert; const L = { quick: 'Quick', drum: 'Drum-Aware', stem: 'Stem-Split' }; return m ? (L[m.engine] || 'Drum-Aware') : (L[s?._engine] || '-'); });

function open() { if (cur.value) modalOpen.value = true; }
function onWheel(e) { songs.move(e.deltaY > 0 ? 1 : -1); }
function onPick(i) { if (i === songs.sel) open(); else songs.sel = i; }

// a soft cursor blip as the selection cycles through the wheel; direction is the
// shortest circular step so it reads right at the list ends too
watch(() => songs.sel, (n, o) => {
  if (o == null || !songs.all.length) return;
  const total = songs.all.length;
  let d = n - o; if (d > total / 2) d -= total; if (d < -total / 2) d += total;
  engine.cursor(d < 0 ? -1 : 1);
});

onMounted(() => songs.ensureDemos());
onBeforeUnmount(() => { navFocus.value = -1; });

// Two focus zones: the song wheel, and the top nav tabs (so a controller can
// reach Add, Library, Settings, and Pads). Right leaves the wheel for the nav.
const TAB_ROUTES = ['select', 'add', 'library', 'settings', 'pads'];
const NAV = [1, 2, 3, 4]; // nav tab indices for add, library, settings, pads
const zone = ref('wheel');
let navPos = 0;
function toNav() { zone.value = 'nav'; navPos = 0; navFocus.value = NAV[0]; }
function toWheel() { zone.value = 'wheel'; navFocus.value = -1; }
function navMove(dir) {
  if (dir === 'up') { toWheel(); return; }
  if (dir === 'left') { if (navPos === 0) { toWheel(); return; } navPos--; }
  else if (dir === 'right') navPos = Math.min(NAV.length - 1, navPos + 1);
  navFocus.value = NAV[navPos];
}
useScope({
  move: (d) => {
    if (zone.value === 'wheel') { if (d === 'up') songs.move(-1); else if (d === 'down') songs.move(1); else if (d === 'right') toNav(); }
    else navMove(d);
  },
  confirm: () => { if (zone.value === 'wheel') open(); else go(TAB_ROUTES[NAV[navPos]]); },
  cancel: () => { if (zone.value === 'nav') toWheel(); else go('title'); }
});
</script>
