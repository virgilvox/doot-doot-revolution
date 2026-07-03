// useInput: wire the shared input singleton to the app once, and translate its
// raw lane and start/back events into the two vocabularies the app needs:
//   - gameplay: 'lane:down' / 'lane:up' { lane }
//   - navigation: 'move' { dir }, 'confirm', 'cancel'
// Directions come from the four lanes (0 left, 1 down, 2 up, 3 right), which the
// keyboard arrows already produce, so keys and gamepad share one path. Confirm
// and cancel come from Enter/Escape and from the first two gamepad face buttons,
// so the whole app is playable with no mouse.

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

  // one global loop samples gamepads. face buttons 0/1 drive confirm/cancel with
  // rising-edge detection so a controller alone can operate every menu.
  let prevA = false, prevB = false;
  const loop = () => {
    input.poll();
    const pads = (typeof navigator !== 'undefined' && navigator.getGamepads) ? navigator.getGamepads() : [];
    let a = false, b = false;
    for (const gp of pads) {
      if (!gp || !input.padEnabled()) continue;
      if (gp.buttons[0] && gp.buttons[0].pressed) a = true;
      if (gp.buttons[1] && gp.buttons[1].pressed) b = true;
    }
    if (a && !prevA) bus.emit('confirm');
    if (b && !prevB) bus.emit('cancel');
    prevA = a; prevB = b;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // resume the audio context on the first gesture (browser autoplay policy)
  const wake = () => { engine.resume(); window.removeEventListener('pointerdown', wake); window.removeEventListener('keydown', wake); };
  window.addEventListener('pointerdown', wake); window.addEventListener('keydown', wake);
}
