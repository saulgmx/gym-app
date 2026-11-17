# Handoff: estado del proyecto Gym app

**Fecha:** 17-nov-2026 · **Lee primero:** `docs/README.md` (cómo trabajamos), `docs/constitution.md` y este archivo.

## Qué existe

- **Documentación SDD completa (16-nov):**
  - `docs/README.md`: mapa de documentos, jerarquía de autoridad, flujo spec → plan → tareas → código, convenciones de IDs.
  - `docs/constitution.md` v1.0: principios P-1 a P-8 y checklist de revisión.
  - `docs/spec.md` v0.3: spec de producto (qué y por qué). Las secciones 8-10 ahora remiten a la arquitectura y los contratos.
  - `docs/architecture.md` v1.0: módulos, capas, diagramas de secuencia, persistencia, conceptos transversales, escenarios de calidad QS-01 a QS-10.
  - `docs/adr/`: ADR-0001 a 0011 aceptados (0009 UUIDv7 y fechas, 0010 `Result`, 0011 hosting en Vercel con dominio propio).
  - `docs/modules/`: contratos de `plan`, `training`, `progression`, `health`, `data` y `shared`, con reglas RN-* y pruebas de contrato.
  - `docs/templates/`: plantillas de spec de feature, plan, tareas y ADR.
- `docs/plan.md`: plan de entrenamiento de 3 bloques (fuente del seed).
- Prototipo visual (4 pantallas): https://claude.ai/artifact/4n7JmYVCDFjgH558Foi2Zk
- Repo `saulgmx/gym-app` (público) en `~/dev/personal/side-projects/gym-app`. Código de la fase 0 hasta el punto de control C:
  - A y B: herramientas, fronteras verificadas, esqueleto de módulos, `shared/kernel` (tipos branded, `Result`, fechas, números, relojes, UUIDv7, `DataPort`) y `shared/events` (bus en memoria + `@/shared/events/testing`).
  - C: tokens y estilos base con stylelint, router con `TabBar` y 4 páginas vacías, manejo de errores (ADR-0010), `bootstrap()`, PWA instalable y offline con aviso de actualización, `vercel.json` con los headers, `size-limit` (102.87 kB de 200 kB) y Playwright en Chromium y WebKit.
  - Aún no hay datos, Dexie ni despliegue.

## Decisiones tomadas

- PWA offline-first con Dexie; sin cuentas en v1 (ADR-0002).
- Monolito modular de 5 módulos + `shared` + `app` (ADR-0001); fronteras en CI (ADR-0008).
- Gráficas con uPlot (ADR-0004), estilos con CSS Modules + variables CSS (ADR-0005), estado efímero con Zustand (ADR-0006), Zod en fronteras (ADR-0007).
- La app nunca sugiere ejercicios `lumbarRisk: 'high'` (P-1, RN-PLN-07, RN-PRG-00).
- IDs UUIDv7 propios y monótonos; `Instant` nunca se compara como string (ADR-0009).
- Errores esperados con `Result` y códigos tipados por módulo; mensajes al usuario solo desde el mapa en `app` (ADR-0010).
- Hosting en Vercel servido desde un dominio propio; `main` protegida con CI obligatorio; sin funciones exclusivas de Vercel (ADR-0011). Dominio: pendiente de compra (`.com` en Cloudflare Registrar o Porkbun); se conecta en la tarea de despliegue.
- Bloque C (17-nov, aprobado durante la implementación; detalle en spec 000 §6–§7, plan §5, §6.3 y §6.10–§6.12, architecture §7.10 y modules/shared.md §4):
  - Nombres de tokens y tres hojas globales en `shared/ui` (`tokens.css`, `fonts.css`, `base.css`); `tokens.css` es el único archivo con colores literales. Clases de `*.module.css` en camelCase.
  - `cx()` en `shared/ui` para clases de CSS Modules (con `noUncheckedIndexedAccess` cada clase es `string | undefined`).
  - Errores de render: `errorElement` en la ruta raíz y `AppErrorBoundary` comparten `ErrorFallback` con "Recargar"; errores async: un solo `AppNotice` no bloqueante.
  - `compose()` sin bus de eventos hasta que un módulo publique (fase 2); `bootstrap(rootElement, { storage })`.
  - PWA: nombre "Gym", ícono de mancuerna (`public/icon.svg`), aviso de actualización con "Actualizar" y "Ahora no".
  - CSP con `frame-ancestors 'none'`, más `nosniff` y `no-referrer`; `no-cache` en toda ruta fuera de `/assets/`.
  - Aceptadas 4 vulnerabilidades moderadas de `glob`/`minimatch` vía `workbox-build` (solo build; plan §8).
- Forma de trabajo: el usuario quiere ser guiado paso a paso; ejecuta con Claude Code o su terminal.

## Pendiente de confirmar (bloquea las fases indicadas)

| # | Pregunta | Propuesta | Dónde | Fase |
|---|---|---|---|---|
| 1 | ¿Ejercicios `high`: bloqueo total o advertencia con confirmación? | Bloqueo total | plan.md §10 | 1 |
| 2 | Alternancia A/B del bloque 1 | `Block.schedule` con `weekParity` | plan.md RN-PLN-03 | 1 |
| 3 | Ejercicios con alternativa ("dominadas o jalón") | `alternatives: ID[]` | plan.md §10 | 1 |
| 4 | Series planificadas: ¿mínimo del rango? | Mínimo; extras hasta el máximo | plan.md RN-PLN-05 | 1 |
| 6 | Workouts cerrados inmutables en v1 | Sí, salvo notas | training.md RN-TRN-07 | 2 |
| 7 | Porcentajes de bajada (5% rendimiento, 10% dolor) y ejercicios `isPrimary` | Ver contrato | progression.md §9 | 4 |
| 8 | Bandas de dolor fijas aunque cambie el umbral; definición de "sube 3 sesiones" | Fijas; 3 entradas estrictamente crecientes | health.md §10 | 3 |

## Siguiente paso: fase 0, bloque D (despliegue)

1. ~~Confirmar ADR-0009, ADR-0010 y hosting~~ (hecho, 16-nov).
2. ~~Spec, plan y tareas en `docs/specs/000-fase-0/`~~ (aprobados y fusionados, PR #1 y #2).
3. ~~Bloque A, T1–T7: herramientas y fronteras~~ (fusionado, PR #3).
4. ~~Bloque B, T8–T13: kernel y bus de eventos~~ (fusionado, PR #4).
5. ~~Bloque C, T14–T22: app shell, PWA y E2E~~ (PR #5, 17-nov, listo para revisión, CI verde). Fusionarlo con "Create a merge commit".
6. **Siguiente: T23** (proteger `main`: cambios por PR, check `ci` obligatorio, sin push directo) en una rama nueva `feat/000-phase-0-d` creada desde `main` **después** de fusionar el PR #5. T23 usa `gh api` y necesita tu confirmación explícita.
7. Pendiente del usuario: comprar el dominio (T24). T25 (proyecto en Vercel y DNS) y T26 (verificación en producción con `curl -I`, instalación en el iPhone y modo avión) dependen de él. T27 cierra la fase (handoff, comandos en `CLAUDE.md`, spec implementada).

Notas para retomar:
- Entorno: Node `24.22.3` con Volta (el de Homebrew ya se desinstaló). `npm ci --strict-allow-scripts` en CI; `fsevents` denegado en `allowScripts`. Navegadores de Playwright: `npx playwright install chromium webkit` (en CI con `--with-deps`).
- Comandos: `npm run test:e2e` (construye y prueba contra `vite preview`), `npm run size`, `npm run icons` (regenera los PNG si cambia `public/icon.svg`).
- Pruebas primero: el commit en rojo se hace local **sin push**; se sube junto con la tarea que lo pone en verde. Las tareas de herramientas o solo de pruebas (T20–T22) van en un solo commit.
- Antes de escribir pruebas, revisar si el contrato deja comportamientos sin definir; proponerlos, y con la aprobación escribirlos en los docs antes del código.
- Mutaciones: tras cada prueba en verde, romper el código a propósito y ver que falla la prueba correcta. En el bloque C encontraron tres pruebas que pasaban sin probar nada: el `replace` de la redirección (T15), `showNotice` que reemplazaba el aviso (T16) y el rechazo de `persist()` sin capturar (T17: Vitest **no** marcó ese rechazo; la prueba espía `then`). Un mutante que no compila no prueba nada (el build falla antes de las pruebas).
- Copias de seguridad en scripts de mutación: `cp f bak && { cambio; prueba; cp bak f; }`, con nombre único (`$$.$RANDOM`). Con `a && b; cp bak f` el `cp` corre aunque falle `a` y restaura una copia vieja (pasó en T16).
- Comprobar con Node los valores esperados de las pruebas (contraste WCAG, prefijos UUID) en vez de escribirlos de memoria.
- Kernel: las fechas `LocalDate` se calculan con `Date.UTC`; `systemClock` se prueba con `vi.stubEnv('TZ', …)` porque `src/` no tiene tipos de Node (`process`). Las pruebas de tipos (`*.test-d.ts`) no cuentan para la cobertura.
- Eventos: los de ejemplo (`test/Pinged`, `test/Ponged`) viven en `src/shared/events/__tests__/test-events.ts`; por ampliación global, su tipo es visible en todo `src/`. Nada impide todavía importar `@/shared/events/testing` desde código de producción; si llega a pasar, añadir una regla con su fixture.
- React Router 8: sin `errorElement`, una ruta que lanza muestra su propia pantalla en inglés y `AppErrorBoundary` no la ve. `RouterProvider` del navegador viene de `react-router/dom`. `NavLink to="/"` nunca está activo en otra ruta (no necesita `end`).
- dependency-cruiser lee `exports` (react-router 8 no tiene `main`) e ignora `virtual:*` (módulos de plugins de Vite).
- stylelint: `overrides.files` se resuelve respecto al archivo de configuración; la prueba pasa la configuración como objeto con `cwd` en los fixtures.
- PWA: el precache por defecto de Workbox omite `woff2` e íconos (por eso `globPatterns`); el generador de íconos añade 30% de relleno blanco salvo `padding: 0`. En la primera visita el SW se instala pero no controla la página hasta recargar; `serviceWorker.ready` puede resolverse en `activating`.
- Headers: la prueba de arquitectura lee la CSP de `docs/architecture.md` §7.10; cambiarla es editar ese documento y `vercel.json` a la vez. Vercel aplica headers por la ruta pedida, no por el archivo servido.
- `size-limit` mide con brotli salvo `"gzip": true`.
- Playwright: WebKit (como Safari) enfoca enlaces con `Alt+Tab`. Las mutaciones E2E requieren reconstruir, porque `vite preview` sirve `dist/`.
- `eslint-disable-next-line` justificado en `src/app/errors/messages.ts` (`no-generated-empty-object-type`): quitarlo cuando un módulo exporte su primer código de error.
- El reporte de cobertura en texto oculta los archivos al 100%; para verlos, usar `--coverage.reporter=json-summary`.
- Verificar con `set -o pipefail` cuando se encadenan comandos con `|`: un `| tail` oculta el código de salida. En zsh, `echo =====` falla (usar comillas) y un glob sin coincidencias aborta el comando.
- `eslint-plugin-boundaries` v7: el descriptor `layer` va primero con `exclusive: true`; el grafo de módulos vive en `config/module-graph.json`.
- Al fusionar PR: "Create a merge commit".

## Prompt sugerido para un chat nuevo

"Vamos a seguir con la fase 0 en docs/specs/000-fase-0/tasks.md, desde la siguiente tarea pendiente (T23). Lee primero docs/README.md, docs/constitution.md y docs/handoff.md. Guíame paso a paso y muéstrame los comandos que uses para que vaya aprendiendo."
