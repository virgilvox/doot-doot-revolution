import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composePiece, chartFromPiece, mixSeed, DIFFS } from '@doot-games/chart';

test('composePiece is deterministic for a seed', () => {
  const a = composePiece('pulse', 12345, { bpm: 130, targetSeconds: 40 });
  const b = composePiece('pulse', 12345, { bpm: 130, targetSeconds: 40 });
  assert.equal(a.tempo, 130);
  assert.equal(a.totalBars, b.totalBars);
  assert.equal(a.rootPc, b.rootPc);
  assert.deepEqual(a.bars, b.bars);
  assert.deepEqual(a.events, b.events);
});

test('composePiece forces a dance tempo and fills a target length', () => {
  const p = composePiece('circuit', 7, { bpm: 150, targetSeconds: 60 });
  assert.equal(p.tempo, 150);
  const secs = p.totalSteps * (60 / 150 / 4);
  assert.ok(secs > 45 && secs < 80, 'length near target, got ' + secs.toFixed(1));
  assert.ok(p.events.kick && Object.keys(p.events.kick).length > 0, 'has drums');
});

test('chartFromPiece scales with difficulty and yields valid, sorted notes', () => {
  const piece = composePiece('circuit', 999, { bpm: 150, targetSeconds: 45 });
  const basic = chartFromPiece(piece, 'basic');
  const difficult = chartFromPiece(piece, 'difficult');
  const expert = chartFromPiece(piece, 'expert');

  assert.ok(basic.notes.length > 0, 'basic has notes');
  assert.ok(difficult.notes.length >= basic.notes.length, 'difficult denser than basic');
  assert.ok(expert.notes.length >= difficult.notes.length, 'expert denser than difficult');

  assert.equal(basic.foot, DIFFS.basic.foot);
  assert.equal(expert.foot, DIFFS.expert.foot);

  for (const n of expert.notes) {
    assert.ok(n.lane >= 0 && n.lane <= 3, 'lane in range');
    assert.ok([4, 8, 16].includes(n.quant), 'valid quant');
    assert.ok(n.t >= 0 && Number.isFinite(n.t), 'finite time');
    if (n.type === 'hold') assert.ok(n.endBeat > n.beat && n.dur > 0, 'hold has tail');
  }
  for (let i = 1; i < expert.notes.length; i++) assert.ok(expert.notes[i].t >= expert.notes[i - 1].t, 'sorted by time');

  // notes-per-second stays under the difficulty cap
  const nps = expert.count / expert.duration;
  assert.ok(nps <= DIFFS.expert.maxNps + 0.5, 'respects maxNps, got ' + nps.toFixed(2));
  assert.ok(expert.radar && expert.radar.stream >= 0, 'has a radar');
});

test('composePiece builds fixed-length evolving chunks (the perpetual stream)', () => {
  let prev = null;
  for (let i = 0; i < 6; i++) {
    const p = composePiece('pulse', mixSeed(1234, i), { bpm: 140, bars: 8, rootPc: 2, intensity: 0.72, sectionIndex: (i % 3) + 1, evolveFrom: prev });
    assert.equal(p.totalBars, 8, 'chunk is exactly the requested bar count');
    assert.ok(p.events.kick && Object.keys(p.events.kick).length > 0, 'chunk has drums (not treated as an intro)');
    const ch = chartFromPiece(p, 'expert');
    assert.ok(ch.notes.length > 0, 'chunk charts to steps');
    for (const n of ch.notes) assert.ok(n.lane >= 0 && n.lane <= 3);
    prev = p.summary;
  }
});

test('chartFromPiece is deterministic', () => {
  const piece = composePiece('neon', 42, { bpm: 132, targetSeconds: 30 });
  const a = chartFromPiece(piece, 'difficult');
  const b = chartFromPiece(piece, 'difficult');
  assert.deepEqual(a.notes, b.notes);
});
