// fbxRetarget: load a Mixamo .fbx and retarget its animation onto a VRM's normalized
// humanoid, returning a THREE.AnimationClip that plays through the same mixer as the
// .vrma clips. The rest-pose compensation (premultiply the parent's rest world rotation,
// multiply the bone's inverted rest world rotation) and the VRM0 axis flip follow the
// official pixiv three-vrm humanoid-animation example, which is the verified method for
// this conversion. FBXLoader is only imported here, so it rides the lazy avatar chunk.

import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// Mixamo rig bone -> VRM humanoid bone. Fingers are left out; the dances do not use them.
const RIG_MAP = {
  mixamorigHips: 'hips',
  mixamorigSpine: 'spine',
  mixamorigSpine1: 'chest',
  mixamorigSpine2: 'upperChest',
  mixamorigNeck: 'neck',
  mixamorigHead: 'head',
  mixamorigLeftShoulder: 'leftShoulder',
  mixamorigLeftArm: 'leftUpperArm',
  mixamorigLeftForeArm: 'leftLowerArm',
  mixamorigLeftHand: 'leftHand',
  mixamorigRightShoulder: 'rightShoulder',
  mixamorigRightArm: 'rightUpperArm',
  mixamorigRightForeArm: 'rightLowerArm',
  mixamorigRightHand: 'rightHand',
  mixamorigLeftUpLeg: 'leftUpperLeg',
  mixamorigLeftLeg: 'leftLowerLeg',
  mixamorigLeftFoot: 'leftFoot',
  mixamorigLeftToeBase: 'leftToes',
  mixamorigRightUpLeg: 'rightUpperLeg',
  mixamorigRightLeg: 'rightLowerLeg',
  mixamorigRightFoot: 'rightFoot',
  mixamorigRightToeBase: 'rightToes'
};

const _loader = new FBXLoader();
// cache the parsed FBX asset per URL: only the retarget math depends on the VRM, so an
// avatar swap should re-retarget from the cached asset, not re-download and re-parse the
// multi-MB file. loadMixamoClip copies track values before mutating, so the shared asset
// is never altered.
const _assetCache = new Map();
function loadAsset(url) {
  let p = _assetCache.get(url);
  if (!p) { p = _loader.loadAsync(url); _assetCache.set(url, p); }
  return p;
}

// url: a .fbx served from the app. vrm: the mounted VRM. Resolves to an AnimationClip
// retargeted onto the vrm, or rejects if the asset has no usable rig/animation.
export function loadMixamoClip(url, vrm) {
  return loadAsset(url).then((asset) => {
    const clip = THREE.AnimationClip.findByName(asset.animations, 'mixamo.com') || asset.animations[0];
    if (!clip) throw new Error('no animation in ' + url);

    const tracks = [];
    const restRotationInverse = new THREE.Quaternion();
    const parentRestWorldRotation = new THREE.Quaternion();
    const quatA = new THREE.Quaternion();
    const vec = new THREE.Vector3();

    const hips = asset.getObjectByName('mixamorigHips');
    if (!hips) throw new Error('not a Mixamo rig: ' + url);
    const motionHipsHeight = hips.position.y;
    const vrmHipsY = vrm.humanoid.getNormalizedBoneNode('hips').getWorldPosition(vec).y;
    const vrmRootY = vrm.scene.getWorldPosition(vec).y;
    const vrmHipsHeight = Math.abs(vrmHipsY - vrmRootY);
    const hipsScale = motionHipsHeight ? vrmHipsHeight / motionHipsHeight : 1;
    const v0 = vrm.meta && vrm.meta.metaVersion === '0';

    clip.tracks.forEach((track) => {
      const [rigName, propertyName] = track.name.split('.');
      const vrmBoneName = RIG_MAP[rigName];
      const vrmNode = vrmBoneName ? vrm.humanoid.getNormalizedBoneNode(vrmBoneName) : null;
      const rigNode = asset.getObjectByName(rigName);
      if (!vrmNode || !rigNode) return;
      const vrmNodeName = vrmNode.name;

      rigNode.getWorldQuaternion(restRotationInverse).invert();
      rigNode.parent.getWorldQuaternion(parentRestWorldRotation);

      if (track instanceof THREE.QuaternionKeyframeTrack) {
        const values = track.values.slice();
        for (let i = 0; i < values.length; i += 4) {
          quatA.fromArray(values, i);
          quatA.premultiply(parentRestWorldRotation).multiply(restRotationInverse);
          quatA.toArray(values, i);
          if (v0) { values[i] = -values[i]; values[i + 2] = -values[i + 2]; } // flip X,Z for VRM0
        }
        tracks.push(new THREE.QuaternionKeyframeTrack(`${vrmNodeName}.${propertyName}`, track.times.slice(), values));
      } else if (track instanceof THREE.VectorKeyframeTrack) {
        const values = track.values.map((v, i) => (v0 && i % 3 !== 1 ? -v : v) * hipsScale);
        tracks.push(new THREE.VectorKeyframeTrack(`${vrmNodeName}.${propertyName}`, track.times.slice(), values));
      }
    });

    if (!tracks.length) throw new Error('no retargetable tracks in ' + url);
    return new THREE.AnimationClip('mixamo', clip.duration, tracks);
  });
}
