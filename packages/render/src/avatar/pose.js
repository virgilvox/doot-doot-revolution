// pose: the pure math for the procedural dancer. No three.js, no DOM, so it is
// Node-testable. A pose is a plain object of joint values in a mocap-verified
// convention (positive shoulder and hip x swings forward, positive elbow and knee
// is natural flexion, ankle pitch positive points the toes down). moves.js writes
// these, retarget.js reads them onto a rig, and the director blends between them.

export const TAU = Math.PI * 2;

// beat-phased sine and cosine: S(beat, freq, phase) in turns, not radians, so a
// frequency of 0.5 is one full cycle every two beats.
export const S = (b, f, p) => Math.sin((b * f + (p || 0)) * TAU);
export const C = (b, f, p) => Math.cos((b * f + (p || 0)) * TAU);
// bounce: a rectified half-sine, one hump per beat.
export const BN = (b) => Math.abs(Math.sin(b * Math.PI));
// dip: a 0..1..0 knee-bend curve across one beat.
export const DIP = (b) => 0.5 - 0.5 * Math.cos((((b % 1) + 1) % 1) * TAU);
// smoothstep and the smoother quintic used for move-to-move handoffs.
export const SM = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
export const SS = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * x * (x * (x * 6 - 15) + 10));
export const CL = (x, a, b) => Math.max(a, Math.min(b, x));
export const LP = (a, b, t) => a + (b - a) * t;
export const L3 = (a, b, t) => [LP(a[0], b[0], t), LP(a[1], b[1], t), LP(a[2], b[2], t)];
// wrap an angle to (-pi, pi] so a blended rotation never takes the long way round.
export const W = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const fract = (x) => x - Math.floor(x);

// the rest pose every move starts from. px/py/pz and yaw/pitch/roll are root motion
// on the mount; the rest drive individual joints. Arms carry a small T-pose splay so
// a still avatar does not look pinned to its sides.
export const base = () => ({
  px: 0, py: 0, pz: 0, yaw: 0, pitch: 0, roll: 0,
  hips: [0, 0, 0], chest: [0, 0, 0], head: [0, 0, 0],
  shL: [0, 0, 0.09], shR: [0, 0, -0.09], elL: 0.18, elR: 0.18,
  hipL: [0, 0, 0], hipR: [0, 0, 0], kneL: 0.06, kneR: 0.06,
  ankL: [0, 0, 0], ankR: [0, 0, 0], toeL: 0, toeR: 0
});

// linear blend of two poses, per key, arrays componentwise. t=0 is a, t=1 is b.
export function blendPose(a, b, t) {
  const o = {};
  for (const k in a) {
    const av = a[k], bv = b[k];
    o[k] = Array.isArray(av) ? L3(av, bv, t) : LP(av, bv, t);
  }
  return o;
}
