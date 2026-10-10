import { defineConfig } from 'vite';
import { licenseInventory } from './scripts/license-inventory.mjs';

export default defineConfig({
  plugins: [licenseInventory('licenses/preload.json')],
  build: {
    target: 'es2020',
    minify: false,
    sourcemap: false,
    emptyOutDir: false,
    outDir: 'build/electron/src',
    rollupOptions: {
      input: 'electron/src/preload.ts',
      external: ['electron'],
      output: {
        format: 'cjs',
        entryFileNames: 'preload.js',
        inlineDynamicImports: true,
      },
    },
  },
});
