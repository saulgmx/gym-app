# Tareas: Fase 2, sesión activa

**Plan:** `specs/002-fase-2/plan.md`

Cada tarea es pequeña (≤ 1-2 h), deja el CI verde y tiene una verificación concreta. En el dominio de `training`, en `plan` y en el servicio, la tarea de pruebas va antes que la de implementación (P-5, plan §7): el commit en rojo se queda local y se sube con la tarea que lo pone en verde.

**Responsable:** C = Claude Code · U = usuario (requiere tu cuenta, tu dispositivo o una decisión tuya).

## A. `plan` y dominio de `training` (pruebas primero)

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T1 | Pruebas de `plan` v1.11: `PlannedItem.alternatives` resueltas en orden y `[]` sin alternativas (RN-PLN-11); RN-PLN-15 (i) con la alternativa de un ítem igual al principal o a la alternativa de otro, y su lugar en el orden de RN-PLN-19; `getExercise` y `getExercises` (orden pedido, sin los inexistentes) | `plan/domain`, `plan/application` | Pruebas en rojo | AC-22, AC-23 (datos), RN-TRN-12 | C | ☑ |
| T2 | Implementar T1 en `schedule.ts`, `seed-rules.ts` y el servicio; `getExercise(s)` entran en `PlanApi` | `plan` | T1 en verde; el seed real sigue pasando (AC-4 de la spec 001); `plan` al 100%; 12 mutaciones detectadas, cada una por la prueba de su regla | AC-22, AC-23 (datos) | C | ☑ |
| T3 | Tipos del dominio de `training` según el contrato v1.3: `Workout` (con `plannedFor`), `WorkoutItem` (con `options`, `maxSets`, `note`), `SetLog`, `ExerciseSession`, `WorkoutView`, `TrainingErrorCode` y los `details` tipados | `training/domain` | `npm run typecheck` pasa | — | C | ☑ |
| T4 | Pruebas de `set-values.ts`: `parseNumber` ("62,5", "62.5", vacío → `null`, texto → `NaN`) y RN-TRN-04 por métrica (`weight`, `reps`, `time`), por equipo (asistencia solo en `bodyweight` + `weight`), límites, paso de 0.25 y no finitos, cada uno con su `field` y `reason` | `training/domain` | Pruebas en rojo | AC-16 a AC-19b | C | ☑ |
| T5 | Implementar `set-values.ts` | `training/domain` | T4 en verde; 100% de cobertura; 23 mutaciones detectadas, cada una por la prueba de su regla | AC-16 a AC-19b | C | ☑ |
| T6 | Pruebas de creación en `workout.ts`: instantánea desde un `TodayPlan` (RN-TRN-02: orden, `plannedSets`, `maxSets`, `options`, `note`, prellenado o `null`), `plannedFor` en la semana y día de pesas (RN-TRN-14) y ejercicio repetido → lanza (RN-TRN-12) | `training/domain` | Pruebas en rojo | AC-1, AC-3, AC-8, AC-10 | C | ☑ |
| T7 | Implementar la creación en `workout.ts` | `training/domain` | T6 en verde; 100% de cobertura; 17 mutaciones detectadas, cada una por la prueba de su regla | AC-1, AC-3, AC-8, AC-10 | C | ☑ |
| T8 | Pruebas de cambios en `workout.ts`: registrar valores y marcar o desmarcar (RN-TRN-04, 05), herencia del peso (11), extras y quitar con renumeración (10), elegir alternativa (13), descartar (15) y cerrado → `workout-closed` (07). Cada función devuelve `changes` y `value` | `training/domain` | Pruebas en rojo | AC-13 a AC-15, AC-20, AC-23, AC-24, AC-31 a AC-35 | C | ☐ |
| T9 | Implementar los cambios en `workout.ts` | `training/domain` | T8 en verde; cobertura del dominio de `training` ≥ 80% (`workout.ts` y `set-values.ts` 100%); mutaciones detectadas, cada una por la prueba de su regla | AC-13 a AC-15, AC-20, AC-23, AC-24, AC-31 a AC-35 | C | ☐ |

**Punto de control A:** PR "training domain and plan alternatives".

## B. Aplicación, persistencia y composición

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T10 | Pruebas del servicio con un repositorio en memoria (que implementa `mutate` igual que Dexie) y un `PlanReader` falso: cada operación de `TrainingApi`, `already-active` con el id en `details`, `plannedFor`, prellenado del `SuggestionProvider` al iniciar y al elegir alternativa, `getWorkoutView` con los ejercicios de todas las `options` y `getExerciseHistory` (RN-TRN-08) | `training/application` | Pruebas en rojo | AC-1 a AC-3, AC-6, AC-8, AC-10, AC-29, AC-30, QS-08 | C | ☐ |
| T11 | Implementar `application/ports.ts` (`TrainingRepository`, `SuggestionProvider`, `PlanReader`) y `createTrainingService`: lo asíncrono ajeno se reúne antes de `mutate` (plan §5) | `training/application` | T10 en verde | Ídem T10 | C | ☐ |
| T12 | Pruebas de integración con `fake-indexeddb` a través de `createTraining`: dos `startWorkout` concurrentes desde dos conexiones → un solo activo (AC-2); iniciar, registrar 3 series y abrir otra instancia → todo sigue (AC-4, QS-03); un error del dominio no escribe nada; historial por `exerciseId` | `training` | Pruebas en rojo | AC-2, AC-4, AC-12, RN-TRN-03 | C | ☐ |
| T13 | `infrastructure/schema.ts` (`trainingStores`), repositorio Dexie (`mutate` y `createIfNoneActive` en transacciones `rw` sobre `workouts` y `sets`) y `createTraining` en `index.ts` | `training/infrastructure`, `index.ts` | T12 en verde; `npm run lint` (fronteras) pasa | AC-2, AC-4, AC-12 | C | ☐ |
| T14 | Hooks `useWorkoutView`, `useActiveWorkout` y `useLastSession` con el patrón fechado (plan §6.4) | `training/ui` | Prueba con `fake-indexeddb`: devuelven el dato, `null` si no existe, y se actualizan al escribir en `sets` y `workouts` | RF-19 | C | ☐ |
| T15 | `app`: `db.ts` en la versión 2 (prueba de subida desde v1, AC-38); `compose` con `createTraining` y `nullSuggestions`; `AppContext` con `training`; `messages.ts` con `TrainingErrorCode` y los textos de `invalid-set-values` por campo y motivo (plan §6.6) | `app` | Pruebas de `db`, `compose` y `messages` pasan | AC-38 | C | ☐ |
| T16 | Prueba de seguridad sobre el seed real: iniciar cada plantilla del seed (una fecha por plantilla) y elegir cada alternativa → ningún ejercicio `high` en ningún workout | `app/seed` | La prueba pasa; se comprueba que falla al meter un `high` en un plan falso | AC-41, P-1, QS-01 | C | ☐ |

**Punto de control B:** PR "training persistence and composition".

## C. Interfaz

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T17 | `ConfirmDialog` en `shared/ui`: `<dialog>` nativo con `showModal`, Escape cancela y el foco vuelve al botón que lo abrió (relleno de `showModal` en las pruebas si jsdom no lo trae) | `shared/ui` | Pruebas de componente; stylelint pasa | AC-34 (diálogo) | C | ☐ |
| T18 | `training/ui/format.ts`, `SetRow` y `SetTable`: columnas, `inputmode`, nombre accesible por fila, envío en `change`, coma decimal, borrador con error y `describeError`, fila hecha con texto, "extra", "Con asistencia", "Añadir serie" y "Quitar serie" con sus límites, y "anterior" con `useLastSession` | `training/ui` | Pruebas de componente por rol y nombre; stylelint pasa | AC-12 a AC-20, AC-29 a AC-33 (UI) | C | ☐ |
| T19 | `SessionHeader`: nombre de la sesión, "Ejercicio 2 de 7", "Anterior" y "Siguiente", y "Ver ejercicios" desplegable con el avance de cada uno | `training/ui` | Pruebas de componente | AC-25, AC-26 | C | ☐ |
| T20 | `TodayPage`: "Continuar sesión" (con fecha si es de otro día), "Descartar sesión" con `ConfirmDialog`, "Iniciar sesión" en días de pesas y la sección "Otra sesión de esta semana"; `StartWorkoutButton` compartido (navega a la sesión activa si ya existe) | `app/pages` | Pruebas de componente con relojes fijos | AC-1, AC-3, AC-5, AC-7, AC-9, AC-11, AC-34 | C | ☐ |
| T21 | `DayPreviewPage` en `/dia/:date` (dentro de `AppLayout`) con redirecciones por fecha inválida, de otra semana, hoy o sin pesas; spec §7.2 ya tiene la ruta | `app/pages`, `app/router.tsx` | Pruebas de componente y de rutas | AC-8 | C | ☐ |
| T22 | `SessionPage`: validación de `:exerciseIndex` con redirección, "Esta sesión ya no está disponible.", encabezado, nombre, rango, RIR y consejo (`cue` y `note`), "Cambiar a …" (deshabilitado con series hechas), `SetTable` y "Descartar sesión" | `app/pages` | Pruebas de componente con `createTraining` y `fake-indexeddb` | AC-4, AC-22 a AC-28, AC-34 | C | ☐ |
| T23 | `UpdatePrompt` aplazado con una sesión activa (plan §6.8) | `app/pwa` | Prueba con `useRegisterSW` simulado: oculto con sesión activa, visible al descartarla | AC-37 | C | ☐ |
| T24 | Medir el bundle (`npm run build` y `npm run size`). Si pasa de 170 kB, cambiar `plan/infrastructure/seed-schema.ts` a `zod/mini` con las pruebas del esquema sin cambios | raíz, `plan/infrastructure` | `npm run size` < 200 kB, y < 170 kB o `zod/mini` aplicado; medición anotada en plan §6.9 | AC-40 | C | ☐ |

**Punto de control C:** PR "active session UI".

## D. Verificación y cierre

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T25 | E2E `session.spec` con `page.clock`: iniciar, registrar, recargar y continuar (AC-4); sin conexión (AC-36); otra sesión de la semana (AC-8); descartar (AC-34); dos páginas a la vez (AC-2); tiempo del check (AC-21). `a11y.spec` con la sesión activa y "Hoy" con sesión activa, más medida de los objetivos táctiles | `tests/e2e` | `npm run test:e2e` pasa local y en CI, en Chromium y WebKit | AC-2, AC-4, AC-8, AC-21, AC-34, AC-36, AC-39, QS-03, QS-05 | C | ☐ |
| T26 | Tras el despliegue, en el iPhone (PWA instalada): aceptar la actualización y ver que el plan y la semana siguen (v1 → v2); hacer una sesión de prueba con el teclado en español (coma), asistencia en Dominadas, una alternativa, una serie extra, cerrar la app a la mitad y continuar; modo avión; descartar | producción | Todo funciona en el iPhone; la respuesta al marcar se siente inmediata | AC-38, CA-3, QS-05 (manual en iOS) | U + C | ☐ |
| T27 | Actualizar `handoff.md`, marcar la spec y el plan como implementados y revisar los comandos de `CLAUDE.md` | docs | Revisión | — | C | ☐ |

**Punto de control D:** PR "phase 2 handoff".

## Notas

- **Ramas:** primero se fusiona `docs/002-phase-2-spec` (pregunta 6, spec, plan, contratos y estas tareas). La implementación va en `feat/002-phase-2-a` a `-d`, cada una desde `main` actualizado, con un commit por tarea y un PR por punto de control ("Create a merge commit").
- **Pruebas en rojo:** T1, T4, T6, T8, T10 y T12 se quedan como commit local y se suben junto con la tarea que las pone en verde (T2, T5, T7, T9, T11 y T13), para que el CI del PR nunca esté en rojo.
- **Antes de cada tarea de pruebas:** revisar si el contrato deja comportamientos sin definir, proponerlos y, con tu aprobación, escribirlos en el contrato antes del código (handoff).
- **Mutaciones:** tras cada prueba en verde, romper la regla a propósito y ver que falla la prueba de esa regla, con copia de seguridad de nombre único (handoff).
- **Nombres de pruebas:** citan la regla o el criterio, por ejemplo `it('RN-TRN-11: la serie siguiente vacía hereda el peso')` o `it('AC-2: dos startWorkout concurrentes dejan un solo activo')`.
- **Fechas y valores esperados:** se calculan con Node antes de escribirlos en una prueba, no de memoria.
- **Datos reales:** desde T26 la base del iPhone está en la versión 2. Las sesiones de prueba de esta fase se descartan; las primeras sesiones reales llegan con el cierre de la fase 3.
