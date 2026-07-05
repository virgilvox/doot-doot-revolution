// director: chooses and cycles the procedural moves and blends between them. Stateful
// but pure (no three.js, no DOM), so it is Node-testable. The stage calls update(beat,
// tier) each frame and gets a finished pose; a new move is picked when the current one
// runs out, and a wider smootherstep crossfade smooths the handoff versus the original
// hard smoothstep, which is the "refine and smooth" the brief asked for.

import { base, blendPose, SS, CL } from './pose.js';
import { MOVES, STUMBLE } from './moves.js';

// combo thresholds that gate the tier (0 cold .. 4 fever). energy = tier / 4.
export const THRESH = [0, 8, 24, 48, 80];
export function tierFor(combo) {
  for (let i = THRESH.length - 1; i >= 0; i--) if (combo >= THRESH[i]) return i;
  return 0;
}

// beats spent easing one move into the next. Longer than the reference's single beat
// so fast tiers do not snap between poses.
const BLEND_BEATS = 1.5;

export function createDirector(opts) {
  const rng = (opts && opts.rng) || Math.random;
  let curMove = MOVES[0], prevMove = null, curStart = 0, prevStart = 0, nextSwitch = 8, tier = 0;

  function pickMove(excl) {
    let pool = MOVES.filter((m) => m.t === tier && m.n !== excl);
    if (!pool.length) pool = MOVES.filter((m) => m.t === tier);
    // occasionally borrow a calmer move from the tier below for variety
    if (tier > 0 && rng() < 0.25) pool = pool.concat(MOVES.filter((m) => m.t === tier - 1));
    return pool[Math.floor(rng() * pool.length)];
  }
  function switchMove(m, atBeat) {
    prevMove = curMove; prevStart = curStart;
    curMove = m; curStart = atBeat;
    nextSwitch = atBeat + m.bars * 4;
  }
  // pull the next cut earlier, quantized to a 2-beat boundary (used on a tier change)
  function requestSwitch(beat) {
    nextSwitch = Math.min(nextSwitch, Math.ceil((beat + 0.01) / 2) * 2);
  }
  function forceStumble(beat) { switchMove(STUMBLE, beat); }

  // produce the pose for this beat. ampScale (0..1) lets the caller calm the whole
  // body for reduced motion; tier scales the natural amplitude toward full at fever.
  function update(beat, curTier, ampScale) {
    tier = curTier | 0;
    if (beat >= nextSwitch) switchMove(pickMove(curMove.n), nextSwitch);
    let p = curMove.f(beat - curStart, base());
    if (prevMove) {
      const t = SS(CL((beat - curStart) / BLEND_BEATS, 0, 1));
      if (t < 1) p = blendPose(prevMove.f(beat - prevStart, base()), p, t);
      else prevMove = null;
    }
    const amp = Math.min(0.8 + tier * 0.06, 1.05) * (ampScale == null ? 1 : ampScale);
    return blendPose(base(), p, amp);
  }
  function reset() { curMove = MOVES[0]; prevMove = null; curStart = 0; prevStart = 0; nextSwitch = 8; tier = 0; }
  const current = () => curMove.n;

  return { update, requestSwitch, forceStumble, reset, current };
}
