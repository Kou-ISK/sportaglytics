import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true,
  },
  build: {
    outDir: 'build',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('react')) return 'vendor-react';
          if (id.includes('@mui')) return 'vendor-mui';
          if (id.includes('video.js')) return 'vendor-videojs';
          if (id.includes('recharts')) return 'vendor-recharts';
          if (id.includes('@dnd-kit')) return 'vendor-dnd';
          if (id.includes('lodash')) return 'vendor-lodash';
          return 'vendor';
        },
      },
    },
  },
});
