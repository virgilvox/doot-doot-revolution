// simfile: read and write StepMania .sm files and the native Doot song package.
// Pure string work, no DOM. The .sm path gives interoperability so charts open
// in StepMania and other tools; the native package gives a full-fidelity round
// trip including edits.
//
// Note characters follow the .sm spec: 0 empty, 1 tap, 2 hold head, 3 hold or
// roll tail, 4 roll head, M mine. Column order for dance-single is Left, Down,
// Up, Right. Measures are comma-delimited; each measure is four beats subdivided
// evenly by its row count, up to 192 rows. #OFFSET is written as the negative of
// the first-beat offset, matching StepMania where a negative offset means the
// audio leads in before beat 0.
//
// Reading honors the full tempo map: #BPMS with several segments and #STOPS are
// parsed, and each note's time comes from a createTiming map, so gimmick charts
// (BPM changes, stops) import with correct timing. Both .sm and the newer .ssc are
// supported. Only dance-single (4-panel) charts are read; mines, lifts, and fakes
// have no equivalent here and are dropped.

import { createTiming } from './charter.js';

const ROWS_PER_MEASURE = 192, ROWS_PER_BEAT = 48;
const DIVISORS = [4, 8, 12, 16, 24, 32, 48, 64, 96, 192];

function quantOf(beat) { const subs = [1, 2, 3, 4, 6, 8, 12, 16]; for (let i = 0; i < subs.length; i++) { const d = subs[i]; if (Math.abs(beat * d - Math.round(beat * d)) < 0.02) return d; } return 16; }
function denomToNote(d) { return ({ 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48, 16: 64 })[d] || 64; }
function beatOf(note, offset, period) { return note.beat != null ? note.beat : (note.t - offset) / period; }
function safeName(s) { return (s || 'song').replace(/[^\w.-]+/g, '_'); }

// The measure grid for one chart, serialized to the comma-delimited .sm body.
function chartBody(chart) {
  const period = 60 / chart.bpm, offset = chart.offset || 0;
  const grid = [];
  function ensure(meas) { while (grid.length <= meas) { const ra = []; for (let r = 0; r < ROWS_PER_MEASURE; r++) ra.push(['0', '0', '0', '0']); grid.push(ra); } }
  function setCell(beat, lane, ch) {
    let meas = Math.floor(beat / 4), within = beat - meas * 4, row = Math.round(within * ROWS_PER_BEAT);
    if (row >= ROWS_PER_MEASURE) { meas++; row -= ROWS_PER_MEASURE; }
    if (meas < 0 || row < 0) return;
    ensure(meas); grid[meas][row][lane] = ch;
  }
  for (const n of chart.notes) {
    const beat = beatOf(n, offset, period), lane = n.lane;
    if ((n.type === 'hold' || n.dur > 0) && (n.endBeat != null || n.dur > 0)) {
      const endBeat = n.endBeat != null ? n.endBeat : beat + n.dur / period;
      setCell(beat, lane, '2'); setCell(endBeat, lane, '3');
    } else setCell(beat, lane, '1');
  }
  if (!grid.length) ensure(0);

  const used = (row) => row[0] !== '0' || row[1] !== '0' || row[2] !== '0' || row[3] !== '0';
  const body = [];
  for (let m = 0; m < grid.length; m++) {
    const ra = grid[m]; let res = 192;
    for (let di = 0; di < DIVISORS.length; di++) {
      const dv = DIVISORS[di], sN = ROWS_PER_MEASURE / dv; let ok = true;
      for (let r = 0; r < ROWS_PER_MEASURE; r++) { if (used(ra[r]) && (r % sN) !== 0) { ok = false; break; } }
      if (ok) { res = dv; break; }
    }
    const lines = [], s2 = ROWS_PER_MEASURE / res;
    for (let r = 0; r < ROWS_PER_MEASURE; r += s2) lines.push(ra[r].join(''));
    body.push(lines.join('\n'));
  }
  return body.join('\n,\n');
}

// The tempo map as StepMania strings, so an imported gimmick chart round-trips
// instead of flattening to its first BPM on export.
function bpmsStr(chart) {
  const bpms = (chart.bpms && chart.bpms.length) ? chart.bpms : [{ beat: 0, bpm: chart.bpm }];
  return bpms.map((b) => b.beat.toFixed(3) + '=' + b.bpm.toFixed(3)).join(',');
}
function stopsStr(chart) {
  return (chart.stops || []).map((s) => s.beat.toFixed(3) + '=' + s.seconds.toFixed(3)).join(',');
}
// Song-level #TITLE / #ARTIST / #MUSIC / #OFFSET / #BPMS / #STOPS header, once.
function smHeader(chart, meta) {
  const title = meta.title || chart.title || 'Untitled', artist = meta.artist || chart.artist || 'DOOT';
  const music = safeName(meta.music || title) + (meta.musicExt || '.ogg');
  let hdr = '#TITLE:' + title + ';\n#ARTIST:' + artist + ';\n#MUSIC:' + music + ';\n';
  hdr += '#OFFSET:' + (-(chart.offset || 0)).toFixed(3) + ';\n#BPMS:' + bpmsStr(chart) + ';\n';
  const stops = stopsStr(chart); if (stops) hdr += '#STOPS:' + stops + ';\n';
  hdr += '#SELECTABLE:YES;\n\n';
  return hdr;
}

// One #NOTES chart section. A .sm may carry several, one per difficulty.
function smNotes(chart, meta) {
  const head = '//--------------- dance-single ---------------\n#NOTES:\n     dance-single:\n     ' + (meta.author || 'DOOT') + ':\n     ' + smDifficulty(chart.difficulty) + ':\n     ' + (chart.meter || chart.foot || 1) + ':\n     0,0,0,0,0:\n';
  return head + chartBody(chart) + '\n;\n';
}

// Serialize a single chart to a StepMania .sm string. meta may override title,
// artist, and the music filename.
export function toSM(chart, meta = {}) {
  return smHeader(chart, meta) + smNotes(chart, meta);
}

// Serialize a whole song record (its charts across difficulties) to one .sm file,
// the way StepMania groups difficulties under a single song header.
export function songToSM(record) {
  const entries = Object.entries(record.charts || {}).filter(([, c]) => c && c.notes && c.notes.length);
  if (!entries.length) return '';
  const meta = { title: record.title, artist: record.artist, music: record.title };
  const charts = entries.map(([key, c]) => ({ ...c, bpm: c.bpm || record.bpm, offset: c.offset != null ? c.offset : (record.offset || 0), difficulty: c.difficulty || key }));
  return smHeader(charts[0], meta) + charts.map((c) => smNotes(c, meta)).join('\n');
}

// StepMania difficulty class names. Our difficulty keys map onto them.
function smDifficulty(key) {
  return ({ beginner: 'Beginner', basic: 'Easy', difficult: 'Medium', expert: 'Hard', challenge: 'Challenge' })[key] || 'Medium';
}
function fromSmDifficulty(name) {
  return ({ Beginner: 'beginner', Easy: 'basic', Medium: 'difficult', Hard: 'expert', Challenge: 'challenge', Edit: 'expert' })[name] || 'difficult';
}

function tag(text, name) { const m = text.match(new RegExp('#' + name + ':([^;]*);', 'i')); return m ? m[1].trim() : null; }

// Parse a #BPMS or #STOPS body of "beat=value,beat=value,..." pairs.
function parseBpms(raw) {
  const out = [];
  for (const seg of (raw || '').split(',')) {
    const p = seg.split('='), beat = parseFloat(p[0]), bpm = parseFloat(p[1]);
    if (isFinite(beat) && isFinite(bpm) && bpm > 0) out.push({ beat, bpm });
  }
  if (!out.length) out.push({ beat: 0, bpm: 120 });
  return out.sort((a, b) => a.beat - b.beat);
}
function parseStops(raw) {
  const out = [];
  for (const seg of (raw || '').split(',')) {
    if (!seg.trim()) continue;
    const p = seg.split('='), beat = parseFloat(p[0]), seconds = parseFloat(p[1]);
    if (isFinite(beat) && isFinite(seconds) && seconds > 0) out.push({ beat, seconds });
  }
  return out.sort((a, b) => a.beat - b.beat);
}

function makeNote(beat, lane, timing, type) {
  return { t: timing.beatToTime(beat), beat, lane, dur: 0, quant: denomToNote(quantOf(beat)), type: type || 'tap' };
}

// Turn the comma-delimited measure rows of one dance-single chart into notes,
// timing each by the tempo map. Only 4-panel rows are read.
function parseMeasures(noteData, timing) {
  const measures = noteData.split(',');
  const notes = [], open = [null, null, null, null];
  for (let m = 0; m < measures.length; m++) {
    const lines = measures[m].split('\n').map((l) => l.trim()).filter((l) => /^[0-9MLFK]{4}$/.test(l));
    const rows = lines.length; if (!rows) continue;
    for (let r = 0; r < rows; r++) {
      const beat = m * 4 + (r / rows) * 4, line = lines[r];
      for (let lane = 0; lane < 4; lane++) {
        const ch = line[lane];
        if (ch === '1') notes.push(makeNote(beat, lane, timing));
        else if (ch === '2' || ch === '4') { const n = makeNote(beat, lane, timing, ch === '4' ? 'roll' : 'hold'); notes.push(n); open[lane] = n; }
        else if (ch === '3') { const n = open[lane]; if (n) { n.endBeat = beat; n.dur = timing.beatToTime(beat) - timing.beatToTime(n.beat); open[lane] = null; } }
      }
    }
  }
  notes.sort((a, b) => a.t - b.t || a.lane - b.lane);
  return notes;
}

function makeChart(diffClass, meter, notes, offset, bpms, stops) {
  return { difficulty: fromSmDifficulty(diffClass), foot: meter, meter, bpm: bpms[0].bpm, offset, bpms, stops, notes, count: notes.length };
}
const SLOTS = ['beginner', 'basic', 'difficult', 'expert', 'challenge'];
// Place a chart in its difficulty slot. Six StepMania classes fold onto five slots
// (Hard and Edit both map to expert), so on a collision keep the harder chart in
// the slot and move the other to the nearest free slot rather than dropping it.
// Only when all five slots are full is a chart lost.
function addChart(charts, c) {
  const k = c.difficulty;
  if (!charts[k]) { charts[k] = c; return; }
  const keep = c.meter >= charts[k].meter ? c : charts[k], move = keep === c ? charts[k] : c;
  charts[k] = keep;
  const i = SLOTS.indexOf(k);
  for (let d = 1; d < SLOTS.length; d++) {
    for (const j of [i + d, i - d]) {
      if (j >= 0 && j < SLOTS.length && !charts[SLOTS[j]]) { move.difficulty = SLOTS[j]; charts[SLOTS[j]] = move; return; }
    }
  }
}

// Parse an .sm file into a song record with every dance-single difficulty.
function parseSMSong(text) {
  const title = tag(text, 'TITLE') || 'Untitled', artist = tag(text, 'ARTIST') || '';
  const offset = -(parseFloat(tag(text, 'OFFSET') || '0') || 0);
  const bpms = parseBpms(tag(text, 'BPMS')), stops = parseStops(tag(text, 'STOPS'));
  const timing = createTiming({ offset, bpms, stops });
  const charts = {}, re = /#NOTES\s*:([\s\S]*?);/gi;
  let m;
  while ((m = re.exec(text))) {
    const parts = m[1].split(':');
    if (parts.length < 6 || (parts[0] || '').trim().toLowerCase() !== 'dance-single') continue;
    const notes = parseMeasures(parts.slice(5).join(':'), timing);
    if (notes.length) addChart(charts, makeChart((parts[2] || '').trim(), parseInt((parts[3] || '').trim(), 10) || 1, notes, offset, bpms, stops));
  }
  return { title, artist, bpm: bpms[0].bpm, offset, bpms, stops, music: tag(text, 'MUSIC') || '', charts };
}

// Parse an .ssc file. Timing lives in the header and may be overridden per chart.
export function parseSSC(text) {
  const title = tag(text, 'TITLE') || 'Untitled', artist = tag(text, 'ARTIST') || '';
  const songOffset = -(parseFloat(tag(text, 'OFFSET') || '0') || 0);
  const songBpms = parseBpms(tag(text, 'BPMS')), songStops = parseStops(tag(text, 'STOPS'));
  const charts = {};
  for (const sec of text.split(/#NOTEDATA\s*:/i).slice(1)) {
    if ((tag(sec, 'STEPSTYPE') || '').trim().toLowerCase() !== 'dance-single') continue;
    const notesRaw = tag(sec, 'NOTES'); if (!notesRaw) continue;
    const bpms = /#BPMS\s*:/i.test(sec) ? parseBpms(tag(sec, 'BPMS')) : songBpms;
    const stops = /#STOPS\s*:/i.test(sec) ? parseStops(tag(sec, 'STOPS')) : songStops;
    const offset = /#OFFSET\s*:/i.test(sec) ? -(parseFloat(tag(sec, 'OFFSET') || '0') || 0) : songOffset;
    const notes = parseMeasures(notesRaw, createTiming({ offset, bpms, stops }));
    if (notes.length) addChart(charts, makeChart((tag(sec, 'DIFFICULTY') || '').trim(), parseInt(tag(sec, 'METER') || '1', 10) || 1, notes, offset, bpms, stops));
  }
  return { title, artist, bpm: songBpms[0].bpm, offset: songOffset, bpms: songBpms, stops: songStops, music: tag(text, 'MUSIC') || '', charts };
}

// Parse either format into a song record. Detects .ssc by its #NOTEDATA blocks.
export function parseSimfile(text) {
  return /#NOTEDATA\s*:/i.test(text) ? parseSSC(text) : parseSMSong(text);
}

// Backward-compatible single-chart parse: the first dance-single chart found.
export function parseSM(text) {
  const song = parseSMSong(text), keys = Object.keys(song.charts);
  const c = keys.length ? song.charts[keys[0]] : { difficulty: 'difficult', notes: [] };
  return { title: song.title, artist: song.artist, bpm: song.bpm, offset: song.offset, bpms: song.bpms, stops: song.stops, difficulty: c.difficulty, notes: c.notes };
}

// Native song package: a JSON envelope for full-fidelity round trips including
// edits. Audio is carried as a base64 data URL when provided, or left out for a
// metadata-only package.
export function toPackage(record, opts = {}) {
  const song = {
    id: record.id, title: record.title, artist: record.artist, bpm: record.bpm,
    offset: record.offset, source: record.source, duration: record.duration, createdAt: record.createdAt
  };
  const pkg = { format: 'doot-package', version: 1, song, charts: record.charts || {} };
  if (opts.audio) pkg.audio = opts.audio;
  return JSON.stringify(pkg, null, opts.pretty ? 1 : 0);
}
export function parsePackage(json) {
  const pkg = typeof json === 'string' ? JSON.parse(json) : json;
  if (pkg.format !== 'doot-package') throw new Error('not a doot-package');
  const rec = Object.assign({}, pkg.song, { charts: pkg.charts || {} });
  if (pkg.audio) rec.audio = pkg.audio;
  return rec;
}
