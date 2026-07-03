// Cover gradient helpers so wheel cards, banners, and library rows share a look.
export const COVERS = ['--pink', '--purple', '--blue', '--teal', '--green', '--orange', '--red', '--yellow'];
export const covGrad = (i) => `linear-gradient(135deg,var(${COVERS[i % COVERS.length]}),var(${COVERS[(i + 3) % COVERS.length]}))`;
export function fmtTime(sec) { sec = Math.max(0, sec | 0); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
