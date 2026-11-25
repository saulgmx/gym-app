# Migrar a Node 26

**Estado:** pospuesta por el dueño del producto (20-nov-2026).

## Contexto

- Node 26 es el LTS activo desde oct-2026; Node 24 está en mantenimiento hasta abr-2028.
- Vercel avisa que la configuración del proyecto cambió (probablemente "Node.js Version" a 26.x). No rompe nada, porque `engines.node: "24.x"` manda sobre esa configuración.

## Cuando toque

Un PR aparte con:

- `.tool-versions` y `engines.node` a 26, y `mise install`.
- Verificación completa, con E2E y `npm run size`.
- Compatibilidad de Vite, Vitest, Playwright, ESLint y `size-limit`.
- Vercel en 26.x.
- Notas de la guía de desarrollo (§1) y del plan de la spec 000.
