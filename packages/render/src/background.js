// background: a seeded generative fragment-shader background, adapted from the
// spline engine. A grammar assembles a GLSL fragment shader from field generators
// (fbm, ridged, voronoi, rings, plasma, cells, waves, swirl, gyroid, truchet, flow),
// domain warp, an optional blend layer, IQ cosine palettes, modulation and post. The
// structure bakes once when you compose (so there is no mid-play recompile hitch);
// motion and slow evolution ride animated uniforms, so it morphs continuously. Same
// concept as the generative music: seeded, deterministic, endlessly evolving. Pure
// WebGL, framework-agnostic — the app wraps it in a component behind the notefield.

/* ---- rng + hashing ---- */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function pick(rng, w) { let s = 0; for (const x of w) s += x; let r = rng() * s; for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; } return w.length - 1; }
function rng_range(rng, a, b) { return a + rng() * (b - a); }
function f(x) { let s = (+x).toFixed(4); if (!/[.]/.test(s)) s += '.0'; return s; }
function v3(r, g, b) { return `vec3(${f(r)},${f(g)},${f(b)})`; }

const FIELD_NAMES = ['fbm', 'ridged', 'voronoi', 'rings', 'plasma', 'cells', 'waves', 'swirl', 'gyroid', 'truchet', 'flow'];
// Trypophobia-safe: voronoi (idx 2), cells (5) and truchet (9) are removed from every
// mood (weight 0) because they cluster holes/bumps; their weight is redistributed to the
// smooth flowing fields (fbm, plasma, swirl, gyroid, flow). rings (3) is kept only at a
// low weight and softened. Palettes raise the trough (a vs b) so no channel clamps to a
// pure-black hole center, cap the colour frequency c <= 1.0, and drop scanlines/heavy
// grain that add a stippled lattice.
export const BG_MOODS = [
  { name: 'AURORA', fieldW: [4, 1, 0, 1, 3, 0, 2, 3, 2, 0, 4], pal: { a: [.45, .45, .35], b: [.50, .50, .40], c: [1, 1, .80], d: [0, .25, .55] }, zoom: 1.4, rot: .05, warp: .9, fScale: 2.0, drift: .12, cScale: 1.1, cShift: .05, gamma: 1.2, vig: .30, grain: .05, scan: false, scanAmt: 0 },
  { name: 'NOCTURNE', fieldW: [6, 1, 0, 1, 2, 0, 1, 2, 1, 0, 3], pal: { a: [.28, .28, .36], b: [.32, .24, .40], c: [1, 1, 1], d: [0, .15, .42] }, zoom: 1.6, rot: .03, warp: .6, fScale: 2.2, drift: .08, cScale: 1.0, cShift: .03, gamma: 1.4, vig: .42, grain: .05, scan: false, scanAmt: 0 },
  { name: 'MAGMA', fieldW: [2, 5, 0, 1, 3, 0, 1, 1, 2, 0, 2], pal: { a: [.50, .28, .22], b: [.42, .28, .18], c: [1, .85, .60], d: [0, .10, .20] }, zoom: 1.8, rot: .02, warp: .7, fScale: 3.0, drift: .10, cScale: 1.15, cShift: .04, gamma: 1.6, vig: .40, grain: .05, scan: false, scanAmt: 0 },
  { name: 'GLASS', fieldW: [2, 1, 0, 2, 3, 0, 3, 2, 3, 0, 2], pal: { a: [.50, .50, .55], b: [.45, .45, .50], c: [1, 1, 1], d: [.10, .22, .35] }, zoom: 1.5, rot: .06, warp: .5, fScale: 2.4, drift: .07, cScale: 1.2, cShift: .05, gamma: 1.1, vig: .35, grain: .04, scan: false, scanAmt: 0 },
  { name: 'VAPOR', fieldW: [4, 0, 0, 1, 3, 0, 2, 2, 1, 0, 4], pal: { a: [.60, .50, .60], b: [.35, .30, .35], c: [.80, .90, 1], d: [.20, .42, .62] }, zoom: 1.3, rot: .04, warp: .8, fScale: 1.8, drift: .09, cScale: 1.0, cShift: .06, gamma: 1.0, vig: .28, grain: .05, scan: false, scanAmt: 0 },
  { name: 'CIRCUIT', fieldW: [2, 2, 0, 1, 3, 0, 2, 2, 3, 0, 3], pal: { a: [.30, .40, .40], b: [.30, .50, .45], c: [1, 1, .90], d: [.20, .42, .22] }, zoom: 2.0, rot: .03, warp: .6, fScale: 3.2, drift: .10, cScale: 1.15, cShift: .04, gamma: 1.5, vig: .40, grain: .05, scan: false, scanAmt: 0 },
  { name: 'OCEAN', fieldW: [2, 1, 0, 1, 2, 0, 3, 3, 1, 0, 4], pal: { a: [.25, .35, .40], b: [.30, .40, .45], c: [1, 1, .90], d: [.10, .35, .60] }, zoom: 1.5, rot: .04, warp: .9, fScale: 2.1, drift: .11, cScale: 1.1, cShift: .05, gamma: 1.2, vig: .33, grain: .05, scan: false, scanAmt: 0 },
  { name: 'ACID', fieldW: [2, 1, 0, 1, 2, 0, 3, 2, 4, 0, 2], pal: { a: [.55, .50, .45], b: [.45, .50, .50], c: [1.0, 1.0, 1.0], d: [0, .25, .50] }, zoom: 1.6, rot: .06, warp: .8, fScale: 2.6, drift: .12, cScale: 1.1, cShift: .07, gamma: 1.2, vig: .30, grain: .05, scan: false, scanAmt: 0 },
  { name: 'SOLAR', fieldW: [2, 1, 0, 1, 4, 0, 3, 1, 3, 0, 3], pal: { a: [.60, .40, .20], b: [.40, .40, .20], c: [1, 1, .60], d: [0, .12, .25] }, zoom: 1.5, rot: .03, warp: .7, fScale: 2.2, drift: .10, cScale: 1.2, cShift: .05, gamma: 1.3, vig: .34, grain: .05, scan: false, scanAmt: 0 },
  { name: 'EMBER', fieldW: [3, 4, 0, 1, 2, 0, 1, 2, 1, 0, 2], pal: { a: [.45, .28, .12], b: [.45, .32, .15], c: [1, .90, .70], d: [0, .10, .20] }, zoom: 1.6, rot: .03, warp: .7, fScale: 2.5, drift: .09, cScale: 1.2, cShift: .04, gamma: 1.5, vig: .40, grain: .05, scan: false, scanAmt: 0 }
];
const MOOD_SALT = [0x9e3779b1, 0x85ebca77, 0xc2b2ae3d, 0x27d4eb2f, 0x165667b1, 0x3b97a19b, 0x452821e6, 0x38d01377, 0xbe5466cf, 0x34e90c6c];

const PREAMBLE = `precision highp float;
uniform float time; uniform vec2 resolution; varying vec2 vTextureCoord;
uniform float u_zoom,u_rotSpeed,u_warp,u_fScale,u_drift,u_cScale,u_cShift,u_gamma,u_sym,u_chroma,u_hue,u_layer,u_vig,u_grain,u_scan,u_bright;
float hash21(vec2 p){ p=fract(p*vec2(123.34,345.45)); p+=dot(p,p+34.345); return fract(p.x*p.y); }
vec2 hash22(vec2 p){ float n=sin(dot(p,vec2(41.0,289.0))); return fract(vec2(262144.0,32768.0)*n); }
float vnoise(vec2 p){ vec2 i=floor(p),fp=fract(p); vec2 u=fp*fp*(3.0-2.0*fp);
  float a=hash21(i),b=hash21(i+vec2(1.0,0.0)),c=hash21(i+vec2(0.0,1.0)),d=hash21(i+vec2(1.0,1.0));
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y); }
float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<6;i++){ v+=a*vnoise(p); p*=2.0; a*=0.5; } return v; }
float ridged(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<6;i++){ v+=a*(1.0-abs(vnoise(p)*2.0-1.0)); p*=2.02; a*=0.5; } return v; }
float voronoi(vec2 p){ vec2 n=floor(p),fp=fract(p); float md=8.0;
  for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){ vec2 g=vec2(float(i),float(j)); vec2 o=hash22(n+g); vec2 r=g+o-fp; md=min(md,dot(r,r)); } return sqrt(md); }
float voronoiEdge(vec2 p){ vec2 n=floor(p),fp=fract(p); float f1=8.0,f2=8.0;
  for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){ vec2 g=vec2(float(i),float(j)); vec2 o=hash22(n+g); float d=dot(g+o-fp,g+o-fp); if(d<f1){f2=f1;f1=d;} else if(d<f2){f2=d;} } return sqrt(f2)-sqrt(f1); }
vec2 rot(vec2 p,float a){ float s=sin(a),c=cos(a); return mat2(c,-s,s,c)*p; }
vec2 kaleido(vec2 p,float n){ float a=atan(p.y,p.x); float r=length(p); float seg=6.28318530718/n; a=mod(a,seg); a=abs(a-seg*0.5); return vec2(cos(a),sin(a))*r; }
vec3 palette(float t,vec3 a,vec3 b,vec3 c,vec3 d){ return a+b*cos(6.28318530718*(c*t+d)); }`;

const VERT = `attribute vec2 a_pos; varying vec2 vTextureCoord;
void main(){ vTextureCoord=a_pos*0.5+0.5; gl_Position=vec4(a_pos,0.0,1.0); }`;

const FALLBACK_MAIN = `void main(){ vec2 uv=(vTextureCoord*resolution-0.5*resolution)/resolution.y;
  float fld=fbm(uv*3.0+time*0.1); vec3 col=palette(fld,vec3(0.5),vec3(0.5),vec3(1.0),vec3(0.0,0.33,0.67));
  gl_FragColor=vec4(col*u_bright,1.0); }`;

function buildFragSource(state) {
  const rng = mulberry32((state.seed ^ MOOD_SALT[state.moodIndex % MOOD_SALT.length]) >>> 0);
  const M = BG_MOODS[state.moodIndex];
  const jit = amt => (rng() * 2 - 1) * amt;
  const PA = v3(M.pal.a[0], M.pal.a[1], M.pal.a[2]);
  const PB = v3(M.pal.b[0] + jit(0.06), M.pal.b[1] + jit(0.06), M.pal.b[2] + jit(0.06));
  const PC = v3(M.pal.c[0] + jit(0.08), M.pal.c[1] + jit(0.08), M.pal.c[2] + jit(0.08));
  const PD = v3(M.pal.d[0] + jit(0.10), M.pal.d[1] + jit(0.10), M.pal.d[2] + jit(0.10));
  const R = state.rack, S = [];
  S.push(`vec2 uv=(vTextureCoord*resolution-0.5*resolution)/resolution.y;`);
  S.push(`vec2 p=uv*u_zoom;`);
  S.push(`p=rot(p,time*u_rotSpeed);`);
  if (R.symmetry) { const m = pick(rng, [3, 1, 1, 2]); if (m === 0) S.push(`p=kaleido(p,max(2.0,floor(u_sym)));`); else if (m === 1) S.push(`p.x=abs(p.x);`); else if (m === 2) S.push(`p=abs(p);`); else S.push(`p=abs(mod(p,2.0)-1.0);`); }
  if (R.warp) { const w = pick(rng, [4, 2, 2]); if (w === 0) { S.push(`p+=u_warp*vec2(fbm(p*1.7+7.1),fbm(p*1.7+13.7+time*u_drift*0.6));`); S.push(`p+=(u_warp*0.5)*vec2(fbm(p*3.3+2.0),fbm(p*3.3+9.0-time*u_drift*0.4));`); } else if (w === 1) { S.push(`p+=u_warp*0.3*vec2(sin(p.y*6.0+time*u_drift*3.0),sin(p.x*6.0-time*u_drift*3.0));`); } else { S.push(`p=rot(p,u_warp*1.4/(0.25+length(p)));`); } }
  const fieldName = FIELD_NAMES[pick(rng, M.fieldW)];
  S.push(`float fld;`);
  if (fieldName === 'fbm') S.push(`fld=fbm(p*u_fScale+vec2(1.3,4.7)+time*u_drift);`);
  else if (fieldName === 'ridged') S.push(`fld=ridged(p*u_fScale+time*u_drift);`);
  else if (fieldName === 'voronoi') S.push(`fld=voronoi(p*u_fScale+time*u_drift);`);
  else if (fieldName === 'rings') S.push(`fld=0.5+0.4*sin(length(p)*u_fScale*0.45-time*u_drift*2.0+fbm(p*1.5)*5.0);`);
  else if (fieldName === 'plasma') S.push(`fld=0.5+0.5*sin(p.x*u_fScale+time*u_drift)*cos(p.y*u_fScale-time*u_drift*0.8)+0.35*fbm(p*u_fScale*0.5);`);
  else if (fieldName === 'cells') S.push(`fld=1.0-voronoiEdge(p*u_fScale+time*u_drift);`);
  else if (fieldName === 'waves') S.push(`fld=0.5+0.5*(sin(p.x*u_fScale+time*u_drift)+sin(p.y*u_fScale*0.9-time*u_drift*0.8))*0.5;`);
  else if (fieldName === 'swirl') S.push(`fld=fbm(rot(p,length(p)*2.0+time*u_drift)*u_fScale);`);
  else if (fieldName === 'gyroid') S.push(`{ float gx=sin(p.x*u_fScale)*cos(p.y*u_fScale); float gy=sin(p.y*u_fScale)*cos(p.x*u_fScale); fld=0.5+0.4*sin((gx+gy)*1.4+time*u_drift); }`);
  else if (fieldName === 'truchet') S.push(`{ vec2 gp=p*u_fScale; vec2 gc=floor(gp); vec2 gf=fract(gp)-0.5; float rr=step(0.5,hash21(gc)); vec2 ctr=mix(vec2(-0.5),vec2(0.5),rr); float bd=smoothstep(0.62,0.38,abs(length(gf-ctr)-0.5)*4.0); fld=0.5+0.5*sin(bd*6.28318-time*u_drift*2.0); }`);
  else S.push(`{ vec2 q=vec2(fbm(p*u_fScale+time*u_drift),fbm(p*u_fScale+vec2(5.2,1.3)-time*u_drift)); fld=fbm(p*u_fScale+2.0*q); }`);
  if (R.layer) {
    const lScale = rng_range(rng, 0.6, 2.2), lRot = rng_range(rng, -0.06, 0.06), lPhase = rng_range(rng, 0, 6.28), bS = rng_range(rng, 1.2, 3.5), bO = rng_range(rng, 0, 10);
    S.push(`vec2 pb=rot(p*${f(lScale)},time*${f(lRot)}+${f(lPhase)});`);
    const g = pick(rng, [3, 2, 2, 2]);
    if (g === 0) S.push(`float fld2=fbm(pb*${f(bS)}+${f(bO)}+time*u_drift);`);
    else if (g === 1) S.push(`float fld2=ridged(pb*${f(bS)}-time*u_drift);`);
    else if (g === 2) S.push(`float fld2=0.5+0.5*sin(pb.x*${f(bS)}+time*u_drift)*cos(pb.y*${f(bS)}-time*u_drift*0.8);`);
    else S.push(`float fld2=0.5+0.5*sin(pb.x*${f(bS)}+time*u_drift)*sin(pb.y*${f(bS)});`);
    const bl = pick(rng, [3, 2, 2, 0]);
    if (bl === 0) S.push(`fld=mix(fld,fld2,u_layer);`);
    else if (bl === 1) S.push(`fld=mix(fld,fld*fld2,u_layer);`);
    else if (bl === 2) S.push(`fld=mix(fld,1.0-(1.0-clamp(fld,0.0,1.0))*(1.0-clamp(fld2,0.0,1.0)),u_layer);`);
    else S.push(`fld=mix(fld,abs(fld-fld2),u_layer);`);
  }
  // modulation kept soft: gamma, or a gentle sine remap. The fract() and smoothstep()
  // options were removed -- they posterize the field into hard-edged clustered patches.
  if (R.mod) { const m = pick(rng, [3, 0, 0, 1]); if (m === 0) S.push(`fld=pow(clamp(fld,0.0,1.0),u_gamma);`); else S.push(`fld=0.5+0.5*sin(fld*6.28318*(0.35+u_gamma*0.4));`); }
  S.push(`vec3 col=palette(fld*u_cScale+time*u_cShift+u_hue,${PA},${PB},${PC},${PD});`);
  S.push(`col=mix(vec3(dot(col,vec3(0.299,0.587,0.114))),col,u_chroma);`);
  if (R.post) {
    S.push(`col*=1.0-u_vig*dot(uv,uv);`);
    S.push(`col+=u_grain*(hash21(gl_FragCoord.xy*0.5+time)-0.5);`);
    if (M.scan) S.push(`col*=1.0-u_scan*0.5*(0.5+0.5*sin(gl_FragCoord.y*2.0));`);
  }
  S.push(`gl_FragColor=vec4(clamp(col*u_bright,0.0,1.0),1.0);`);
  state.fieldName = fieldName;
  return `void main(){\n  ${S.join('\n  ')}\n}`;
}

const U_NAMES = ['resolution', 'time', 'u_zoom', 'u_rotSpeed', 'u_warp', 'u_fScale', 'u_drift', 'u_cScale', 'u_cShift', 'u_gamma', 'u_sym', 'u_chroma', 'u_hue', 'u_layer', 'u_vig', 'u_grain', 'u_scan', 'u_bright'];

export function createBackground(canvas, opts = {}) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, preserveDrawingBuffer: false }) || canvas.getContext('experimental-webgl');
  const state = {
    seed: hashStr('doot'), moodIndex: 0,
    speed: opts.speed != null ? opts.speed : 52, complexity: opts.complexity != null ? opts.complexity : 36,
    chroma: 100, hue: 0, sym: 6, blend: 48, bright: opts.brightness != null ? opts.brightness : 0.85,
    rack: { symmetry: false, warp: true, layer: true, mod: true, pixelate: false, post: true },
    playing: false, evoMix: 1, t: 0, fieldName: 'fbm', evoFreq: [], evoPhase: []
  };
  let prog = null, loc = {}, raf = 0, last = 0;
  const MAX_PIXELS = opts.maxPixels || 1.6e6;

  if (gl) { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); }

  function compile(type, src) { const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { gl.deleteShader(sh); return { err: gl.getShaderInfoLog(sh) }; } return { sh }; }
  function makeProgram(fsMain) { const vs = compile(gl.VERTEX_SHADER, VERT); if (vs.err) return { err: vs.err }; const fs = compile(gl.FRAGMENT_SHADER, PREAMBLE + '\n\n' + fsMain); if (fs.err) return { err: fs.err }; const p = gl.createProgram(); gl.attachShader(p, vs.sh); gl.attachShader(p, fs.sh); gl.bindAttribLocation(p, 0, 'a_pos'); gl.linkProgram(p); gl.deleteShader(vs.sh); gl.deleteShader(fs.sh); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { gl.deleteProgram(p); return { err: gl.getProgramInfoLog(p) }; } return { p }; }
  function useProgram(p) { if (prog) gl.deleteProgram(prog); prog = p; gl.useProgram(prog); loc = {}; for (const n of U_NAMES) loc[n] = gl.getUniformLocation(prog, n); const a = gl.getAttribLocation(prog, 'a_pos'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0); }
  function deriveEvolution() { const r = mulberry32((Math.imul(state.seed, 2654435761) ^ 0xABCD1234) >>> 0); state.evoFreq = []; state.evoPhase = []; for (let i = 0; i < 10; i++) { state.evoFreq.push(0.02 + r() * 0.06); state.evoPhase.push(r() * 6.28318); } }
  function rebuild() { if (!gl) return; const main = buildFragSource(state); const res = makeProgram(main); if (res.err) { const fb = makeProgram(FALLBACK_MAIN); if (fb.p) useProgram(fb.p); } else useProgram(res.p); deriveEvolution(); }

  function computeUniforms(t) {
    const M = BG_MOODS[state.moodIndex], speedF = state.speed / 100, cx = state.complexity / 100, mix = state.evoMix;
    const ev = (i, amp) => mix * amp * Math.sin(t * state.evoFreq[i] + state.evoPhase[i]);
    return {
      u_zoom: M.zoom * (1 + ev(0, 0.15)), u_rotSpeed: M.rot * speedF + ev(1, 0.03),
      u_warp: M.warp * (0.4 + 1.2 * cx) + ev(2, 0.15 * M.warp + 0.05), u_fScale: M.fScale * (0.8 + 0.9 * cx) + ev(3, 0.2 * M.fScale),
      u_drift: M.drift * speedF + ev(4, 0.15 * M.drift + 0.02), u_cScale: M.cScale + ev(5, 0.3), u_cShift: M.cShift * speedF + ev(6, 0.02),
      u_gamma: M.gamma * (0.6 + 0.8 * cx) + ev(7, 0.15), u_sym: state.sym, u_chroma: state.chroma / 100, u_hue: state.hue / 360 + ev(9, 0.03),
      u_layer: state.blend / 100, u_vig: M.vig, u_grain: M.grain * (1 + ev(8, 0.4)), u_scan: M.scan ? M.scanAmt : 0.0, u_bright: state.bright
    };
  }
  function resize() {
    if (!gl) return; let dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    let w = Math.max(1, Math.floor(canvas.clientWidth * dpr)), h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (w * h > MAX_PIXELS) { const s = Math.sqrt(MAX_PIXELS / (w * h)); w = Math.floor(w * s); h = Math.floor(h * s); }
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  }
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    if (state.playing) state.t += dt;
    if (gl && prog) {
      resize(); gl.useProgram(prog); const U = computeUniforms(state.t);
      if (loc.resolution) gl.uniform2f(loc.resolution, canvas.width, canvas.height);
      if (loc.time) gl.uniform1f(loc.time, state.t);
      for (const k in U) { if (loc[k] != null) gl.uniform1f(loc[k], U[k]); }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    raf = requestAnimationFrame(frame);
  }

  // Bake a shader for a seed + mood. moodName picks a BG_MOODS entry (case-insensitive);
  // omitted picks one from the seed.
  function compose(seedInput, moodName) {
    state.seed = (typeof seedInput === 'number') ? (seedInput >>> 0) : hashStr(String(seedInput || 'doot'));
    let mi = moodName ? BG_MOODS.findIndex(m => m.name.toLowerCase() === String(moodName).toLowerCase()) : -1;
    if (mi < 0) mi = state.seed % BG_MOODS.length;
    state.moodIndex = mi;
    rebuild();
  }
  function start() { state.playing = true; if (!raf) { last = (typeof performance !== 'undefined' ? performance.now() : Date.now()); raf = requestAnimationFrame(frame); } }
  function stop() { state.playing = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  function dispose() { stop(); if (gl && prog) { gl.deleteProgram(prog); prog = null; } }

  if (gl) rebuild();
  return { ok: !!gl, start, stop, resize, compose, dispose, canvas };
}
