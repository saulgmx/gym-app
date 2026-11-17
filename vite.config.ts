import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const BG = '#0E1411'; // --bg (spec §7.4)

/**
 * Global headers of vercel.json (CSP and security), so `vite preview` and the e2e tests run with
 * the same policy as production (plan §6.3). `vite dev` does not get them: HMR injects inline scripts.
 */
function productionHeaders(): Record<string, string> {
  const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as {
    headers: { source: string; headers: { key: string; value: string }[] }[];
  };
  const global = vercel.headers.find((rule) => rule.source === '/(.*)');
  if (!global) throw new Error('vercel.json has no global "/(.*)" header rule');
  return Object.fromEntries(global.headers.map(({ key, value }) => [key, value]));
}

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
  preview: {
    headers: productionHeaders(),
  },
});
