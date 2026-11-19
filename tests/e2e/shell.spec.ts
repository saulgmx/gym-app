import { expect, test } from '@playwright/test';

// Spec 000 AC-1 and AC-23 on the production build. Spec 006 AC-1 adds the third tab, Historial.

test('AC-1: / opens Hoy in Spanish with the dark theme', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'Hoy' })).toBeVisible();
  await expect(page).toHaveTitle('Hoy · Gym');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  // --bg (#0E1411) as the body background.
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(14, 20, 17)');
});

test('AC-23: every TabBar target is at least 44 × 44 px', async ({ page }) => {
  await page.goto('/');
  const tabs = page.getByRole('navigation', { name: 'Principal' }).getByRole('link');
  await expect(tabs).toHaveCount(3);

  for (const tab of await tabs.all()) {
    const box = await tab.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});

test('AC-23: TabBar links show a visible focus ring from the keyboard', async ({
  page,
  browserName,
}) => {
  await page.goto('/');
  // WebKit, like Safari, only moves focus to links with Alt+Tab.
  const tabKey = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
  const nav = page.getByRole('navigation', { name: 'Principal' });

  for (const name of ['Hoy', 'Historial', 'Progreso']) {
    await page.keyboard.press(tabKey);
    const link = nav.getByRole('link', { name });
    await expect(link).toBeFocused();
    await expect(link).toHaveCSS('outline-style', 'solid');
    // 0.1875rem at the default 16px root size.
    await expect(link).toHaveCSS('outline-width', '3px');
  }
});
