/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Alias `@` → src (exigé par shadcn/ui ; aussi déclaré dans tsconfig.json et tsconfig.app.json).
  // `/src` est résolu depuis la racine du projet par Vite (dev, build et Vitest).
  resolve: {
    alias: { '@': '/src' },
  },
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
