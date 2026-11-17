import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import viteConfig from '../../vite.config';

// Spec 000 AC-38 (partial) and AC-35 groundwork: vercel.json applies the headers of architecture
// §7.10 and §8 and ADR-0011, and `vite preview` serves the same global headers (plan §6.3).

interface Header {
  key: string;
  value: string;
}

interface VercelConfig {
  headers: { source: string; headers: Header[] }[];
  rewrites: { source: string; destination: string }[];
}

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const vercel = JSON.parse(read('vercel.json')) as VercelConfig;

/** The CSP as written in architecture §7.10, the single source of truth (ADR-0011). */
const ARCHITECTURE_CSP = /^- CSP: `([^`]+)`/m.exec(read('docs/architecture.md'))?.[1];

// These sources only use regex groups, so `^source$` is how Vercel matches them.
const matches = (source: string, path: string) => new RegExp(`^${source}$`).test(path);

/** Every header value that applies to a path, grouped by header name. */
function headersFor(path: string): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const rule of vercel.headers.filter((r) => matches(r.source, path))) {
    for (const { key, value } of rule.headers) {
      result.set(key, [...(result.get(key) ?? []), value]);
    }
  }
  return result;
}

const rewriteFor = (path: string) =>
  vercel.rewrites.find((r) => matches(r.source, path))?.destination;

const PAGES = ['/', '/progreso', '/sesion/w1/0', '/sesion/w1/cierre'];
const SHELL_FILES = ['/index.html', '/sw.js', '/manifest.webmanifest', '/pwa-192x192.png'];
const HASHED_ASSETS = ['/assets/index-B_NqKpmH.js', '/assets/inter-latin-wght-normal-Dx4kXJ.woff2'];
const ALL = [...PAGES, ...SHELL_FILES, ...HASHED_ASSETS];

describe('vercel.json headers', () => {
  it('reads the CSP from architecture §7.10', () => {
    expect(ARCHITECTURE_CSP).toMatch(/^default-src 'self';/);
  });

  it.each(ALL)('AC-38: %s gets exactly the CSP of architecture §7.10', (path) => {
    expect(headersFor(path).get('Content-Security-Policy')).toEqual([ARCHITECTURE_CSP]);
  });

  it.each(ALL)('%s gets nosniff and no-referrer', (path) => {
    const headers = headersFor(path);
    expect(headers.get('X-Content-Type-Options')).toEqual(['nosniff']);
    expect(headers.get('Referrer-Policy')).toEqual(['no-referrer']);
  });

  it.each([...PAGES, ...SHELL_FILES])('AC-38: %s is served with no-cache', (path) => {
    expect(headersFor(path).get('Cache-Control')).toEqual(['no-cache']);
  });

  it.each(HASHED_ASSETS)('AC-38: %s is cached as immutable', (path) => {
    expect(headersFor(path).get('Cache-Control')).toEqual(['public, max-age=31536000, immutable']);
  });
});

describe('vercel.json rewrites', () => {
  it.each(PAGES)('AC-39: %s falls back to /index.html', (path) => {
    expect(rewriteFor(path)).toBe('/index.html');
  });

  it.each(['/assets/missing.js', '/sw.js', '/favicon.ico'])(
    '%s is not rewritten, so a missing file is a 404 rather than HTML',
    (path) => {
      expect(rewriteFor(path)).toBeUndefined();
    },
  );
});

describe('portability and preview', () => {
  it('ADR-0011: vercel.json uses only headers and rewrites', () => {
    expect(
      Object.keys(vercel)
        .filter((k) => k !== '$schema')
        .sort(),
    ).toEqual(['headers', 'rewrites']);
  });

  it('AC-35: vite preview serves the same global headers as production', () => {
    const global = vercel.headers.find((r) => r.source === '/(.*)');
    expect(global).toBeDefined();
    expect(viteConfig.preview?.headers).toEqual(
      Object.fromEntries(global?.headers.map((h) => [h.key, h.value]) ?? []),
    );
  });
});
