import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toSM, songToSM, parseSM, parseSimfile, parseSSC, toPackage, parsePackage } from '@doot-games/chart';

const chart = {
  bpm: 120, offset: 0, difficulty: 'expert', meter: 12,
  notes: [
    { t: 0.5, beat: 1, lane: 0, dur: 0, quant: 4, type: 'tap' },
    { t: 1.0, beat: 2, lane: 2, dur: 0, quant: 8, type: 'tap' },
    { t: 1.5, beat: 3, lane: 1, dur: 0.5, quant: 4, type: 'hold', endBeat: 4 }
  ]
};

test('a chart round trips through .sm', () => {
  const sm = toSM(chart);
  assert.ok(sm.includes('dance-single'));
  assert.ok(sm.includes('#BPMS:0.000=120.000'));
  const back = parseSM(sm);
  assert.equal(back.notes.length, 3);
  const lanes = back.notes.map((n) => n.lane).sort();
  assert.deepEqual(lanes, [0, 1, 2]);
  const hold = back.notes.find((n) => n.dur > 0);
  assert.ok(hold, 'hold should survive');
  assert.equal(hold.lane, 1);
  assert.equal(Math.round(hold.endBeat), 4);
});

test('note beats are preserved to the grid', () => {
  const back = parseSM(toSM(chart));
  const beats = back.notes.map((n) => Math.round(n.beat)).sort();
  assert.deepEqual(beats, [1, 2, 3]);
});

test('a whole song exports every difficulty under one header', () => {
  const easy = { ...chart, difficulty: 'basic', meter: 5, notes: chart.notes.slice(0, 1) };
  const rec = { title: 'Neon', artist: 'V', bpm: 120, offset: 0, charts: { basic: easy, expert: chart } };
  const sm = songToSM(rec);
  assert.equal(sm.match(/#TITLE:/g).length, 1, 'one song header');
  assert.equal(sm.match(/#NOTES:/g).length, 2, 'one notes block per difficulty');
  assert.ok(sm.includes('Hard') && sm.includes('Easy'), 'both difficulty classes present');
  assert.equal(parseSM(sm).notes.length, 1, 'the first chart parses back');
});

const SM_MULTI = `#TITLE:Multi;
#ARTIST:V;
#OFFSET:0.000;
#BPMS:0.000=120.000,4.000=240.000;
#STOPS:;

#NOTES:
     dance-single:
     :
     Easy:
     3:
     0,0,0,0,0:
1000
0000
0000
0000
,
1000
0000
0000
0000
;
#NOTES:
     dance-single:
     :
     Hard:
     10:
     0,0,0,0,0:
1000
0100
0010
0001
;`;

test('parseSimfile reads every dance-single difficulty from a .sm', () => {
  const song = parseSimfile(SM_MULTI);
  assert.equal(song.bpms.length, 2, 'both BPM segments parsed');
  assert.ok(song.charts.basic, 'Easy maps to basic');
  assert.ok(song.charts.expert, 'Hard maps to expert');
  assert.equal(song.charts.expert.notes.length, 4);
});

test('note times honor a BPM change', () => {
  const song = parseSimfile(SM_MULTI);
  const easy = song.charts.basic.notes; // taps at beat 0 and beat 4
  assert.equal(easy.length, 2);
  assert.equal(Math.round(easy[0].t * 1000), 0);      // beat 0 at t=0
  assert.equal(Math.round(easy[1].t * 1000), 2000);   // beat 4 at 4*0.5s, before the speed-up
});

test('exporting a variable-BPM chart preserves the tempo map', () => {
  const gimmick = {
    bpm: 120, offset: 0, difficulty: 'expert', meter: 12,
    bpms: [{ beat: 0, bpm: 120 }, { beat: 4, bpm: 180 }],
    stops: [{ beat: 8, seconds: 0.5 }],
    notes: [{ t: 0, beat: 0, lane: 0, dur: 0, quant: 4, type: 'tap' }]
  };
  const sm = toSM(gimmick);
  assert.ok(sm.includes('#BPMS:0.000=120.000,4.000=180.000'), 'both BPMs written');
  assert.ok(sm.includes('#STOPS:8.000=0.500'), 'the stop is written');
  const song = parseSimfile(sm);
  assert.equal(song.bpms.length, 2);
  assert.equal(song.stops.length, 1);
});

test('parseSSC reads a .ssc NOTEDATA block', () => {
  const ssc = `#VERSION:0.83;
#TITLE:SSC;
#OFFSET:0.000;
#BPMS:0.000=120.000;
#NOTEDATA:;
#STEPSTYPE:dance-single;
#DIFFICULTY:Challenge;
#METER:14;
#NOTES:
1000
0000
0000
0000
;`;
  const song = parseSSC(ssc);
  assert.ok(song.charts.challenge, 'Challenge chart present');
  assert.equal(song.charts.challenge.meter, 14);
  assert.equal(song.charts.challenge.notes.length, 1);
  assert.equal(parseSimfile(ssc).charts.challenge.notes.length, 1);
});

test('parseSSC honors a per-chart BPM override', () => {
  const ssc = `#VERSION:0.83;
#TITLE:Override;
#OFFSET:0.000;
#BPMS:0.000=100.000;
#NOTEDATA:;
#STEPSTYPE:dance-single;
#DIFFICULTY:Hard;
#METER:10;
#BPMS:0.000=200.000;
#NOTES:
1000
0000
1000
0000
;`;
  const song = parseSSC(ssc);
  assert.equal(song.bpm, 100, 'song-level BPM is the header value');
  const c = song.charts.expert;
  assert.equal(c.notes.length, 2);
  // the beat-2 note uses the per-chart 200 bpm (0.3 s/beat), so 0.6 s not 1.2 s
  assert.equal(Math.round(c.notes[1].t * 1000), 600);
});

test('a difficulty-class collision keeps both charts', () => {
  // Hard and Edit both map to expert; both must survive, in different slots
  const sm = `#TITLE:Collide;
#BPMS:0.000=120.000;
#NOTES:
     dance-single:
     :
     Hard:
     10:
     0,0,0,0,0:
1000
;
#NOTES:
     dance-single:
     :
     Edit:
     12:
     0,0,0,0,0:
0100
;`;
  const song = parseSimfile(sm);
  assert.equal(Object.keys(song.charts).length, 2, 'both charts kept, not collapsed');
  assert.equal(song.charts.expert.meter, 12, 'the harder chart holds the expert slot');
});

test('the native package round trips', () => {
  const rec = { id: 'x', title: 'Test', artist: 'A', bpm: 120, offset: 0, source: 'file', duration: 10, createdAt: 1, charts: { expert: chart } };
  const r2 = parsePackage(toPackage(rec));
  assert.equal(r2.title, 'Test');
  assert.equal(r2.charts.expert.notes.length, 3);
  assert.equal(r2.bpm, 120);
});
