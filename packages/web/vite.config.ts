import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// De /api-route gaat in development door naar het staf-servertje (packages/server).
// Draait de server niet, dan werkt alles behalve de OpenRouter-staf gewoon door.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
});
