# Tareas: Rediseño de "Hoy"

**Plan:** `specs/003-rediseno-hoy/plan.md`

Cada tarea es pequeña (≤ 1-2 h), deja el CI verde y tiene una verificación concreta. En el dominio (`duration`, `progress`) y en el servicio, la tarea de pruebas va antes que la de implementación (plan §7): el commit en rojo se queda local y se sube con la tarea que lo pone en verde.

**Responsable:** C = Claude Code · U = usuario (requiere tu cuenta, tu dispositivo o una decisión tuya).

## A. Dominio (pruebas primero)

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T1 | Pruebas de `plan/domain/duration.ts` (RN-PLN-27): `setSeconds` con `metric` `weight`, `reps` y `time` (media de `repRange`); `plannedSessionSeconds` con calentamiento y cambio por ítem; `displayMinutes` (múltiplo de 5 más cercano, mínimo 5); con el seed real, Full body A y B de la semana 1 → 50 y 55 min, Full body B de la semana 2 → 75, y el deload usa el 50% de las series | `plan/domain` | Pruebas en rojo | AC-1, AC-5, AC-6 | C | ☐ |
| T2 | Implementar `duration.ts` con las constantes con nombre; `index.ts` exporta las funciones, las constantes y `formatRir` (contrato v1.14) | `plan/domain`, `index.ts` | T1 en verde; `duration.ts` al 100%; mutaciones detectadas, cada una por la prueba de su regla | AC-1, AC-5, AC-6 | C | ☐ |
| T3 | Pruebas de `training/domain/progress.ts` (`progressOf`) con un tiempo por serie falso: ítem hecho solo si todas sus series lo están, también las extra (RN-TRN-21); ítem y serie actuales; todo hecho → `current: null`; estados por ítem; `setsDone` e `itemsWithDoneSets`; tiempo restante solo con series pendientes y cambio por ítem pendiente, sin calentamiento, y `null` sin pendientes (RN-TRN-20) | `training/domain` | Pruebas en rojo | AC-16, AC-20 a AC-24 | C | ☐ |
| T4 | Implementar `progress.ts` | `training/domain` | T3 en verde; `progress.ts` al 100%; mutaciones detectadas; `npm run lint` confirma que el dominio no importa `plan` | AC-16, AC-20 a AC-24 | C | ☐ |

**Punto de control A:** PR "today redesign domain".

## B. Consulta y componentes de los módulos

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T5 | Pruebas del servicio y de la aplicación: `getActiveWorkoutView` (sin activo → `undefined`; el activo de RN-TRN-01 armado como RN-TRN-17); `workoutProgress(view)` con `setSeconds` real sobre Full body A de la semana 1 → 40 min sin series hechas y 25 min con Prensa y la 1.ª de Press de banca hechas; hook `useActiveWorkoutView` (RN-TRN-19: cargando, `null`, se actualiza al marcar una serie) | `training/application`, `training/ui` | Pruebas en rojo | AC-16, AC-21 | C | ☐ |
| T6 | Implementar `getActiveWorkoutView`, `application/progress.ts` (`workoutProgress`) y `useActiveWorkoutView`; exportarlos por `index.ts` (contrato v1.16) | `training` | T5 en verde; `domain` y `application` al 100%; mutaciones detectadas | AC-16, AC-21 | C | ☐ |
| T7 | `SessionPage` redirige con `workoutProgress(view).current` y se borra `firstPending` (plan §6.3) | `app/pages` | Las pruebas de spec 002 AC-4 y AC-27 siguen en verde sin cambios; un mutante en `current` las rompe | Spec 002 AC-4, AC-27 | C | ☐ |
| T8 | `PlanExerciseList` sin RIR por fila; `DayPreviewPage` (y la tarjeta actual de "Hoy" hasta T13) muestra "RIR 3-4" una vez bajo el título de la sesión (plan §6.11) | `plan/ui`, `app/pages` | Pruebas de componente: nombre, series × reps, segundos en `time` y nota; vista previa con el RIR una vez | AC-3, AC-4 | C | ☐ |
| T9 | `WeekStrip` con las marcas de spec §6.4: círculo de 32 px, anillo vacío, "C" punteada, "–", anillo de hoy sumado a la marca y ● en pesas; `<ol>` con un `role="img"` por día y `aria-label` "<día>, [hoy,] <sesión>, <estado>" | `plan/ui` | Pruebas de componente por rol y nombre para miércoles 18-nov, jueves 19 y sábado 21; stylelint pasa; mutaciones detectadas | AC-10 a AC-13 | C | ☐ |
| T10 | `ConfirmDialog` anclado abajo con `env(safe-area-inset-bottom)` (plan §6.12); `discardDialogText({ setsDone, itemsWithDoneSets })` con sus tres variantes y "Sí, descartar", usado por `SessionPage` y por la tarjeta actual de "Hoy" | `shared/ui`, `app/pages` | Pruebas de los textos (3, 1 y 0 series) y del diálogo desde la sesión activa; stylelint pasa | AC-23, AC-24, AC-26 | C | ☐ |

**Punto de control B:** PR "today redesign queries and module components".

## C. Página "Hoy"

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T11 | Formatos: `formatShortDateTitle` ("Miércoles 18 nov", sin punto) en `app/format-date.ts`, y `app/pages/today/format.ts` ("N ejercicios · ~M min", "N de M ejercicios hechos", "Faltan ~X min", "Vas en: … · serie N", "N de M sesiones", tiempo `m:ss` y `h:mm:ss`, negativo → "0:00") | `app` | Pruebas unitarias con los valores calculados con Node; mutaciones detectadas | AC-1, AC-10, AC-16, AC-17 | C | ☐ |
| T12 | `Elapsed`: único componente con `setInterval` de 1 s; lee `clock.now()` y no es región viva (plan §6.5) | `app/pages/today` | Prueba con temporizadores falsos: "18:42" → "18:43"; más de una hora; reloj hacia atrás → "0:00"; se limpia al desmontar | AC-17 | C | ☐ |
| T13 | Estado D: `TodayPage` como contenedor con `useActiveWorkoutView`; `h1` oculto; `TodayHeader` (fecha y chip de semana); `DayCard` en pesas (título de 44 px, resumen, chips de bloque, RIR y "Descarga", CTA), cardio, descanso y fuera del programa; desplegable `<details>` "Ver los N ejercicios"; `WeekSection` ("Esta semana", "0 de M sesiones" y `WeekStrip`, oculta fuera del programa); `OtherDays` con botones de 48 px y borde neutro; "Empezar sesión" en `StartWorkoutButton` | `app/pages` | Pruebas de página con reloj fijo (lunes 16, martes 17, jueves 19, semana 15, antes y después del programa); mutaciones detectadas | AC-1 a AC-5, AC-7 a AC-10, AC-14, AC-15 | C | ☐ |
| T14 | Estado D2: `ActiveSessionCard` con borde de acento, `Elapsed` solo si la sesión es de hoy, título, "N de M ejercicios hechos", "Faltan ~X min", barra de segmentos decorativa, "Vas en", "Continuar sesión" (a `current.itemIndex`, o "del lunes 16 de noviembre") y "Descartar sesión" con el diálogo de T10; sin desplegable ni "Otra sesión de esta semana" | `app/pages` | Pruebas de página con el ejemplo de spec §4.5, la sesión de otro día, todo hecho, recién iniciada y con una extra; descartar vuelve a D; mutaciones detectadas | AC-16, AC-18 a AC-25 | C | ☐ |
| T15 | Medir el bundle (`npm run build` y `npm run size`) | raíz | `npm run size` < 200 kB; medición anotada en plan §6.10 | AC-28 | C | ☐ |

**Punto de control C:** PR "today redesign page".

## D. Verificación y cierre

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T16 | E2E con `page.clock`: `today.spec` (D en pesas, cardio y fuera del programa; "Empezar sesión"; sin conexión en D y D2), `session.spec` (salir a "Hoy", ver D2 y continuar; descartar desde D2) y `a11y.spec` (axe en D y D2, objetivos ≥ 44 px, título de 44 px a 320 px de ancho sin desbordar) | `tests/e2e` | `npm run test:e2e` pasa local y en CI, en Chromium y WebKit; las pruebas nuevas, estables en 5 repeticiones; la fecha corta sin punto en WebKit. **Hecho (18-nov):** 330 de 330 en 5 repeticiones. El tiempo de D2 usa `page.clock.install` y se pausa en 18:18:42 cuando la tarjeta ya se ve (pausado desde el inicio, "Hoy" no sale de la carga). La fecha sin punto la cubre `format-date-period.test.ts` (mes y día cortos), porque el WebKit de Playwright no pone el punto; el E2E compara el texto exacto. AC-2 de spec 002 (dos pestañas) pasa a secuencial: fallaba 1 de cada 10 en WebKit porque la segunda pestaña veía la sesión antes de su clic; la simultaneidad sigue en `dexie-repository.test.ts`. A 320 px, los nombres del seed caben aun sin `overflow-wrap`, así que esa línea no se ejercita hasta que haya nombres propios (spec futura) | AC-2, AC-18, AC-25, AC-27, AC-29 | C | ☑ |
| T17 | Tras el despliegue, en el iPhone (PWA instalada): "Hoy" en un día de pesas, abrir el desplegable, empezar, salir a "Hoy" y ver D2 con el tiempo corriendo, descartar con el diálogo abajo (zona segura); un día de cardio o descanso; modo avión | producción | Todo se ve como el diseño y nada queda bajo la barra de inicio | AC-27 (manual en iOS), riesgos del plan §8 | U + C | ☐ |
| T18 | Actualizar `handoff.md`, marcar la spec y el plan como implementados y revisar los comandos de `CLAUDE.md` | docs | Revisión | — | C | ☐ |

**Punto de control D:** PR "today redesign handoff".

## Modelo recomendado por tarea

Guía para elegir el modelo de Claude Code en cada tarea (18-nov). Si el costo o los límites de uso no importan, Opus en todas es lo más simple y reduce el retrabajo.

| Punto | Modelo | Por qué |
|---|---|---|
| A (T1-T4) | Sonnet | Funciones puras bien especificadas, con los valores esperados ya calculados |
| B (T5-T10) | Opus en T5-T7; Sonnet en T8-T10 | T5-T7 tocan la arquitectura (fronteras, consulta reactiva, migrar `firstPending`); T8-T10 son componentes chicos |
| C (T11-T15) | Sonnet en T11, T12 y T15; Opus en T13-T14 | T13-T14 son la página completa, con muchos criterios a la vez y las trampas de pruebas del handoff |
| D (T16-T18) | Opus en T16; Sonnet en T18 | T16 es E2E en WebKit con `page.clock`, donde más se pierde con pruebas inestables. T17 es tuya en el iPhone |

Cambiar a Opus en cuanto Sonnet decida algo que no está en el plan o se atore con una prueba inestable. Con cualquier modelo, cada tarea cierra con `npm run lint` y `npm test` en verde y las mutaciones anotadas en "Verificación".

## Notas

- **Ramas:** primero se fusiona `docs/003-today-redesign-plan` (plan, contratos y estas tareas). La implementación va en `feat/003-today-redesign-a` a `-d`, cada una desde `main` actualizado, con un commit por tarea y un PR por punto de control ("Create a merge commit").
- **Pruebas en rojo:** T1, T3 y T5 se quedan como commit local y se suben junto con la tarea que las pone en verde (T2, T4 y T6), para que el CI del PR nunca esté en rojo.
- **Antes de cada tarea de pruebas:** revisar si el contrato deja comportamientos sin definir, proponerlos y, con tu aprobación, escribirlos en el contrato antes del código (handoff).
- **Mutaciones:** tras cada prueba en verde, romper la regla a propósito y ver que falla la prueba de esa regla, con copia de seguridad de nombre único (handoff).
- **Nombres de pruebas:** citan la regla o el criterio, por ejemplo `it('RN-TRN-21: una serie extra sin hacer deja el ejercicio pendiente')` o `it('AC-16: la tarjeta de sesión en curso muestra el avance')`.
- **Fechas y valores esperados:** se calculan con Node antes de escribirlos en una prueba, no de memoria (las duraciones de la spec ya se calcularon así).
- **Textos que cambian en pruebas existentes:** "Iniciar sesión" pasa a "Empezar sesión" (T13) y el diálogo de descarte cambia de texto (T10). Las pruebas de spec 002 que los citan se actualizan en la misma tarea.
