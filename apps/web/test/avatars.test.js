import { test, expect } from 'vitest';
import { AVATARS, DANCES, EMOTES, DEFAULT_AVATAR, WEB_PRELOAD, WEB_POOL, avatarById } from '../src/game/avatars.js';
import { settings } from '../src/game/settings.js';

// The dancer stage (three.js + WebGL) is exercised by the in-browser check. Here we
// guard the bundled-asset manifest that feeds it: a real default, encoded URLs, and a
// web-preload subset drawn from the full lists, so a bad edit fails CI instead of the
// dancer silently loading nothing.

test('the default avatar exists in the roster and matches the setting default', () => {
  expect(AVATARS.some((a) => a.id === DEFAULT_AVATAR)).toBe(true);
  expect(avatarById(DEFAULT_AVATAR).id).toBe(DEFAULT_AVATAR);
  expect(settings.avatar).toBe(DEFAULT_AVATAR);
  // an unknown id falls back to the first avatar rather than undefined
  expect(avatarById('nope')).toBe(AVATARS[0]);
});

test('every asset url is a rooted, space-encoded public path with a known extension', () => {
  const all = [...AVATARS, ...DANCES, ...EMOTES];
  for (const a of all) {
    expect(a.url.startsWith('/')).toBe(true);
    expect(a.url.includes(' ')).toBe(false); // spaces must be percent-encoded
    expect(/\.(vrm|glb|vrma|fbx)$/i.test(a.url)).toBe(true);
  }
  // clip kinds pick the loader path, so they must be one of the two we handle
  for (const c of [...DANCES, ...EMOTES]) expect(['vrma', 'fbx']).toContain(c.kind);
});

test('the web preload subset is drawn from the full dance and emote lists', () => {
  for (const d of WEB_PRELOAD.dances) expect(DANCES).toContain(d);
  for (const e of WEB_PRELOAD.emotes) expect(EMOTES).toContain(e);
  expect(WEB_PRELOAD.dances.length).toBeLessThanOrEqual(DANCES.length);
});

test('the web random-avatar pool references real avatars and includes the default', () => {
  for (const id of WEB_POOL) expect(AVATARS.some((a) => a.id === id)).toBe(true);
  expect(WEB_POOL).toContain(DEFAULT_AVATAR);
});
