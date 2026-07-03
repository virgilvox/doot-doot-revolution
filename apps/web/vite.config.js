import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// The web build is the primary target and never depends on Electron. When
// ELECTRON=1 is set, a second target is added via vite-plugin-electron, imported
// dynamically so a machine without the Electron toolchain can still build the web
// app. base './' keeps asset paths relative for both static hosting and the
// packaged app:// scheme.
export default defineConfig(async () => {
  const plugins = [vue()];
  if (process.env.ELECTRON) {
    const electron = (await import('vite-plugin-electron/simple')).default;
    plugins.push(electron({
      main: { entry: 'electron/main.js' },
      // sandboxed preload must be a single CommonJS file named preload.js
      preload: { input: 'electron/preload.js', vite: { build: { rollupOptions: { output: { format: 'cjs', entryFileNames: 'preload.js', inlineDynamicImports: true } } } } }
    }));
  }
  // The @doot-games packages are linked workspace source under active development,
  // so exclude them from dep pre-bundling: Vite serves them as live source with
  // HMR instead of caching a stale optimized snapshot (which otherwise drops newly
  // added exports until the cache is force-cleared).
  const workspace = ['chart', 'render', 'play', 'library'].map((n) => '@doot-games/' + n);
  return { plugins, base: './', server: { port: 4318 }, optimizeDeps: { exclude: workspace }, test: { environment: 'jsdom', globals: true, setupFiles: ['./test/setup.js'] } };
});
