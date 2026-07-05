// avatars: the bundled VRM models and motion clips for the dancer feature. Assets live
// in public/ and are fetched by URL on demand, so nothing here touches the initial
// payload. Only one VRM is resident at a time; the default is the smallest so enabling
// the dancer is quick. Motion is split into full-body DANCES (cycled as featured
// routines, including the two Mixamo .fbx retargeted at runtime) and short EMOTES
// (gesture accents). On desktop everything can preload; on web a small subset preloads
// and the rest load when selected.

const enc = (p) => encodeURI(p);

export const AVATARS = [
  { id: 'VIPE_Hero__272', label: 'Hero 272', url: enc('/vrm/VIPE_Hero__272.vrm') },
  { id: 'VIPE_Hero__510', label: 'Hero 510', url: enc('/vrm/VIPE_Hero__510.vrm') },
  { id: 'UrbanTV', label: 'Urban', url: enc('/vrm/UrbanTV.vrm') },
  { id: '1738580850813093682', label: 'Model A', url: enc('/vrm/1738580850813093682.vrm') },
  { id: '5046019746890715772', label: 'Model B', url: enc('/vrm/5046019746890715772.vrm') },
  { id: '8661669951517724396', label: 'Model C', url: enc('/vrm/8661669951517724396.vrm') },
  { id: '7536306365885596509', label: 'Model D', url: enc('/vrm/7536306365885596509.vrm') },
  { id: '5441226627340532140', label: 'Model E', url: enc('/vrm/5441226627340532140.vrm') },
  { id: '3944687619380472747', label: 'Model F', url: enc('/vrm/3944687619380472747.vrm') }
];

export const DEFAULT_AVATAR = '7536306365885596509';

// On web, one avatar is picked at random from this small pool per session (variety
// without downloading all nine). Desktop bundles everything, so it randomizes over the
// full roster. An explicit choice in Settings overrides the random pick either way.
export const WEB_POOL = ['7536306365885596509', 'VIPE_Hero__510', 'UrbanTV'];

// full-body dances: the two Mixamo clips (retargeted at runtime) plus the pixiv motion
// pack. Kind picks the loader path in the stage.
export const DANCES = [
  { url: enc('/fbx/Slide Hip Hop Dance.fbx'), kind: 'fbx' },
  { url: enc('/fbx/Step Hip Hop Dance.fbx'), kind: 'fbx' },
  { url: enc('/vrma/VRMA_01.vrma'), kind: 'vrma' },
  { url: enc('/vrma/VRMA_02.vrma'), kind: 'vrma' },
  { url: enc('/vrma/VRMA_03.vrma'), kind: 'vrma' },
  { url: enc('/vrma/VRMA_04.vrma'), kind: 'vrma' },
  { url: enc('/vrma/VRMA_05.vrma'), kind: 'vrma' },
  { url: enc('/vrma/VRMA_06.vrma'), kind: 'vrma' },
  { url: enc('/vrma/VRMA_07.vrma'), kind: 'vrma' }
];

// short gesture emotes fired as accents (fever, and available for a manual tray).
export const EMOTES = [
  { url: enc('/vrma/Clapping.vrma'), kind: 'vrma' },
  { url: enc('/vrma/Jump.vrma'), kind: 'vrma' },
  { url: enc('/vrma/Surprised.vrma'), kind: 'vrma' },
  { url: enc('/vrma/LookAround.vrma'), kind: 'vrma' },
  { url: enc('/vrma/Angry.vrma'), kind: 'vrma' },
  { url: enc('/vrma/Blush.vrma'), kind: 'vrma' },
  { url: enc('/vrma/Goodbye.vrma'), kind: 'vrma' },
  { url: enc('/vrma/Relax.vrma'), kind: 'vrma' },
  { url: enc('/vrma/Sad.vrma'), kind: 'vrma' },
  { url: enc('/vrma/Sleepy.vrma'), kind: 'vrma' },
  { url: enc('/vrma/Thinking.vrma'), kind: 'vrma' }
];

// on web, preload a light subset so first play is quick; the rest load on demand.
export const WEB_PRELOAD = {
  dances: [DANCES[0], DANCES[1], DANCES[2], DANCES[3]],
  emotes: [EMOTES[0], EMOTES[1], EMOTES[2]]
};

export function avatarById(id) { return AVATARS.find((a) => a.id === id) || AVATARS[0]; }
