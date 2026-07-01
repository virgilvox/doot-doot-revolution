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

const ROWS_PER_MEASURE = 192, ROWS_PER_BEAT = 48;
const DIVISORS = [4, 8, 12, 16, 24, 32, 48, 64, 96, 192];

function quantOf(beat) { const subs = [1, 2, 3, 4, 6, 8, 12, 16]; for (let i = 0; i < subs.length; i++) { const d = subs[i]; if (Math.abs(beat * d - Math.round(beat * d)) < 0.02) return d; } return 16; }
function denomToNote(d) { return ({ 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48, 16: 64 })[d] || 64; }
function beatOf(note, offset, period) { return note.beat != null ? note.beat : (note.t - offset) / period; }
function safeName(s) { return (s || 'song').replace(/[^\w.-]+/g, '_'); }

// Serialize a chart to a StepMania .sm string. meta may override title, artist,
// and the music filename.
export function toSM(chart, meta = {}) {
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

  const title = meta.title || chart.title || 'Untitled', artist = meta.artist || chart.artist || 'DOOT';
  const music = safeName(meta.music || title) + (meta.musicExt || '.ogg');
  const diffClass = smDifficulty(chart.difficulty);
  let hdr = '#TITLE:' + title + ';\n#ARTIST:' + artist + ';\n#MUSIC:' + music + ';\n';
  hdr += '#OFFSET:' + (-offset).toFixed(3) + ';\n#BPMS:0.000=' + chart.bpm.toFixed(3) + ';\n#SELECTABLE:YES;\n\n';
  hdr += '//--------------- dance-single ---------------\n#NOTES:\n     dance-single:\n     ' + (meta.author || 'DOOT') + ':\n     ' + diffClass + ':\n     ' + (chart.meter || chart.foot || 1) + ':\n     0,0,0,0,0:\n';
  return hdr + body.join('\n,\n') + '\n;\n';
}

// StepMania difficulty class names. Our difficulty keys map onto them.
function smDifficulty(key) {
  return ({ beginner: 'Beginner', basic: 'Easy', difficult: 'Medium', expert: 'Hard', challenge: 'Challenge' })[key] || 'Medium';
}
function fromSmDifficulty(name) {
  return ({ Beginner: 'beginner', Easy: 'basic', Medium: 'difficult', Hard: 'expert', Challenge: 'challenge', Edit: 'expert' })[name] || 'difficult';
}

function tag(text, name) { const m = text.match(new RegExp('#' + name + ':([^;]*);', 'i')); return m ? m[1].trim() : null; }

// Parse a StepMania .sm string into a chart. Reads the first dance-single chart.
export function parseSM(text) {
  const title = tag(text, 'TITLE') || 'Untitled', artist = tag(text, 'ARTIST') || '';
  const smOffset = parseFloat(tag(text, 'OFFSET') || '0') || 0, offset = -smOffset;
  const bpmsRaw = tag(text, 'BPMS') || '0=120', firstBpm = parseFloat(bpmsRaw.split(',')[0].split('=')[1]) || 120;
  const period = 60 / firstBpm;

  // isolate the note data of the first #NOTES block: skip its 6 header fields.
  const idx = text.search(/#NOTES\s*:/i);
  let difficulty = 'difficult', notes = [];
  if (idx >= 0) {
    let rest = text.slice(text.indexOf(':', idx) + 1);
    const end = rest.indexOf(';'); if (end >= 0) rest = rest.slice(0, end);
    const parts = rest.split(':');
    // parts: [type, author, difficultyClass, meter, radar, noteData]
    if (parts.length >= 6) {
      difficulty = fromSmDifficulty((parts[2] || '').trim());
      const noteData = parts.slice(5).join(':');
      notes = parseMeasures(noteData, offset, period);
    }
  }
  return { title, artist, bpm: firstBpm, offset, difficulty, notes };
}

function parseMeasures(noteData, offset, period) {
  const measures = noteData.split(',');
  const notes = [], open = [null, null, null, null];
  for (let m = 0; m < measures.length; m++) {
    const lines = measures[m].split('\n').map((l) => l.trim()).filter((l) => /^[0-9MLFK]{4}$/.test(l));
    const rows = lines.length; if (!rows) continue;
    for (let r = 0; r < rows; r++) {
      const beat = m * 4 + (r / rows) * 4, line = lines[r];
      for (let lane = 0; lane < 4; lane++) {
        const ch = line[lane];
        if (ch === '1') notes.push(makeNote(beat, lane, offset, period));
        else if (ch === '2' || ch === '4') { const n = makeNote(beat, lane, offset, period, ch === '4' ? 'roll' : 'hold'); notes.push(n); open[lane] = n; }
        else if (ch === '3') { const n = open[lane]; if (n) { n.endBeat = beat; n.dur = (beat - n.beat) * period; open[lane] = null; } }
      }
    }
  }
  notes.sort((a, b) => a.t - b.t || a.lane - b.lane);
  return notes;
}
function makeNote(beat, lane, offset, period, type) {
  return { t: offset + beat * period, beat, lane, dur: 0, quant: denomToNote(quantOf(beat)), type: type || 'tap' };
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
