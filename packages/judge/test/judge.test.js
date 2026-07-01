import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Judge, gradeFor, WINDOWS } from '@doot-games/judge';

const now = () => 0;

test('an on-time tap is Marvelous, a late one degrades', () => {
  const chart = { bpm: 120, offset: 0, notes: [{ t: 1, lane: 0, dur: 0, quant: 4 }] };
  let j = new Judge(chart, { now });
  assert.equal(j.hit(0, 1.0), 'marvelous');
  j = new Judge(chart, { now });
  assert.equal(j.hit(0, 1.0 + WINDOWS.great - 0.001), 'great');
});

test('an unhit note becomes a miss and breaks combo', () => {
  const chart = { bpm: 120, offset: 0, notes: [{ t: 1, lane: 0, dur: 0, quant: 4 }, { t: 2, lane: 1, dur: 0, quant: 4 }] };
  const j = new Judge(chart, { now });
  j.hit(0, 1.0);
  assert.equal(j.combo, 1);
  j.update(2.5, [false, false, false, false]);
  const r = j.results();
  assert.equal(r.counts.marvelous, 1);
  assert.equal(r.counts.miss, 1);
  assert.equal(j.combo, 0);
  assert.ok(!r.fullCombo);
});

test('a held freeze is counted, an early release is dropped', () => {
  const hc = { bpm: 120, offset: 0, notes: [{ t: 1, lane: 0, dur: 1, quant: 4 }] };
  const held = new Judge(hc, { now });
  held.hit(0, 1.0);
  held.update(1.5, [true, false, false, false]);
  held.update(2.01, [true, false, false, false]);
  assert.equal(held.holdsHeld, 1);
  assert.equal(held.holdsDropped, 0);

  const drop = new Judge(hc, { now });
  drop.hit(0, 1.0);
  drop.update(1.4, [false, false, false, false]);
  drop.update(1.8, [false, false, false, false]);
  assert.equal(drop.holdsDropped, 1);
});

test('a held freeze keeps its score bonus after a later judgment', () => {
  const chart = { bpm: 120, offset: 0, notes: [{ t: 1, lane: 0, dur: 1, quant: 4 }, { t: 3, lane: 1, dur: 0, quant: 4 }] };
  const j = new Judge(chart, { now });
  j.hit(0, 1.0);
  j.update(2.01, [true, false, false, false]);
  assert.equal(j.holdsHeld, 1);
  assert.ok(j.holdBonus > 0);
  const afterHold = j.score;
  j.hit(1, 3.0);
  assert.ok(j.score > afterHold, 'the later tap raises the score, keeping the hold bonus');
});

test('grade thresholds map accuracy to letters', () => {
  assert.equal(gradeFor(100), 'AAA');
  assert.equal(gradeFor(95), 'AA');
  assert.equal(gradeFor(85), 'A');
  assert.equal(gradeFor(10), 'D');
});
