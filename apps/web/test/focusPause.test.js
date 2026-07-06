import { test, expect, vi, beforeEach } from 'vitest';

// Fake the platform singletons and the session so the composable's real focus logic runs
// against spies. ctx is truthy so suspend() is not skipped by the "no audio yet" guard;
// setVolumes exists because importing settings.js runs its immediate volume watcher.
const engine = vi.hoisted(() => ({ ctx: {}, suspend: vi.fn(), resume: vi.fn(), setVolumes: vi.fn() }));
const session = vi.hoisted(() => ({ pause: vi.fn(), resume: vi.fn() }));
vi.mock('../src/game/singletons.js', () => ({ engine }));
vi.mock('../src/composables/useSession.js', () => ({ session }));

import { useFocusPause } from '../src/composables/useFocusPause.js';
import { settings } from '../src/game/settings.js';

// Control what the composable reads as "are we the focused, visible window".
let vis = 'visible', hf = true;
Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => vis });
document.hasFocus = () => hf;
const setState = (v, f) => { vis = v; hf = f; };
// visibilitychange is a document event; blur/focus/pageshow/pagehide are window events.
const fire = (name) => (name === 'visibilitychange' ? document : window).dispatchEvent(new Event(name));

// useFocusPause wires its listeners once (module guard), so wire before the tests and let
// them share it, the same way the real app does. Each test resets the spies and the state.
useFocusPause();

beforeEach(() => {
  settings.pauseOnBlur = true;
  setState('visible', true);
  fire('focus'); // return to a clean, un-suspended baseline
  engine.suspend.mockClear(); engine.resume.mockClear();
  session.pause.mockClear(); session.resume.mockClear();
});

test('losing real focus suspends the audio and pauses the run', () => {
  setState('visible', false); // window blurred: still visible, no longer focused
  fire('blur');
  expect(engine.suspend).toHaveBeenCalledTimes(1);
  expect(session.pause).toHaveBeenCalledTimes(1);
});

test('a hidden tab suspends', () => {
  setState('hidden', true);
  fire('visibilitychange');
  expect(engine.suspend).toHaveBeenCalledTimes(1);
});

test('a stray focus while not actually focused does not resume (macOS Mission Control)', () => {
  setState('visible', false);
  fire('blur');                 // suspended
  engine.suspend.mockClear(); session.pause.mockClear();

  fire('focus');                // stray focus fired while the overview is open
  fire('focus'); fire('blur');  // clicking a different window from the overview
  expect(engine.resume).not.toHaveBeenCalled();
  expect(session.resume).not.toHaveBeenCalled();
});

test('genuinely returning focus resumes', () => {
  setState('visible', false); fire('blur'); // suspended
  engine.resume.mockClear(); session.resume.mockClear();

  setState('visible', true);
  fire('focus');
  expect(engine.resume).toHaveBeenCalledTimes(1);
  expect(session.resume).toHaveBeenCalledTimes(1);
});

test('with the setting off, losing focus does nothing', () => {
  settings.pauseOnBlur = false;
  setState('visible', false);
  fire('blur');
  expect(engine.suspend).not.toHaveBeenCalled();
  expect(session.pause).not.toHaveBeenCalled();
});

test('turning the setting off while suspended restores the audio', () => {
  setState('visible', false); fire('blur'); // suspended
  engine.resume.mockClear(); session.resume.mockClear();

  settings.pauseOnBlur = false;
  fire('focus'); // any re-evaluation now restores the suspend it caused
  expect(engine.resume).toHaveBeenCalledTimes(1);
  expect(session.resume).toHaveBeenCalledTimes(1);
});

test('does not suspend before any audio context exists', () => {
  engine.ctx = null;
  setState('visible', false);
  fire('blur');
  expect(engine.suspend).not.toHaveBeenCalled();
  expect(session.pause).not.toHaveBeenCalled();
  engine.ctx = {}; // and a later real focus does not wrongly resume, since we never suspended
  setState('visible', true); fire('focus');
  expect(engine.resume).not.toHaveBeenCalled();
});
