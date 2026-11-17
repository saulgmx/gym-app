import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// PWA icons from public/icon.svg (plan §6.12): `npm run icons`, PNGs versioned in public/.
// The SVG has its own full-bleed background and keeps the figure inside the maskable safe zone,
// so the preset's default padding (white, 30% on maskable and Apple icons) is turned off.
const background = '#0E1411'; // --bg

/** @type {import('@vite-pwa/assets-generator/config').AssetType[]} */
const types = ['transparent', 'maskable', 'apple'];

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: Object.fromEntries(
    types.map((type) => [
      type,
      { ...minimal2023Preset[type], padding: 0, resizeOptions: { background } },
    ]),
  ),
  images: ['public/icon.svg'],
});
