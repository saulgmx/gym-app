import { expect, test } from '@playwright/test';
import { PAGES } from './pages';

// Spec 000 AC-35: the production CSP (vite preview reuses vercel.json) is never violated.

declare global {
  interface Window {
    cspViolations?: string[];
  }
}

for (const { path, heading } of PAGES) {
  test(`AC-35: ${path} loads without CSP violations`, async ({ page }) => {
    const consoleViolations: string[] = [];
    page.on('console', (message) => {
      if (/content security policy/i.test(message.text())) consoleViolations.push(message.text());
    });
    // Injected by Playwright before any page script, so the CSP does not apply to it.
    await page.addInitScript(() => {
      window.cspViolations = [];
      document.addEventListener('securitypolicyviolation', (event) => {
        window.cspViolations?.push(`${event.violatedDirective}: ${event.blockedURI}`);
      });
    });

    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    expect(await page.evaluate(() => window.cspViolations)).toEqual([]);
    expect(consoleViolations).toEqual([]);
  });
}
