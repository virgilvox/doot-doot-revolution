import { test, expect } from 'vitest';
import { nextTick } from 'vue';
import { settings, resetSettings } from '../src/game/settings.js';

test('reactive settings read, write, apply side effects, and reset', async () => {
  settings.speed = 3.3;
  expect(settings.speed).toBe(3.3);
  settings.reducedMotion = true;
  await nextTick(); // watchers flush on the scheduler
  expect(document.body.classList.contains('reduce')).toBe(true);
  resetSettings();
  await nextTick();
  expect(settings.speed).toBe(2.4);
  expect(settings.reducedMotion).toBe(false);
  expect(document.body.classList.contains('reduce')).toBe(false);
});
