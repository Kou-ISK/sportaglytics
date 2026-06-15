import { defineConfig } from 'vite';

export default defineConfig({
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
