import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditor } from '@doot-games/editor';

// The editor mounts a live DOM with canvases, audio, and pointer handlers, so a
// full mount is exercised by the in-browser render check. Here we guard that the
// module loads with no DOM present and exposes its factory, which catches import
// and export regressions in CI.
test('editor exports a factory', () => {
  assert.equal(typeof createEditor, 'function');
});
