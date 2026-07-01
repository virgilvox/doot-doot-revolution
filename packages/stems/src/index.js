// stems: optional WebGPU drum-stem isolation. This is the one path that runs a
// real neural model in the browser, a source-separation model (Demucs) loaded
// over WebGPU. It is heavy and needs WebGPU plus cross-origin isolation, so it is
// feature detected and everything loads dynamically. On any failure it returns
// null, which signals the caller to fall back to charting the full mix.
//
// Nothing here runs unless isolateDrums is called, so consumers that do not use
// stems pay nothing.

const ORT_URL = 'https://esm.sh/onnxruntime-web@1.27.0/webgpu';
const DEMUCS_URL = 'https://esm.sh/demucs-web@1.0.2';

export function isSupported() {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

// Resample any buffer to stereo Float32 at 44.1 kHz using an OfflineAudioContext,
// the sample rate the model expects.
async function resampleStereo(buffer) {
  const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const off = new OC(2, Math.max(1, Math.ceil(buffer.duration * 44100)), 44100);
  const tmp = off.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  for (let c = 0; c < buffer.numberOfChannels; c++) tmp.copyToChannel(buffer.getChannelData(c), c);
  const src = off.createBufferSource(); src.buffer = tmp; src.connect(off.destination); src.start();
  const r = await off.startRendering();
  return { L: r.getChannelData(0).slice(0), R: r.getChannelData(r.numberOfChannels > 1 ? 1 : 0).slice(0) };
}

let _proc = null;
async function loadProcessor(onStatus, onProgress) {
  if (_proc) return _proc;
  const ort = await import(ORT_URL);
  const demucs = await import(DEMUCS_URL);
  try { ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/'; ort.env.wasm.numThreads = 1; } catch (e) {}
  const CONSTANTS = demucs.CONSTANTS;
  const proc = new demucs.DemucsProcessor({
    ort,
    sessionOptions: { executionProviders: ['webgpu'] },
    onProgress: (p) => { if (p && onProgress) onProgress(0.15 + 0.8 * (p.progress || 0)); if (p && onStatus && p.totalSegments) onStatus('separating ' + (p.currentSegment || 0) + '/' + p.totalSegments); },
    onDownloadProgress: (l, t) => { if (onStatus && t) onStatus('downloading model ' + Math.round(l / t * 100) + '%'); if (onProgress && t) onProgress(0.02 + 0.1 * (l / t)); }
  });
  if (onStatus) onStatus('fetching htdemucs weights (first run is large, then cached)');
  await proc.loadModel(CONSTANTS.DEFAULT_MODEL_URL);
  _proc = { proc, CONSTANTS };
  return _proc;
}

// Isolate the drum stem. Returns an AudioBuffer-like mono object of the drums, or
// null to signal the caller should fall back to the full mix. options:
// { onStatus(msg), onProgress(0..1) }.
export async function isolateDrums(buffer, options = {}) {
  if (!isSupported()) return null;
  try {
    const d = await loadProcessor(options.onStatus, options.onProgress);
    const st = await resampleStereo(buffer);
    const r = await d.proc.separate(st.L, st.R);
    const drums = r.drums || (d.CONSTANTS.TRACKS ? r[d.CONSTANTS.TRACKS[0]] : null);
    if (!drums || !drums.left) return null;
    const dl = drums.left, dr = drums.right || drums.left, n = dl.length, mono = new Float32Array(n);
    for (let i = 0; i < n; i++) mono[i] = 0.5 * (dl[i] + dr[i]);
    return { sampleRate: 44100, length: n, numberOfChannels: 1, duration: n / 44100, getChannelData: () => mono };
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('stem isolation unavailable, falling back to full mix', e);
    return null;
  }
}
