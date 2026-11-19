# Tareas: Historial de sesiones

**Plan:** `specs/006-historial/plan.md`

Cada tarea es pequeña (≤ 1-2 h), deja el CI verde y tiene una verificación concreta.
- **Prueba primero:** en RN-PLN-28, RN-HLT-20, RN-TRN-28 y RN-TRN-29, la tarea de pruebas va antes que la de implementación. El commit en rojo se queda local y se sube con la tarea que lo pone en verde. En las piezas de `app`, las pruebas se escriben primero dentro de la misma tarea.
- **Antes de escribir pruebas:** revisar si el contrato deja comportamientos sin definir. Si los deja, proponerlos y, con tu aprobación, escribirlos en los docs antes del código (handoff, notas).
- **Mutaciones:** tras cada prueba en verde, romper el código a propósito y ver que falla la prueba correcta.

**Responsable:** C = Claude Code · U = usuario (requiere tu cuenta, tu dispositivo o una decisión tuya).

## A. `plan` y `health`

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T1 | Pruebas de RN-PLN-28. **Dominio** (`schedule.test.ts`, `blockOfWeek` sobre los bloques del seed): semana 1 y 4 → "Bloque 1 · Full body"; 5 → Bloque 2; 15 → "Descarga"; 0, 16 y negativa → `null`. **Servicio** (`plan-service.test.ts`): `getBlocks` ordena por `startWeek` aunque el almacenamiento los devuelva en otro orden; sin programa lanza con un mensaje que cita RN-PLN-22. **Hook** (`hooks.test.tsx`): `useBlocks` → `undefined` y luego los bloques | `plan/domain`, `application`, `ui` | Pruebas en rojo | RN-PLN-28; AC-6 | C || ☑ |
| T2 | Implementar `blockOfWeek` (`domain/schedule.ts`), `getBlocks` (servicio, sobre `loadSnapshot`) y `useBlocks` (`ui/hooks.ts`); exportarlos por `index.ts` | `plan` | T1 en verde; `npm run lint`; mutaciones detectadas (`<` por `≤` en cada borde, sin ordenar) | Ídem | C || ☑ |
| T3 | Pruebas de RN-HLT-20. **Servicio sobre Dexie** (`health-service.test.ts`, con `fake-indexeddb`, como el resto de `health`): ids con y sin entrada; ids repetidos; lista vacía → mapa vacío **sin** leer la base (un *hook* `reading` que lanza lo demuestra); un fallo de la base hace rechazar (bloque "fallos del almacenamiento"). **Hook** (`hooks.test.tsx`): `usePainForWorkouts` → `undefined`, luego el mapa; con otra lista de ids, `undefined` hasta tener la suya; se actualiza al guardar una entrada | `health/application`, `infrastructure`, `ui` | Pruebas en rojo | RN-HLT-20; AC-7, AC-8, AC-17, AC-18, AC-32 | C || ☑ |
| T4 | Implementar `findByWorkoutIds` en `PainRepository` (Dexie, por el índice `&workoutId`), `getPainForWorkouts` y `usePainForWorkouts`; exportar el hook | `health` | T3 en verde; `npm run lint`; mutaciones detectadas (sin el atajo de la lista vacía, clave del hook sin los ids) | Ídem | C || ☑ |
| T5 | `formatRedFlags` (plan §6.4): las etiquetas salen de `RedFlagsChecklist.tsx` a `ui/labels.ts`, el componente las importa de allí y `formatRedFlags` las une con ", " en el orden de `RED_FLAGS` | `health/ui`, `index.ts` | Pruebas primero (`pain-ui.test.tsx`, junto a las de `RedFlagsChecklist`: una, varias en desorden → orden de `RED_FLAGS`, vacía → ""); las de `RedFlagsChecklist` siguen en verde sin cambios; mutaciones detectadas | AC-18 | C || ☑ |

**Punto de control A:** PR "history: plan and health".

## B. `training`

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T6 | Pruebas de RN-TRN-29 (`history.test.ts`, `historyDetail`): un elemento por ítem en el orden de `items`; `replaces` = `options[0]` si se eligió una alternativa y `null` si no; solo series hechas del ejercicio elegido, por `setNumber` (una serie hecha del principal de antes de cambiar no sale); una extra hecha sale; un ítem sin series hechas → `sets: []`; `in_progress` y `discarded` → `null` | `training/domain` | Pruebas en rojo | RN-TRN-29; AC-19 a AC-22, AC-25 | C || ☑ |
| T7 | Implementar `historyDetail` en `domain/history.ts` y exportarlo | `training/domain`, `index.ts` | T6 en verde; mutaciones detectadas (sin filtrar `done`, sin filtrar el ejercicio elegido, `replaces` siempre `null`, sin la comprobación de `completed`) | Ídem | C || ☑ |
| T8 | Pruebas de RN-TRN-28. **Servicio** (`training-service.test.ts`, memoria): solo `completed`; orden por `date` y luego `startedAt` con offsets distintos; el resumen de cada uno (uno parcial: "3 de 7"); con `finishedAt` no depende de `now`. **Repositorio** (`dexie-repository.test.ts`): `findCompletedStates` devuelve cada workout con **sus** series (dos workouts con series no se mezclan) y deja fuera `in_progress` y `discarded`. **Hook** (`hooks.test.tsx`): `useWorkoutHistory` → `undefined`, luego `[]`, y se actualiza al cerrar una sesión | `training/application`, `infrastructure`, `ui` | Pruebas en rojo | RN-TRN-28; AC-5, AC-7, AC-8, AC-10, AC-11, AC-13 | C || ☑ |
| T9 | Implementar `findCompletedStates` (Dexie: índice `status` y `sets.where('workoutId').anyOf(ids)` en una transacción `r`; memoria: lo mismo), `listWorkoutHistory`, `HistoryEntry` y `useWorkoutHistory`; exportarlos | `training` | T8 en verde; `npm run lint`; mutaciones detectadas (sin filtrar por `workoutId`, sin filtrar `completed`, sin ordenar, orden de `startedAt` como string) | Ídem | C || ☑ |
| T10 | `formatDoneSet(set, metric)` en `ui/format.ts`, sobre `formatPrevious`, y exportarlo | `training/ui` | Pruebas primero (`format.test.ts`): "100 × 10 · RIR 2", "62,5 × 8 · RIR 1", "Asist. 20 × 8 · RIR 2", "12 · RIR 1" (`reps`), "40 s · RIR 2" (`time`); mutaciones detectadas | AC-20, AC-23, AC-24 | C || ☑ |

**Punto de control B:** PR "history: training".

## C. Lista y detalle

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T11 | Mover sin cambiar el comportamiento (plan §6.7, §6.8, §6.10): `minutesFigure`, `setsFigure`, `itemsFigure` y `Figure` de `close/format.ts` a `app/format-summary.ts`; `CloseSummary` a `app/pages/SummaryFigures.tsx` (con `showTime`), y el Cierre lo usa; `formatBackChip` de `today/format.ts` a `app/format-pain.ts`. Las pruebas se mueven con su código | `app` | Todas las pruebas existentes del Cierre y de "Hoy" en verde con solo cambios de importación; `npm run lint` (incluye dependency-cruiser) | — | C || ☑ |
| T12 | `formatWeekRange(weekStart)` en `app/format-date.ts`; `groupByWeek(entries)` y `formatHistorySummary(summary)` en `app/pages/history/` (plan §6.7, §6.10) | `app` | Pruebas primero (`history-format.test.ts`): "16-22 nov", "30 nov-6 dic", "28 dic-3 ene" y el mes sin punto aunque `Intl` lo ponga (como `format-date-period.test.ts`); grupos por semana ISO en el orden de entrada; `programWeek` de la más reciente; `null` → grupo sin número; "52 min · 10 series · 7 ejercicios" y "30 min · 5 series · 3 de 7 ejercicios"; mutaciones detectadas | AC-6, AC-7, AC-8, AC-12 | C || ☑ |
| T13 | Rutas `historial` y `historial/:workoutId` (de momento, el detalle es un marcador que T14 reemplaza en el mismo PR), `NavLink` "Historial" con su icono en `TabBar`, textos en `history/texts.ts` y `HistoryPage` con `HistoryRow` (plan §6.6, §6.7) | `app` | Pruebas primero: `router.test.tsx`, donde ya se prueba la barra (AC-1 a AC-3) y `history-page.test.tsx` (AC-4 a AC-13, con datos de la spec §4 escritos por la API; AC-11 directo en la base con `lastTestDatabase()`); nombre accesible de la fila con todo el texto visible; stylelint; mutaciones detectadas (`plannedFor` en lugar de `date` para la fecha, sin chip de señales, vacío mientras carga) | AC-1 a AC-13 | C | ☐ |
| T14 | `HistoryDetailPage` (plan §6.8): encabezado con "Volver" (`state.from` validado), resumen con `SummaryFigures`, dolor, ejercicios con `historyDetail` y `formatDoneSet`, notas y el estado "no está en el historial" | `app` | Pruebas primero (`history-detail.test.tsx`): AC-14 a AC-32; "Volver" con `from` `'/'`, `'/historial'`, otro valor y sin `state`; mutaciones detectadas (sin "Sin series", sin "Extra", consejos de banda visibles, `in_progress` mostrado) | AC-14 a AC-32 | C | ☐ |

**Punto de control C:** PR "history: pages". Tras C, la pestaña y el historial ya funcionan; solo faltan los enlaces de "Hoy".

## D. Enlaces desde "Hoy"

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T15 | `DoneDay` con `workoutId` y el enlace "Ver detalle" en `DayCard`; `OtherDays` con `doneId` (fila hecha como `Link` gris); `TodayPage` pasa los ids con `completed.find` (plan §6.9) | `app/pages/today`, `app/pages` | Pruebas primero en `today-done.test.tsx` y `day-card.test.tsx`: AC-33 a AC-35 (con dos `completed` del mismo `plannedFor`, el más reciente). Se actualizan las pruebas y el E2E de la spec 005 que esperaban la fila "no pulsable", citando spec 006 AC-34; mutaciones detectadas (`date` en lugar de `plannedFor`, sin `state`) | AC-33 a AC-35 | C | ☐ |
| T16 | Medir el bundle (`npm run build` y `npm run size`) | raíz | `npm run size` < 200 kB; la medición se anota en el plan §6.11 | AC-38 | C | ☐ |

**Punto de control D:** PR "history: links from today".

## E. Verificación y cierre

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T17 | E2E en `tests/e2e/history.spec.ts` (`describe('spec 006 …')`): cerrar dos sesiones con los ayudantes de `helpers.ts`, abrir "Historial", comprobar grupos y filas, abrir el detalle y volver; abrir el detalle desde la tarjeta de "Hoy" y volver a "Hoy"; el recorrido sin conexión (AC-37). En `a11y.spec.ts`: axe, 44 px y 320 px en la lista y en los detalles de una sesión completa y una parcial con señales | `tests/e2e` | `npm run test:e2e` pasa en local y en CI, en Chromium y WebKit; las pruebas nuevas, estables en 5 repeticiones (`--grep "spec 006" --repeat-each=5`) | AC-36, AC-37 | C | ☐ |
| T18 | Tras el despliegue, en el iPhone (PWA instalada): la pestaña "Historial", la lista con tus sesiones reales (las dos del 18-nov salen las dos, AC-11), el detalle de una con alternativa o asistencia si la hay, "Ver detalle" desde "Hoy" en un día hecho y todo en modo avión | producción | Se ve como en la spec §6; nada se pierde; la lista abre sin espera visible | AC-11, AC-37 (manual en iOS), riesgos del plan §8 | U + C | ☐ |
| T19 | Actualizar `handoff.md` y marcar la spec y el plan como implementados | docs | Revisión | — | C | ☐ |

**Punto de control E:** PR "history: e2e and handoff".

## Modelo recomendado por tarea

Guía para elegir el modelo de Claude Code en cada tarea. Si el costo o los límites de uso no importan, Opus en todas es lo más simple y reduce el retrabajo.

| Punto | Modelo | Por qué |
|---|---|---|
| A (T1-T5) | Sonnet | Reglas pequeñas y puras, y una consulta por índice |
| B (T6-T10) | Sonnet en T6, T7 y T10; Opus en T8 y T9 | La transacción con dos tablas y el orden por instantes |
| C (T11-T14) | Sonnet en T11 y T12; Opus en T13 y T14 | Tres consultas en vivo por página y sus estados |
| D (T15-T16) | Opus en T15; Sonnet en T16 | Cambia pruebas de la spec 005 y la confusión `date` / `plannedFor` |
| E (T17-T19) | Opus en T17; Sonnet en T19 | E2E estables en WebKit; T18 es tuya |

## Notas

- **Orden:** A y B son independientes entre sí; C necesita las dos; D necesita C (el detalle al que enlaza).
- **Usabilidad entre PR:** tras A y B no cambia nada visible. Tras C, la pestaña y el historial funcionan. Tras D, "Hoy" enlaza al detalle.
- **T13 y el marcador del detalle:** la ruta del detalle entra en T13 con un componente mínimo para que las filas tengan destino en las pruebas; T14 lo reemplaza antes de abrir el PR de C, así que `main` nunca tiene el marcador.
- **Datos reales (T18):** las dos sesiones cerradas del 18-nov solo se toleran (spec 005b AC-17); en el historial deben salir las dos, la más reciente primero.
