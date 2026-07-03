// Import StepMania simfiles into the library. A StepMania song is a folder holding
// a .sm or .ssc (the steps) plus its audio and art. This groups a flat file list
// by folder, so a single song folder or a whole pack (a folder of song folders)
// both import in one go. Each folder that has a simfile and an audio file becomes a
// library song, with every dance-single difficulty and the full tempo map, so
// BPM-change and stop charts play in sync.

import { parseSimfile } from '@doot-games/chart';
import { computeRadar } from '@doot-games/chart';
import { engine, library } from './singletons.js';

const AUDIO_RE = /\.(ogg|mp3|wav|m4a|aac|flac)$/i;
const SIM_RE = /\.(ssc|sm)$/i;

const relPath = (f) => f.webkitRelativePath || f.name;
const dirOf = (f) => { const p = relPath(f); const i = p.lastIndexOf('/'); return i >= 0 ? p.slice(0, i) : ''; };
function hash(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const idOf = (title, text) => 'sm-' + String(title || 'song').replace(/[^\w.-]+/g, '_').slice(0, 40) + '-' + hash(text).toString(36);

// Import a flat file list (a folder pick, or hand-picked files). Returns
// { imported, errors }.
export async function importSimfiles(fileList) {
  const files = Array.from(fileList || []);
  const byDir = new Map();
  for (const f of files) { const d = dirOf(f); if (!byDir.has(d)) byDir.set(d, []); byDir.get(d).push(f); }
  let imported = 0; const errors = [];
  for (const group of byDir.values()) {
    // prefer .ssc over .sm when a folder has both (it carries more)
    const sims = group.filter((f) => SIM_RE.test(f.name)).sort((a, b) => (/\.ssc$/i.test(b.name) ? 1 : 0) - (/\.ssc$/i.test(a.name) ? 1 : 0));
    if (!sims.length) continue;
    try { await importOne(sims[0], group); imported++; }
    catch (e) { errors.push(sims[0].name + ': ' + e.message); }
  }
  return { imported, errors };
}

async function importOne(simFile, group) {
  const text = await simFile.text();
  const song = parseSimfile(text);
  const diffs = Object.keys(song.charts);
  if (!diffs.length) throw new Error('no dance-single charts');

  let audioFile = song.music ? group.find((f) => f.name.toLowerCase() === song.music.toLowerCase()) : null;
  if (!audioFile) audioFile = group.find((f) => AUDIO_RE.test(f.name));
  if (!audioFile) throw new Error('no audio file alongside it');

  await engine.resume();
  const ab = await audioFile.arrayBuffer();
  const buf = await engine.decode(ab.slice(0));
  const duration = buf.duration;
  for (const k of diffs) { const c = song.charts[k]; c.duration = duration; c.radar = computeRadar(c); }

  const rec = {
    id: idOf(song.title, text), title: song.title || 'Untitled', artist: song.artist || '',
    bpm: song.bpm, offset: song.offset, bpms: song.bpms, stops: song.stops,
    source: 'stepmania', duration, createdAt: Date.now(),
    audio: new Blob([ab], { type: audioFile.type || 'audio/mpeg' }), charts: song.charts
  };
  await library.put(rec);
  return rec;
}
