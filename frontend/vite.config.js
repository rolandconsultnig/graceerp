import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 2025,
    proxy: {
      '/api': {
        target: 'http://localhost:2020',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:2020',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../backend/public',
    emptyOutDir: true,
  },
});
