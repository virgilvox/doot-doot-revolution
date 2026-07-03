import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Judge } from '@doot-games/play';

const chart = (ns) => ({ notes: ns });
const note = (t, lane) => ({ t, lane, dur: 0, quant: 4 });

test('appendNotes grows the note list and the accuracy denominator', () => {
  const j = new Judge(chart([note(1, 0)]), { endless: true });
  assert.equal(j.notes.length, 1);
  assert.equal(j.total, 1);
  j.appendNotes([note(2, 1), note(3, 2)]);
  assert.equal(j.notes.length, 3);
  assert.equal(j.total, 3);
});

test('pruneBefore drops only judged notes behind the cutoff, front-contiguous', () => {
  const j = new Judge(chart([note(1, 0), note(2, 1), note(5, 2)]), { endless: true });
  j.update(2.5); // notes at 1 and 2 sweep to miss (past the boo window); note at 5 stays
  const cut = j.pruneBefore(2.4);
  assert.equal(cut, 2, 'the two missed notes are pruned');
  assert.equal(j.notes.length, 1);
  assert.equal(j.notes[0].t, 5, 'the future note survives');
  assert.equal(j.total, 3, 'total never shrinks (judged notes stay counted)');
});

test('pruneBefore stops at the first unjudged note (never drops the future)', () => {
  const j = new Judge(chart([note(1, 0), note(2, 1)]), { endless: true });
  assert.equal(j.pruneBefore(10), 0);
  assert.equal(j.notes.length, 2);
});

test('endless score is monotonic points, not normalized accuracy', () => {
  const j = new Judge(chart([note(1, 0), note(1, 1)]), { endless: true });
  j.hit(0, 1.0); // marvelous
  const s1 = j.score;
  j.appendNotes([note(2, 2)]);
  j.hit(2, 2.0); // marvelous
  assert.ok(j.score > s1, 'score climbs as notes are hit, even as total grows');
});
