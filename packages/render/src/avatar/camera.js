// camera: the shot director. It cuts between framings every few bars and reframes the
// dancer. c:0 shots pin the dancer to the left or right third beside the note track by
// rig-shifting the camera laterally; c:1 shots frame center and closer, behind the lane
// band. Higher tiers unlock more dynamic shots and cut faster. Handheld sway and a
// beat-driven fov punch add life; a calm factor (reduced motion) damps both. Ported
// from the SWIVEL reference director.

import * as THREE from 'three';
import { CL } from './pose.js';

const SHOTS = [
  { n: 'WIDE',  c: 0, len: [4, 8],    fov: 48, hand: 0.25, minT: 0, f: (u, g, F, o) => { o.px = 0.3 * g; o.py = 1.65; o.pz = 6.6 - 1.1 * u; o.tx = F.x; o.ty = F.y + 0.05; o.tz = 0; o.roll = 0; } },
  { n: 'LOW',   c: 0, len: [4, 4, 8], fov: 56, hand: 0.4,  minT: 0, f: (u, g, F, o) => { o.px = 1.6 * g; o.py = 0.5; o.pz = 4.4 - 0.8 * u; o.tx = F.x; o.ty = F.y + 0.25; o.tz = 0; o.roll = 0.05 * g; } },
  { n: 'TRUCK', c: 0, len: [4, 8],    fov: 46, hand: 0.3,  minT: 0, f: (u, g, F, o) => { o.px = g * (-3.0 + 2.2 * u); o.py = 1.3; o.pz = 3.2; o.tx = F.x; o.ty = F.y; o.tz = 0; o.roll = 0; } },
  { n: 'ORBIT', c: 0, len: [4, 8],    fov: 48, hand: 0.3,  minT: 0, f: (u, g, F, o) => { const a = g * (-0.8 + 1.5 * u); o.px = Math.sin(a) * 4.4; o.py = 1.9 - 0.45 * u; o.pz = Math.cos(a) * 4.4; o.tx = F.x; o.ty = F.y; o.tz = 0; o.roll = 0; } },
  { n: 'OVER',  c: 0, len: [2, 4],    fov: 52, hand: 0.35, minT: 1, f: (u, g, F, o) => { o.px = 0.7 * g; o.py = 5.6 - 0.4 * u; o.pz = 2.7; o.tx = F.x; o.ty = 0.9; o.tz = 0; o.roll = 0.06 * g; } },
  { n: 'DUTCH', c: 0, len: [2, 4],    fov: 60, hand: 0.55, minT: 1, f: (u, g, F, o) => { o.px = 2.0 * g; o.py = 0.6; o.pz = 3.2 - 0.4 * u; o.tx = F.x; o.ty = F.y + 0.15; o.tz = 0; o.roll = 0.16 * g; } },
  // c:1 shots frame the dancer centered and closer (larger), behind the translucent lane
  // band, like the swivel reference. Available from the start so the framing gets used.
  { n: 'CLOSE', c: 1, len: [3, 4],    fov: 38, hand: 0.6,  minT: 0, f: (u, g, F, o) => { o.px = 0.4 * g; o.py = 1.55; o.pz = 2.7 - 0.25 * u; o.tx = F.x * 0.6; o.ty = F.hy; o.tz = 0; o.roll = 0.02 * g; } },
  { n: 'HERO',  c: 1, len: [3, 4],    fov: 34, hand: 0.4,  minT: 0, f: (u, g, F, o) => { o.px = 0.15 * g; o.py = 1.15; o.pz = 3.0 - 0.3 * u; o.tx = 0; o.ty = 1.2; o.tz = 0; o.roll = 0; } },
  { n: 'PUNCH', c: 1, len: [3, 4],    fov: 42, hand: 0.3,  minT: 1, f: (u, g, F, o) => { const e = 1 - (1 - u) * (1 - u); o.px = 0.2 * g; o.py = 1.42; o.pz = 6.4 - 3.4 * e; o.tx = F.x; o.ty = F.y + 0.1; o.tz = 0; o.roll = 0; } }
];

export function createCameraDirector(camera, opts) {
  const rng = (opts && opts.rng) || Math.random;
  let shot = SHOTS[0], cutBeat = 0, shotLen = 8, sgn = 1, lastShot = '', anchor = -1, lastSide = -1;
  const camO = { px: 0, py: 0, pz: 0, tx: 0, ty: 0, tz: 0, roll: 0 };
  // smoothed camera state: the actual camera eases toward camO each frame so a cut reads
  // as a quick glide, never a hard jump. Snapped on reset.
  const cur = { px: 0, py: 1.7, pz: 7, tx: 0, ty: 1, tz: 0, roll: 0, fov: 50 };
  let primed = false;
  const tv = new THREE.Vector3();

  function cut(atBeat, tier) {
    const pool = SHOTS.filter((s) => s.minT <= tier && s.n !== lastShot);
    shot = pool[Math.floor(rng() * pool.length)] || SHOTS[0];
    lastShot = shot.n;
    sgn = rng() < 0.5 ? -1 : 1;
    if (shot.c) { anchor = 0; }
    else { lastSide = rng() < 0.72 ? -lastSide : lastSide; anchor = lastSide; }
    let ln = shot.len[Math.floor(rng() * shot.len.length)];
    if (tier >= 4) ln = Math.max(2, ln * 0.5);
    if (tier <= 0) ln = Math.max(ln, 4);
    shotLen = ln; cutBeat = atBeat;
  }

  // beat: song beat. t: wall-clock seconds (sway). mount: {x,y} of the dancer root.
  // BP: beat pulse 0..1. calm: 0..1 sway/roll scale (1 normal, low for reduced motion).
  function update(beat, t, tier, energy, BP, mount, calm, dt) {
    const cf = calm == null ? 1 : calm;
    if (beat - cutBeat >= shotLen) cut(cutBeat + shotLen, tier);
    const u = Math.max(0, Math.min(1, (beat - cutBeat) / shotLen));
    const F = { x: mount.x * 0.55, y: 1.12 + mount.y * 0.5, hy: 1.56 + mount.y * 0.6 };
    shot.f(u, sgn, F, camO);
    let f = shot.fov;
    if (tier >= 2) f -= 5.0 * BP * (0.35 + 0.65 * energy);
    if (anchor !== 0) {
      // lateral rig shift: keep the dancer around 56 percent across, clear of the track
      const vx = camO.tx - camO.px, vy = camO.ty - camO.py, vz = camO.tz - camO.pz;
      const dist = Math.hypot(vx, vy, vz) || 1;
      const halfW = dist * Math.tan(f * Math.PI / 360) * camera.aspect;
      let rx = -vz, rz = vx;
      const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
      const s = -anchor * 0.56 * halfW;
      camO.px += rx * s; camO.pz += rz * s; camO.tx += rx * s; camO.tz += rz * s;
    }
    // ease the smoothed state toward the shot; a cut becomes a fast glide, not a jump
    const tau = 0.17, k = primed ? (1 - Math.exp(-CL(dt || 0.016, 0.001, 0.1) / tau)) : 1;
    primed = true;
    cur.px += (camO.px - cur.px) * k; cur.py += (camO.py - cur.py) * k; cur.pz += (camO.pz - cur.pz) * k;
    cur.tx += (camO.tx - cur.tx) * k; cur.ty += (camO.ty - cur.ty) * k; cur.tz += (camO.tz - cur.tz) * k;
    cur.roll += (camO.roll - cur.roll) * k; cur.fov += (f - cur.fov) * k;
    const hs = 0.022 * shot.hand * (0.55 + 0.9 * energy) * cf;
    const hx = (Math.sin(t * 1.9) + 0.6 * Math.sin(t * 3.7 + 1.3)) * hs;
    const hy = (Math.sin(t * 2.3 + 0.7) + 0.6 * Math.sin(t * 4.1)) * hs;
    camera.position.set(cur.px + hx, cur.py + hy, cur.pz);
    tv.set(cur.tx + hx * 0.4, cur.ty + hy * 0.4, cur.tz);
    camera.lookAt(tv);
    camera.rotation.z += cur.roll * cf + Math.sin(t * 1.1) * 0.008 * shot.hand * cf;
    if (Math.abs(camera.fov - cur.fov) > 0.01) { camera.fov = cur.fov; camera.updateProjectionMatrix(); }
  }

  function reset(atBeat, tier) { lastShot = ''; primed = false; cut(atBeat || 0, tier || 0); }
  return { update, reset };
}
