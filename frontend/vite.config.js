import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Plugin to remove crossorigin attribute that causes CORS issues
const removeCrossOriginPlugin = () => ({
  name: 'remove-crossorigin',
  transformIndexHtml(html) {
    return html.replace(/ crossorigin/g, '');
  },
});

export default defineConfig({
  plugins: [react(), removeCrossOriginPlugin()],
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
