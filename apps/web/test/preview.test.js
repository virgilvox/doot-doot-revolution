import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick, markRaw } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';

// Mock the platform singletons so the composable talks to a fake engine.
// vi.hoisted so the object exists before the hoisted vi.mock factory runs.
const engine = vi.hoisted(() => ({ decode: vi.fn(), preview: vi.fn(), stopPreview: vi.fn() }));
vi.mock('../src/game/singletons.js', () => ({ engine }));

import { useSongPreview } from '../src/composables/useSongPreview.js';

let curRef;
const Harness = { template: '<i/>', setup() { curRef = ref(null); useSongPreview(curRef); } };

beforeEach(() => { vi.useFakeTimers(); engine.decode.mockReset(); engine.preview.mockReset(); engine.stopPreview.mockReset(); });
afterEach(() => vi.useRealTimers());

test('previews only the settled song, after the debounce', async () => {
  const wrap = mount(Harness);
  // markRaw so Vue does not proxy the fake buffer, as it leaves real AudioBuffers.
  const a = { id: 'a', buffer: markRaw({ duration: 15 }) };
  const b = { id: 'b', buffer: markRaw({ duration: 200 }) };
  curRef.value = a; await nextTick();
  vi.advanceTimersByTime(200);           // still within the settle window
  curRef.value = b; await nextTick();    // moved before settling -> debounce restarts
  expect(engine.preview).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(350);
  expect(engine.preview).toHaveBeenCalledTimes(1);
  expect(engine.preview.mock.calls[0][0]).toBe(b.buffer); // the settled one, not a
  wrap.unmount();
});

test('a slow decode does not play onto a song already scrolled past', async () => {
  const wrap = mount(Harness);
  let resolveDecode;
  engine.decode.mockImplementation(() => new Promise((r) => { resolveDecode = r; }));
  const a = { id: 'a', audio: { arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) } };
  const b = { id: 'b', buffer: markRaw({ duration: 15 }) };
  curRef.value = a; await nextTick();
  await vi.advanceTimersByTimeAsync(350); // playFor(a) parks on the pending decode
  curRef.value = b; await nextTick();     // scroll away before a decodes
  await vi.advanceTimersByTimeAsync(350); // playFor(b) previews b immediately
  resolveDecode({ duration: 100 });       // a's decode finally resolves, late
  await flushPromises();
  expect(engine.preview).toHaveBeenCalledTimes(1);       // a's stale decode was dropped
  expect(engine.preview.mock.calls[0][0]).toBe(b.buffer);
  wrap.unmount();
});

test('stops the preview when the view unmounts', () => {
  const wrap = mount(Harness);
  wrap.unmount();
  expect(engine.stopPreview).toHaveBeenCalled();
});
