<template>
  <div class="view"><div class="view-inner">
    <div v-show="!reviewing">
      <div class="scr-head"><button class="btn white sm" @click="back">&larr; Back</button><h1>Add a Song</h1></div>
      <div class="add-body add-cols">
        <div class="panel">
          <span class="eyebrow">Source</span>
          <div class="drop" @click="$refs.file.click()" @dragover.prevent @drop.prevent="onDrop">
            <b>Drop an audio file</b>mp3 · wav · ogg · m4a, or click to browse. Decoded locally, nothing uploaded.
            <input ref="file" type="file" accept="audio/*" hidden @change="onFile">
          </div>
          <p v-if="plat.canImportUrl" class="hint">Desktop build: you can also import from a URL (fetched past the CORS wall).</p>
          <div v-if="plat.canImportUrl" class="url-row"><input class="input" v-model="url" placeholder="Paste a direct audio URL"><button class="btn blue sm" @click="fromUrl">Fetch</button></div>
          <span class="eyebrow" style="margin-top:2px">Import StepMania</span>
          <div class="drop" @click="$refs.simFolder.click()">
            <b>Import a simfile or pack</b>Pick a song folder or a whole pack folder. The .sm or .ssc and its audio import together, with every difficulty and any BPM changes.
            <input ref="simFolder" type="file" webkitdirectory hidden @change="onSimPick">
            <input ref="simFiles" type="file" accept=".sm,.ssc,audio/*" multiple hidden @change="onSimPick">
          </div>
          <p class="hint">No folder access? <button class="btn white sm" @click.stop="$refs.simFiles.click()">Choose files instead</button></p>
          <span class="eyebrow" style="margin-top:2px">Track</span>
          <div class="grid2">
            <div class="field"><label>Title</label><input class="input" v-model="meta.title"></div>
            <div class="field"><label>Artist</label><input class="input" v-model="meta.artist"></div>
            <div class="field"><label>BPM (detected)</label><input class="input" v-model="meta.bpm"></div>
            <div class="field"><label>Length</label><input class="input" :value="meta.len" readonly></div>
          </div>
        </div>
        <div class="panel">
          <span class="eyebrow">Chart engine</span>
          <div class="engines">
            <div v-for="(u, k) in ENGINE_UI" :key="k" class="engine" :class="{ on: engineSel === k }" @click="engineSel = k">
              <div class="en-ic" :style="{ background: `var(${u.color})` }">{{ u.ic }}</div>
              <div class="en-b"><div class="en-t">{{ ENGINES[k].name }}</div><div class="en-d">{{ ENGINES[k].desc }}</div></div>
              <div class="en-m"><span>{{ u.time }}</span><div class="emeter" :class="u.cls"><i v-for="n in 3" :key="n" :class="{ f: n <= u.q }"></i></div></div>
            </div>
          </div>
          <span class="eyebrow" style="margin-top:2px">Generate difficulties</span>
          <div class="gen-diffs">
            <button v-for="df in diffKeys" :key="df" class="gchip" :class="{ on: diffSet.has(df) }" :style="diffSet.has(df) ? { background: `var(${DIFF_VAR[df]})` } : {}" @click="toggleDiff(df)">{{ DIFFS[df].name }}</button>
          </div>
        </div>
        <div class="add-cta" style="grid-column:1/-1;display:flex;justify-content:flex-end;gap:10px">
          <button class="btn white" @click="back">Cancel</button>
          <button class="btn green" :disabled="!draft || running" @click="generate">GENERATE CHART</button>
        </div>
      </div>

      <div v-if="running || stages.length" class="panel" style="margin-top:14px">
        <div class="run-bar"><i :style="{ width: (bar * 100) + '%' }"></i></div>
        <div class="stages" style="margin-top:10px">
          <div v-for="(st, i) in stages" :key="i" class="stg" :class="st.state"><span class="tick">{{ st.tick }}</span><span class="lbl">{{ st.label }}</span></div>
        </div>
        <div v-if="done" class="res-cta" style="margin-top:12px"><button class="btn green sm" @click="openReview">Review &amp; edit</button></div>
      </div>
    </div>

    <div v-if="reviewing" class="review">
      <div class="add-top" style="border-radius:var(--r2);border:3px solid var(--ink)">
        <h1>REVIEW &amp; EDIT</h1>
        <div class="right" style="gap:8px">
          <span class="sortpill">{{ enginePath }}</span>
          <button class="btn white sm" @click="reviewing = false">Back</button>
          <button class="btn green sm" @click="save">Save to Library</button>
        </div>
      </div>
      <div class="ed-mount"><ChartEditor ref="editor" :charts="draft.charts" :difficulty="firstDiff" :audio-buffer="draft.buffer" :audio-context="ctx" @change="onEdit" /></div>
    </div>
  </div></div>
</template>

<script setup>
import { reactive, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { analyze, estimateTempo } from '@doot-games/analysis';
import { DIFFS } from '@doot-games/charter';
import { ENGINES, generate as pipelineGenerate } from '@doot-games/pipeline';
import { computeRadar } from '@doot-games/radar';
import { DIFF_VAR } from '@doot-games/ui';
import ChartEditor from '../components/ChartEditor.vue';
import { engine } from '../game/singletons.js';
import { importSimfiles } from '../game/importSimfile.js';
import { useLibraryStore } from '../stores/library.js';
import { usePlatform } from '../composables/usePlatform.js';
import { useScope } from '../composables/useNavigation.js';
import { toast } from '../game/toast.js';
import { fmtTime } from '../game/covers.js';

const router = useRouter();
const plat = usePlatform();
const lib = useLibraryStore();
const ctx = engine.ensure();

const ENGINE_UI = {
  quick: { ic: 'Q', color: '--green', time: '~5s', q: 2, cls: '' },
  drum: { ic: 'D', color: '--blue', time: '~15s', q: 2, cls: '' },
  stem: { ic: 'S', color: '--purple', time: '~60s', q: 3, cls: 'q' }
};
const STAGE_LABELS = ['Decode & resample', 'Detect tempo', 'Isolate drums · WebGPU', 'Place steps per subdivision', 'Balance feet & write .doot'];
const STAGE_INDEX = { decode: 0, tempo: 1, isolate: 2, place: 3, balance: 4 };
const diffKeys = Object.keys(DIFFS);

const draft = ref(null);
const meta = reactive({ title: 'Untitled', artist: 'Unknown', bpm: '-', len: '-' });
const engineSel = ref('drum');
const diffSet = reactive(new Set(['basic', 'difficult', 'expert']));
const url = ref('');
const running = ref(false);
const done = ref(false);
const bar = ref(0);
const stages = ref([]);
const reviewing = ref(false);
const enginePath = ref('drum-aware');
const editor = ref(null);
const firstDiff = computed(() => (draft.value && draft.value.charts && draft.value.charts.expert) ? 'expert' : (draft.value ? Object.keys(draft.value.charts)[0] : 'basic'));

function back() { router.push({ name: 'select' }); }
function toggleDiff(df) { if (diffSet.has(df)) diffSet.delete(df); else diffSet.add(df); }

async function loadBuffer(buf, name) {
  const an = analyze(buf), tp = estimateTempo(an);
  draft.value = { buffer: buf, analysis: an, tempo: tp, charts: {} };
  meta.title = name || 'Untitled'; meta.bpm = String(Math.round(tp.bpm)); meta.len = fmtTime(buf.duration);
  done.value = false; stages.value = [];
  toast('Loaded · ~' + Math.round(tp.bpm) + ' BPM · ' + fmtTime(buf.duration));
}
async function onFile(e) { const f = e.target.files[0]; if (f) await decodeFile(f); }
async function onDrop(e) { const f = e.dataTransfer.files[0]; if (f) await decodeFile(f); }
async function onSimPick(e) {
  const files = e.target.files; if (!files || !files.length) return;
  toast('Importing simfiles...');
  try {
    const { imported, errors } = await importSimfiles(files);
    if (imported) { toast('Imported ' + imported + ' song' + (imported === 1 ? '' : 's')); router.push({ name: 'library' }); }
    else toast(errors[0] ? ('Import: ' + errors[0]) : 'No simfiles found in that selection');
  } catch (err) { console.error(err); toast('Import failed'); }
  e.target.value = '';
}
async function decodeFile(f) { try { await engine.resume(); const buf = await engine.decode(await f.arrayBuffer()); await loadBuffer(buf, f.name.replace(/\.[^.]+$/, '')); draft.value.file = f; } catch (err) { console.error(err); toast('Could not decode this file'); } }
async function fromUrl() { if (!url.value) return; try { const ab = await plat.fetchAudio(url.value); const buf = await engine.decode(ab.slice(0)); await loadBuffer(buf, url.value.split('/').pop() || 'Track'); draft.value.file = new Blob([ab], { type: 'audio/mpeg' }); } catch (err) { toast('Fetch failed: ' + err.message); } }

function setStage(i, state, tick, label) { const s = stages.value[i]; if (!s) return; s.state = state; if (tick) s.tick = tick; if (label) s.label = label; }
async function generate() {
  const d = draft.value; if (!d) { toast('Load a file first'); return; }
  const diffs = [...diffSet]; if (!diffs.length) { toast('Pick at least one difficulty'); return; }
  running.value = true; done.value = false; bar.value = 0;
  stages.value = STAGE_LABELS.map((l, i) => ({ label: l, tick: String(i + 1), state: '' }));
  if (engineSel.value !== 'stem') setStage(2, 'skip', '-', 'Isolate drums · not needed');
  const bpm = parseFloat(meta.bpm) || d.tempo.bpm;
  const hooks = { stage: (name) => { const i = STAGE_INDEX[name]; if (i != null) setStage(i, 'run'); }, progress: (p) => { bar.value = Math.max(0, Math.min(1, p)); }, status: (msg) => setStage(2, 'run', null, 'Isolate drums · ' + msg) };
  try {
    const out = await pipelineGenerate({ buffer: d.buffer, analysis: d.analysis, tempo: d.tempo, title: meta.title }, { engine: engineSel.value, difficulties: diffs, bpm, seed: meta.title }, hooks);
    d.charts = out.charts; enginePath.value = out.engineUsed;
    stages.value.forEach((st, i) => { if (st.state !== 'skip') setStage(i, 'done'); });
    bar.value = 1; done.value = true;
  } catch (err) { console.error(err); toast('Charting failed: ' + err.message); }
  running.value = false;
}

function openReview() { reviewing.value = true; }
function onEdit(charts) { draft.value.charts = charts; }
async function save() {
  const charts = editor.value ? editor.value.getCharts() : draft.value.charts;
  Object.keys(charts).forEach((df) => { charts[df].radar = computeRadar(charts[df]); charts[df].count = charts[df].notes.length; });
  const bpm = parseFloat(meta.bpm) || draft.value.tempo.bpm;
  const rec = { id: 'song-' + Date.now(), title: meta.title || 'Untitled', artist: meta.artist || 'Unknown', bpm, offset: draft.value.tempo.offset || 0, source: 'file', createdAt: Date.now(), duration: draft.value.buffer.duration, audio: draft.value.file || null, charts };
  await lib.put(rec); toast('Saved to library'); router.push({ name: 'library' });
}

useScope({ cancel: () => { if (reviewing.value) reviewing.value = false; else back(); } });
</script>

<style scoped>
.add-cols { padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
@media (max-width: 860px) { .add-cols { grid-template-columns: 1fr; } }
.ed-mount { border: 3px solid var(--ink); border-radius: var(--r2); background: var(--paper); padding: 12px; margin-top: 10px; height: clamp(320px, 60vh, 560px); }
.review { display: flex; flex-direction: column; gap: 10px; }
</style>
