// dancerClock: a plain, non-reactive frame clock the dancer stage reads each frame. It
// is written once per session loop iteration (three cheap number/bool writes), the same
// way the 60fps loop reads settings.speed directly. Kept out of Vue reactivity so the
// avatar canvas never triggers a component re-render. The stage derives tier, energy,
// and the beat pulse from these.

export const dancerClock = { beat: 0, combo: 0, playing: false };
