// Extract the script from the single file build and syntax check it with
// node --check. This is the validation gate the rules require before a build
// change is considered done.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'apps/ddr/dist/index.html');
const SCRATCH = process.env.DDR_SCRATCH || join(ROOT, '.cache');

if (!existsSync(OUT)) { console.error('no build at ' + OUT + '. run npm run build first.'); process.exit(1); }

const html = readFileSync(OUT, 'utf8');
const m = html.match(/<script>\n([\s\S]*?)<\/script>\s*<\/body>/);
if (!m) { console.error('could not find the bundled script in ' + OUT); process.exit(1); }

if (!existsSync(SCRATCH)) mkdirSync(SCRATCH, { recursive: true });
const scratchJs = join(SCRATCH, 'ddr-check.js');
writeFileSync(scratchJs, m[1]);
execSync('node --check ' + JSON.stringify(scratchJs), { stdio: 'inherit' });
console.log('bundle syntax check passed');
