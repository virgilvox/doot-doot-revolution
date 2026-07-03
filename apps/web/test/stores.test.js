import { test, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSettingsStore } from '../src/stores/settings.js';

beforeEach(() => setActivePinia(createPinia()));

test('settings store reads, writes, and resets to defaults', () => {
  const s = useSettingsStore();
  s.set('speed', 3.3);
  expect(s.state.speed).toBe(3.3);
  s.set('reducedMotion', true);
  expect(document.body.classList.contains('reduce')).toBe(true);
  s.reset();
  expect(s.state.speed).toBe(2.4);
  expect(s.state.reducedMotion).toBe(false);
});
