# Tareas: Fase 0, esqueleto instalable con fronteras verificadas

**Plan:** `specs/000-fase-0/plan.md`

Cada tarea es pequeña (≤ 1-2 h), deja el CI verde y tiene una verificación concreta. En el kernel y el bus de eventos, la tarea de pruebas va antes que la de implementación (P-5). Los fixtures de fronteras se escriben antes que sus reglas.

**Responsable:** C = Claude Code · U = usuario (requiere tu cuenta o una decisión tuya).

## A. Herramientas y fronteras

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T1 | `package.json` (Volta `24.22.3`/`11.19.1`, `engines.node: "24.x"`, scripts), Vite + React + TS a mano (sin plantilla), `tsconfig` estricto (§6.1, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`), alias `@/`, `build.target` iOS 16, `index.html` con `lang="es"` y `main.tsx` mínimo | raíz, `app` | `node -v` = `v24.22.3` en el proyecto; `npm run dev` muestra "Hoy"; `npm run typecheck` y `npm run build` pasan | AC-1 (parcial), AC-2 | C | ☑ |
| T2 | Prettier + ESLint 10 (`typescript-eslint` strict-type-checked, `react-hooks`, `no-explicit-any`, `no-eval`, `no-implied-eval`, `no-new-func`, prohibir `dangerouslySetInnerHTML` con `no-restricted-syntax`) | raíz | `npm run lint` y `npm run format:check` pasan | AC-3 (config) | C | ☑ |
| T3 | Vitest 5 con proyectos `unit` (jsdom + jest-dom) y `architecture` (node), `typecheck` para `*.test-d.ts`, cobertura con umbral de 80% en `shared/kernel` y `modules/*/domain`; una prueba de humo | raíz | `npm test` pasa | — | C | ☑ |
| T4 | Workflow de CI (`.github/workflows/ci.yml`, job `ci`): `setup-node` desde `package.json`, `npm ci`, typecheck, lint, test, build | CI | El PR muestra el check `ci` en verde | AC-36 (parcial) | C | ☑ |
| T5 | Estructura de carpetas: `shared/{kernel,events,ui}`, los 5 módulos con capas vacías (`.gitkeep`) e `index.ts` con `create<Module>()` → `{}`, `app/compose.ts` | todos | `npm run typecheck` pasa; el árbol coincide con architecture §5 | — | C | ☑ |
| T6 | Fixtures de fronteras (`tests/architecture/fixtures/src/`) y pruebas: cada violación de AC-4 a AC-9 + AC-3 con su archivo válido | `tests/architecture` | Las pruebas **fallan** (rojo): todavía no hay reglas | AC-3 a AC-9 | C | ☑ |
| T7 | `eslint-plugin-boundaries` (elementos y reglas de §6.4) + `.dependency-cruiser.cjs`; `npm run lint` incluye `depcruise`; excluir fixtures del lint normal | raíz | T6 en verde; `npm run lint` pasa sobre `src/` real | AC-3 a AC-9, QS-07, CA-9 | C | ☑ |

**Punto de control A:** PR "tooling and boundaries".

## B. Kernel y eventos (pruebas primero)

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T8 | Pruebas de tipos branded, `Result`, `ok`/`err` (prueba de tipos), fechas (`addDays`, `daysBetween`, `startOfIsoWeek`, `weekdayOf`, `compareInstants`), `fixedClock`, `sequentialIds` y números | `shared/kernel` | Pruebas en rojo | AC-13 a AC-17 | C | ☑ |
| T9 | Implementar lo anterior + `systemClock` y la interfaz `DataPort` (solo tipo) | `shared/kernel` | T8 en verde; cobertura ≥ 80% | AC-13 a AC-17 | C | ☑ |
| T10 | Pruebas de `createUuidV7Generator`: formato, versión y variante, timestamp decodificable, 10 000 IDs en el mismo ms, reloj que retrocede, desbordamiento del contador | `shared/kernel` | Pruebas en rojo | AC-10 a AC-12 | C | ☑ |
| T11 | Implementar UUIDv7 (§6.5) | `shared/kernel` | T10 en verde | AC-10 a AC-12 | C | ☑ |
| T12 | Pruebas del bus: entrega asíncrona, aislamiento de fallos con `onError`, desuscripción y pruebas de tipos de `DomainEvents` (evento de ejemplo declarado solo en la prueba) | `shared/events` | Pruebas en rojo | AC-18 a AC-21 | C | ☑ |
| T13 | Implementar `createEventBus` + `@/shared/events/testing` con `flushEvents()` | `shared/events` | T12 en verde; `flushEvents` no se exporta desde `@/shared/events` | AC-18 a AC-21 | C | ☑ |

**Punto de control B:** PR "shared kernel and event bus".

## C. App, PWA y E2E

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T14 | `tokens.css` (spec §7.4), `fonts.css` con solo `woff2` latinos (§6.7), estilos base (tema oscuro, `rem`, foco visible); stylelint con `declaration-strict-value` y su prueba con un fixture CSS (escrita primero) | `shared/ui` | La prueba de AC-27 pasa; `npm run lint` incluye stylelint | AC-27 | C | ☑ |
| T15 | Router (`createBrowserRouter`): layout con `TabBar` para `/` y `/progreso`; `/sesion/:workoutId/:exerciseIndex` y `/sesion/:workoutId/cierre` sin `TabBar`; `*` → `/`; páginas vacías con los textos de spec §6 | `app` | Pruebas de componente con router en memoria | AC-22, AC-24, AC-25 | C | ☑ |
| T16 | Errores (ADR-0010): `AppErrorBoundary`, `installGlobalErrorHandlers`, store de avisos (Zustand), `AppNotice` y mapa `messages.ts` tipado (vacío) | `app` | Pruebas de componente | AC-28, AC-29 | C | ☑ |
| T17 | `bootstrap()` en `main.tsx`: handlers globales, `storage.persist()` con fallo silencioso, `compose()`, render | `app` | Prueba unitaria con `navigator.storage` simulado (existe / no existe / lo niega) | AC-33 | C | ☑ |
| T18 | PWA: `vite-plugin-pwa` (`registerType: 'prompt'`, manifest, precache), íconos generados desde `public/icon.svg` con `@vite-pwa/assets-generator` (PNG versionados), `UpdatePrompt` con `useRegisterSW` | `app` | Prueba de componente con el módulo virtual simulado; el build genera `sw.js` y `manifest.webmanifest` | AC-30 (parcial), AC-32 | C | ☐ |
| T19 | `vercel.json` (headers y rewrite de ADR-0011); `vite.config.ts` aplica sus headers globales a `preview.headers`; prueba de arquitectura de headers | raíz | `tests/architecture/headers.test.ts` pasa: CSP = architecture §7.10 y reglas de caché presentes | AC-38 (parcial) | C | ☐ |
| T20 | `size-limit` (§6.9) y paso en CI | raíz, CI | `npm run size` pasa; el CI falla si se supera el límite (comprobado bajando el límite temporalmente) | AC-34, QS-10 | C | ☐ |
| T21 | Playwright contra `vite preview` (proyectos `chromium` Pixel 7 y `webkit` iPhone 13), `shell.spec` y `a11y.spec` con axe; paso en CI | `tests/e2e`, CI | `npm run test:e2e` pasa local y en CI | AC-1, AC-23, AC-26 | C | ☐ |
| T22 | `pwa.spec` (SW activo, recarga sin conexión) y `csp.spec` (cero `securitypolicyviolation`) | `tests/e2e` | Pasan en CI; si WebKit en Linux no soporta el caso sin conexión, se limita a chromium y se anota aquí | AC-30, AC-31, AC-35, QS-06 (parcial) | C | ☐ |

**Punto de control C:** PR "app shell, PWA and e2e".

## D. Despliegue (ADR-0011)

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T23 | Proteger `main`: cambios por PR, check `ci` obligatorio, sin push directo (con `gh api` tras tu confirmación, o desde GitHub) | GitHub | Un push directo a `main` es rechazado | AC-37 | C + U | ☐ |
| T24 | Comprar el dominio (`.com` en Cloudflare Registrar o Porkbun) | — | Dominio activo en tu cuenta | — | U | ☐ |
| T25 | Crear el proyecto en Vercel desde `saulgmx/gym-app` (Node 24.x, framework Vite), añadir `gym.<dominio>` y su registro DNS | Vercel, DNS | `https://gym.<dominio>` sirve la app con HTTPS | AC-38 | U (Claude guía) | ☐ |
| T26 | Verificar producción: `curl -I` de `/`, `/sw.js`, `/assets/*` y `/progreso`; instalar en el iPhone; modo avión | producción | Headers correctos, sin 404 en rutas profundas, la app abre sin conexión en el iPhone | AC-38, AC-39, AC-31 (manual en iOS) | U + C | ☐ |
| T27 | Actualizar `handoff.md`, la sección de comandos de `CLAUDE.md` y marcar la spec como implementada | docs | Revisión | — | C | ☐ |

**Punto de control D:** PR "deploy and handoff".

## Notas

- **Ramas:** primero se fusionan `docs/phase-0-decisions` y `docs/000-phase-0-spec`. La implementación va en `feat/000-phase-0`, con un commit por tarea y un PR por punto de control. Hasta T23, `main` no está protegida: los PR se fusionan solo con el check `ci` en verde, por disciplina.
- **Orden flexible:** el bloque D no depende de C salvo T26. T24 (comprar el dominio) se puede hacer en cualquier momento.
- **Scripts esperados al final:** `dev`, `build`, `preview`, `typecheck`, `lint` (ESLint + stylelint + dependency-cruiser), `format`, `format:check`, `test`, `test:e2e`, `size`.
- Las pruebas citan el criterio en su nombre, por ejemplo `it('AC-11: 10 000 IDs en el mismo ms son únicos y ordenados')`.
