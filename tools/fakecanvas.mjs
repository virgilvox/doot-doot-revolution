// A minimal fake 2D canvas for render smoke tests in Node. Every context method
// is a no-op; gradients return a stub with addColorStop. Enough to run the
// notefield renderer headless and confirm it does not throw.

export function fakeCtx() {
  const grad = { addColorStop() {} };
  const target = {};
  return new Proxy(target, {
    get(o, p) {
      if (p in o) return o[p];
      if (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern') return () => grad;
      if (p === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      return () => {};
    },
    set(o, p, v) { o[p] = v; return true; }
  });
}

export function fakeCanvas(w = 220, h = 360) {
  const ctx = fakeCtx();
  return {
    style: {}, width: 1, height: 1,
    getContext() { return ctx; },
    getBoundingClientRect() { return { width: w, height: h, left: 0, top: 0, right: w, bottom: h }; },
    addEventListener() {}, removeEventListener() {}, setPointerCapture() {}
  };
}
