// Bundle the app and its packages into one self contained HTML file. This keeps
// the single file philosophy while the source stays modular. No external bundler
// is used: the workspace is plain ES modules in a disciplined style (top-level
// single-line imports, exports at the declaration), so a small resolver and
// transform turn them into one script wrapped in a tiny module registry. Dynamic
// import() calls (the WebGPU model loads) are left untouched so they still load
// at runtime.
//
// The bundle is assembled in a scratch location and syntax checked with
// node --check before it is copied to dist.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRATCH = process.env.DDR_SCRATCH || join(ROOT, '.cache');
const ENTRY = join(ROOT, 'apps/ddr/src/app.js');
const HTML = join(ROOT, 'apps/ddr/src/index.html');
const OUT = join(ROOT, 'apps/ddr/dist/index.html');

const IMPORT_FROM = /^import\s+(.+?)\s+from\s+['"]([^'"]+)['"];?\s*$/gm;
const IMPORT_BARE = /^import\s+['"]([^'"]+)['"];?\s*$/gm;

function resolveSpec(spec, importerDir) {
  if (spec.startsWith('@doot-games/')) {
    const name = spec.slice('@doot-games/'.length);
    return join(ROOT, 'packages', name, 'src', 'index.js');
  }
  if (spec.startsWith('.')) {
    let p = resolve(importerDir, spec);
    if (!p.endsWith('.js')) p += '.js';
    return p;
  }
  throw new Error('unexpected bare specifier: ' + spec);
}

// The regex transform handles single-line named/namespace/default imports and
// declaration-site exports. Fail loudly if a module uses a construct it cannot
// rewrite, rather than emitting a silently broken bundle.
function assertTransformable(code, file) {
  const rel = file.split('/').slice(-3).join('/');
  if (/^export\s+default\b/m.test(code)) throw new Error('unsupported `export default` in ' + rel + '; use named exports');
  if (/^export\s*\{[^}]*\}\s*from\s*['"]/m.test(code)) throw new Error('unsupported re-export `export { ... } from` in ' + rel + '; import then export');
  for (const line of code.split('\n')) {
    if (!/^import\b/.test(line)) continue; // dynamic import() starts with const/await, not import at col 0
    const ok = /^import\s+.+\s+from\s+['"][^'"]+['"];?\s*$/.test(line) || /^import\s+['"][^'"]+['"];?\s*$/.test(line);
    if (!ok) throw new Error('unsupported import form in ' + rel + ' (must be a single-line import): ' + line.trim());
  }
}

function findImports(code) {
  const specs = [];
  let m;
  IMPORT_FROM.lastIndex = 0; while ((m = IMPORT_FROM.exec(code))) specs.push(m[2]);
  IMPORT_BARE.lastIndex = 0; while ((m = IMPORT_BARE.exec(code))) specs.push(m[1]);
  return specs;
}

// Rewrite a module's static imports into require() calls and its exports into
// assignments on the exports object. Dynamic import() is not matched here.
function transform(code, importerDir) {
  const names = [];
  code = code.replace(IMPORT_FROM, (mm, clause, spec) => {
    const id = JSON.stringify(resolveSpec(spec, importerDir));
    clause = clause.trim();
    if (clause.startsWith('{')) {
      const inner = clause.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean).map((s) => { const a = s.split(/\s+as\s+/); return a.length > 1 ? (a[0].trim() + ': ' + a[1].trim()) : a[0].trim(); }).join(', ');
      return 'const { ' + inner + ' } = require(' + id + ');';
    }
    if (clause.startsWith('* as ')) return 'const ' + clause.slice(5).trim() + ' = require(' + id + ');';
    return 'const ' + clause + ' = require(' + id + ').default;';
  });
  code = code.replace(IMPORT_BARE, (mm, spec) => 'require(' + JSON.stringify(resolveSpec(spec, importerDir)) + ');');
  code = code.replace(/^export\s*\{([^}]*)\}\s*;?\s*$/gm, (mm, inner) => {
    inner.split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => { const a = s.split(/\s+as\s+/); names.push({ local: a[0].trim(), exported: (a[1] || a[0]).trim() }); });
    return '';
  });
  code = code.replace(/^export\s+(async\s+function|function|class|const|let|var)\s+([A-Za-z0-9_$]+)/gm, (mm, kw, name) => { names.push({ local: name, exported: name }); return kw + ' ' + name; });
  let tail = '\n';
  names.forEach((e) => { tail += 'exports.' + e.exported + ' = ' + e.local + ';\n'; });
  return code + tail;
}

function collect(entry) {
  const order = [], seen = new Set();
  (function visit(file) {
    if (seen.has(file)) return; seen.add(file);
    const code = readFileSync(file, 'utf8');
    findImports(code).forEach((spec) => visit(resolveSpec(spec, dirname(file))));
    order.push(file);
  })(entry);
  return order;
}

function build() {
  const files = collect(ENTRY);
  let out = '(function(){\n"use strict";\nvar __m={};\nfunction __d(id,fn){__m[id]={fn:fn,ex:null};}\nfunction __r(id){var m=__m[id];if(!m)throw new Error("missing module "+id);if(!m.ex){m.ex={};m.fn(m.ex,__r);}return m.ex;}\n';
  for (const file of files) {
    const raw = readFileSync(file, 'utf8');
    assertTransformable(raw, file);
    const code = transform(raw, dirname(file));
    out += '__d(' + JSON.stringify(file) + ', function(exports, require){\n' + code + '\n});\n';
  }
  out += '__r(' + JSON.stringify(ENTRY) + ');\n})();\n';

  if (!existsSync(SCRATCH)) mkdirSync(SCRATCH, { recursive: true });
  const scratchJs = join(SCRATCH, 'ddr-bundle.js');
  writeFileSync(scratchJs, out);
  execSync('node --check ' + JSON.stringify(scratchJs), { stdio: 'inherit' });

  // Use a function replacer so $ sequences in the bundle are not treated as
  // replacement escapes (a plain string replacement would mangle $$ into $).
  let html = readFileSync(HTML, 'utf8');
  html = html.replace(/<script type="module" src="\.\/app\.js"><\/script>/, () => '<script>\n' + out + '\n</script>');
  const scratchHtml = join(SCRATCH, 'ddr-index.html');
  writeFileSync(scratchHtml, html);

  if (!existsSync(dirname(OUT))) mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, html);
  const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
  console.log('bundled ' + files.length + ' modules, syntax check passed, wrote ' + OUT + ' (' + kb + ' kb)');
}

build();
