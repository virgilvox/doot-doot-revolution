// stage: the three.js dancer scene, a transparent layer that sits over the shader
// background. It mounts a VRM, drives it either with the procedural director or with a
// loaded clip (a .vrma gesture or a retargeted Mixamo dance), runs the camera director,
// and renders. Imperative and framework-agnostic, mirroring background.js's shape:
// createDancerStage(canvas, opts) -> { ok, start, stop, resize, setAvatar, loadVRMA,
// loadFBX, playEmote, setReducedMotion, dispose }. three and the VRM libs are only
// imported here (and the sibling avatar modules), so they ride one lazy chunk.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip, VRMLookAtQuaternionProxy } from '@pixiv/three-vrm-animation';
import { W, CL, fract } from './pose.js';
import { applyVRMPose, cacheBones } from './retarget.js';
import { createDirector, tierFor } from './director.js';
import { createCameraDirector } from './camera.js';
import { loadMixamoClip } from './fbxRetarget.js';

const TIER_HEX = [0x5a6672, 0x37d3bd, 0x5ee08a, 0xf2b63c, 0xff4f9a];
const TIER_COL = TIER_HEX.map((h) => new THREE.Color(h));

export function createDancerStage(canvas, opts) {
  const o = opts || {};
  const clock = o.clock || { beat: 0, combo: 0, playing: false };
  const rng = o.rng || Math.random;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (err) { return { ok: false, start() {}, stop() {}, resize() {}, setAvatar() { return Promise.reject(err); }, loadVRMA() { return Promise.reject(err); }, loadFBX() { return Promise.reject(err); }, playDance() { return false; }, flip() {}, setReducedMotion() {}, dispose() {} }; }

  renderer.setPixelRatio(Math.min(o.maxPixelRatio || 2, (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 60);
  camera.position.set(0, 1.7, 7);

  // bright arcade lighting: warm key, teal rim, generous fill, plus a tier-tinted point
  const hemi = new THREE.HemisphereLight(0xbfd3ff, 0x352a3a, 2.4); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff2e0, 3.2); key.position.set(3, 6, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x59d8c6, 2.2); rim.position.set(-3, 3, -4); scene.add(rim);
  const tierLight = new THREE.PointLight(0xffffff, 1.6, 14, 2); tierLight.position.set(1.6, 2.2, 2.6); scene.add(tierLight);

  const mount = new THREE.Group(); mount.rotation.order = 'YXZ'; scene.add(mount);
  const vrmHolder = new THREE.Group(); mount.add(vrmHolder);

  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), new THREE.MeshBasicMaterial({ color: 0x1a1030, transparent: true, opacity: 0.28 }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.012; scene.add(blob);

  const director = createDirector({ rng });
  const camDir = createCameraDirector(camera, { rng });
  camDir.reset(0, 0);

  const gltf = new GLTFLoader();
  gltf.register((parser) => new VRMLoaderPlugin(parser));
  gltf.register((parser) => new VRMAnimationLoaderPlugin(parser));

  // avatar + clip state
  const A = { vrm: null, bones: null, yaw: 0, exp: {}, restHipsY: 0 };
  const hipsW = new THREE.Vector3(); // scratch for the avatar's world position each frame
  const clips = { mixer: null, raw: {}, fbxUrl: {}, actions: {}, dances: [], emotes: [] };
  // one full-body dance clip loops at a time; the cycle cross-fades to a new clip or to
  // a procedural segment. procWeight blends the procedural rig over whatever the clip
  // mixer wrote each frame, so clip<->procedural handoffs never pop.
  const dance = { action: null, name: null };
  let segEndAt = 0, procWeight = 1, targetProc = 1, reduced = !!o.reducedMotion;
  let blinkT = -1, nextBlink = 3, lastBeat = 0, revealAt = 0;

  function setReducedMotion(v) { reduced = !!v; }

  // ---- clip actions -------------------------------------------------------
  function resetMixer() {
    if (clips.mixer) clips.mixer.stopAllAction();
    clips.actions = {}; dance.action = null; dance.name = null;
    procWeight = 1; targetProc = 1; segEndAt = 0;
    if (!A.vrm) { clips.mixer = null; return; }
    clips.mixer = new THREE.AnimationMixer(A.vrm.scene);
    // fbx dances retarget per avatar; kick those off so their actions become ready
    Object.keys(clips.fbxUrl).forEach((name) => buildFbxAction(name));
  }
  // a looping action for a dance name, built lazily. vrma builds from the cached raw
  // animation; fbx is retargeted asynchronously by buildFbxAction and cached by name.
  function danceActionFor(name) {
    if (clips.actions[name]) return clips.actions[name];
    if (!A.vrm || !clips.mixer || !clips.raw[name]) return null;
    let clip; try { clip = createVRMAnimationClip(clips.raw[name], A.vrm); } catch (err) { return null; }
    const act = clips.mixer.clipAction(clip);
    act.setLoop(THREE.LoopRepeat, Infinity);
    clips.actions[name] = act; return act;
  }
  function buildFbxAction(name) {
    const url = clips.fbxUrl[name];
    if (!url || !A.vrm || !clips.mixer) return Promise.resolve(null);
    const mixer = clips.mixer;
    return loadMixamoClip(url, A.vrm).then((clip) => {
      if (clips.mixer !== mixer) return null; // avatar swapped mid-load
      const act = mixer.clipAction(clip); act.setLoop(THREE.LoopRepeat, Infinity);
      clips.actions[name] = act; return act;
    }).catch(() => null);
  }
  function readyDances() { return clips.dances.filter((n) => danceActionFor(n)); }
  // cross-fade to a specific dance clip, looping it. Returns false if its action is not
  // ready yet (an fbx still retargeting), so the caller can fall back to procedural.
  function startClip(name) {
    const act = danceActionFor(name);
    if (!act) return false;
    if (act !== dance.action) {
      // the first clip (before the avatar is revealed) snaps to full weight so the reveal
      // shows the clip immediately, not a bind-pose fade-in; later clips cross-fade
      const fade = vrmHolder.visible ? 0.45 : 0;
      act.reset(); act.enabled = true; act.setEffectiveWeight(1); act.fadeIn(fade); act.play();
      if (dance.action) dance.action.fadeOut(fade);
      dance.action = act; dance.name = name;
    }
    targetProc = 0; return true;
  }
  // hand the body back to the procedural rig, fading any clip out
  function goProcedural() { if (dance.action) { dance.action.fadeOut(0.5); dance.action = null; dance.name = null; } targetProc = 1; }
  // pick the next segment. Dance clips are the primary animation, so whenever one is
  // ready a fresh clip plays; the procedural rig is only a fallback while clips are still
  // loading (or if none are bundled), and then we retry quickly so a real clip takes over
  // the moment it is available. This keeps the avatar in a real animation, never a static
  // or arms-up default pose.
  function nextSegment(now) {
    const ready = readyDances();
    if (ready.length) {
      const pool = ready.filter((n) => n !== dance.name);
      const list = pool.length ? pool : ready;
      if (startClip(list[Math.floor(rng() * list.length)])) { segEndAt = now + 7 + rng() * 5; return; }
    }
    goProcedural();
    segEndAt = now + (clips.dances.length ? 0.4 : 7 + rng() * 5); // retry soon while clips load
  }
  // jump straight to a named dance now (used when a clip is dropped on the stage)
  function playDance(name) { const ok = startClip(name); if (ok) segEndAt = performance.now() / 1000 + 9; return ok; }

  // ---- asset loading ------------------------------------------------------
  function loadVRMA(url, role) {
    const name = clipName(url);
    return fetch(url).then((r) => r.arrayBuffer()).then((buf) => new Promise((res, rej) => {
      gltf.parse(buf, '', (g) => {
        const va = g.userData.vrmAnimations && g.userData.vrmAnimations[0];
        if (!va) { rej(new Error('no animation in ' + url)); return; }
        clips.raw[name] = va; delete clips.actions[name];
        registerRole(name, role); res(name);
      }, rej);
    }));
  }
  function loadFBX(url, role) {
    const name = clipName(url);
    clips.fbxUrl[name] = url; registerRole(name, role || 'dance');
    // resolve only after the retarget has actually read the file, so a caller that made
    // a blob URL can revoke it once we resolve without cutting the load short
    const done = A.vrm ? buildFbxAction(name) : Promise.resolve(null);
    return done.then(() => name);
  }
  function registerRole(name, role) {
    const list = role === 'emote' ? clips.emotes : clips.dances;
    if (!list.includes(name)) list.push(name);
  }
  function clipName(url) { return String(url).split('/').pop().replace(/\.(vrma|fbx|glb)$/i, ''); }

  function setAvatar(url) {
    return fetch(url).then((r) => r.arrayBuffer()).then((buf) => new Promise((res, rej) => {
      gltf.parse(buf, '', (g) => {
        const vrm = g.userData.vrm;
        if (!vrm) { rej(new Error('no VRM in ' + url)); return; }
        try { mountVRM(vrm); res(vrm); } catch (err) { rej(err); }
      }, rej);
    }));
  }
  function mountVRM(vrm) {
    if (A.vrm) { vrmHolder.remove(A.vrm.scene); VRMUtils.deepDispose(A.vrm.scene); }
    VRMUtils.rotateVRM0(vrm);
    vrm.scene.traverse((n) => { n.frustumCulled = false; });
    const bb = new THREE.Box3().setFromObject(vrm.scene);
    const h = bb.max.y - bb.min.y;
    const s = h > 0.05 ? 1.62 / h : 1;
    vrmHolder.scale.setScalar(s);
    vrmHolder.position.y = -bb.min.y * s;
    vrmHolder.add(vrm.scene);
    if (vrm.lookAt) {
      vrm.lookAt.target = camera;
      try { const lp = new VRMLookAtQuaternionProxy(vrm.lookAt); lp.name = 'lookAtQuaternionProxy'; vrm.scene.add(lp); } catch (err) { /* no look-at proxy */ }
    }
    A.vrm = vrm; A.bones = cacheBones(vrm); A.yaw = 0; A.exp = {};
    ['happy', 'blink'].forEach((n) => { try { if (vrm.expressionManager && vrm.expressionManager.getValue(n) != null) A.exp[n] = true; } catch (err) { /* no such expression */ } });
    resetMixer();
    // never show the static default/rest pose: keep the avatar hidden until a real clip is
    // driving it (the frame loop reveals it straight into the clip), with a short fallback
    // reveal if no clip loads. Record the bind hip height as the contact shadow's ground ref.
    vrmHolder.visible = false;
    revealAt = performance.now() / 1000 + 2.5;
    vrm.scene.updateMatrixWorld(true);
    A.restHipsY = A.bones.hips ? A.bones.hips.getWorldPosition(hipsW).y : 0;
  }
  function flip() { A.yaw = A.yaw ? 0 : Math.PI; }

  // ---- frame loop ---------------------------------------------------------
  let raf = 0, last = performance.now(), running = false;
  const IDLE_BPM = 82;

  function frame() {
    raf = requestAnimationFrame(frame);
    const nowMs = performance.now();
    let dt = (nowMs - last) / 1000; last = nowMs; dt = CL(dt, 0, 0.05);
    const tSec = nowMs / 1000;

    const playing = !!clock.playing;
    const beat = Math.max(playing ? (clock.beat || 0) : tSec * IDLE_BPM / 60, 0);
    const combo = playing ? (clock.combo || 0) : 0;
    const tier = tierFor(combo);
    const energy = tier / 4;
    const BP = beat > 0 ? Math.pow(1 - fract(beat), 2.6) : 0;
    const calm = reduced ? 0.35 : 1;

    // a song restart rewinds the beat toward 0: re-seed the schedulers so the dancer and
    // camera do not stay frozen on stale future cut times (audit finding)
    if (beat + 0.5 < lastBeat) { director.reset(); camDir.reset(beat, tier); goProcedural(); segEndAt = 0; }
    lastBeat = beat;

    // advance the segment cycle on the wall clock (robust to the idle/play beat jump), so
    // the swivel moves, vrma dances, and fbx dances take turns and it is always moving
    if (A.vrm && tSec >= segEndAt) nextSegment(tSec);
    if (A.vrm && targetProc === 0 && !dance.action) targetProc = 1; // clip not ready yet
    // reveal the avatar only once a real clip is driving it, snapping straight to the clip
    // so the static/default pose is never shown; fall back to revealing after a short wait
    // if no clip ever loads (procedural, which is at least animated)
    if (A.vrm && !vrmHolder.visible) {
      if (dance.action) { procWeight = 0; targetProc = 0; vrmHolder.visible = true; }
      else if (tSec >= revealAt) vrmHolder.visible = true;
    }

    // ease the procedural/clip blend
    const step = dt / 0.45;
    procWeight += CL(targetProc - procWeight, -step, step);
    procWeight = CL(procWeight, 0, 1);

    // the clip mixer writes the humanoid bones first; the procedural rig then blends over
    // the top by procWeight (0 = pure clip, 1 = pure procedural), with no pop either way
    if (A.vrm && clips.mixer) clips.mixer.update(dt);
    if (procWeight > 0.001) {
      const p = director.update(beat, tier, reduced ? 0.6 : 1);
      mount.position.set(p.px * procWeight, p.py * procWeight, p.pz * procWeight);
      mount.rotation.set(W(p.pitch * procWeight), W((A.vrm ? A.yaw : 0) + p.yaw * procWeight), W(p.roll * procWeight));
      if (A.vrm) applyVRMPose(A.bones, p, procWeight);
    } else {
      mount.position.set(0, 0, 0);
      mount.rotation.set(0, A.vrm ? A.yaw : 0, 0);
    }

    const tc = TIER_COL[tier];
    tierLight.color.copy(tc);
    tierLight.intensity = (0.3 + 0.9 * energy + 0.5 * BP * energy) * 3.14;
    key.intensity = 2.9 + 1.0 * BP * (0.3 + 0.7 * energy);

    if (A.vrm) {
      const em = A.vrm.expressionManager;
      if (em) {
        if (A.exp.happy) em.setValue('happy', tier >= 3 ? 0.5 * energy : 0);
        if (A.exp.blink) {
          if (tSec > nextBlink) { blinkT = tSec; nextBlink = tSec + 2.2 + rng() * 3; }
          const bp = CL((tSec - blinkT) / 0.16, 0, 1);
          em.setValue('blink', Math.sin(bp * Math.PI));
        }
      }
      A.vrm.update(dt);
    }

    camDir.update(beat, tSec, tier, energy, BP, mount.position, calm, dt);

    // the contact shadow tracks the avatar's actual ground position. With a clip driving,
    // the horizontal motion lives in the hips bone (e.g. the slide dance), not the mount,
    // so read the hips world position rather than the mount, and shrink/fade it as the
    // hips lift off the ground.
    if (A.vrm && A.bones && A.bones.hips) {
      A.bones.hips.getWorldPosition(hipsW);
      blob.position.x = hipsW.x; blob.position.z = hipsW.z;
      const bs = CL(1 - Math.max(0, hipsW.y - (A.restHipsY || hipsW.y)) * 1.4, 0.4, 1);
      blob.scale.setScalar(bs); blob.material.opacity = 0.28 * bs;
    } else {
      blob.position.x = mount.position.x; blob.position.z = mount.position.z;
      const bs = CL(1 - mount.position.y * 1.1, 0.35, 1);
      blob.scale.setScalar(bs); blob.material.opacity = 0.28 * bs;
    }

    renderer.render(scene, camera);
  }

  function start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  function resize() {
    const w = canvas.clientWidth || canvas.width || 1;
    const h = canvas.clientHeight || canvas.height || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  function dispose() {
    stop();
    if (clips.mixer) clips.mixer.stopAllAction();
    if (A.vrm) { vrmHolder.remove(A.vrm.scene); VRMUtils.deepDispose(A.vrm.scene); A.vrm = null; }
    blob.geometry.dispose(); blob.material.dispose();
    renderer.dispose();
    try { renderer.forceContextLoss(); } catch (err) { /* not always supported */ }
  }

  return { ok: true, start, stop, resize, setAvatar, loadVRMA, loadFBX, playDance, flip, setReducedMotion, dispose,
    get avatar() { return A.vrm; }, get clips() { return { dances: clips.dances.slice(), emotes: clips.emotes.slice() }; } };
}
