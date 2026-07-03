// The imperative platform singletons, created once and shared across the app. The
// event bus lives in game/bus.js and the reactive settings in game/settings.js.

import { createEngine } from '@doot-games/play';
import { createInput } from '@doot-games/play';
import { createLibrary } from '@doot-games/library';
import { createFsLibrary } from './fsLibrary.js';

export const engine = createEngine();
export const input = createInput();

// On the desktop app, persist the library as files on disk; on the web, use the
// default IndexedDB backend.
const doot = typeof window !== 'undefined' ? window.doot : null;
export const library = createLibrary(doot && doot.isDesktop ? { store: createFsLibrary(doot) } : {});
