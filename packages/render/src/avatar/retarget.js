// retarget: copy a procedural pose onto a VRM's normalized humanoid bones. The torso,
// head, legs, feet and toes share the rig's frame so their values copy across straight.
// The arms differ only by the T-pose rest: each upper arm rests along +/-X, so its pose
// quaternion is composed with a fixed quarter-turn about Z, and elbow flexion maps to a
// rotation about Y (sign per side). Uses three's math classes only; the quaternion
// composition (armQuat) is pure and unit-testable. applyVRMPose takes an optional weight
// so a caller can slerp the pose over whatever the clip mixer just wrote (smooth handoff
// between a mocap clip and the procedural rig with no pop).

import * as THREE from 'three';
import { W, CL } from './pose.js';

const CQ_L = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2);
const CQ_R = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
const YAX = new THREE.Vector3(0, 1, 0);
const XAX = new THREE.Vector3(1, 0, 0);
const eTmp = new THREE.Euler();
// distinct temporaries so a single apply pass never aliases its own working quaternion
const qEul = new THREE.Quaternion();
const qArm = new THREE.Quaternion();
const qAxis = new THREE.Quaternion();

// the shoulder quaternion for one arm: the pose swing composed with the rest offset.
// out is an optional target Quaternion to avoid allocation.
export function armQuat(sh, CQ, out) {
  const q = out || new THREE.Quaternion();
  eTmp.set(W(-sh[0]), W(sh[1]), W(sh[2]), 'XYZ');
  return q.setFromEuler(eTmp).multiply(CQ);
}

// cache the normalized humanoid bone nodes we drive, once per avatar.
export function cacheBones(vrm) {
  const g = (n) => vrm.humanoid.getNormalizedBoneNode(n);
  return {
    hips: g('hips'), spine: g('spine'), chest: g('chest'), neck: g('neck'), head: g('head'),
    lUA: g('leftUpperArm'), lLA: g('leftLowerArm'), rUA: g('rightUpperArm'), rLA: g('rightLowerArm'),
    lUL: g('leftUpperLeg'), lLL: g('leftLowerLeg'), lF: g('leftFoot'), lT: g('leftToes'),
    rUL: g('rightUpperLeg'), rLL: g('rightLowerLeg'), rF: g('rightFoot'), rT: g('rightToes')
  };
}

// write pose p onto the cached bones H. weight (default 1) blends toward the pose from
// whatever the bone already holds: 1 sets it exactly, values below 1 slerp so a mocap
// clip eases into the procedural rig. Spine mass splits across spine+chest and the head
// lean across neck+head when those bones exist, so the bend reads naturally.
export function applyVRMPose(H, p, weight) {
  const w = weight == null ? 1 : weight;
  const full = w >= 0.999;
  const put = (bone, x, y, z) => {
    if (!bone) return;
    eTmp.set(W(x), W(y), W(z), 'XYZ');
    if (full) bone.quaternion.setFromEuler(eTmp);
    else { qEul.setFromEuler(eTmp); bone.quaternion.slerp(qEul, w); }
  };
  const putQ = (bone, q) => { if (!bone) return; if (full) bone.quaternion.copy(q); else bone.quaternion.slerp(q, w); };
  const putAxis = (bone, axis, angle) => { if (!bone) return; qAxis.setFromAxisAngle(axis, angle); putQ(bone, qAxis); };

  put(H.hips, p.hips[0], p.hips[1], p.hips[2]);
  if (H.chest) {
    if (H.spine) put(H.spine, p.chest[0] * 0.55, p.chest[1] * 0.55, p.chest[2] * 0.55);
    put(H.chest, p.chest[0] * 0.45, p.chest[1] * 0.45, p.chest[2] * 0.45);
  } else if (H.spine) {
    put(H.spine, p.chest[0], p.chest[1], p.chest[2]);
  }
  if (H.neck && H.head) {
    put(H.neck, p.head[0] * 0.4, p.head[1] * 0.4, p.head[2] * 0.4);
    put(H.head, p.head[0] * 0.6, p.head[1] * 0.6, p.head[2] * 0.6);
  } else if (H.head) {
    put(H.head, p.head[0], p.head[1], p.head[2]);
  }

  putQ(H.lUA, armQuat(p.shL, CQ_L, qArm));
  putAxis(H.lLA, YAX, -CL(p.elL, 0, 2.6));
  putQ(H.rUA, armQuat(p.shR, CQ_R, qArm));
  putAxis(H.rLA, YAX, CL(p.elR, 0, 2.6));

  put(H.lUL, p.hipL[0], p.hipL[1], p.hipL[2]);
  putAxis(H.lLL, XAX, CL(p.kneL, 0, 2.5));
  put(H.lF, CL(p.ankL[0], -0.6, 1.1), p.ankL[1], CL(p.ankL[2], -0.35, 0.35));
  putAxis(H.lT, XAX, CL(p.toeL, -0.3, 1.0));

  put(H.rUL, p.hipR[0], p.hipR[1], p.hipR[2]);
  putAxis(H.rLL, XAX, CL(p.kneR, 0, 2.5));
  put(H.rF, CL(p.ankR[0], -0.6, 1.1), p.ankR[1], CL(p.ankR[2], -0.35, 0.35));
  putAxis(H.rT, XAX, CL(p.toeR, -0.3, 1.0));
}
