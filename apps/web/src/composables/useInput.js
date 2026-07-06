// useInput: wire the shared input singleton to the app once, and translate its
// raw lane and start/back events into the two vocabularies the app needs:
//   - gameplay: 'lane:down' / 'lane:up' { lane }
//   - navigation: 'move' { dir }, 'confirm', 'cancel'
// Directions come from the four lanes (0 left, 1 down, 2 up, 3 right), which the
// keyboard arrows already produce, so keys and gamepad share one path. Confirm and
// cancel come from Enter/Escape and from each device's bound start/back (input.js
// resolves gamepad start/back through the bindings, so a remapped or non-standard
// pad is correct), so the whole app is playable with no mouse.

import { engine, input } from '../game/singletons.js';
import { bus } from '../game/bus.js';

const DIR = ['left', 'down', 'up', 'right'];
let started = false;

export function useInput() {
  if (started) return;
  started = true;

  input.on('down', ({ lane, device }) => { bus.emit('lane:down', { lane, device }); bus.emit('move', { dir: DIR[lane] }); });
  input.on('up', ({ lane, device }) => bus.emit('lane:up', { lane, device }));
  input.on('start', () => bus.emit('confirm'));
  input.on('back', () => bus.emit('cancel'));

  input.attach(window);

  // one global loop samples gamepads; input.poll() resolves every button (lanes,
  // start, back, and the standard-mapped face-button convenience) through the
  // per-device bindings and emits the same start/back events the bridge above turns
  // into confirm/cancel. No second raw button read, so a non-standard pad's Down
  // panel can never masquerade as confirm or cancel.
  const loop = () => { input.poll(); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);

  // resume the audio context on the first gesture (browser autoplay policy)
  const wake = () => { engine.resume(); window.removeEventListener('pointerdown', wake); window.removeEventListener('keydown', wake); };
  window.addEventListener('pointerdown', wake); window.addEventListener('keydown', wake);
}
