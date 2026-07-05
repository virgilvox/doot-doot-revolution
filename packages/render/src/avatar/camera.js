// camera: the shot director. It cuts between framings every few bars and reframes the
// dancer. c:0 shots pin the dancer to the left or right third beside the note track by
// rig-shifting the camera laterally; c:1 shots frame center and closer, behind the lane
// band. Higher tiers unlock more dynamic shots. Each cut eases from the previous framing
// into the new one with a smootherstep (slow in, slow out) over CUT_DUR, so a cut reads
// as a graceful camera push rather than a snap, and shots run long enough that it never
// feels busy. Handheld sway and a beat-driven fov punch add life; a calm factor (reduced
// motion) damps both.

import * as THREE from 'three';
import { CL, SS, LP } from './pose.js';

// len is in beats; longer values mean fewer, calmer cuts. Slow moving shots (orbit,
// truck) run longest so their motion has room to breathe.
const SHOTS = [
  { n: 'WIDE',  c: 0, len: [6, 8],  fov: 48, hand: 0.22, minT: 0, f: (u, g, F, o) => { o.px = 0.3 * g; o.py = 1.65; o.pz = 6.6 - 1.0 * u; o.tx = F.x; o.ty = F.y + 0.05; o.tz = 0; o.roll = 0; } },
  { n: 'LOW',   c: 0, len: [6, 8],  fov: 56, hand: 0.35, minT: 0, f: (u, g, F, o) => { o.px = 1.5 * g; o.py = 0.55; o.pz = 4.4 - 0.6 * u; o.tx = F.x; o.ty = F.y + 0.25; o.tz = 0; o.roll = 0.04 * g; } },
  { n: 'TRUCK', c: 0, len: [8, 10], fov: 46, hand: 0.28, minT: 0, f: (u, g, F, o) => { o.px = g * (-2.4 + 1.8 * u); o.py = 1.3; o.pz = 3.4; o.tx = F.x; o.ty = F.y; o.tz = 0; o.roll = 0; } },
  { n: 'ORBIT', c: 0, len: [8, 12], fov: 48, hand: 0.28, minT: 0, f: (u, g, F, o) => { const a = g * (-0.6 + 1.1 * u); o.px = Math.sin(a) * 4.4; o.py = 1.9 - 0.35 * u; o.pz = Math.cos(a) * 4.4; o.tx = F.x; o.ty = F.y; o.tz = 0; o.roll = 0; } },
  { n: 'OVER',  c: 0, len: [4, 6],  fov: 52, hand: 0.3,  minT: 1, f: (u, g, F, o) => { o.px = 0.7 * g; o.py = 5.4 - 0.3 * u; o.pz = 2.9; o.tx = F.x; o.ty = 0.9; o.tz = 0; o.roll = 0.05 * g; } },
  { n: 'DUTCH', c: 0, len: [4, 6],  fov: 58, hand: 0.4,  minT: 1, f: (u, g, F, o) => { o.px = 1.9 * g; o.py = 0.7; o.pz = 3.2 - 0.3 * u; o.tx = F.x; o.ty = F.y + 0.15; o.tz = 0; o.roll = 0.13 * g; } },
  // c:1 shots frame the dancer centered and closer (larger), behind the translucent lane
  // band, like the swivel reference. Available from the start so the framing gets used.
  { n: 'CLOSE', c: 1, len: [5, 7],  fov: 38, hand: 0.45, minT: 0, f: (u, g, F, o) => { o.px = 0.35 * g; o.py = 1.55; o.pz = 2.8 - 0.2 * u; o.tx = F.x * 0.6; o.ty = F.hy; o.tz = 0; o.roll = 0.02 * g; } },
  { n: 'HERO',  c: 1, len: [6, 8],  fov: 34, hand: 0.32, minT: 0, f: (u, g, F, o) => { o.px = 0.15 * g; o.py = 1.15; o.pz = 3.1 - 0.2 * u; o.tx = 0; o.ty = 1.2; o.tz = 0; o.roll = 0; } },
  { n: 'PUNCH', c: 1, len: [5, 7],  fov: 42, hand: 0.28, minT: 1, f: (u, g, F, o) => { const e = 1 - (1 - u) * (1 - u); o.px = 0.2 * g; o.py = 1.42; o.pz = 6.0 - 3.0 * e; o.tx = F.x; o.ty = F.y + 0.1; o.tz = 0; o.roll = 0; } }
];

export function createCameraDirector(camera, opts) {
  const rng = (opts && opts.rng) || Math.random;
  let shot = SHOTS[0], cutBeat = 0, shotLen = 8, sgn = 1, lastShot = '', anchor = -1, lastSide = -1;
  const camO = { px: 0, py: 0, pz: 0, tx: 0, ty: 0, tz: 0, roll: 0 };
  // cur is the resolved framing rendered each frame; from is the framing frozen at the
  // last cut. The transition eases from -> shot over CUT_DUR with a smootherstep.
  const cur = { px: 0, py: 1.7, pz: 7, tx: 0, ty: 1, tz: 0, roll: 0, fov: 50 };
  const from = Object.assign({}, cur);
  const CUT_DUR = 0.8;
  let cutT = CUT_DUR; // start settled
  const tv = new THREE.Vector3();

  function cut(atBeat, tier) {
    const pool = SHOTS.filter((s) => s.minT <= tier && s.n !== lastShot);
    shot = pool[Math.floor(rng() * pool.length)] || SHOTS[0];
    lastShot = shot.n;
    sgn = rng() < 0.5 ? -1 : 1;
    if (shot.c) { anchor = 0; }
    else { lastSide = rng() < 0.45 ? -lastSide : lastSide; anchor = lastSide; } // stay a side more often
    let ln = shot.len[Math.floor(rng() * shot.len.length)];
    if (tier >= 4) ln = Math.max(4, ln * 0.8); // fever cuts a little sooner, not frantically
    if (tier <= 0) ln = Math.max(ln, 6);
    shotLen = ln; cutBeat = atBeat;
    // freeze the current framing so the ease starts exactly where the camera is now
    from.px = cur.px; from.py = cur.py; from.pz = cur.pz;
    from.tx = cur.tx; from.ty = cur.ty; from.tz = cur.tz;
    from.roll = cur.roll; from.fov = cur.fov;
    cutT = 0;
  }

  // beat: song beat. t: wall-clock seconds (sway). mount: {x,y} of the dancer root.
  // BP: beat pulse 0..1. calm: 0..1 sway/roll scale (1 normal, low for reduced motion).
  function update(beat, t, tier, energy, BP, mount, calm, dt) {
    const cf = calm == null ? 1 : calm;
    if (beat - cutBeat >= shotLen) cut(cutBeat + shotLen, tier);
    const u = CL((beat - cutBeat) / shotLen, 0, 1);
    const F = { x: mount.x * 0.55, y: 1.12 + mount.y * 0.5, hy: 1.56 + mount.y * 0.6 };
    shot.f(u, sgn, F, camO);
    let f = shot.fov;
    if (tier >= 2) f -= 4.0 * BP * (0.3 + 0.6 * energy);
    if (anchor !== 0) {
      // lateral rig shift: keep the dancer around 56 percent across, clear of the track
      const vx = camO.tx - camO.px, vy = camO.ty - camO.py, vz = camO.tz - camO.pz;
      const dist = Math.hypot(vx, vy, vz) || 1;
      const halfW = dist * Math.tan(f * Math.PI / 360) * camera.aspect;
      let rx = -vz, rz = vx;
      const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
      const sh = -anchor * 0.56 * halfW;
      camO.px += rx * sh; camO.pz += rz * sh; camO.tx += rx * sh; camO.tz += rz * sh;
    }
    // smootherstep ease from the pre-cut framing into the live shot
    cutT = Math.min(cutT + CL(dt || 0.016, 0, 0.1), CUT_DUR);
    const es = SS(cutT / CUT_DUR);
    cur.px = LP(from.px, camO.px, es); cur.py = LP(from.py, camO.py, es); cur.pz = LP(from.pz, camO.pz, es);
    cur.tx = LP(from.tx, camO.tx, es); cur.ty = LP(from.ty, camO.ty, es); cur.tz = LP(from.tz, camO.tz, es);
    cur.roll = LP(from.roll, camO.roll, es); cur.fov = LP(from.fov, f, es);
    const hs = 0.018 * shot.hand * (0.5 + 0.8 * energy) * cf;
    const hx = (Math.sin(t * 1.9) + 0.6 * Math.sin(t * 3.7 + 1.3)) * hs;
    const hy = (Math.sin(t * 2.3 + 0.7) + 0.6 * Math.sin(t * 4.1)) * hs;
    camera.position.set(cur.px + hx, cur.py + hy, cur.pz);
    tv.set(cur.tx + hx * 0.4, cur.ty + hy * 0.4, cur.tz);
    camera.lookAt(tv);
    camera.rotation.z += cur.roll * cf + Math.sin(t * 1.1) * 0.006 * shot.hand * cf;
    if (Math.abs(camera.fov - cur.fov) > 0.01) { camera.fov = cur.fov; camera.updateProjectionMatrix(); }
  }

  function reset(atBeat, tier) { lastShot = ''; cut(atBeat || 0, tier || 0); cutT = CUT_DUR; }
  return { update, reset };
}
