# Handoff: estado del proyecto Gym app

**Fecha:** 20-nov-2026 (fase 3 cerrada: specs 005, 005b, 006, 007 y 008 implementadas; siguiente: fase 4; Node con mise en lugar de Volta) · **Lee primero:** `docs/README.md` (cómo trabajamos), `docs/constitution.md` y este archivo. La historia detallada de cada fase está en [`handoff-history.md`](handoff-history.md); solo hace falta si una tarea toca algo antiguo y su spec o contrato no lo aclaran.

## Estado actual

- **App en producción:** https://gym.saulgmx.com (Vercel, `main` protegida con CI), instalada en el iPhone. Repo `saulgmx/gym-app` (público). Prototipo visual: https://claude.ai/artifact/4n7JmYVCDFjgH558Foi2Zk
- **Documentos y versiones:** `constitution.md` v1.1 (P-2 enmendado, ADR-0013), `spec.md` v0.14, `architecture.md` v1.5, ADR-0001 a 0014 (0014 propuesto) (0007 reemplazado por 0012). Contratos: `plan` v1.22, `training` v1.34, `health` v1.15 (textos validados), `data` v1.7, `shared` (§2 con `SeriesRow`). Diseños elegidos en `docs/design-hoy.md`, `design-sesion-activa.md` y `design-cierre.md`.
- **Base Dexie `gym-app` v3** (tablas de `plan`, `workouts`, `sets`, `painEntries`); seed real en `src/app/seed/plan-seed.json` (36 ejercicios, 4 bloques, 11 plantillas). En el iPhone el plan empezó el lunes 16-nov-2026.
- **Bundle inicial:** 177.49 kB de 200 kB. **E2E:** 150, en Chromium y WebKit.
- **Piloto de ejecución delegada** a Qwen 3.6 35B local (ADR-0014 propuesto, PR #72); ver "Piloto Opus → Qwen".
- **Fases hechas** (detalle en `handoff-history.md` y en cada spec):

| Fase | Spec | Qué entregó | PR |
|---|---|---|---|
| 0 | `000-fase-0` | Herramientas, fronteras en CI, kernel, PWA, Vercel y dominio | #3 a #6 |
| 1 | `001-fase-1` | Módulo `plan`, seed, "Hoy" | #7 a #10 |
| 2 | `002-fase-2` | Módulo `training`, sesión activa, base v2 | #12 a #17 |
| 2.5 | `003-rediseno-hoy`, `004-rediseno-sesion` | Rediseño de "Hoy" y de la sesión activa | #20 a #30 |
| 3 | `005-cierre` | Módulo `health`, Cierre con dolor lumbar, base v3 | #37 a #45 |
| 3 | `005b-una-sesion-por-dia` | Una sola sesión cerrada por día (RN-TRN-27) | #46 a #50 |
| 3 | `006-historial` | Pestaña "Historial", lista y detalle | #51 a #57 |
| 3 | `007-respaldo` | Módulo `data`, pestaña "Ajustes", respaldo JSON | #58 a #65 |
| 3 | `008-csv` | "Exportar series (CSV)" en Ajustes; cierra la fase 3 | #66 a #68, #70, #73, #75 y el de cierre |

## Decisiones tomadas

- PWA offline-first con Dexie; sin cuentas en v1 (ADR-0002).
- Monolito modular de 5 módulos + `shared` + `app` (ADR-0001); fronteras en CI (ADR-0008).
- Gráficas con uPlot (ADR-0004), estilos con CSS Modules + variables CSS (ADR-0005), estado efímero con Zustand (ADR-0006), Zod valida la forma y el dominio las reglas (ADR-0012, que reemplaza a ADR-0007).
- La app nunca sugiere ejercicios `lumbarRisk: 'high'` (P-1, RN-PLN-07, RN-PRG-00).
- IDs UUIDv7 propios y monótonos; `Instant` nunca se compara como string (ADR-0009).
- Errores esperados con `Result` y códigos tipados por módulo; mensajes al usuario solo desde el mapa en `app` (ADR-0010).
- Hosting en Vercel servido desde un dominio propio; `main` protegida con CI obligatorio; sin funciones exclusivas de Vercel (ADR-0011). Dominio `saulgmx.com` (Bloque D).
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
- Node con **mise** en lugar de Volta (20-nov, Volta dejó de mantenerse): `.tool-versions` es la única fuente de la versión, para mise en local y `setup-node` en CI; npm va con Node (24.22.3 trae 11.19.1). Sin ADR: es del entorno de desarrollo, no de la app (detalle en spec 000 plan §6 y §8).
- Forma de trabajo: el usuario quiere ser guiado paso a paso; ejecuta con Claude Code o su terminal.

## Pendiente de confirmar (bloquea las fases indicadas)

| # | Pregunta | Propuesta | Dónde | Fase |
|---|---|---|---|---|
| 7 | Porcentajes de bajada (5% rendimiento, 10% dolor) y ejercicios `isPrimary` | Ver contrato | progression.md §9 | 4 |

## Piloto Opus → Qwen

- **Calibración T5 (spec 008):** 1 intento (~3 min), 1 ronda de revisión (~2 min), 0 violaciones, 19/19 pruebas, 7/7 mutaciones.
- **T9 (spec 008), sin supervisión:** Claude lanza `qwen` en modo no interactivo (prompt posicional; `-p` está obsoleto en la 0.28.0) con `--approval-mode auto-edit --exclude-tools run_shell_command --max-wall-time 20m --max-session-turns 40`; brief y logs en `/tmp/qwen-T9/`. Intento 1 (119 s) falló en lint (`unbound-method`) por una línea de ejemplo del brief; intento 2 (962 s, con un `ETIMEDOUT` de LM Studio y reintento) pasó. 0 archivos fuera de lo permitido, 8/8 mutaciones; Claude solo retocó el orden de un import y un comentario. **Lecciones:** el código de ejemplo del brief tiene que pasar lint; en jsdom, comparar bytes como arrays (`Uint8Array` de jsdom y de Node no son `toEqual`).
- **Script para las próximas delegaciones:** `~/qwen-calib/run-qwen.sh <tarea> <intento>` (fuera del repo, aprobado el 20-nov, aún sin uso real). Lee `~/qwen-calib/<tarea>/brief-N.md` y `allowed.txt`; pasa el brief por stdin con los mismos límites que T9 más `--max-tool-calls 80` y `--output-format stream-json`; mide lo que cambió Qwen contra una foto del árbol y deja `attempt-N.log`, `.jsonl`, `.stderr`, `.patch` y `summary.tsv`. No carga modelos a mano (JIT). Lanzarlo en segundo plano: puede pasar de 10 min. En su primer uso, confirmar en el `.jsonl` los eventos `tool_use`, `tool_result` e `is_error` (vistos solo en el código de `qwen`).
- **Entorno:** LM Studio con JIT y un solo modelo en memoria (no cargar modelos a mano). El 35B con contexto 131072 y `samplingParams` en `~/.qwen/settings.json` (temperature 0.6, top_p 0.95, top_k 20), porque Qwen Code manda su propia temperatura.
- **Pendientes:** el 27B falla al formatear llamadas a herramientas; apagar la memoria automática de Qwen Code. (El MCP de AWS ya no está: `qwen mcp list` no muestra servidores.)
- La sección "Ejecución delegada" de `docs/README.md`, `QWEN.md` y la columna `Q` de `templates/tasks.md` se agregan cuando ADR-0014 pase a `Aceptado`.

## Siguiente paso

La fase 3 (MVP usable en el gym, spec §13) está cerrada: la spec 008 cerró con el PR de cierre (A en el #70, B en el #73, C en el #75; detalle en `handoff-history.md` y en `docs/specs/008-csv/tasks.md`). En el iPhone ya están el Cierre con dolor lumbar, el historial, el respaldo JSON y el CSV de series.

**Fase 4, v1.0** (spec §13: progresión, alertas, temporizador, peso corporal, gráficas). Primero, cerrar la pregunta 7 (porcentajes de bajada y ejercicios `isPrimary`, `progression.md` §9) y proponer cómo repartir la fase en specs, como la fase 3 (005 a 008). Pruebas primero en `progression` y `health`.

Además:

1. **Ya sin pendientes tuyos (20-nov):** T20a de la 007 verificada en el iPhone (el aviso ya no sale al tocar "Compartir" en Safari) y T24 de la 005 hecha (el traumatólogo validó sin cambios los textos de salud y el aviso médico de Ajustes; `health.md` v1.15).
2. **Node 26 (pospuesto por el usuario, 20-nov):** Node 26 es el LTS activo desde oct-2026; Node 24 está en mantenimiento hasta abr-2028. Vercel avisa que la configuración del proyecto cambió (probablemente "Node.js Version" a 26.x); no rompe nada, porque `engines.node: "24.x"` manda sobre esa configuración. Cuando toque: PR aparte con `.tool-versions` y `engines.node` a 26, `mise install`, verificación completa (con E2E y `size`), compatibilidad de Vite, Vitest, Playwright, ESLint y `size-limit`, Vercel en 26.x y notas del handoff y del plan de la fase 0.
3. **Planeado, sin fecha:** migrar el hosting de Vercel a AWS. Requiere un ADR nuevo que reemplace ADR-0011 y su propia spec. El origen `https://gym.saulgmx.com` se mantiene, así que IndexedDB y la PWA instalada no se pierden: en Cloudflare solo cambia el CNAME. Hay que rehacer en AWS los headers y el `Cache-Control` por ruta, el rewrite de SPA (sin servir HTML para `/assets/falta.js`) y el comando de instalación, y cambiar `vite.config.ts` y `tests/architecture/headers.test.ts`, que hoy leen `vercel.json`.

## Notas para retomar

- Entorno: Node `24.22.3` con mise (`.tool-versions`; `mise install` en un equipo nuevo) y un Node 24 global (`~/.config/mise/config.toml`). Shims de mise en `~/.zshenv` y otra vez en `~/.zprofile`, y `mise activate zsh` en `~/.zshrc`: `path_helper` (`/etc/zprofile`) corre después de `~/.zshenv` y pone `/opt/homebrew/bin` primero, así que sin la línea de `~/.zprofile` un `node` que Homebrew instale como dependencia (pasó con Qwen Code y Volta) gana al fijado. Comprobar con `zsh -lic 'which -a node'`. `npm ci --strict-allow-scripts` en CI; `fsevents` denegado en `allowScripts`. Navegadores de Playwright: `npx playwright install chromium webkit` en local; en CI vienen en la imagen `mcr.microsoft.com/playwright` del job `ci`, con la misma versión que `@playwright/test` (al actualizar Playwright, cambiar la etiqueta y el digest de la imagen en `ci.yml`).
- Una prueba que dispara una exportación y termina sin esperarla deja la lectura de IndexedDB corriendo: con la suite completa, el archivo llega al `deliverFile` de la prueba siguiente (spec 008 T11). Esperar a que se llame `deliverFile` antes de terminar.
- El BOM en el código va como escape `\uFEFF`: el carácter literal falla en lint (`no-irregular-whitespace`), y en T11 algo lo convirtió al guardar. Para leerlo en una prueba, `new TextDecoder('utf-8', { ignoreBOM: true })` (por defecto lo quita, igual que `blob.text()`).
- Al cerrar cada tarea, `npx tsc -b --force`: el `tsc -b` incremental de `npm run typecheck` dejó pasar un error de tipos en T10 que el CI sí vio.
- Comandos: `npm run test:e2e` (construye y prueba contra `vite preview`), `npm run size`, `npm run icons` (regenera los PNG si cambia `public/icon.svg`).
- Pruebas primero: el commit en rojo se hace local **sin push**; se sube junto con la tarea que lo pone en verde. Las tareas de herramientas o solo de pruebas (T20–T22) van en un solo commit.
- Antes de escribir pruebas, revisar si el contrato deja comportamientos sin definir; proponerlos, y con la aprobación escribirlos en los docs antes del código.
- Mutaciones: tras cada prueba en verde, romper el código a propósito y ver que falla la prueba correcta. En el bloque C encontraron tres pruebas que pasaban sin probar nada: el `replace` de la redirección (T15), `showNotice` que reemplazaba el aviso (T16) y el rechazo de `persist()` sin capturar (T17: Vitest **no** marcó ese rechazo; la prueba espía `then`). Un mutante que no compila no prueba nada (el build falla antes de las pruebas).
- Un mutante con reemplazo global (`replace_all`, `sed …/g`) puede tocar más de lo que dice: en la spec 008 T5, "LF en vez de CRLF" también cambió la regex que decide las comillas (`/[,"\r\n]/`). Mirar el diff del mutante antes de contar el resultado.
- Código implementado por otro modelo (spec 008 T5, Qwen): se verifica con las mutaciones de la tarea y el commit lleva el trailer `Implemented-by: <modelo> (attempt N/3)` además del `Co-Authored-By`.
- Mutantes mal escritos (fase 1, B): uno que no hace el cambio que dice, uno que no compila (variable inexistente) o uno que solo cubre la mitad del cambio sobreviven o "mueren" sin probar nada. Revisar el mutante antes de concluir. El script de mutación debe correr también los `*.test-d.ts` (`--typecheck`) cuando el mutante es de tipos.
- `rejects.toThrow()` sin patrón acepta cualquier error, también un `TypeError` accidental: exigir el de la regla (`/RN-PLN-22/`). Los mensajes de error del dominio y de la infraestructura citan su regla.
- `vi.spyOn(Promise.prototype, 'then')` entra en recursión (Vitest usa promesas): reemplazar `then` a mano solo durante la llamada y restaurarlo en `finally` (`src/app/__tests__/compose.test.ts`).
- Zod 4 bajo la CSP: `z.config({ jitless: true })` antes de definir los esquemas; si no, su prueba de `new Function` es una violación de `eval` en `csp.spec`.
- `npm run size` mide `dist/` tal como está: construir antes (`npm run build`), o se mide un bundle viejo.
- `fake-indexeddb`: `import 'fake-indexeddb/auto'` por archivo y una base con nombre propio (`crypto.randomUUID()`); cerrar y `Dexie.delete` en `afterEach`. Un *hook* `creating` que lanza sirve para forzar un fallo a mitad de una transacción.
- El seed se escribe con el tipo de entrada del esquema (`z.input<typeof planSeedSchema>`) en los fixtures; `plan-seed.summary.md` está en `.prettierignore` para que la comparación sea exacta.
- Copias de seguridad en scripts de mutación: `cp f bak && { cambio; prueba; cp bak f; }`, con nombre único (`$$.$RANDOM`). Con `a && b; cp bak f` el `cp` corre aunque falle `a` y restaura una copia vieja (pasó en T16).
- Mutaciones con script: Vitest 5 con `--reporter=json` escribe en `.vitest/json/output.json` (no en stdout); pasar `--outputFile=<ruta fuera del repo>`. Un mutante mal escrito (por ejemplo, que deja un `throw` incondicional) "muere" sin probar nada: revisar que lo mate la prueba de su regla, no todas.
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
- El reporte de cobertura en texto oculta los archivos al 100%; para verlos, usar `--coverage.reporter=json-summary`.
- Verificar con `set -o pipefail` cuando se encadenan comandos con `|`: un `| tail` oculta el código de salida. En zsh, `echo =====` falla (usar comillas) y un glob sin coincidencias aborta el comando.
- `eslint-plugin-boundaries` v7: el descriptor `layer` va primero con `exclusive: true`; el grafo de módulos vive en `config/module-graph.json`.
- Al fusionar PR: "Create a merge commit".
- `main` protegida: ni un push directo ni un PR con `ci` en rojo entran, tampoco como admin. Para una emergencia, desactivar temporalmente en Settings → Branches.
- zsh no divide variables sin comillas: opciones de `curl` en una variable van como array, `R=(--resolve a)` y `curl "${R[@]}"`. Lo mismo con varios archivos de prueba en un script de mutantes: `T=(a.test.ts b.test.ts)` y `npx vitest run "${T[@]}"`; con `$T`, Vitest recibe una sola ruta, no encuentra nada y todos los mutantes "sobreviven" (spec 005b T4).
- DNS: si el Mac preguntó por un nombre antes de que existiera, guarda el "no existe" (~30 min). Verificar con `dig +short nombre @1.1.1.1` y `curl --resolve nombre:443:IP`, o limpiar con `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`.
- En la fase 0 solo hay 2 pestañas (Hoy y Progreso); Sesión y Cierre se abren por URL.
- `Suspense` en pruebas (fase 1, C): en el entorno de `act`, React solo reintenta un componente suspendido en `use(promesa)` dentro de un `act` esperado con `await`. `src/app/__tests__/test-app.tsx` renderiza así; para probar el orden real de arranque (promesa que se resuelve después), montar con `createRoot` y `IS_REACT_ACT_ENVIRONMENT = false` durante la prueba (`today-page.test.tsx`).
- `import 'fake-indexeddb/auto'` va **antes** de cualquier import que cargue Dexie (incluido el router o una página): Dexie toma `indexedDB` al cargarse y, si no está, falla con `MissingAPIError`.
- Vitest 5 oculta la consola de las pruebas que pasan: para depurar con `console.log`, hacer fallar la prueba a propósito.
- `useLiveQuery` conserva el resultado anterior al cambiar las dependencias (por eso los hooks fechan su resultado) y lanza los errores en el render. Con Dexie 4.4.7 una espera ajena (`setTimeout`) en la consulta no rompe el seguimiento (plan 001 §6.4).
- Zod 4 bajo la CSP: `z.config({ jitless: true })` antes de definir los esquemas.
- CI: `npx playwright install --with-deps` se colgaba a veces porque el mirror de Ubuntu bajaba los 139 MB de dependencias a ~60 kB/s (18-nov: un intento llegó al límite de 5 min). Desde el PR `ci/playwright-container` el job corre en la imagen oficial de Playwright y ya no usa `apt`.
- PWA en iOS: el aviso de versión nueva aparece al volver a abrir la app; "Actualizar" recarga y aplica la versión. Una versión sin cambios visibles parece que "no hizo nada". Desde la fase 2 el aviso no aparece mientras haya una sesión activa (AC-37).
- React Router 8 navega con transiciones asíncronas: dentro del `act` síncrono de un clic normal, el trabajo pendiente se puede descartar y la navegación no llega. En las pruebas de `app`, los toques que navegan usan `tapToNavigate` (`src/app/__tests__/test-app.tsx`), y antes de tocar algo en "Hoy" hay que esperar a que cargue (`use(ready)`). Era la causa de la prueba de rutas inestable desde la fase 1.
- El foco que se mueve en un `useEffect` llega después del render: esperarlo con `waitFor`, no con un `expect` justo después del texto nuevo.
- E2E con recarga: un campo se guarda unos milisegundos después del Enter, y recargar antes corta la escritura. Las pruebas esperan a que IndexedDB tenga el valor (`waitForStoredSet` en `tests/e2e/helpers.ts`) y luego recargan.
- `NavLink` solo marca su propia ruta: "Hoy" en `/dia/:date` usa `Link` con `aria-current` calculado (`TabBar.tsx`).
- Probar lo que se **ve**, no solo lo que se guarda: el signo de la asistencia se guardaba bien y se mostraba mal en reps y RIR, y solo lo encontró el iPhone (PR #17).
- Un mutante de un límite de errores debe quitarlo del árbol: si conserva `getDerivedStateFromError`, sigue atrapando el error y el mutante "sobrevive" sin probar nada.
- E2E con `page.clock.install` (spec 003 T16): con el reloj pausado desde la carga, "Hoy" no sale del estado de carga (solo el `h1` oculto). Se deja fluir, y se pausa con `pauseAt` cuando la tarjeta ya se ve; desde ahí solo `runFor` lo mueve. Se pausa respecto al `startedAt` guardado (en segundos enteros), no a una hora fija: en CI el clic de inicio puede llegar después de 1 s y se vería "18:41" (pasó en el PR #25; se reproduce con un `waitForTimeout(1500)` antes del clic). El resto del E2E sigue con `setFixedTime` (`freezeClockAt`).
- El WebKit de Playwright 1.65 escribe los nombres cortos sin punto ("nov", "lun"), igual que Node: el `.replace('.', '')` de `format-date.ts` lo cubre `format-date-period.test.ts`, que hace que `Intl` añada el punto. En el iPhone la fecha se ve sin punto, pero eso no dice si Safari lo pone, porque la app lo quita.
- Con una base vacía, el programa empieza el lunes de la semana de la primera visita (RN-PLN-13): el domingo 15 ya es la semana 1. Para abrir "Hoy" en otra fecha, `openTodayOn` (`tests/e2e/helpers.ts`) ancla el lunes 16 y luego mueve el reloj.
- En E2E una serie sin valores no se marca hecha (RN-TRN-04): llenar kilos, reps y RIR antes del checkbox.
- axe (`label-content-name-mismatch`, WCAG 2.5.3) exige que el nombre de un control contenga todo su texto visible: un subtítulo dentro del botón va en el nombre, no en `aria-describedby` (spec 004 T13). Las pruebas de Testing Library comparan el nombre exacto; Playwright, por subcadena.
- WebKit (como Safari) no enfoca un botón al hacerle clic con el ratón: un diálogo abierto así no tiene a quién devolver el foco. Las pruebas E2E del foco devuelto abren con el teclado (`focus()` y Enter); con el dedo en iOS no hay foco visible que recuperar (spec 004 T6).
- Dos clics de Playwright en dos pestañas nunca llegan a la vez: la segunda pestaña ve la sesión en vivo y su botón desaparece. AC-2 de spec 002 es secuencial en E2E; la simultaneidad la prueba `dexie-repository.test.ts`.
- A 320 px los nombres del seed caben aun sin `overflow-wrap: anywhere`: esa línea no se ejercita hasta que haya nombres propios (spec futura de plantillas).
- Dexie (spec 005): una versión nueva que **no menciona** una tabla la conserva; solo la borra `tabla: null`. Un mutante "v3 olvida una tabla" es equivalente.
- Dexie `liveQuery` con una base cerrada **espera en silencio** a que se abra (el hook se queda en `undefined`): para probar que un error llega al *error boundary*, usar un *hook* `reading` que lanza.
- Dexie `between(from, to)` con `from > to` devuelve vacío, no lanza.
- `useLocation().state` llega como `any`: tiparlo como `unknown` y validarlo (`ClosePage`, plan §6.6).
- Una página que guarda y luego navega debe guardar su estado en el componente que sigue montado: si la vista en vivo cambia (`completed`) y desmonta el formulario, sus `setState` se pierden (`ClosePage`, plan §6.5).
- `Promise.withResolvers` no está en el `lib` de TypeScript del proyecto: en pruebas, una promesa con `resolve` a mano.
- Las comillas simples dentro de `node -e …` cortan el script de la shell: para editar código con comillas, usar la herramienta de edición.
- E2E de la spec 005 (T22): `getByText` lee también el texto `aria-hidden` (el chip "Hecha ✓" no es `getByText('Hecha', { exact: true })`); filtrar el `listitem` por su texto visible. Los ayudantes de sesión y Cierre (`startSession`, `doSet`, `cierreWithOneSet`, `painLevel`, `storedRows`) viven en `tests/e2e/helpers.ts`; `startSession` no navega, para poder empezar sin conexión sin recargar.
- Una prueba de "vuelve a donde estaba" debe salir de un punto distinto del valor por defecto: en el ejemplo parcial, el ejercicio actual (RN-TRN-21) también es el 2, así que volver al 2 no probaba el `state` de la navegación (se abre el Cierre desde el 3).
- Mutantes E2E con script: comprobar que `npm run build` sale bien antes de correr Playwright; si no compila, Playwright prueba el `dist/` anterior y el mutante "sobrevive" o "muere" sin probar nada (pasó dos veces en T22). Reconstruir con el código real al terminar.
- Playwright no emula la zona segura (`env(safe-area-inset-*)` vale 0): el pie fijo se prueba por tamaños y posición; la zona segura, en el iPhone.
- T22: una vez falló el recorrido completo en WebKit justo tras un build, sin detalle (salida mal filtrada); no se repitió en unas 150 corridas. Si reaparece, correr con `--trace=retain-on-failure`.
- Mutantes que no compilan (spec 005b): `cond ? a : b` → `false ? a : b` deja variables sin usar y `tsc -b` falla (`noUnusedLocals`); `x && false ? …` estrecha `x` a `never` y su rama no compila. Una condición que nunca se cumple y conserva el tipo sirve: `x?.name === '' ? …`. En Vitest, un archivo que no carga da "Test Files N failed" sin "Tests N failed": el script debe tratarlo como error del mutante, no como muerto ni como vivo.
- Datos rotos en pruebas de `app` que la API ya impide (dos `completed` con el mismo `date`): `lastTestDatabase()` de `test-app.tsx` devuelve la base de los últimos servicios de prueba para escribir directo (`today-done.test.tsx`, AC-17).
- `zod/mini` (T24): la misma API en funciones (`z.pipe`, `.check(z.minLength(1))`, `z.exactOptional(…)`); las pruebas pueden seguir importando tipos de `zod`, que no entran en el bundle.
- **Correr los E2E en local antes de abrir un PR que toca algo compartido** (barra de pestañas, rutas, "Hoy", componentes de varias páginas), no solo en la tarea de E2E: la pestaña "Historial" rompió `shell.spec.ts` (contaba 2 pestañas) y el CI falló en el PR #55.
- El nombre accesible une los elementos en línea sin espacio y recorta los espacios del borde de cada elemento: en un enlace con varias partes (`HistoryRow`), el espacio separador va **entre** elementos (`{' '}`), no dentro del primero.
- Una prueba de "mientras carga" con un `ready` que nunca se resuelve no prueba nada: la página no llega a consultar. Dejar colgada la consulta concreta (`vi.spyOn(api, 'listWorkoutHistory').mockReturnValue(new Promise(() => undefined))`).
- Datos escritos directo en pruebas: que sean coherentes entre sí (un `programWeek` que corresponda a la fecha; series que pertenezcan al workout). Un dato imposible hace fallar la prueba por la razón equivocada.
- Una spec puede contradecir un contrato de más rango: gana el contrato (`docs/README.md`) y se corrige la spec antes del código (spec 006 decisión 10, RN-TRN-17).
- `addExtraSet` solo hasta `maxSets` (`TemplateItem.sets[1]`, RN-TRN-10): para ejemplos con serie extra, elegir un ítem con margen (en la semana 2, Fondos `[2, 3]`; Press inclinado `[3, 3]` ya empieza en su máximo).
- Capturas para revisar a mano: un E2E temporal con `page.screenshot({ fullPage: true })` en el scratchpad, borrado al terminar. En la captura de página completa, la barra fija sale a media altura: es un efecto de la captura, no un error.
- **iOS, datos de la PWA instalada (spec 007 T20):** la app de la pantalla de inicio guarda sus datos aparte de Safari. Ajustes de iOS → Safari → Datos de sitios web no la vacía (y además agrupa todo `saulgmx.com`, así que borraría otras apps del dominio). Para empezar de cero: mantener pulsado el icono → "Eliminar app" y reinstalarla desde Safari.
- **Consola del iPhone:** Web Inspector desde la Mac. iPhone: Ajustes → Apps → Safari → Avanzado → Web Inspector; Mac: Safari → Ajustes → Avanzado → "Mostrar funciones para desarrolladores web"; con cable, menú Desarrollo → el iPhone → la página. El handler global escribe "Unexpected error" seguido del error real.
- Safari del iPhone inyecta scripts propios (la hoja de compartir) que pueden fallar; llegan como evento `error` con `event.error` nulo. El handler global los ignora con `console.warn` (spec 007 decisión 19); un error de la app siempre trae el objeto (`only-throw-error`).
- Pruebas de `app` que exportan o importan (spec 007): con la suite completa, IndexedDB tarda más que el `act` del clic; esperar el efecto con `waitFor` (que se llamó a `deliverFile`, que el botón volvió), no suponerlo tras el `act`.
- Una región `role="status"` que siempre está montada (para que se anuncie): `findByRole('status')` la encuentra vacía al instante; esperar su texto con `waitFor`.
- `user.upload(input, [])` no dispara `change`: para "cerrar el selector sin elegir", `fireEvent.change(input, { target: { files: [] } })`. El valor de un `<input type="file">` se limpia con `value = ''` para poder elegir el mismo archivo otra vez.
- E2E de descargas (spec 007): quitar `navigator.share` y `canShare` con `addInitScript` (`withoutShare` en `tests/e2e/helpers.ts`) para que siempre descargue; `waitForEvent('download')` y `download.path()`; el selector de archivos con `waitForEvent('filechooser')` al tocar el botón. Un segundo "teléfono" es `browser.newContext({ ...devices[…], baseURL, timezoneId })`: con `exactOptionalPropertyTypes`, `test.info().project.use` no se puede pasar campo a campo.
- `perl -0pi -e 's{…}{…}'` con llaves dentro del patrón o del reemplazo (imports de TypeScript) confunde los delimitadores y deja el archivo roto: para editar imports, usar la herramienta de edición.

## Prompt sugerido para un chat nuevo

"Empezamos la fase 4. Lee primero docs/README.md, docs/constitution.md y docs/handoff.md ("Siguiente paso"), y luego docs/spec.md (§13 y los requerimientos de la fase 4) y docs/modules/progression.md (§9, pregunta 7). La fase 3 está cerrada. Ayúdame a cerrar la pregunta 7 y propón cómo repartir la fase 4 en specs. Guíame paso a paso, una tarea a la vez."
