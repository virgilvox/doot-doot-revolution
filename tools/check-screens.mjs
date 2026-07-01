// Render check: confirm the built single file contains every screen and the key
// elements each screen needs. This is a structural check on the artifact. Full
// runtime rendering is verified by loading the build in a browser; this gate runs
// in Node with no dependencies so it can sit in CI next to the syntax check.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'apps/ddr/dist/index.html');

if (!existsSync(OUT)) { console.error('no build at ' + OUT + '. run npm run build first.'); process.exit(1); }
const html = readFileSync(OUT, 'utf8');

const SCREENS = ['title', 'select', 'diff', 'add', 'game', 'results', 'settings', 'library', 'gamepad'];
const ELEMENTS = [
  'titleArrows', 'wheel', 'diffs', 'selRadar', 'danceBtn', 'diffGrid', 'startPlay',
  'engines', 'genDiffs', 'genBtn', 'addRun', 'reviewBtn', 'addReview', 'edHost', 'saveBtn',
  'field', 'gpProg', 'resGrade', 'resJudges', 'setRows', 'libList', 'bindGrid'
];

const missing = [];
for (const s of SCREENS) if (!html.includes('id="s-' + s + '"')) missing.push('screen s-' + s);
for (const id of ELEMENTS) if (!html.includes('id="' + id + '"')) missing.push('element #' + id);

if (missing.length) { console.error('render check failed, missing:\n  ' + missing.join('\n  ')); process.exit(1); }
console.log('render check passed: ' + SCREENS.length + ' screens and ' + ELEMENTS.length + ' key elements present');
