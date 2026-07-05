import { test } from 'node:test';
import assert from 'node:assert/strict';
import { base, blendPose } from '../src/avatar/pose.js';
import { MOVES, STUMBLE } from '../src/avatar/moves.js';
import { createDirector, tierFor, THRESH } from '../src/avatar/director.js';
import { armQuat } from '../src/avatar/retarget.js';
import * as THREE from 'three';

// The stage (three.js + WebGL) is exercised by the in-browser render check. These
// guard the pure pose math that feeds it: shape, finiteness, blending, tier gating,
// and the arm retarget quaternion, which is where a regression would silently break
// every avatar.

const KEYS = ['px', 'py', 'pz', 'yaw', 'pitch', 'roll', 'hips', 'chest', 'head', 'shL', 'shR', 'elL', 'elR', 'hipL', 'hipR', 'kneL', 'kneR', 'ankL', 'ankR', 'toeL', 'toeR'];

function finitePose(p, label) {
  for (const k of KEYS) {
    assert.ok(k in p, `${label}: missing ${k}`);
    const v = p[k];
    if (Array.isArray(v)) { assert.equal(v.length, 3, `${label}: ${k} not a 3-vector`); v.forEach((x) => assert.ok(Number.isFinite(x), `${label}: ${k} has NaN`)); }
    else assert.ok(Number.isFinite(v), `${label}: ${k} is NaN`);
  }
}

test('base() has the full joint schema and is finite', () => {
  finitePose(base(), 'base');
});

test('blendPose interpolates scalars and vectors at the midpoint', () => {
  const a = base(); const b = base();
  b.py = 1; b.head = [0.4, 0, 0.2]; b.elL = 1;
  const m = blendPose(a, b, 0.5);
  assert.equal(m.py, 0.5);
  assert.ok(Math.abs(m.elL - (a.elL + b.elL) / 2) < 1e-9); // midpoint elbow flexion
  assert.deepEqual(m.head, [0.2, 0, 0.1]);
  const at0 = blendPose(a, b, 0); assert.equal(at0.py, a.py);
  const at1 = blendPose(a, b, 1); assert.equal(at1.py, b.py);
});

test('every move returns a finite, complete pose across a full bar', () => {
  const all = MOVES.concat([STUMBLE]);
  for (const m of all) {
    for (let beat = 0; beat <= m.bars * 4 + 0.001; beat += 0.25) {
      const p = m.f(beat, base());
      finitePose(p, `${m.n}@${beat}`);
    }
  }
});

test('tierFor maps combo onto the five tiers by threshold', () => {
  assert.equal(tierFor(0), 0);
  assert.equal(tierFor(THRESH[1] - 1), 0);
  assert.equal(tierFor(THRESH[1]), 1);
  assert.equal(tierFor(THRESH[4]), 4);
  assert.equal(tierFor(1000), 4);
});

test('director produces finite poses and advances through moves deterministically', () => {
  // seeded rng so the run is reproducible and the moves actually cycle
  let s = 12345; const rng = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const d = createDirector({ rng });
  let switches = 0; let last = d.current();
  for (let beat = 0; beat < 64; beat += 0.5) {
    const p = d.update(beat, tierFor(beat), 1);
    finitePose(p, `dir@${beat}`);
    if (d.current() !== last) { switches++; last = d.current(); }
  }
  assert.ok(switches >= 2, 'director should switch moves over 16 bars');
});

test('armQuat composes the swing with the rest offset into a unit quaternion', () => {
  const CQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2);
  const q = armQuat([0.3, 0.1, 0.5], CQ);
  assert.ok(Math.abs(q.length() - 1) < 1e-6, 'quaternion is normalized');
  // a zero swing must reduce to exactly the rest offset CQ
  const rest = armQuat([0, 0, 0], CQ);
  assert.ok(Math.abs(rest.x - CQ.x) < 1e-6 && Math.abs(rest.w - CQ.w) < 1e-6, 'zero swing equals the rest offset');
});
