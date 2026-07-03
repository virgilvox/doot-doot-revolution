// useRovingFocus: a focused index over a list of items, driven by the nav events,
// so a controller (which never moves DOM focus) can operate any menu with a
// visible ring. size() gives the current count; onConfirm(i) activates the
// focused item; onAdjust(i, delta) optionally handles left/right on the focused
// item (sliders); cols() gives a column count for grid movement.

import { ref } from 'vue';
import { useScope } from './useNavigation.js';

export function useRovingFocus(opts) {
  const index = ref(opts.start || 0);
  const size = opts.size || (() => 0);
  const cols = opts.cols || (() => 1);

  function move(dir) {
    const n = size(); if (!n) return;
    if (index.value >= n) index.value = n - 1;
    const c = cols();
    if (dir === 'left' || dir === 'right') {
      if (c <= 1 && opts.onAdjust) opts.onAdjust(index.value, dir === 'right' ? 1 : -1);
      else index.value = (index.value + (dir === 'right' ? 1 : -1) + n) % n;
    } else if (dir === 'up') {
      index.value = c > 1 ? (index.value - c + n) % n : (index.value - 1 + n) % n;
    } else if (dir === 'down') {
      index.value = c > 1 ? (index.value + c) % n : (index.value + 1) % n;
    }
  }

  useScope({
    move,
    confirm: () => opts.onConfirm && opts.onConfirm(index.value),
    cancel: () => opts.onCancel && opts.onCancel()
  });
  return { index };
}
