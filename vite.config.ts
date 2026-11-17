/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Indispensable avec les volumes Docker sous Windows / macOS
    watch: { usePolling: true, interval: 300 },
  },
  build: {
    rolldownOptions: {
      output: {
        // Leaflet et react-leaflet dans un chunk à part (mis en cache indépendamment du code de
        // l'app). Vite 8 / Rolldown : remplace l'ancien `manualChunks` objet, qui n'existe plus.
        codeSplitting: {
          groups: [{ name: 'leaflet', test: /node_modules[\\/](react-)?leaflet[\\/]/ }],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
