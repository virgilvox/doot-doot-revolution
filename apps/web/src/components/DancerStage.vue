<template>
  <canvas ref="cv" class="dancer-stage" aria-hidden="true"></canvas>
</template>

<script setup>
import { onMounted, onBeforeUnmount, watch, ref } from 'vue';
import { settings } from '../game/settings.js';
import { dancerClock } from '../game/dancerClock.js';
import { usePlatform } from '../composables/usePlatform.js';
import { AVATARS, DANCES, WEB_PRELOAD, WEB_POOL, DEFAULT_AVATAR, avatarById } from '../game/avatars.js';

// The VRM dancer: a transparent three.js layer over the shader background during play.
// The heavy engine (three + the VRM libs) is dynamic-imported so it only loads when the
// dancer is enabled, and it drives itself from dancerClock, so this component just owns
// the canvas lifecycle: create, size, swap avatar, and dispose. Mounted by GameView only
// when settings.dancer is on. On desktop everything preloads; on web a light subset does
// and the rest load on demand.

const cv = ref(null);
const platform = usePlatform();
let stage = null, ro = null, host = null, disposed = false;

// which avatar to mount: an explicit Settings choice wins; otherwise pick at random from
// the platform pool (a small curated set on web, the full roster on desktop) for variety.
function chooseAvatarId() {
  if (settings.avatar && settings.avatar !== DEFAULT_AVATAR) return settings.avatar;
  const pool = platform.isDesktop ? AVATARS.map((a) => a.id) : WEB_POOL;
  return pool[Math.floor(Math.random() * pool.length)] || DEFAULT_AVATAR;
}

async function loadClips() {
  if (!stage) return;
  // full-body dances cycle in the stage. Desktop loads them all; web loads a light
  // subset so first play stays quick.
  const dances = platform.isDesktop ? DANCES : WEB_PRELOAD.dances;
  for (const d of dances) {
    const p = d.kind === 'fbx' ? stage.loadFBX(d.url, 'dance') : stage.loadVRMA(d.url, 'dance');
    p.catch(() => {}); // a clip that fails to load is simply absent from the pool
  }
}

function onVisibility() {
  if (!stage) return;
  if (document.hidden) stage.stop(); else stage.start();
}

// drop a .vrm/.glb to swap the avatar, or a .vrma/.fbx to add a dance. Blob URLs feed
// the same loaders the bundled assets use, then are revoked once the load settles.
function onDragOver(e) { e.preventDefault(); }
function onDrop(e) {
  if (!stage) return;
  const files = e.dataTransfer && e.dataTransfer.files; if (!files || !files.length) return;
  e.preventDefault();
  for (const f of files) {
    const url = URL.createObjectURL(f); const done = () => URL.revokeObjectURL(url);
    if (/\.(vrm|glb)$/i.test(f.name)) stage.setAvatar(url).then(done, done);
    else if (/\.vrma$/i.test(f.name)) stage.loadVRMA(url, 'dance').then((n) => { stage.playDance && stage.playDance(n); done(); }, done);
    else if (/\.fbx$/i.test(f.name)) stage.loadFBX(url, 'dance').then(done, done);
    else done();
  }
}

onMounted(async () => {
  let mod;
  try { mod = await import('@doot-games/render/avatar'); }
  catch (err) { console.warn('[dancer] engine failed to load', err); return; }
  if (disposed || !cv.value) return;
  stage = mod.createDancerStage(cv.value, { clock: dancerClock, reducedMotion: settings.reducedMotion, maxPixelRatio: platform.isDesktop ? 2 : 1.75 });
  if (!stage.ok) { stage = null; return; }
  stage.resize();
  ro = new ResizeObserver(() => stage && stage.resize());
  ro.observe(cv.value);
  document.addEventListener('visibilitychange', onVisibility);
  // scope drop-to-swap to the game stage, not the whole window, so unrelated drops
  // elsewhere in the app keep their default behavior (audit finding)
  host = cv.value.parentElement || cv.value;
  host.addEventListener('dragover', onDragOver);
  host.addEventListener('drop', onDrop);
  stage.setAvatar(avatarById(chooseAvatarId()).url).then(() => { if (!disposed) loadClips(); }).catch((err) => console.warn('[dancer] avatar failed', err));
  stage.start();
});

watch(() => settings.avatar, (id) => { if (stage) stage.setAvatar(avatarById(id).url).catch(() => {}); });
watch(() => settings.reducedMotion, (v) => { if (stage) stage.setReducedMotion(v); });

onBeforeUnmount(() => {
  disposed = true;
  document.removeEventListener('visibilitychange', onVisibility);
  if (host) { host.removeEventListener('dragover', onDragOver); host.removeEventListener('drop', onDrop); host = null; }
  if (ro) { ro.disconnect(); ro = null; }
  if (stage) { stage.dispose(); stage = null; }
});
</script>

<style scoped>
/* over the shader, under the notefield (DOM order gives the stacking); never
   intercepts pointer input */
.dancer-stage { position: absolute; inset: 0; width: 100%; height: 100%; display: block; pointer-events: none; }
</style>
