# Handoff: estado del proyecto Gym app

**Fecha:** 18-nov-2026 (fase 2 y rediseño de "Hoy", spec 003, completos) · **Lee primero:** `docs/README.md` (cómo trabajamos), `docs/constitution.md` y este archivo.

## Qué existe

- **Documentación SDD completa (16-nov):**
  - `docs/README.md`: mapa de documentos, jerarquía de autoridad, flujo spec → plan → tareas → código, convenciones de IDs.
  - `docs/constitution.md` v1.0: principios P-1 a P-8 y checklist de revisión.
  - `docs/spec.md` v0.7: spec de producto (qué y por qué). Las secciones 8-10 ahora remiten a la arquitectura y los contratos. La 0.4 (17-nov) fija el bloqueo total de los ejercicios `high` en §6.5; la 0.5 añade la ruta `/dia/:date`, la 0.6 `/sesion/:workoutId` (spec 002) y la 0.7 (18-nov) el rediseño de "Hoy" en §7.2, §7.3 y §13 (spec 003).
  - `docs/architecture.md` v1.3: módulos, capas, diagramas de secuencia, persistencia, conceptos transversales, escenarios de calidad QS-01 a QS-10.
  - `docs/adr/`: ADR-0001 a 0012 (0009 UUIDv7 y fechas, 0010 `Result`, 0011 hosting en Vercel con dominio propio, 0012 Zod valida la forma y el dominio las reglas, que reemplaza a 0007).
  - `docs/modules/`: contratos de `plan`, `training`, `progression`, `health`, `data` y `shared`, con reglas RN-* y pruebas de contrato.
  - `docs/templates/`: plantillas de spec de feature, plan, tareas y ADR.
- `docs/plan.md`: plan de entrenamiento de 3 bloques (fuente del seed).
- `docs/design-hoy.md`: diseño elegido de "Hoy" (tableros D y D2 del lienzo de diseño), alineado con la spec 003. `docs/design-sesion-activa.md`: diseño elegido de la sesión activa (tablero "Sesión activa A3", variantes Primero, Intermedio y Último), alineado con la spec 004.
- Prototipo visual (4 pantallas): https://claude.ai/artifact/4n7JmYVCDFjgH558Foi2Zk
- Repo `saulgmx/gym-app` (público) en `~/dev/personal/side-projects/gym-app`. **Fase 0 completa** (spec 000 implementada):
  - A y B: herramientas, fronteras verificadas, esqueleto de módulos, `shared/kernel` (tipos branded, `Result`, fechas, números, relojes, UUIDv7, `DataPort`) y `shared/events` (bus en memoria + `@/shared/events/testing`).
  - C: tokens y estilos base con stylelint, router con `TabBar` y 4 páginas vacías, manejo de errores (ADR-0010), `bootstrap()`, PWA instalable y offline con aviso de actualización, `vercel.json` con los headers, `size-limit` (102.87 kB de 200 kB) y Playwright en Chromium y WebKit.
  - D: `main` protegida; app en producción en **https://gym.saulgmx.com** (Vercel), verificada con `curl -I` e instalada en el iPhone con modo avión.
- **Fase 1 completa** (spec 001 implementada, PR #8 a #10 y el de cierre):
  - Módulo `plan` con sus cuatro capas: dominio (`schedule.ts`, `seed-rules.ts`), servicio con puertos, repositorio Dexie, esquema Zod del seed, hooks `useTodayPlan`/`useWeekPlan`, `WeekStrip` y `PlanExerciseList`. Contrato `plan` v1.10.
  - Base Dexie `gym-app` v1 (`app/db.ts`), seed real en `src/app/seed/plan-seed.json` (36 ejercicios, 4 bloques, 11 plantillas) cargado al arrancar; `compose` expone `ready`, que "Hoy" espera con `use(ready)`.
  - "Hoy" muestra fecha, bloque, semana, tira de la semana y la sesión del día; verificado en el iPhone con y sin conexión (T19). En el iPhone el plan empezó el lunes 16-nov-2026.
  - Bundle inicial 168.64 kB de 200 kB.
- **Fase 2 completa** (spec 002 implementada, PR #12 a #17 y el de cierre):
  - Módulo `training` con sus cuatro capas: dominio puro (`set-values.ts`, `workout.ts`, `history.ts`), servicio con puertos (`PlanReader`, `SuggestionProvider` nulo hasta la fase 4), repositorio Dexie donde cada cambio es una transacción (`mutate`), hooks `useWorkoutView`, `useActiveWorkout` y `useLastSession`, y los componentes `SetTable`, `SetRow` y `SessionHeader`. Contratos `training` v1.14 y `plan` v1.12 (alternativas y `getExercise(s)`).
  - Base Dexie `gym-app` **v2** (tablas `workouts` y `sets`); la subida desde v1 se probó (AC-38) y se verificó en el iPhone.
  - "Hoy" con "Iniciar", "Continuar" (con fecha si es de otro día) y "Descartar sesión"; "Otra sesión de esta semana" y su vista previa en `/dia/:date`; la sesión en `/sesion/:workoutId/:exerciseIndex` con tabla de series, "anterior", coma decimal, asistencia (peso negativo), alternativas, series extra y "Anterior"/"Siguiente". El aviso de actualización espera a que no haya sesión activa.
  - Bundle inicial **160.08 kB** de 200 kB, con el esquema del seed en `zod/mini` (T24). Marcar una serie se ve en 19 ms en Chromium y 4-5 ms en WebKit.
  - Verificado en el iPhone (T26): la primera pasada encontró las reps y el RIR con signo menos bajo la asistencia, solo en pantalla, corregido en el PR #17.
- **Rediseño de "Hoy" completo** (spec 003 implementada, PR #20, #23, #24 y el de cierre):
  - `plan`: duración estimada (`setSeconds`, `plannedSessionSeconds`, `displayMinutes`, RN-PLN-27), `WeekStrip` con marcas y `PlanExerciseList` sin RIR por fila. Contrato `plan` v1.14.
  - `training`: avance y tiempo restante (`progressOf` puro y `workoutProgress`, RN-TRN-20 y 21), `getActiveWorkoutView` y `useActiveWorkoutView`; `firstPending` pasó al dominio. Contrato `training` v1.16.
  - `shared`: `ConfirmDialog` anclado abajo con la zona segura.
  - "Hoy" en `app/pages/today/`: estado D (pesas, cardio, descanso, fuera del programa) y D2 ("Sesión en curso", con `Elapsed` como único reloj de 1 s).
  - Bundle inicial **161.91 kB** de 200 kB.
  - E2E con `page.clock` para D y D2, axe, 44 px y 320 px (T16). Verificado en el iPhone (T17); el día de descanso solo en E2E.

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
| 7 | Porcentajes de bajada (5% rendimiento, 10% dolor) y ejercicios `isPrimary` | Ver contrato | progression.md §9 | 4 |
| 8 | Bandas de dolor fijas aunque cambie el umbral; definición de "sube 3 sesiones". Además: el diseño de "Hoy" muestra el aviso con la **última** lectura ≥ 3/10, y la spec §6.2 lo pide sobre el umbral 2 sesiones seguidas o subiendo 3 (3/10 está en la banda "Normal"); decidir si son dos avisos o cambia la regla (spec 003 §6.6) | Fijas; 3 entradas estrictamente crecientes | health.md §10 | 3 |

## Historia y siguiente paso

1. ~~Fase 0~~ (bloques A–D, PR #3 a #6). Al fusionar el PR del bloque D: "Create a merge commit", con `ci` en verde y la rama al día (si GitHub dice "out-of-date", pulsar "Update branch").
2. ~~Preguntas 1 a 4~~ (17-nov, `modules/plan.md` v1.1 §10): `high` con bloqueo total, también como alternativa y al importar (RN-PLN-07); `Block.schedule` con `weekParity` por semana dentro del bloque, manda el calendario (RN-PLN-03); `TemplateItem.alternatives` y la serie registra el ejercicio usado (RN-PLN-11); se planifica el mínimo del rango (RN-PLN-05).
3. ~~Spec 001~~ aprobada (17-nov): `docs/specs/001-fase-1/spec.md`, con sus reglas ya en `modules/plan.md` v1.2 (RN-PLN-06 y 10 a 15).
4. ~~Plan técnico~~ aprobado (17-nov): `docs/specs/001-fase-1/plan.md`, con el catálogo del seed (36 ejercicios, §4.1), contrato `plan` v1.3 y architecture §5.2 (hooks en `ui`) y §7.3 (v1 solo con tablas de `plan`).
   `docs/specs/001-fase-1/tasks.md`: T1 a T20 en 4 puntos de control (A dominio, B persistencia y seed, C "Hoy", D verificación y cierre).
   Docs fusionados en el PR #7.
5. ~~Punto de control A, dominio~~ (T1–T6, PR #8, 17-nov): `plan/domain/types.ts`, `schedule.ts` y `seed-rules.ts` al 100% de cobertura, con 43 mutaciones detectadas. Contrato `plan` v1.5: casos de borde del calendario (RN-PLN-16 a 18) y de la validación del seed (RN-PLN-15 (e)–(h), RN-PLN-19). `npm audit`: aviso nuevo de `picomatch` ≤ 4.0.7 sin versión corregida, solo en herramientas (plan §8).
6. ~~Punto de control B, persistencia y seed~~ (T7–T14, PR #9, 17-nov; orden real T7–T11, T13, T14, T12):
   - Contrato `plan` v1.6 a v1.8: puertos `SeedParser`/`PlanRepository` (plan §6.9), `ensureSeeded` valida siempre (RN-PLN-20), errores de almacenamiento como rechazo (21), consultas sin programa lanzan (22), sin caché (23), esquema del seed (24), "vacía" son las 4 tablas y solo inserta (14), un solo programa (25). `getExercise(s)` y `listExercises` pasan a la fase 2.
   - ADR-0012 reemplaza a ADR-0007.
   - Seed real en `src/app/seed/plan-seed.json`, verificado contra `plan-seed.summary.md` (transcripción a mano de `plan.md`; reglas en plan §4.1). Revisado por el usuario con ayuda de otro modelo: sin errores; Press de banca de Torso A queda solo con barra.
   - La regla de fronteras deja que el `index.ts` de un módulo importe `shared/kernel` (architecture §5.2).
   - Bundle inicial 166.76 kB de 200 kB (umbral de `zod/mini`: 170 kB, plan §6.2); se mide otra vez en T18.
7. ~~Punto de control C, "Hoy"~~ (T15–T18, PR #10, 17-nov): contrato `plan` v1.9 (hooks: el resultado lleva su fecha, errores al *error boundary*, RN-PLN-26) y v1.10 (`ProgramPosition` con `startDate` y `totalWeeks`); `WeekStrip` con indicador de texto y nombre accesible; `TodayPage` con `Suspense` y `use(ready)`; E2E con `page.clock` en la zona del usuario, sin conexión y axe. Se mantiene Zod clásico (168.64 kB < 170 kB, plan §6.2).
8. ~~Punto de control D, cierre~~ (T19–T20, 17-nov): verificado en el iPhone (aviso de actualización, datos y modo avión); spec y plan 001 marcados como implementados.
9. ~~Fase 2, sesión activa~~ (spec §13: `SetRow`, guardado por serie, recuperación de sesión; módulo `training`). Pasos:
   1. ~~Pregunta 6~~ (17-nov, `modules/training.md` v1.1 §10): `completed` y `discarded` son finales, también las notas (RN-TRN-07); corregir llega en v1.1.
   2. ~~Spec 002~~ aprobada (17-nov): `docs/specs/002-fase-2/spec.md` (AC-1 a AC-41). La sesión solo se descarta en esta fase (Cierre en la fase 3); `SuggestionProvider` nulo y la serie siguiente hereda el peso (RN-TRN-11); entran RF-14, RF-16 y RF-17; alternativas solo sin series hechas (RN-TRN-13); "Otra sesión de esta semana" con `plannedFor` (RN-TRN-14); asistencia con peso negativo (RN-TRN-04); sin `bus` hasta la fase 4. Reglas ya en `modules/training.md` v1.2, `modules/plan.md` v1.11 (`PlannedItem.alternatives`, `getExercise(s)`, RN-PLN-15 (i)) y `modules/progression.md` §9.4.
   3. ~~Plan técnico~~ aprobado (17-nov): `docs/specs/002-fase-2/plan.md`. Escritura con `repository.mutate` (transacción que relee y llama al dominio puro), sin `configureTraining`, bus ni Zustand; `useWorkoutView`; coma decimal; `describeError` desde `app`; ruta `/dia/:date`; `zod/mini` si el bundle pasa de 170 kB. Contrato `training` v1.3, spec v0.5 (§7.2) y architecture v1.2 (§6.4, §7.8).
   4. ~~Tareas~~ (17-nov): `docs/specs/002-fase-2/tasks.md`, T1 a T27 en 4 puntos de control (A dominio y `plan`, B persistencia y composición, C interfaz, D verificación y cierre). La prueba P-1 sobre el seed real vive en `app/seed` (fronteras, plan §7).
   5. ~~Punto de control A, dominio y `plan`~~ (T1–T9, PR #13): `PlannedItem.alternatives`, `getExercise(s)`, RN-PLN-15 (i); valores de una serie (RN-TRN-04), creación del workout (RN-TRN-02, 12, 14) y sus cambios puros. Contrato `training` v1.4 a v1.6.
   6. ~~Punto de control B, persistencia y composición~~ (T10–T16, PR #14): servicio, repositorio Dexie, base v2, hooks, textos de error en `app` y la prueba P-1 sobre el seed real (AC-41). Contrato v1.7 a v1.10.
   7. ~~Punto de control C, interfaz~~ (T17–T24, PR #15): `ConfirmDialog`, `SetTable`, `SessionHeader`, "Hoy" con sesión, `/dia/:date`, `SessionPage`, aviso de actualización aplazado y `zod/mini`. Contrato v1.11 a v1.13; spec v0.6 y architecture v1.3 (`/sesion/:workoutId`).
   8. ~~Punto de control D, verificación y cierre~~ (T25–T27, PR #17 y el de cierre): E2E de la sesión y AC-39 (axe y objetivos de 44 px), iPhone y este cierre. Spec y plan 002 marcados como implementados.
10. ~~Rediseño de "Hoy"~~ (spec §13, fase 2.5). Pasos:
   1. ~~Spec 003~~ aprobada (18-nov): `docs/specs/003-rediseno-hoy/spec.md` (AC-1 a AC-29), desde `docs/design-hoy.md`. Estados D y D2 con datos existentes, sin cambios de base; duración estimada (RN-PLN-27, contrato `plan` v1.13), tiempo restante y avance de la sesión (RN-TRN-20 y 21, `training` v1.15); tira con marcas y "N de M" (N = 0 hasta la fase 3); descarte con texto que no dice "se borrarán" (RN-TRN-15). Fuera: "Hoy subes" (fase 4), ✓ de la tira y dolor (fase 3), hoja "Cambiar sesión" y sesión libre (spec futura), registrar cardio.
   2. ~~Plan técnico~~ aprobado (18-nov): `docs/specs/003-rediseno-hoy/plan.md`. Duración como funciones puras de `plan` (`setSeconds`, `plannedSessionSeconds`, `displayMinutes`); `workoutProgress(view)` en `training`, con `progressOf` puro que recibe el tiempo por serie (el dominio no importa `plan`); `getActiveWorkoutView` y `useActiveWorkoutView` para D2; `firstPending` pasa al dominio; `Elapsed` aislado con reloj de 1 s; componentes en `app/pages/today/`; `PlanExerciseList` sin RIR por fila (la vista previa lo muestra bajo el título); `ConfirmDialog` anclado abajo. Contratos `plan` v1.14, `training` v1.16 y `shared` §4.
   3. ~~Tareas~~ (18-nov): `docs/specs/003-rediseno-hoy/tasks.md`, T1 a T18 en 4 puntos de control (A dominio, B consulta y componentes de los módulos, C página "Hoy", D verificación y cierre).
   4. ~~Punto de control A, dominio~~ (T1–T4, PR #20): `duration.ts` y `progress.ts` con pruebas primero.
   5. ~~Punto de control B, consulta y componentes~~ (T5–T10, PR #23): `getActiveWorkoutView`, `workoutProgress`, `SessionPage` con `current`, `PlanExerciseList`, `WeekStrip` y `ConfirmDialog`.
   6. ~~Punto de control C, página~~ (T11–T15, PR #24): formatos, `Elapsed`, estados D y D2; bundle 161.91 kB.
   7. ~~Punto de control D, verificación y cierre~~ (T16–T18, PR de cierre): E2E, iPhone y este cierre. Spec y plan 003 marcados como implementados.
11. **Siguiente: rediseño de la sesión activa** (spec 004, fase 2.5, desde `docs/design-sesion-activa.md`). Pasos:
   1. **Spec 004 aprobada** (18-nov): `docs/specs/004-rediseno-sesion/spec.md` (AC-1 a AC-38). Encabezado en una fila (flecha, "Ejercicio N de M ▾", tiempo), aviso de salida con "Seguir entrenando", "Salir y continuar después" y "Descartar sesión" (Cancelar vuelve al aviso), menú flotante con el nombre de la sesión como título, tarjeta compacta/completa (empieza compacta y recuerda la elección sin guardarla), "Seg", pistas de reps y RIR, serie actual resaltada y línea "Siguiente: …" / "Último ejercicio de hoy" en el pie. Sin base de datos ni reglas nuevas (RN-TRN-21). Fuera: "Terminar y guardar" (spec 005), descanso y sugerencias (fase 4). El tiempo no se muestra en una sesión de otro día, como en "Hoy" (§8, decisión 9).
   2. Al aprobar: contrato `training` v1.18 (`SessionHeader`, `SetTable`) y spec v0.8 (§7.2); luego plan técnico y tareas.
12. **Fase 3, MVP usable en el gym** (spec §13: cierre con dolor lumbar, historial, exportar/importar; módulos `health` y `data`, y `finishWorkout` en `training`). Empieza por la **pregunta pendiente 8** (bandas de dolor, `modules/health.md` §10), que bloquea la fase; luego la **spec 005** (la 004 es el rediseño de la sesión activa). Pruebas primero en `health` (constitución). Trae el ✓ de la tira, "N" de "N de M", las filas "hecha ✓" de "Otra sesión", el aviso y el chip de espalda en "Hoy" (spec 003 §6.6) y "Terminar y guardar lo hecho" en el aviso de salida de la sesión (spec 004).
13. Planeado por el usuario (17-nov), sin fecha: migrar el hosting de Vercel a AWS. Requiere un ADR nuevo que reemplace ADR-0011 y su propia spec. El origen `https://gym.saulgmx.com` se mantiene, así que IndexedDB y la PWA instalada no se pierden: en Cloudflare solo cambia el CNAME. Hay que rehacer en AWS los headers y el `Cache-Control` por ruta, el rewrite de SPA (sin servir HTML para `/assets/falta.js`) y el comando de instalación, y cambiar `vite.config.ts` y `tests/architecture/headers.test.ts`, que hoy leen `vercel.json`. Se verifica igual que T26.

Notas para retomar:
- Entorno: Node `24.22.3` con Volta (el de Homebrew ya se desinstaló). `npm ci --strict-allow-scripts` en CI; `fsevents` denegado en `allowScripts`. Navegadores de Playwright: `npx playwright install chromium webkit` en local; en CI vienen en la imagen `mcr.microsoft.com/playwright` del job `ci`, con la misma versión que `@playwright/test` (al actualizar Playwright, cambiar la etiqueta y el digest de la imagen en `ci.yml`).
- Comandos: `npm run test:e2e` (construye y prueba contra `vite preview`), `npm run size`, `npm run icons` (regenera los PNG si cambia `public/icon.svg`).
- Pruebas primero: el commit en rojo se hace local **sin push**; se sube junto con la tarea que lo pone en verde. Las tareas de herramientas o solo de pruebas (T20–T22) van en un solo commit.
- Antes de escribir pruebas, revisar si el contrato deja comportamientos sin definir; proponerlos, y con la aprobación escribirlos en los docs antes del código.
- Mutaciones: tras cada prueba en verde, romper el código a propósito y ver que falla la prueba correcta. En el bloque C encontraron tres pruebas que pasaban sin probar nada: el `replace` de la redirección (T15), `showNotice` que reemplazaba el aviso (T16) y el rechazo de `persist()` sin capturar (T17: Vitest **no** marcó ese rechazo; la prueba espía `then`). Un mutante que no compila no prueba nada (el build falla antes de las pruebas).
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
- zsh no divide variables sin comillas: opciones de `curl` en una variable van como array, `R=(--resolve a)` y `curl "${R[@]}"`.
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
- Dos clics de Playwright en dos pestañas nunca llegan a la vez: la segunda pestaña ve la sesión en vivo y su botón desaparece. AC-2 de spec 002 es secuencial en E2E; la simultaneidad la prueba `dexie-repository.test.ts`.
- A 320 px los nombres del seed caben aun sin `overflow-wrap: anywhere`: esa línea no se ejercita hasta que haya nombres propios (spec futura de plantillas).
- `zod/mini` (T24): la misma API en funciones (`z.pipe`, `.check(z.minLength(1))`, `z.exactOptional(…)`); las pruebas pueden seguir importando tipos de `zod`, que no entran en el bundle.

## Prompt sugerido para un chat nuevo

"Seguimos con el rediseño de la sesión activa (spec 004). Lee primero docs/README.md, docs/constitution.md y docs/handoff.md, y docs/specs/004-rediseno-sesion/spec.md. La spec está aprobada: sigue con el plan técnico (contrato `training` v1.18 y spec v0.8 §7.2 primero). Después viene la fase 3 (spec 005), que empieza por la pregunta pendiente 8 (health.md §10). Guíame paso a paso, una tarea a la vez."
