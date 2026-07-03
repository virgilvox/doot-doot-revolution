// useNavigation: a focus-scope stack driven by the nav events. Each view or modal
// pushes a scope with move/confirm/cancel handlers; only the top scope receives
// input, which gives modal focus trapping for free. Views implement their own
// movement (the wheel changes selection, a list changes index), so there is no
// generic focusable registry to maintain.

import { onMounted, onUnmounted } from 'vue';
import { bus } from '../game/singletons.js';

const stack = [];
let wired = false;
function wire() {
  if (wired) return; wired = true;
  const top = () => stack[stack.length - 1];
  bus.on('move', ({ dir }) => { const s = top(); if (s && s.move) s.move(dir); });
  bus.on('confirm', () => { const s = top(); if (s && s.confirm) s.confirm(); });
  bus.on('cancel', () => { const s = top(); if (s && s.cancel) s.cancel(); });
}

export function useNavigation() {
  wire();
  function pushScope(handlers) {
    const scope = { ...handlers };
    stack.push(scope);
    return () => { const i = stack.indexOf(scope); if (i >= 0) stack.splice(i, 1); };
  }
  return { pushScope };
}

// Convenience for a view: push a scope on mount, pop on unmount.
export function useScope(handlers) {
  const nav = useNavigation();
  let pop = null;
  onMounted(() => { pop = nav.pushScope(handlers); });
  onUnmounted(() => { if (pop) pop(); });
  return nav;
}
