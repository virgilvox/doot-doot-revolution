<template>
  <div class="view"><div class="view-inner">
    <div class="scr-head"><button class="btn white sm" @click="back">&larr; Back</button><h1>Settings</h1></div>
    <div class="panel"><div class="rows">
      <div v-for="(r, i) in rows" :key="r.key || r.t" class="row">
        <div class="rl"><div class="t">{{ r.t }}</div><div v-if="desc(r)" class="d">{{ desc(r) }}</div></div>
        <div class="rc" :class="{ kfocus: fi === i }">
          <template v-if="r.kind === 'range' || r.kind === 'vol'">
            <input type="range" :min="r.kind === 'vol' ? 0 : r.min" :max="r.kind === 'vol' ? 100 : r.max" :step="r.kind === 'vol' ? 1 : r.step" :value="rangeValue(r)" @input="onInput(r, $event)">
            <span class="rv">{{ rangeLabel(r) }}</span>
          </template>
          <template v-else-if="r.kind === 'toggle'">
            <span class="sw-toggle" :class="{ on: s.state[r.key] }" role="switch" :aria-checked="s.state[r.key]" @click="s.set(r.key, !s.state[r.key])"></span>
          </template>
          <template v-else>
            <button class="btn white sm" :disabled="r.disabled && r.disabled()" @click="r.action()">{{ r.label() }}</button>
          </template>
        </div>
      </div>
    </div></div>
  </div></div>
</template>

<script setup>
import { reactive, onBeforeUnmount } from 'vue';
import { go } from '../game/screen.js';
import { settings, resetSettings } from '../game/settings.js';
import { useRovingFocus } from '../composables/useRovingFocus.js';
import { engine } from '../game/singletons.js';

// settings is one reactive object; assigning to it triggers the persistence and
// side-effect watchers in game/settings.js. This adapter keeps the template's
// s.state / s.set / s.reset shape.
const s = { state: settings, set: (k, v) => { settings[k] = v; }, reset: resetSettings };
const back = () => go('select');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const calib = reactive({ running: false, msg: '', clicks: [], taps: [] });

// desktop-only manual update check (the app also checks on launch and every few hours)
const isDesktop = !!(window.doot && window.doot.isDesktop);
const upd = reactive({ msg: '' });
// reflect live update status (download progress, ready, or error) as it is reported
if (isDesktop && window.doot.onUpdate) window.doot.onUpdate((d) => {
  if (!d) return;
  if (d.state === 'available') upd.msg = 'Update found, downloading…';
  else if (d.state === 'downloading') upd.msg = 'Downloading update' + (d.percent != null ? ' ' + d.percent + '%' : '…');
  else if (d.state === 'ready') upd.msg = 'Update ' + (d.version ? 'v' + d.version + ' ' : '') + 'ready. Restart to install.';
  else if (d.state === 'error') upd.msg = 'Auto-update failed. Get it from the releases page.';
});
async function checkForUpdate() {
  if (!window.doot || !window.doot.checkUpdate) return;
  upd.msg = 'Checking…';
  try {
    const r = await window.doot.checkUpdate();
    if (r && r.updateAvailable) upd.msg = 'Update v' + r.latest + ' found, downloading…';
    else if (r && r.error) upd.msg = 'Could not check';
    else upd.msg = 'You have the latest' + (r && r.current ? ' (v' + r.current + ')' : '');
  } catch (e) { upd.msg = 'Could not check'; }
}

const rows = [
  { t: 'Scroll speed', d: 'How fast arrows travel. Higher is faster.', kind: 'range', key: 'speed', min: 1, max: 5, step: 0.1, fmt: (v) => v.toFixed(1) + 'x' },
  { t: 'Judge offset', d: 'Nudge timing if hits feel early or late.', kind: 'range', key: 'offsetMs', min: -100, max: 100, step: 2, fmt: (v) => (v > 0 ? '+' : '') + Math.round(v) + ' ms' },
  { t: 'Calibrate', id: 'calibrate', kind: 'action', action: runCalibration, label: () => (calib.running ? 'listening…' : 'Tap calibrate'), disabled: () => calib.running },
  { t: 'Master volume', kind: 'vol', key: 'volMaster' },
  { t: 'Music volume', kind: 'vol', key: 'volMusic' },
  { t: 'SFX volume', d: 'Loudness of menu and hit sounds.', kind: 'vol', key: 'volSfx' },
  { t: 'Hit sounds', d: 'Play a note on each hit, pitched to the song. Off by default.', kind: 'toggle', key: 'hitSounds' },
  { t: 'Reduced motion', d: 'Calmer menus. Gameplay still animates.', kind: 'toggle', key: 'reducedMotion' },
  { t: 'Background visuals', d: 'Generative shader behind the lanes during play. Off for a plain field.', kind: 'toggle', key: 'background' },
  ...(isDesktop ? [{ t: 'Check for updates', id: 'update', kind: 'action', action: checkForUpdate, label: () => 'Check now' }] : []),
  { t: 'Reset', d: 'Restore default settings.', kind: 'action', action: () => s.reset(), label: () => 'Reset all' }
];
function desc(r) {
  if (r.id === 'calibrate') return calib.msg || 'Play 8 clicks and tap Space in time to find your offset.';
  if (r.id === 'update') return upd.msg || 'A newer version installs itself; you just restart. Your settings are kept.';
  return r.d || '';
}
function rangeValue(r) { return r.kind === 'vol' ? Math.round(s.state[r.key] * 100) : s.state[r.key]; }
function rangeLabel(r) { return r.kind === 'vol' ? Math.round(s.state[r.key] * 100) + '%' : r.fmt(s.state[r.key]); }
function onInput(r, e) { const v = Number(e.target.value); s.set(r.key, r.kind === 'vol' ? v / 100 : v); }
function adjust(i, delta) {
  const r = rows[i]; if (!r) return;
  if (r.kind === 'range') s.set(r.key, clamp(s.state[r.key] + delta * r.step, r.min, r.max));
  else if (r.kind === 'vol') s.set(r.key, clamp(Math.round(s.state[r.key] * 100) + delta * 5, 0, 100) / 100);
  else if (r.kind === 'toggle') s.set(r.key, !s.state[r.key]);
}
function activate(i) { const r = rows[i]; if (r.kind === 'action') r.action(); else if (r.kind === 'toggle') s.set(r.key, !s.state[r.key]); }
const { index: fi } = useRovingFocus({ size: () => rows.length, onConfirm: activate, onAdjust: adjust, onCancel: back });

// tap calibration
function runCalibration() {
  const ctx = engine.ensure(); if (calib.running) return;
  calib.running = true; calib.taps = []; calib.clicks = []; calib.msg = 'Tap Space on each click…';
  const n = 8, gap = 0.6, start = ctx.currentTime + 0.6;
  for (let i = 0; i < n; i++) {
    const t = start + i * gap; calib.clicks.push(t);
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 1760; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.001); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.start(t); o.stop(t + 0.06);
  }
  setTimeout(finishCalibration, (0.6 + n * gap + 0.7) * 1000);
}
function onKey(e) { if (calib.running && e.code === 'Space') { e.preventDefault(); calib.taps.push(engine.ctx.currentTime); } }
window.addEventListener('keydown', onKey);
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
function finishCalibration() {
  calib.running = false; const dts = [];
  for (const tp of calib.taps) { let best = 1e9; for (const c of calib.clicks) { const d = tp - c; if (Math.abs(d) < Math.abs(best)) best = d; } if (Math.abs(best) < 0.4) dts.push(best); }
  if (dts.length < 3) { calib.msg = 'Not enough taps, try again.'; return; }
  dts.sort((a, b) => a - b); const med = dts[dts.length >> 1];
  const off = clamp(-Math.round(med * 1000), -100, 100);
  s.set('offsetMs', off); calib.msg = 'Offset set to ' + off + ' ms.';
}
</script>
