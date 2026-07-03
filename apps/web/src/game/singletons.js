// The imperative platform singletons, created once and shared across the app.
// Composables and stores wrap these; Vue components never touch them directly.

import { createBus, createSettings } from '@doot-games/core';
import { createEngine } from '@doot-games/engine';
import { createInput } from '@doot-games/input';
import { createLibrary } from '@doot-games/library';
import { createFsLibrary } from './fsLibrary.js';

export const bus = createBus();

export const settings = createSettings({
  defaults: { speed: 2.4, offsetMs: 0, volMaster: 0.9, volMusic: 0.85, volSfx: 0.7, reducedMotion: false }
});

export const engine = createEngine();
engine.setVolumes({ master: settings.get('volMaster'), music: settings.get('volMusic'), sfx: settings.get('volSfx') });

export const input = createInput();

// On the desktop app, persist the library as files on disk; on the web, use the
// default IndexedDB backend.
const doot = typeof window !== 'undefined' ? window.doot : null;
export const library = createLibrary(doot && doot.isDesktop ? { store: createFsLibrary(doot) } : {});
