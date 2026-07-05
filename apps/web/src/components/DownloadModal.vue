<template>
  <!-- Desktop already has the app: no Download. Instead an Update button appears only when
       a newer release has been downloaded in the background and is ready to install. -->
  <button v-if="isDesktop && updateReady" class="dlbtn upd" @click="installUpdate" :title="updateVersion ? 'Restart to update to v' + updateVersion : 'Restart to update'" aria-label="Install update">
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="currentColor" d="M12 4V1L8 5l4 4V6a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z"/></svg>
    <span class="dlbtn-l">Update</span>
  </button>

  <!-- auto-update failed: send the user to the releases page to update by hand -->
  <button v-else-if="isDesktop && updateError" class="dlbtn" @click="openReleases" title="Open the releases page to update" aria-label="Get the update">
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="currentColor" d="M12 4V1L8 5l4 4V6a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z"/></svg>
    <span class="dlbtn-l">Update</span>
  </button>

  <template v-else-if="!isDesktop">
  <button class="dlbtn" @click="toggle" title="Download the desktop app" aria-label="Download the desktop app">
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="currentColor" d="M11 3h2v9.2l3.1-3.1 1.4 1.4L12 16.1 6.5 10.5l1.4-1.4L11 12.2V3zM5 19h14v2H5v-2z"/></svg>
    <span class="dlbtn-l">Download</span>
  </button>

  <teleport to="body">
    <div v-if="open" class="dl-scrim" @click.self="open = false">
      <div class="panel dl-card">
        <div class="dl-head">
          <div class="eyebrow">Get the desktop app</div>
          <button class="dl-x" @click="open = false" aria-label="Close">&times;</button>
        </div>
        <p class="dl-sub">Runs offline with your whole library, and imports audio straight from a URL or YouTube. The web version plays great too.</p>

        <div v-if="loading" class="dl-note">Loading the latest release&hellip;</div>
        <div v-else-if="error" class="dl-note">Couldn't reach GitHub. <a :href="RELEASES" target="_blank" rel="noopener noreferrer">Open the releases page &rarr;</a></div>
        <template v-else>
          <div class="dl-ver">Version {{ version }}</div>
          <div class="dl-grid">
            <a v-for="d in downloads" :key="d.label" class="dl-item" :href="d.url" target="_blank" rel="noopener noreferrer">
              <span class="dl-os" v-html="d.icon"></span>
              <span class="dl-txt"><b>{{ d.label }}</b><span class="dl-meta">{{ d.sub }}</span></span>
              <span class="dl-arrow">&darr;</span>
            </a>
          </div>
          <div class="dl-foot"><a :href="RELEASES" target="_blank" rel="noopener noreferrer">All downloads &amp; release notes &rarr;</a></div>
        </template>
      </div>
    </div>
  </teleport>
  </template>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';

// desktop exposes window.doot; the auto-updater pushes status here
const isDesktop = !!(window.doot && window.doot.isDesktop);
const updateReady = ref(false);
const updateError = ref(false);
const updateVersion = ref('');
function installUpdate() { if (window.doot && window.doot.installUpdate) window.doot.installUpdate(); }
function openReleases() { window.open(RELEASES, '_blank'); }
onMounted(() => {
  if (isDesktop && window.doot.onUpdate) window.doot.onUpdate((d) => {
    if (!d) return;
    if (d.version) updateVersion.value = d.version;
    if (d.state === 'ready') { updateReady.value = true; updateError.value = false; }
    else if (d.state === 'error') updateError.value = true;
  });
});

const REPO = 'virgilvox/doot-doot-revolution';
const RELEASES = `https://github.com/${REPO}/releases/latest`;
const API = `https://api.github.com/repos/${REPO}/releases/latest`;

// platform glyphs (inline, static -> safe to v-html)
const APPLE = '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M17.05 12.04c-.03-2.85 2.33-4.22 2.44-4.28-1.33-1.95-3.4-2.22-4.13-2.25-1.76-.18-3.43 1.04-4.32 1.04-.89 0-2.26-1.02-3.72-.99-1.91.03-3.68 1.11-4.66 2.82-1.99 3.45-.51 8.55 1.42 11.35.94 1.37 2.06 2.9 3.53 2.85 1.42-.06 1.95-.92 3.66-.92 1.71 0 2.19.92 3.69.89 1.53-.03 2.5-1.39 3.43-2.77 1.08-1.58 1.53-3.12 1.55-3.2-.03-.01-2.98-1.14-3.01-4.53zM14.13 4.36c.78-.95 1.31-2.27 1.17-3.58-1.13.05-2.49.75-3.3 1.7-.72.83-1.36 2.18-1.19 3.46 1.26.1 2.54-.64 3.32-1.58z"/></svg>';
const WIN = '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M3 5.4l8-1.1v7.2H3V5.4zM12 4.1L21 3v8.5h-9V4.1zM3 12.5h8v7.2l-8-1.1v-6.1zM12 12.5h9V21l-9-1.1v-7.4z"/></svg>';
const LINUX = '<svg viewBox="0 0 24 24" width="21" height="21"><path fill="currentColor" d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-6l1 3h2v1H7v-1h2l1-3H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm2.6 3.6L5.2 9l2.5 2.5L5.2 14l1.4 1.4 3.9-3.9-3.9-3.9zM12 14h5v1.6h-5V14z"/></svg>';

const open = ref(false);
const loading = ref(false);
const error = ref(false);
const version = ref('');
const downloads = ref([]);
let loaded = false;

const toggle = () => { open.value = !open.value; };

const mb = (n) => (n ? Math.round(n / 1048576) + ' MB' : '');
// map the release assets (named by artifactName in electron-builder.yml) to platforms
function classify(assets) {
  const pick = (re) => assets.find((a) => re.test(a.name));
  const rows = [
    ['macOS · Apple Silicon', /mac-arm64\.dmg$/i, APPLE],
    ['macOS · Intel', /mac-x64\.dmg$/i, APPLE],
    ['Windows', /win-.*\.exe$/i, WIN],
    ['Linux · AppImage', /linux-.*\.AppImage$/i, LINUX]
  ];
  const out = [];
  for (const [label, re, icon] of rows) { const a = pick(re); if (a) out.push({ label, sub: mb(a.size), url: a.browser_download_url, icon }); }
  return out;
}

async function load() {
  if (loaded) return;
  loading.value = true; error.value = false;
  try {
    const res = await fetch(API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    version.value = String(data.tag_name || '').replace(/^v/, '');
    downloads.value = classify(data.assets || []);
    if (!downloads.value.length) throw new Error('no assets');
    loaded = true;
  } catch (e) { error.value = true; } finally { loading.value = false; }
}
watch(open, (v) => { if (v) load(); });
</script>

<style scoped>
.dlbtn { display: inline-flex; align-items: center; gap: 6px; height: 40px; padding: 0 14px; border: 2px solid var(--ink); border-radius: 999px; background: var(--green); color: #fff; font-family: var(--fu); font-weight: 800; font-size: 13px; cursor: pointer; box-shadow: 0 3px 0 var(--ink-2); transition: transform .1s var(--sp), box-shadow .1s; }
.dlbtn:hover { transform: translateY(-1px); }
.dlbtn:active { transform: translateY(3px); box-shadow: 0 0 0 var(--ink-2); }
/* the desktop Update button pulses so a ready update is noticed */
.dlbtn.upd { animation: dl-upd 1.9s ease-in-out infinite; }
@keyframes dl-upd { 0%, 100% { box-shadow: 0 3px 0 var(--ink-2); } 50% { box-shadow: 0 3px 0 var(--ink-2), 0 0 16px rgba(53, 208, 127, .85); } }
.dlbtn svg { display: block; }
@media (max-width: 620px) { .dlbtn-l { display: none; } .dlbtn { padding: 0 11px; } }

.dl-scrim { position: fixed; inset: 0; z-index: 220; display: grid; place-items: center; background: rgba(20, 18, 44, .5); backdrop-filter: blur(4px); padding: 20px; }
.dl-card { width: min(440px, 96vw); display: flex; flex-direction: column; gap: 12px; }
.dl-head { display: flex; align-items: center; justify-content: space-between; }
.dl-x { border: none; background: none; font-size: 26px; line-height: 1; cursor: pointer; color: var(--ink); padding: 0 4px; }
.dl-sub { font-family: var(--fu); font-weight: 600; font-size: 13px; line-height: 1.5; color: #605d84; margin: -2px 0 2px; }
.dl-ver { font-family: var(--fu); font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; color: #9a97bd; }
.dl-note { font-family: var(--fu); font-weight: 700; font-size: 13px; color: #605d84; padding: 10px 0; }
.dl-grid { display: flex; flex-direction: column; gap: 8px; }
.dl-item { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border: 2px solid var(--ink); border-radius: var(--r2); background: #fff; text-decoration: none; color: var(--ink); box-shadow: 0 3px 0 var(--ink-2); transition: transform .1s var(--sp), box-shadow .1s; }
.dl-item:hover { transform: translateY(-1px); background: var(--cream); }
.dl-item:active { transform: translateY(3px); box-shadow: 0 0 0 var(--ink-2); }
.dl-os { display: grid; place-items: center; width: 26px; color: var(--ink); }
.dl-txt { display: flex; flex-direction: column; line-height: 1.2; }
.dl-txt b { font-family: var(--fd); font-weight: 800; font-size: 14px; }
.dl-meta { font-family: var(--fu); font-weight: 700; font-size: 11px; color: #9a97bd; }
.dl-arrow { margin-left: auto; font-family: var(--fd); font-weight: 800; font-size: 18px; color: var(--green); }
.dl-foot { text-align: center; font-family: var(--fu); font-weight: 700; font-size: 12px; }
.dl-foot a, .dl-note a { color: var(--blue); }
</style>
