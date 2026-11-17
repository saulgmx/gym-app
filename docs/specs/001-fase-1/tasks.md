# Tareas: Fase 1, plan cargado y "Hoy" con la sesión correcta

**Plan:** `specs/001-fase-1/plan.md`

Cada tarea es pequeña (≤ 1-2 h), deja el CI verde y tiene una verificación concreta. En el dominio y en `ensureSeeded`, la tarea de pruebas va antes que la de implementación (P-5): el commit en rojo se queda local y se sube con la tarea que lo pone en verde.

**Responsable:** C = Claude Code · U = usuario (requiere tu cuenta, tu dispositivo o una decisión tuya).

## A. Dominio (pruebas primero)

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T1 | Instalar `dexie` 4.4.7, `dexie-react-hooks` 4.4.0, `zod` 4.6.7 y `fake-indexeddb` 6.2.8 (dev) con versión exacta; revisar que no pidan scripts de instalación (`allowScripts`) y correr `npm audit` | raíz | `npm ci --strict-allow-scripts`, `npm run lint` y `npm test` pasan; `npm run size` registra la línea base (102.87 kB) | — | C | ☑ |
| T2 | Tipos del dominio según el contrato v1.3: `Exercise`, `Program`, `Block` (con `weekRir`), `ScheduleEntry`, `SessionTemplate`, `TemplateItem` (con `alternatives`), `ProgramPosition`, `TodayPlan`, `PlannedItem`, `PlanSeed` y `PlanErrorCode` | `plan/domain` | `npm run typecheck` pasa | — | C | ☑ |
| T3 | Pruebas de `schedule.ts` con datos pequeños: posición (RN-PLN-01, 02), sesión del día con paridad dentro del bloque (03), factor de volumen (04), series planificadas (05), RIR con `weekRir` y deload (06), semana de lunes a domingo (10) y plantillas de otro bloque (12), más los casos de borde 16 a 18 del contrato v1.4 | `plan/domain` | Pruebas en rojo | AC-8 a AC-14 (por regla) | C | ☑ |
| T4 | Implementar `schedule.ts` (puro: recibe `LocalDate` y datos, sin reloj) | `plan/domain` | T3 en verde; cobertura del dominio ≥ 80% (`schedule.ts` 100%); 21 mutaciones detectadas, cada una por la prueba de su regla | AC-8 a AC-14 (por regla) | C | ☑ |
| T5 | Pruebas de `seed-rules.ts`: `high` como principal y como alternativa (RN-PLN-07); alternativas inexistentes, iguales al principal, repetidas o con otra `metric` (11); referencias rotas, semanas con hueco o solape, días sin entrada o duplicados y paridad incompleta (15), más (e)–(h) y el orden de errores (19) del contrato v1.5 | `plan/domain` | Pruebas en rojo | AC-5, AC-6 | C | ☑ |
| T6 | Implementar `seed-rules.ts`: devuelve `Result` con `plan/high-risk-exercise` o `plan/invalid-seed` | `plan/domain` | T5 en verde; `seed-rules.ts` 100%; 22 mutaciones detectadas, cada una por la prueba de su regla | AC-5, AC-6 | C | ☑ |

**Punto de control A:** PR "plan domain: schedule and seed rules".

## B. Persistencia y seed

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T7 | Pruebas del servicio de aplicación con un repositorio en memoria: `ensureSeeded` (parser que falla, reglas que fallan, `startDate` = lunes de la semana de `clock.today()` (RN-PLN-13), no escribe si ya hay programa) y `getPosition`/`getTodayPlan`/`getWeekPlan` sobre el repositorio | `plan/application` | Pruebas en rojo | AC-1 (fecha), AC-2, QS-08 | C | ☑ |
| T8 | Implementar `application/ports.ts` (`PlanRepository`, `SeedParser`) y el servicio; el servicio solo espera promesas del repositorio (plan §6.4) | `plan/application` | T7 en verde | AC-1 (fecha), AC-2, QS-08 | C | ☑ |
| T9 | Esquema Zod del seed (`infrastructure/seed-schema.ts`): forma, enums, `weekday` 0-6, IDs UUIDv7, rangos `[min, max]` con `min ≤ max`, enteros positivos; con sus pruebas | `plan/infrastructure` | Pruebas del esquema pasan (casos válidos e inválidos) | AC-5 (forma), P-8 | C | ☑ |
| T10 | Pruebas de integración con `fake-indexeddb` a través de `createPlan`: primer arranque (AC-1), reabrir sin cambios (AC-2), dos `ensureSeeded` concurrentes (AC-3) y base vacía tras un seed inválido o con `high` (AC-5, AC-6) | `plan` | Pruebas en rojo | AC-1 a AC-3, AC-5, AC-6 | C | ☑ |
| T11 | `infrastructure/schema.ts` (`planStores`), repositorio Dexie (`seedIfEmpty` en una transacción `rw` sobre las 4 tablas) y `createPlan({ db, clock })` en `index.ts` | `plan/infrastructure`, `index.ts` | T10 en verde; `npm run lint` (fronteras) pasa | AC-1 a AC-3, AC-5, AC-6 | C | ☑ |
| T12 | `app/db.ts` (`openDatabase` con `planStores` en la versión 1; `indexedDB` inyectable para pruebas), `compose({ db, clock })` con `ready`, `bootstrap` actualizado y `messages.ts` con `PlanErrorCode` (se quita el `eslint-disable` de la fase 0) | `app` | Pruebas de `bootstrap` y `compose`: `ready` resuelve con un seed válido y rechaza con uno inválido o si la base no abre | AC-21 (arranque) | C | ☐ |
| T13 | Pruebas del seed real: validación (AC-4), resumen legible por plantilla comparado con `docs/plan.md` y AC-8 a AC-14 con datos reales a través de la API | `app/seed` | Pruebas en rojo (aún no hay JSON) | AC-4, AC-8 a AC-14 | C | ☐ |
| T14 | Generar los UUIDv7 una vez (script local, no se versiona) y escribir `src/app/seed/plan-seed.json` con el catálogo (plan §4.1), los bloques (§4.2) y las 11 plantillas | `app/seed` | T13 en verde; revisas el resumen legible en el PR | AC-4, AC-8 a AC-14, RF-01 | C + U | ☐ |

**Punto de control B:** PR "plan persistence and seed".

## C. Pantalla "Hoy"

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T15 | Hooks `useTodayPlan` y `useWeekPlan` con `useLiveQuery` | `plan/ui` | Prueba con `fake-indexeddb`: el hook devuelve el plan y se actualiza tras escribir en la tabla (plan §6.4) | — | C | ☐ |
| T16 | `PlanExerciseList` y `WeekStrip` con CSS Modules y tokens: "2 × 8-12" y "3 × 30-45 s", "RIR 3-4", nota; 7 días con inicial, indicador que no depende solo del color, nombre accesible "miércoles, Full body B" y `aria-current="date"` | `plan/ui` | Pruebas de componente; `npm run lint` (stylelint) pasa | AC-15 (lista), AC-17 | C | ☐ |
| T17 | `AppContext` (`plan`, `clock`, `ready`), `useToday(clock)` con `visibilitychange` y `TodayPage`: `Suspense` con `use(ready)`, encabezado, días de pesas, cardio y descanso, fuera del programa y semana de descarga; se quita el estado vacío de la fase 0 | `app` | Pruebas de componente con `createPlan`, `fake-indexeddb` y `fixedClock` | AC-15 a AC-21 | C | ☐ |
| T18 | E2E `today.spec` (`page.clock` en el miércoles 18-nov-2026 → "Full body B"; recarga sin conexión), `a11y.spec` en un día de pesas y uno de descanso, y `size-limit` (si pasa de 170 KB, cambiar a `zod/mini`, plan §6.2) | `tests/e2e`, raíz | `npm run test:e2e` y `npm run size` pasan, local y en CI | AC-1, AC-7, AC-22, AC-23, QS-06 (parcial) | C | ☐ |

**Punto de control C:** PR "today page".

## D. Verificación y cierre

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T19 | Tras el despliegue: abrir `https://gym.saulgmx.com` en el iPhone (PWA instalada), aceptar la actualización, comprobar la sesión de hoy y la tira de la semana; modo avión y reabrir | producción | "Hoy" muestra la sesión correcta con y sin conexión en el iPhone | AC-1, AC-7 (manual en iOS), CA-2 | U + C | ☐ |
| T20 | Actualizar `handoff.md`, marcar la spec y el plan como implementados y revisar los comandos de `CLAUDE.md` | docs | Revisión | — | C | ☐ |

**Punto de control D:** PR "phase 1 handoff".

## Notas

- **Ramas:** primero se fusiona `docs/001-phase-1-spec` (spec, plan y estas tareas). La implementación va en `feat/001-phase-1-a` a `-d`, cada una desde `main` actualizado, con un commit por tarea y un PR por punto de control ("Create a merge commit").
- **Pruebas en rojo:** T3, T5, T7, T10 y T13 se quedan como commit local y se suben junto con la tarea que las pone en verde (T4, T6, T8, T11 y T14), para que el CI del PR nunca esté en rojo.
- **Mutaciones:** tras cada prueba en verde, romper la regla a propósito y ver que falla la prueba correcta, con copia de seguridad de nombre único (handoff).
- **Nombres de pruebas:** citan la regla o el criterio, por ejemplo `it('RN-PLN-03: lunes de la semana 2 → Full body B')` o `it('AC-3: dos ensureSeeded concurrentes cargan un solo programa')`.
- **Fechas y valores esperados:** se calculan con Node antes de escribirlos en una prueba, no de memoria.
- **Datos reales tras T19:** a partir de aquí la PWA del iPhone ya tiene el plan cargado con `startDate` fijado. Un cambio del seed en una versión futura no se aplica solo (spec 001 §2).
