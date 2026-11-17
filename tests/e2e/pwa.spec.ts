import { expect, test } from '@playwright/test';
import { waitForControllingWorker } from './helpers';

// Spec 000 AC-30 and AC-31 (QS-06, partial) on the production build.

test('AC-30: the manifest is installable with --bg colors and maskable icons', async ({ page }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('/manifest.webmanifest');

  const manifest = (await (await page.request.get(href ?? '')).json()) as {
    display: string;
    theme_color: string;
    background_color: string;
    icons: { sizes: string; purpose?: string }[];
  };
  expect(manifest).toMatchObject({
    display: 'standalone',
    theme_color: '#0E1411',
    background_color: '#0E1411',
  });
  const icons = manifest.icons.map((i) => `${i.sizes} ${i.purpose ?? 'any'}`);
  expect(icons).toEqual(expect.arrayContaining(['192x192 any', '512x512 any', '512x512 maskable']));
});

test('AC-30: a service worker is registered and activated', async ({ page }) => {
  await page.goto('/');
  // `ready` resolves while the worker may still be "activating".
  await expect
    .poll(() => page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state))
    .toBe('activated');
});

test('AC-31: once loaded, the app shell works offline', async ({ page, context }) => {
  await page.goto('/');
  await waitForControllingWorker(page);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Hoy' })).toBeVisible();

  await page.getByRole('link', { name: 'Progreso' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Progreso' })).toBeVisible();

  // A deep link offline is answered by the precached index.html (navigateFallback).
  await page.goto('/sesion/w1/cierre');
  await expect(page.getByRole('heading', { level: 1, name: 'Cierre de sesión' })).toBeVisible();
  // Fonts come from the precache too, not from the network.
  expect(await page.evaluate(() => document.fonts.check('1rem "Inter Variable"'))).toBe(true);
});
