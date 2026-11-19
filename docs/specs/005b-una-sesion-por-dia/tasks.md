# Tareas: Una sola sesión cerrada por día

**Plan:** `specs/005b-una-sesion-por-dia/plan.md`

Cada tarea es pequeña (≤ 1-2 h), deja el CI verde y tiene una verificación concreta.
- **Prueba primero:** en RN-TRN-27 y en las piezas de `app`, la tarea de pruebas va antes que la de implementación. El commit en rojo se queda local y se sube con la tarea que lo pone en verde.
- **Antes de escribir pruebas:** revisar si el contrato deja comportamientos sin definir. Si los deja, proponerlos y, con tu aprobación, escribirlos en los docs antes del código (handoff, notas).

**Responsable:** C = Claude Code · U = usuario (requiere tu cuenta, tu dispositivo o una decisión tuya).

## A. `training`: RN-TRN-27

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T1 | Pruebas de RN-TRN-27. **Servicio** (`training-service.test.ts`, repositorio en memoria): con un `completed` de `date` miércoles, iniciar el viernes ese miércoles → `day-already-trained` sin `details`, sin crear nada y con un mensaje que cita la regla (AC-1); el mismo `plannedFor` → `already-done` (AC-2); con uno activo gana `workout-already-active` (AC-3); un `discarded` ese día no lo impide (AC-4); un `completed` de otro `date`, aunque su `plannedFor` o su `finishedAt` caigan ese día, no lo impide (AC-5, AC-6). **Repositorio** (`dexie-repository.test.ts`): `createIfAllowed` devuelve `reason: 'trained'` después de `active` y `done` (orden probado con un workout que cumple las dos); dos llamadas concurrentes en un día ya entrenado → ninguna crea (AC-7) | `training/application`, `infrastructure` | Pruebas en rojo | RN-TRN-27; AC-1 a AC-7 | C | ☑ |
| T2 | Implementar: `CreateResult` con `reason: 'trained'` (`application/ports.ts`); la consulta por el índice `date` en `createIfAllowed` de Dexie y la misma en el repositorio en memoria; `startWorkout` traduce la razón; `training/day-already-trained` en `TrainingErrorCode`; su texto en `app/errors/messages.ts` y en `messages.test.ts` (plan §6.5: el mapa exige un texto por código para compilar) | `training/application`, `infrastructure`, `index.ts`; `app/errors` | T1 en verde; `npm run lint`; mutaciones detectadas (comparar `plannedFor` en lugar de `date`, no filtrar `completed`, `trained` antes que `done`, solo en el repositorio en memoria) | Ídem | C | ☑ |

**Punto de control A:** PR "one session per day: training".

## B. `app`: "Hoy" y la vista previa

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T3 | `formatWeekday(date)` en `app/format-date.ts`, que `formatLongDate` pasa a usar, y `formatTrainedToday(name, plannedFor)` en `app/pages/today/format.ts` (plan §6.5) | `app` | Pruebas primero (`today-format.test.ts`): "viernes", "miércoles" y "sábado" con acento; "Ya entrenaste hoy (Full body A del viernes)."; las de `formatLongDate` siguen en verde; mutaciones detectadas | AC-9 | C | ☑ |
| T4 | `DayCard` con `trained` (texto en lugar de "Empezar sesión" en un día de pesas no hecho; cardio, descanso, fuera del programa y día hecho lo ignoran) y `OtherDays` con `trainedToday` (el aviso bajo el `h2`; filas sin cambios). Clases `.trained` y `.note` en `--text-muted` (plan §6.3) | `app/pages/today` | Pruebas de componente primero (`day-card.test.tsx` y una de `OtherDays`); stylelint; mutaciones detectadas | AC-8 a AC-10 | C | ☑ |
| T5 | "Hoy": `closedToday = completed.find((w) => w.date === date)` en `TodayContent`; `trained` a `DayCard` solo si existe y hoy no está hecho; `trainedToday` a `OtherDays` | `app/pages` | Pruebas de página primero (`today-done.test.tsx`, seed real): AC-8 a AC-12 y AC-17 (dos cerrados el 18-nov: ✓ en miércoles y viernes, "2 de 3", tarjeta hecha y aviso); las de la spec 005 siguen en verde; mutaciones detectadas (`plannedFor` por `date`, `trained` con el día hecho) | AC-8 a AC-12, AC-17 | C | ☐ |
| T6 | Vista previa: `closedToday` en `DayPreview`, con el orden día del plan hecho → ya entrenaste hoy → botón, seguido en vivo (plan §6.4) | `app/pages` | Pruebas de página primero (`day-preview.test.tsx`): AC-13, AC-14, AC-15 (otra escritura cambia el botón por el texto sin recargar) y AC-16 (`startWorkout` devuelve el error: texto en la región `aria-live`, sin navegar); mutaciones detectadas (orden invertido) | AC-13 a AC-16 | C | ☐ |
| T7 | Medir el bundle (`npm run build` y `npm run size`) | raíz | `npm run size` < 200 kB; la medición se anota en plan §6.6 | P-6 | C | ☐ |

**Punto de control B:** PR "one session per day: today and preview".

## C. Verificación y cierre

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T8 | E2E en `close.spec.ts` (`describe('spec 005b …')`). El miércoles 18: vista previa del viernes, empezar, una serie, "Terminar y guardar lo hecho", dolor 0, guardar. Luego, en "Hoy", la tarjeta de AC-9 y el aviso; `/dia/2026-11-20` → "Ya hiciste esta sesión."; `/dia/2026-11-16` → el texto de AC-13 sin botón. El mismo recorrido sin conexión (AC-19). En `a11y.spec.ts`: axe, 44 px y 320 px en "Hoy" (AC-9) y en la vista previa (AC-13) | `tests/e2e` | `npm run test:e2e` pasa en local y en CI, en Chromium y WebKit; las pruebas nuevas, estables en 5 repeticiones (`--grep "spec 005b" --repeat-each=5`) | AC-8, AC-9, AC-13, AC-18, AC-19 | C | ☐ |
| T9 | Tras el despliegue, en el iPhone (PWA instalada): "Hoy" con los dos cerrados del 18-nov se ve bien (AC-17); cerrar una sesión real y ver la tarjeta o el aviso y la vista previa sin "Empezar sesión"; modo avión; al día siguiente, el aviso desaparece | producción | Se ve como en la spec §6; nada se pierde | AC-17, AC-19 (manual en iOS), riesgos del plan §8 | U + C | ☐ |
| T10 | Actualizar `handoff.md` y marcar la spec y el plan como implementados | docs | Revisión | — | C | ☐ |

**Punto de control C:** PR "one session per day: handoff".

## Modelo recomendado por tarea

Guía para elegir el modelo de Claude Code en cada tarea. Si el costo o los límites de uso no importan, Opus en todas es lo más simple y reduce el retrabajo.

| Punto | Modelo | Por qué |
|---|---|---|
| A (T1-T2) | Opus | Transacción, orden de errores, concurrencia y la confusión `date` / `plannedFor` |
| B (T3-T7) | Sonnet en T3, T4 y T7; Opus en T5 y T6 | Las páginas cruzan varias consultas en vivo y estados |
| C (T8-T10) | Opus en T8; Sonnet en T10 | E2E estables en WebKit; T9 es tuya |

## Notas

- **A antes que B:** las páginas no dependen del error nuevo para mostrar los textos (lo leen de `completed`), pero el texto del aviso es el del mapa de `training/day-already-trained`, que entra en T2.
- **Usabilidad entre PR:**
  - Tras A, la app ya impide la segunda sesión: el botón sigue visible, pero al tocarlo aparece el texto del error (AC-16).
  - Tras B, el botón ya no aparece.
- **Datos reales (T9):**
  - Los dos cerrados del 18-nov solo se ven en "Hoy" mientras sea la semana del 16 al 22 de noviembre. Si T9 llega antes del domingo 22, se comprueba AC-17 tal cual: ✓ en miércoles y viernes y "2 de 3".
  - Si llega después, AC-17 queda cubierto por `today-done.test.tsx`, y en el iPhone basta con que nada falle.
