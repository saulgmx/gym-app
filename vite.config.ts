import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // Vite's default baseline excludes Safari 16.0-16.3; RNF-07 requires iOS 16+ (plan §6.8).
    target: ['es2022', 'safari16', 'ios16'],
  },
});
