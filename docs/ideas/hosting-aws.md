# Migrar el hosting de Vercel a AWS

**Estado:** planeada, sin fecha.

## Qué requiere

- Un ADR nuevo que reemplace ADR-0011, y su propia spec.
- Revisar también ADR-0017: en S3 + CloudFront, una Action con OIDC en el tag probablemente conviene más que la rama `production`.

## Qué se conserva

El origen `https://gym.saulgmx.com` se mantiene, así que IndexedDB y la PWA instalada no se pierden: en Cloudflare solo cambia el CNAME.

## Qué hay que rehacer

- En AWS: los headers y el `Cache-Control` por ruta, el rewrite de SPA (sin servir HTML para `/assets/falta.js`) y el comando de instalación.
- En el repo: `vite.config.ts` y `tests/architecture/headers.test.ts`, que hoy leen `vercel.json`.
- La configuración fuera del repo de `architecture.md` §8.1 (Vercel y DNS).
