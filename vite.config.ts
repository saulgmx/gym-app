import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const BG = '#0E1411'; // --bg (spec §7.4)

export default defineConfig({
  plugins: [
    react(),
    // Plan §6.12. Registration comes from useRegisterSW, so no inline script fights the CSP.
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      // globPatterns already precaches every icon; adding them here too duplicates entries.
      includeManifestIcons: false,
      manifest: {
        name: 'Gym',
        short_name: 'Gym',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: BG,
        background_color: BG,
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Workbox's default omits fonts and icons; offline the app would fall back to system fonts.
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico}'],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // Vite's default baseline excludes Safari 16.0-16.3; RNF-07 requires iOS 16+ (plan §6.8).
    target: ['es2022', 'safari16', 'ios16'],
  },
});
