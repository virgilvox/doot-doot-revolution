// moves: the procedural dance library. Each move is f(beat, pose) -> pose, where
// beat is measured from when the move started. A move fills a pose the retarget
// then copies onto the rig. Moves are tagged with a tier t (0 cold .. 4 fever) and a
// length in bars; the director picks from the current tier and blends between them.
// Conventions match pose.js. Joint values stay in anatomical range so any avatar,
// robot or VRM, reads them the same. Ported from the SWIVEL reference rig.

import { S, C, BN, DIP, SM, CL, LP, L3, TAU } from './pose.js';

export const MOVES = [

  { n: 'SWAY', t: 0, bars: 2, f(b, p) {
    p.yaw = 0.07 * S(b, 0.25);
    p.hips[2] = 0.06 * S(b, 0.5); p.chest[2] = -0.05 * S(b, 0.5, 0.15);
    p.head[0] = 0.05 + 0.06 * S(b, 1, 0.2); p.head[2] = 0.05 * S(b, 0.5, 0.3);
    p.py = -0.035 + 0.02 * C(b, 1);
    p.kneL = p.kneR = 0.13 - 0.06 * C(b, 1);
    p.shL = [0.07 * S(b, 0.5), 0, 0.11]; p.shR = [-0.07 * S(b, 0.5), 0, -0.11];
    p.elL = p.elR = 0.25;
    p.ankL[0] = 0.1 * Math.max(0, S(b, 0.5, 0.25));
    p.ankR[0] = 0.1 * Math.max(0, S(b, 0.5, 0.75));
    p.ankL[2] = p.ankR[2] = 0.06 * S(b, 0.5);
    return p;
  } },

  { n: 'BOB', t: 0, bars: 2, f(b, p) {
    const d = DIP(b), hb = Math.max(0, -C(b, 1));
    p.py = -0.05 + 0.035 * C(b, 1);
    p.kneL = p.kneR = 0.16 - 0.08 * C(b, 1);
    p.chest[0] = 0.09 * d; p.head[0] = 0.14 * d - 0.03;
    p.hips[1] = 0.06 * S(b, 0.25);
    p.shL = [0.06 * d, 0, 0.10 + 0.05 * S(b, 0.5)];
    p.shR = [0.06 * d, 0, -0.10 - 0.05 * S(b, 0.5, 0.5)];
    p.elL = p.elR = 0.35 + 0.15 * d;
    p.ankL[0] = p.ankR[0] = 0.22 * hb;
    p.toeL = p.toeR = 0.12 * hb;
    return p;
  } },

  { n: 'STEP_TOUCH', t: 1, bars: 2, f(b, p) {
    const w = S(b, 0.5), d = DIP(b);
    p.px = 0.32 * w; p.py = -0.03 - 0.05 * d;
    p.yaw = -0.14 * w; p.hips[1] = 0.16 * w; p.hips[2] = 0.07 * w;
    p.chest[1] = -0.12 * w;
    p.head[1] = 0.12 * S(b, 0.5, 0.1); p.head[0] = 0.06 * d;
    p.shL = [0.35 * S(b, 0.5, 0.5), 0, 0.16]; p.shR = [0.35 * w, 0, -0.16];
    p.elL = p.elR = 0.55 + 0.2 * d;
    p.kneL = p.kneR = 0.14 + 0.1 * d;
    p.hipL[0] = 0.08 * w; p.hipR[0] = -0.08 * w;
    const tL = SM(CL(w * 1.6, 0, 1)), tR = SM(CL(-w * 1.6, 0, 1));
    p.ankL[0] = 0.6 * tL; p.toeL = 0.35 * tL; p.kneL += 0.3 * tL;
    p.ankR[0] = 0.6 * tR; p.toeR = 0.35 * tR; p.kneR += 0.3 * tR;
    p.ankL[2] = p.ankR[2] = -0.08 * w;
    return p;
  } },

  { n: 'SNAP_GROOVE', t: 1, bars: 2, f(b, p) {
    const w = S(b, 0.25), d = DIP(b);
    p.roll = 0.05 * w; p.px = 0.12 * w; p.py = -0.04 - 0.04 * d;
    p.hips[2] = 0.08 * w; p.chest[1] = 0.1 * S(b, 0.5);
    p.head[0] = 0.08 * d - 0.02; p.head[1] = 0.1 * w;
    p.shR = [0.25, 0, -1.35 - 0.12 * S(b, 0.5)]; p.elR = 1.15 + 0.3 * S(b, 0.5, 0.25);
    p.shL = [0.12, 0, 0.4]; p.elL = 1.0;
    p.kneL = p.kneR = 0.15 + 0.1 * d;
    p.ankL[0] = p.ankR[0] = 0.2 * d;
    p.ankL[2] = p.ankR[2] = -0.09 * w;
    p.toeR = 0.15 * d;
    return p;
  } },

  { n: 'CLAP_MARCH', t: 2, bars: 2, f(b, p) {
    const fl = Math.floor(((b % 4) + 4) % 4) % 2, bn = BN(b);
    const lifL = (1 - fl) * bn, lifR = fl * bn;
    p.hipL[0] = 0.95 * lifL; p.kneL = 1.55 * lifL + 0.15;
    p.hipR[0] = 0.95 * lifR; p.kneR = 1.55 * lifR + 0.15;
    p.py = -0.05 + 0.045 * bn; p.pitch = 0.04;
    p.hips[1] = 0.1 * S(b, 0.5, 0.5); p.chest[1] = 0.12 * S(b, 0.5);
    const swL = [0.5 * S(b, 0.5, 0.5), 0, 0.2], swR = [0.5 * S(b, 0.5), 0, -0.2];
    const c = fl * bn;
    p.shL = L3(swL, [0.95, 0, -0.32], c); p.shR = L3(swR, [0.95, 0, 0.32], c);
    p.elL = p.elR = LP(0.6, 1.15, c);
    p.head[0] = 0.1 * bn;
    p.ankL[0] = 0.75 * lifL; p.toeL = 0.3 * lifL;
    p.ankR[0] = 0.75 * lifR; p.toeR = 0.3 * lifR;
    return p;
  } },

  { n: 'TWIST', t: 2, bars: 2, f(b, p) {
    const tw = S(b, 1), fast = C(b, 2);
    p.yaw = 0.13 * tw; p.hips[1] = 0.55 * tw; p.chest[1] = -0.95 * tw; p.head[1] = 0.3 * tw;
    p.py = -0.1 - 0.035 * fast;
    p.kneL = p.kneR = 0.38 + 0.14 * fast;
    p.shL = [0.32 - 0.22 * tw, 0, 0.55 + 0.12 * tw]; p.elL = 1.4;
    p.shR = [0.32 + 0.22 * tw, 0, -0.55 + 0.12 * tw]; p.elR = 1.4;
    p.head[0] = 0.06;
    p.ankL[1] = p.ankR[1] = -0.4 * tw;      /* pivot on the balls of the feet */
    p.ankL[0] = p.ankR[0] = 0.18 + 0.1 * fast;
    return p;
  } },

  { n: 'WAVE_STEP', t: 2, bars: 2, f(b, p) {
    const d = DIP(b);
    p.px = 0.2 * S(b, 0.25); p.py = -0.04 - 0.04 * d;
    p.hips[2] = 0.1 * S(b, 0.5); p.chest[2] = 0.13 * S(b, 0.5, -0.13); p.head[2] = 0.15 * S(b, 0.5, -0.26);
    p.head[1] = 0.12 * S(b, 0.5, -0.2);
    p.shL = [0, 0, 1.15 + 0.42 * S(b, 0.5, -0.07)]; p.elL = 0.45 + 0.42 * S(b, 0.5, -0.2);
    p.shR = [0, 0, -1.15 + 0.42 * S(b, 0.5, -0.45)]; p.elR = 0.45 + 0.42 * S(b, 0.5, -0.58);
    p.kneL = p.kneR = 0.16 + 0.1 * d;
    p.hips[1] = 0.08 * S(b, 0.5, 0.1);
    p.ankL[0] = 0.25 * Math.max(0, S(b, 0.5, 0.4));
    p.ankR[0] = 0.25 * Math.max(0, S(b, 0.5, 0.9));
    p.ankL[2] = p.ankR[2] = 0.1 * S(b, 0.5, -0.2);
    return p;
  } },

  { n: 'HEEL_TOE', t: 2, bars: 2, f(b, p) {
    /* both feet alternate roles: one heel digs forward while the
       other toe taps behind, swapping every beat pair */
    const w = S(b, 0.5), hR = SM((w + 1) / 2), hL = 1 - hR, d = DIP(b);
    p.hipR[0] = LP(-0.14, 0.42, hR); p.kneR = LP(0.6, 0.1, hR) + 0.06;
    p.ankR[0] = LP(0.85, -0.5, hR);  p.toeR = LP(0.4, 0, hR);
    p.hipL[0] = LP(-0.14, 0.42, hL); p.kneL = LP(0.6, 0.1, hL) + 0.06;
    p.ankL[0] = LP(0.85, -0.5, hL);  p.toeL = LP(0.4, 0, hL);
    p.py = -0.06 - 0.03 * d; p.pitch = -0.03;
    p.hips[1] = 0.18 * w; p.chest[1] = -0.22 * w; p.head[1] = 0.14 * w;
    p.shL = [0.5 * w, 0, 0.25]; p.shR = [-0.5 * w, 0, -0.25];
    p.elL = p.elR = 0.95;
    p.head[0] = 0.07 * d;
    return p;
  } },

  { n: 'DISCO_POINT', t: 3, bars: 2, f(b, p) {
    const dd = S(b, 0.5), k = SM((dd + 1) / 2), d = DIP(b);
    p.shR = [0.2 + 0.5 * k, 0, 0.35 - 2.65 * k]; p.elR = 0.5 - 0.32 * k;
    p.shL = [0.3, 0, 0.5]; p.elL = 1.35;
    p.hips[2] = 0.16 * dd; p.hips[1] = 0.24 * dd; p.chest[1] = -0.14 * dd;
    p.head[1] = -0.32 * dd; p.head[0] = 0.14 - 0.3 * k;
    p.px = 0.13 * dd; p.yaw = 0.1 * dd; p.py = -0.03 - 0.06 * d;
    p.kneL = p.kneR = 0.14 + 0.12 * d;
    p.ankR[0] = 0.45 * k + 0.1 * d; p.toeR = 0.3 * k;
    p.ankL[2] = 0.1 * dd;
    return p;
  } },

  { n: 'RUNNING_MAN', t: 3, bars: 2, f(b, p) {
    const rm = (ph) => (ph < 1 ? 0.9 * Math.sin(ph * Math.PI) : -0.32 * Math.sin((ph - 1) * Math.PI));
    const kk = (ph) => (ph < 1 ? 1.65 * Math.sin(ph * Math.PI) + 0.2 : 0.2);
    const phL = ((b % 2) + 2) % 2, phR = (((b + 1) % 2) + 2) % 2;
    p.hipL[0] = rm(phL); p.kneL = kk(phL);
    p.hipR[0] = rm(phR); p.kneR = kk(phR);
    p.py = -0.07 - 0.06 * BN(b); p.pitch = 0.15;
    const sw = Math.sin(b * Math.PI);
    p.shL = [0.15 - 0.6 * sw, 0, 0.18]; p.shR = [0.15 + 0.6 * sw, 0, -0.18];
    p.elL = p.elR = 1.2; p.head[0] = 0.1;
    p.ankL[0] = CL((p.kneL - 0.2) * 0.45, 0, 0.7);   /* lifted foot points */
    p.ankR[0] = CL((p.kneR - 0.2) * 0.45, 0, 0.7);
    return p;
  } },

  { n: 'BODY_ROLL', t: 3, bars: 2, f(b, p) {
    const w = b * 0.5;
    p.chest[0] = 0.42 * S(w, 1); p.hips[0] = 0.32 * S(w, 1, -0.19); p.head[0] = 0.38 * S(w, 1, 0.16);
    p.py = -0.06 + 0.045 * S(w, 1, -0.35); p.pitch = 0.05;
    p.shL = [0.3 + 0.28 * S(w, 1, 0.1), 0, 0.7]; p.elL = 0.7 + 0.4 * S(w, 1, 0.19);
    p.shR = [0.3 + 0.28 * S(w, 1, 0.1), 0, -0.7]; p.elR = 0.7 + 0.4 * S(w, 1, 0.19);
    p.kneL = p.kneR = 0.32 + 0.18 * S(w, 1, -0.28);
    p.hips[1] = 0.12 * S(b, 0.25); p.yaw = 0.08 * S(b, 0.25);
    p.ankL[0] = p.ankR[0] = 0.3 * Math.max(0, S(w, 1, -0.5));  /* heels rise as the roll passes down */
    p.toeL = p.toeR = 0.15 * Math.max(0, S(w, 1, -0.55));
    return p;
  } },

  { n: 'KICK_STEP', t: 3, bars: 2, f(b, p) {
    /* charleston flavored: front kick right, settle, back flick left, settle */
    const ph = Math.floor(((b % 4) + 4) % 4), bn = BN(b), d = DIP(b);
    if (ph === 0) {
      p.hipR[0] = 1.0 * bn; p.kneR = 0.12 + 0.15 * (1 - bn); p.ankR[0] = 0.85 * bn; p.toeR = 0.3 * bn;
      p.pitch = -0.06 * bn; p.kneL = 0.3 * bn + 0.1; p.ankL[0] = -0.15 * bn;
    } else if (ph === 2) {
      p.hipL[0] = -0.5 * bn; p.kneL = 1.15 * bn + 0.1; p.ankL[0] = 0.6 * bn; p.toeL = 0.25 * bn;
      p.pitch = 0.07 * bn; p.kneR = 0.3 * bn + 0.1; p.ankR[0] = -0.12 * bn;
    } else {
      p.kneL = p.kneR = 0.16 + 0.12 * d; p.ankL[0] = p.ankR[0] = 0.15 * d;
    }
    p.py = -0.05 + 0.045 * bn * (ph % 2 === 0 ? 1 : 0) - 0.03 * d;
    const sw = S(b, 0.5);
    p.shL = [0.65 * sw, 0, 0.22]; p.shR = [-0.65 * sw, 0, -0.22]; p.elL = p.elR = 0.85;
    p.hips[1] = 0.12 * sw; p.head[1] = 0.1 * sw; p.head[0] = 0.05;
    return p;
  } },

  { n: 'SPIN_HIT', t: 4, bars: 2, f(b, p) {
    if (b < 2) {
      const k = SM(b / 2);
      p.yaw = -0.55 * k; p.py = -0.15 * k;
      p.kneL = p.kneR = 0.7 * k + 0.1;
      p.shL = [0.55 * k, 0, 0.3 - 0.5 * k]; p.shR = [0.55 * k, 0, -0.3 + 0.5 * k];
      p.elL = p.elR = 0.3 + 1.0 * k;
      p.head[1] = -0.3 * k; p.pitch = 0.06 * k;
      p.ankL[0] = p.ankR[0] = -0.12 * k;              /* coil */
    } else if (b < 4) {
      const s = SM((b - 2) / 2), q = Math.sin(s * Math.PI);
      p.yaw = -0.55 + s * (TAU + 0.55); p.py = -0.15 + 0.12 * q;
      p.hipL[0] = 0.5 * q; p.kneL = 1.5 * q + 0.1; p.kneR = 0.3;
      p.shL = [0.35, 0, 0.3]; p.shR = [0.35, 0, -0.3];
      p.elL = p.elR = 1.45;
      p.ankR[0] = 0.55;                            /* spins on the ball of the foot */
      p.ankL[0] = 0.55 + 0.3 * q;
    } else if (b < 6) {
      const h = SM(CL((b - 4) * 2, 0, 1)), d = DIP(b);
      p.shL = [0.12, 0, 2.05 * h + 0.3 * (1 - h)]; p.shR = [0.12, 0, -2.05 * h - 0.3 * (1 - h)];
      p.elL = p.elR = 0.15; p.head[0] = -0.22 * h;
      p.py = -0.02 - 0.05 * d;
      p.kneL = p.kneR = 0.12 + 0.1 * d;
      p.ankL[0] = p.ankR[0] = 0.1;
    } else {
      const d = DIP(b);
      p.py = -0.04 - 0.05 * d;
      p.kneL = p.kneR = 0.15 + 0.1 * d;
      p.shL = [0.3 * S(b, 0.5, 0.5), 0, 0.35]; p.shR = [0.3 * S(b, 0.5), 0, -0.35];
      p.elL = p.elR = 0.8;
      p.hips[1] = 0.12 * S(b, 0.5); p.head[0] = 0.06 * d;
      p.ankL[0] = p.ankR[0] = 0.2 * d;
    }
    return p;
  } },

  { n: 'JUMP_STAR', t: 4, bars: 2, f(b, p) {
    const jt = ((b % 4) + 4) % 4;
    if (jt < 0.5) {
      const k = jt / 0.5;
      p.py = -0.24 * k; p.kneL = p.kneR = 1.05 * k + 0.1;
      p.hipL[0] = 0.45 * k; p.hipR[0] = 0.45 * k;
      p.pitch = 0.12 * k;
      p.shL = [-0.55 * k, 0, 0.25]; p.shR = [-0.55 * k, 0, -0.25];
      p.elL = p.elR = 0.4;
      p.ankL[0] = p.ankR[0] = -0.35 * k;               /* crouch, shins forward */
    } else if (jt < 1.6) {
      const a = (jt - 0.5) / 1.1, q = Math.sin(a * Math.PI);
      p.py = LP(-0.24, 0, CL(a * 3, 0, 1)) + 0.95 * q;
      p.hipL = [0.1, 0, 0.5 * q]; p.hipR = [0.1, 0, -0.5 * q];
      p.kneL = p.kneR = 0.1;
      p.shL = [0.1, 0, 0.35 + 1.55 * q]; p.shR = [0.1, 0, -0.35 - 1.55 * q];
      p.elL = p.elR = 0.15;
      p.head[0] = -0.15 * q;
      p.ankL[0] = p.ankR[0] = 0.95 * q;                /* toes pointed hard in the air */
      p.toeL = p.toeR = 0.5 * q;
    } else if (jt < 2.1) {
      const l = (jt - 1.6) / 0.5, q = Math.sin(l * Math.PI);
      p.py = -0.16 * q; p.kneL = p.kneR = 0.85 * q + 0.1; p.pitch = 0.08 * q;
      p.shL = [0.2 * q, 0, 0.3]; p.shR = [0.2 * q, 0, -0.3];
      p.elL = p.elR = 0.5;
      p.ankL[0] = p.ankR[0] = -0.25 * q;               /* absorb the landing */
    } else {
      const d = DIP(jt), pm = Math.sin(jt * Math.PI);
      p.py = -0.04 - 0.05 * d;
      p.kneL = p.kneR = 0.15 + 0.1 * d;
      p.shL = [0.4 + 0.45 * pm, 0, 0.3]; p.shR = [0.4 - 0.45 * pm, 0, -0.3];
      p.elL = p.elR = 1.1;
      p.hips[1] = 0.1 * S(jt, 0.5); p.head[0] = 0.07 * d;
      p.ankL[0] = p.ankR[0] = 0.2 * d;
    }
    return p;
  } },

  { n: 'WINDMILL', t: 4, bars: 2, f(b, p) {
    if (b < 6) {
      const a = b * Math.PI, d = DIP(b);
      p.shL = [0.22, 0, a]; p.shR = [0.22, 0, a + Math.PI];
      p.elL = p.elR = 0.12;
      p.pitch = -0.07;
      p.hips[2] = 0.13 * S(b, 0.5); p.head[2] = 0.1 * S(b, 0.5, 0.25);
      p.py = -0.05 - 0.05 * d;
      p.kneL = p.kneR = 0.2 + 0.12 * d;
      p.px = 0.1 * S(b, 0.5, 0.25);
      p.ankL[0] = p.ankR[0] = 0.28 * d;
      p.ankL[2] = p.ankR[2] = -0.1 * S(b, 0.5, 0.25);
    } else {
      const d = SM((b - 6) / 1.2), dp = DIP(b);
      p.shL = [LP(0.22, 0.1, d), 0, 0.35 * d]; p.shR = [LP(0.22, 0.1, d), 0, -0.35 * d];
      p.elL = p.elR = LP(0.12, 0.7, d);
      p.py = -0.05 - 0.05 * dp;
      p.kneL = p.kneR = 0.2 + 0.1 * dp;
      p.hips[1] = 0.1 * S(b, 0.5) * d; p.head[0] = 0.06 * dp;
      p.ankL[0] = p.ankR[0] = 0.2 * dp;
    }
    return p;
  } }
];

// STUMBLE: a one-bar recovery wobble fired on a miss, damping to rest. Tier -1 keeps
// it out of the normal pool; the director plays it explicitly.
export const STUMBLE = { n: 'STUMBLE', t: -1, bars: 1, f(b, p) {
  const k = Math.exp(-b * 1.1), wob = Math.sin(b * 9) * k;
  p.pitch = 0.42 * k; p.yaw = 0.3 * wob; p.roll = 0.16 * Math.sin(b * 7) * k;
  p.px = 0.14 * wob; p.py = -0.13 * k;
  p.shL = [0.35 + 1.1 * Math.sin(b * 11) * k, 0, 0.75 * k + 0.15]; p.elL = 0.4;
  p.shR = [0.35 + 1.1 * Math.sin(b * 13 + 2) * k, 0, -0.75 * k - 0.15]; p.elR = 0.4;
  p.head[0] = 0.5 * k; p.head[2] = 0.15 * wob;
  p.hipR[0] = -0.5 * k; p.kneR = 0.3;
  p.hipL[0] = 0.15 * k; p.kneL = 0.55 * k + 0.15;
  p.ankL[0] = -0.4 * k; p.toeL = 0.3 * k;               /* caught a toe */
  p.ankR[0] = 0.35 * wob; p.ankR[2] = 0.15 * wob;
  return p;
} };
