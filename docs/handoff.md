# Handoff: estado del proyecto Gym app

**Fecha:** 17-nov-2026 · **Lee primero:** `docs/README.md` (cómo trabajamos), `docs/constitution.md` y este archivo.

## Qué existe

- **Documentación SDD completa (16-nov):**
  - `docs/README.md`: mapa de documentos, jerarquía de autoridad, flujo spec → plan → tareas → código, convenciones de IDs.
  - `docs/constitution.md` v1.0: principios P-1 a P-8 y checklist de revisión.
  - `docs/spec.md` v0.4: spec de producto (qué y por qué). Las secciones 8-10 ahora remiten a la arquitectura y los contratos. La 0.4 (17-nov) fija el bloqueo total de los ejercicios `high` en §6.5.
  - `docs/architecture.md` v1.0: módulos, capas, diagramas de secuencia, persistencia, conceptos transversales, escenarios de calidad QS-01 a QS-10.
  - `docs/adr/`: ADR-0001 a 0011 aceptados (0009 UUIDv7 y fechas, 0010 `Result`, 0011 hosting en Vercel con dominio propio).
  - `docs/modules/`: contratos de `plan`, `training`, `progression`, `health`, `data` y `shared`, con reglas RN-* y pruebas de contrato.
  - `docs/templates/`: plantillas de spec de feature, plan, tareas y ADR.
- `docs/plan.md`: plan de entrenamiento de 3 bloques (fuente del seed).
- Prototipo visual (4 pantallas): https://claude.ai/artifact/4n7JmYVCDFjgH558Foi2Zk
- Repo `saulgmx/gym-app` (público) en `~/dev/personal/side-projects/gym-app`. **Fase 0 completa** (spec 000 implementada):
  - A y B: herramientas, fronteras verificadas, esqueleto de módulos, `shared/kernel` (tipos branded, `Result`, fechas, números, relojes, UUIDv7, `DataPort`) y `shared/events` (bus en memoria + `@/shared/events/testing`).
  - C: tokens y estilos base con stylelint, router con `TabBar` y 4 páginas vacías, manejo de errores (ADR-0010), `bootstrap()`, PWA instalable y offline con aviso de actualización, `vercel.json` con los headers, `size-limit` (102.87 kB de 200 kB) y Playwright en Chromium y WebKit.
  - D: `main` protegida; app en producción en **https://gym.saulgmx.com** (Vercel), verificada con `curl -I` e instalada en el iPhone con modo avión.
  - Aún no hay datos ni Dexie: "Hoy" y "Progreso" muestran su estado vacío.

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
- Bloque D (17-nov):
  - `main` protegida (protección de rama clásica, `gh api`): solo por PR, 0 aprobaciones (GitHub no deja aprobar tus propios PR), check `ci` obligatorio y solo si lo publica GitHub Actions (`app_id 15368`), rama al día con `main` (`strict`), `enforce_admins` (la regla también aplica al admin), sin force push ni borrado.
  - Vercel: la app de GitHub tiene acceso solo a `gym-app`; framework Vite, Node 24.x por `engines`. `installCommand` vive en `vercel.json` y una prueba exige que sea el mismo `npm ci` de CI (plan §6.3).
  - Dominio `saulgmx.com` en Cloudflare Registrar. `gym` es un CNAME al valor propio del proyecto (`….vercel-dns-017.com`) en modo **DNS only** (nube gris): con proxy, Cloudflare se pondría en medio del TLS y podría inyectar scripts que la CSP bloquea. Certificado de Let's Encrypt emitido y renovado por Vercel.
- Forma de trabajo: el usuario quiere ser guiado paso a paso; ejecuta con Claude Code o su terminal.

## Pendiente de confirmar (bloquea las fases indicadas)

| # | Pregunta | Propuesta | Dónde | Fase |
|---|---|---|---|---|
| 6 | Workouts cerrados inmutables en v1 | Sí, salvo notas | training.md RN-TRN-07 | 2 |
| 7 | Porcentajes de bajada (5% rendimiento, 10% dolor) y ejercicios `isPrimary` | Ver contrato | progression.md §9 | 4 |
| 8 | Bandas de dolor fijas aunque cambie el umbral; definición de "sube 3 sesiones" | Fijas; 3 entradas estrictamente crecientes | health.md §10 | 3 |

## Siguiente paso: fase 1 (Dexie, seed y loader, `schedule.ts`)

1. ~~Fase 0~~ (bloques A–D, PR #3 a #6). Al fusionar el PR del bloque D: "Create a merge commit", con `ci` en verde y la rama al día (si GitHub dice "out-of-date", pulsar "Update branch").
2. ~~Preguntas 1 a 4~~ (17-nov, `modules/plan.md` v1.1 §10): `high` con bloqueo total, también como alternativa y al importar (RN-PLN-07); `Block.schedule` con `weekParity` por semana dentro del bloque, manda el calendario (RN-PLN-03); `TemplateItem.alternatives` y la serie registra el ejercicio usado (RN-PLN-11); se planifica el mínimo del rango (RN-PLN-05).
3. ~~Spec 001~~ aprobada (17-nov): `docs/specs/001-fase-1/spec.md`, con sus reglas ya en `modules/plan.md` v1.2 (RN-PLN-06 y 10 a 15).
4. **Siguiente:** `docs/specs/001-fase-1/plan.md` (plantilla `docs/templates/feature-plan.md`), con la tabla del catálogo del seed (`lumbarRisk`, `isPrimary`, `metric`, descansos) para que el usuario la apruebe antes de escribir el JSON. Luego `tasks.md`, con la misma puerta de aprobación que la fase 0.
5. Planeado por el usuario (17-nov), sin fecha: migrar el hosting de Vercel a AWS. Requiere un ADR nuevo que reemplace ADR-0011 y su propia spec. El origen `https://gym.saulgmx.com` se mantiene, así que IndexedDB y la PWA instalada no se pierden: en Cloudflare solo cambia el CNAME. Hay que rehacer en AWS los headers y el `Cache-Control` por ruta, el rewrite de SPA (sin servir HTML para `/assets/falta.js`) y el comando de instalación, y cambiar `vite.config.ts` y `tests/architecture/headers.test.ts`, que hoy leen `vercel.json`. Se verifica igual que T26.

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
- `main` protegida: ni un push directo ni un PR con `ci` en rojo entran, tampoco como admin. Para una emergencia, desactivar temporalmente en Settings → Branches.
- zsh no divide variables sin comillas: opciones de `curl` en una variable van como array, `R=(--resolve a)` y `curl "${R[@]}"`.
- DNS: si el Mac preguntó por un nombre antes de que existiera, guarda el "no existe" (~30 min). Verificar con `dig +short nombre @1.1.1.1` y `curl --resolve nombre:443:IP`, o limpiar con `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`.
- En la fase 0 solo hay 2 pestañas (Hoy y Progreso); Sesión y Cierre se abren por URL.

## Prompt sugerido para un chat nuevo

"Vamos a empezar la fase 1. Lee primero docs/README.md, docs/constitution.md y docs/handoff.md. Empecemos por las preguntas pendientes 1 a 4 y luego la spec 001. Guíame paso a paso y muéstrame los comandos que uses para que vaya aprendiendo."
