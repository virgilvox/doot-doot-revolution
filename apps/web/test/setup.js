// jsdom has no canvas 2D context, ResizeObserver, or rAF. Stub them so the
// canvas-wrapping components mount and render headlessly.
import { fakeCtx } from '../../../tools/fakecanvas.mjs';

HTMLCanvasElement.prototype.getContext = function () { return fakeCtx(); };

if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
}
if (typeof global.requestAnimationFrame === 'undefined') {
  global.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 0);
  global.cancelAnimationFrame = (id) => clearTimeout(id);
}
