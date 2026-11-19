# Plan técnico: Cierre de sesión

**Spec:** `specs/005-cierre/spec.md` · **Estado:** Aprobado (18-nov-2026)

## 1. Resumen de la solución

`health` nace con su dominio puro (clasificación, alerta persistente y causa del aviso de "Hoy"), un repositorio Dexie sobre `painEntries` (base v3) y dos componentes para el Cierre. `training` gana `finishWorkout`, que lee `PainGate` antes de su transacción, `listWorkouts` y la función pura `workoutSummary`, y `startWorkout` rechaza un día ya hecho dentro de la transacción de RN-TRN-01. `app` compone los dos módulos: la pantalla de Cierre guarda el dolor y luego cierra, y "Hoy" cruza el plan de la semana con los workouts terminados y con el resumen del dolor.

## 2. Módulos afectados

| Módulo | Cambio | ¿Cambia el contrato? |
|---|---|---|
| `health` | `domain/pain.ts`, servicio, repositorio Dexie (`painEntries`), `usePainSummary`, `PainSelector`, `RedFlagsChecklist`, `PainNotice` | Sí: `modules/health.md` v1.3 (§2, §3, §4) |
| `training` | `finishWorkout`, `listWorkouts`, `useCompletedWorkouts`, `workoutSummary`; `createIfAllowed` con RN-TRN-24; `painGate` en `createTraining` | Sí: `modules/training.md` v1.20 (§4) |
| `plan` | `WeekStrip` recibe los días hechos | Sí: `modules/plan.md` v1.15 (§4) |
| `app` | `db.ts` v3, `compose` con `health`, `app/pages/close/`, "Hoy", pie y aviso de salida de la sesión, vista previa, textos de error | No (no es un módulo) |
| `shared` | Ninguno | No |

## 3. Cambios de contrato

Ya escritos en `modules/health.md` v1.3, `modules/training.md` v1.20 y `modules/plan.md` v1.15 (18-nov), antes del código.

**`health` v1.3:**

```ts
export const healthStores: Record<'painEntries', string>;   // 'id, &workoutId, recordedAt'

export function createHealth(deps: { db: Dexie; clock: Clock; ids: IdGenerator }): HealthApi;
// `bus` llega cuando se publiquen los eventos de §5 (fase 4), como en training (P-7).

export type HealthErrorCode = 'health/pain-out-of-range' | 'health/invalid-red-flag';

type NoticeCause = 'bladder_bowel' | 'red_flag' | 'alert' | 'over_threshold_2x' | 'rising_3x' | 'attention';

interface PainSummary {
  latest: PainEntry | null;
  latestAssessment: PainAssessment | null;
  persistentAlert: { reason: 'over_threshold_2x' | 'rising_3x' | 'red_flag' } | null;  // sin `since`
  notice: { cause: NoticeCause; message: string } | null;                              // RN-HLT-12, 13
  threshold: number;                                                                    // 3 (sin Ajustes)
}

interface HealthApi {   // spec 005; el resto de §4 entra con su feature
  recordPain(workoutId: ID, input: { level: number; redFlags: RedFlag[]; date: LocalDate }): Promise<Result<PainAssessment, HealthError>>;
  assessPain(level: number, redFlags: RedFlag[]): PainAssessment;
  getPainSummary(): Promise<PainSummary>;
  hasPainEntry(workoutId: ID): Promise<boolean>;
  painGate: PainGate;
}

export function usePainSummary(health: HealthApi): PainSummary | undefined;   // useLiveQuery

function PainSelector(props: { value: number | null; onChange: (level: number) => void; assessment: PainAssessment | null }): JSX.Element;
function RedFlagsChecklist(props: { value: RedFlag[]; onChange: (flags: RedFlag[]) => void; assessment: PainAssessment | null }): JSX.Element;
function PainNotice(props: { notice: NonNullable<PainSummary['notice']> }): JSX.Element;  // aviso ámbar de "Hoy"
```

- Salen de `HealthApi` hasta que se implementen: `getPainForWorkouts` (spec 006), peso corporal y `getSettings`/`updateSettings` (fase 4 y Ajustes), `dataPort` (spec 007). `PainSummary.series` (RF-33) y `persistentAlert.since` salen hasta que una pantalla los use.
- "Últimas entradas" = por `recordedAt`, de la más reciente a la más antigua (§6.3).
- `recordPain` valida RN-HLT-01 y que las banderas sean de `RedFlag` y sin repetir (`health/invalid-red-flag`); reemplaza la entrada del mismo `workoutId` conservando su `id` y con `recordedAt` nuevo (RN-HLT-09).

**`training` v1.20:**

```ts
export function createTraining(deps: { /* …igual… */ painGate: PainGate }): TrainingApi;

interface TrainingApi {
  // …
  finishWorkout(workoutId: ID, input: { notes?: string }): Promise<Result<Workout, TrainingError>>; // RN-TRN-22
  listWorkouts(range: { from: LocalDate; to: LocalDate }): Promise<Workout[]>;                     // RN-TRN-23
}

export function workoutSummary(view: WorkoutView, now: Instant): WorkoutSummary;   // RN-TRN-25, puro
export function useCompletedWorkouts(training: TrainingApi, range: { from: LocalDate; to: LocalDate }): Workout[] | undefined;
```

- **`getWorkoutSummary(id)` se reemplaza** por la función pura `workoutSummary(view, now)`: el Cierre ya tiene la vista en vivo y la tarjeta del día hecho la consulta con `useWorkoutView`; una consulta más no aporta nada (P-7).
- `listWorkouts`: solo `completed`, con `from ≤ date ≤ to`, del más reciente al más antiguo (como RN-TRN-08). RN-TRN-23 se calcula con la semana ISO por `date`, porque `plannedFor` está en la misma semana (RN-TRN-14).

**`plan` v1.15:** `WeekStrip(props: { days; weekStart; today; done: ReadonlySet<LocalDate> })`. Un día de pesas en `done` dibuja ✓ y dice "hecha"; `plan` no sabe de dónde sale (`app` lo calcula con `training`).

## 4. Datos

- **Base v3** en `app/db.ts`: `db.version(3).stores({ ...planStores, ...trainingStores, ...healthStores })`. Solo añade `painEntries`; no hace falta `upgrade` (las tablas de v2 no cambian). Índice único en `workoutId` (RN-HLT-09) y en `recordedAt` para leer las últimas.
- Sin índice nuevo en `workouts` (§3, `listWorkouts`).
- `PainEntry` se guarda tal cual (como las filas de `training`).
- Exportación: sin cambios hasta la spec 007, que añade el `DataPort` de `health`.

## 5. Flujo

```mermaid
sequenceDiagram
  participant CP as ClosePage (app)
  participant H as health
  participant T as training
  CP->>H: recordPain(workoutId, {level, redFlags, date})
  alt error
    H-->>CP: err / rechazo → mensaje sobre el pie (AC-25)
  else ok
    CP->>T: finishWorkout(workoutId, {notes})
    T->>H: painGate.hasPainEntry(workoutId)   (antes de la transacción)
    T->>T: mutate: finishWorkout(state, {notes, now, hasPain}) (dominio)
    alt ok
      T-->>CP: workout completed → navigate('/', replace)
    else error
      T-->>CP: mensaje sobre el pie; reintentar reemplaza el dolor (AC-26)
    end
  end
```

Sin eventos (spec §2). El diagrama de architecture §6.3 se queda como el destino de la fase 4.

## 6. Decisiones

### 6.1 `PainGate` antes de la transacción
`training` escribe en una transacción sobre sus dos tablas y no puede esperar promesas ajenas (spec 002 plan §5); `painEntries` es de `health` (P-4). `finishWorkout` lee `hasPainEntry` primero y pasa el booleano al dominio, que comprueba en el orden de RN-TRN-22: cerrado → sin series hechas → sin dolor. Una entrada de dolor no se borra nunca, así que leerla antes no deja un hueco.

### 6.2 RN-TRN-24 dentro de la transacción de RN-TRN-01
`createIfNoneActive` pasa a `createIfAllowed`: en la misma transacción busca un `in_progress` (RN-TRN-01) y, si no hay, un `completed` con el mismo `plannedFor` (por `status` y filtro). Devuelve `{ created } | { reason: 'active', activeId } | { reason: 'done' }`. Dos pestañas no pueden empezar a la vez un día que se acaba de cerrar.

### 6.3 Las "últimas" son por `recordedAt`
Una sesión del lunes cerrada el martes es la última que se registró. Ordenar por `date` haría que cerrar tarde una sesión vieja no contara como la última. `recordedAt` es `Instant` y se compara con las funciones del kernel (ADR-0009).

### 6.4 Dominio de `health`
`health/domain/pain.ts`, puro, con pruebas primero:
- `checkPainInput(level, redFlags)` → `Result` (RN-HLT-01).
- `assessPain(level, redFlags)` → `PainAssessment` (RN-HLT-02, 06, 07).
- `persistentAlert(latestFirst, threshold)` (RN-HLT-03, 04, 05, 08).
- `noticeOf(latestFirst, threshold)` → `{ cause, message } | null` (RN-HLT-12, 13, textos de §6.1 del contrato).

Los textos de salud viven en `health/domain/messages.ts` (son reglas de spec §6.2, no errores, así que no pasan por el mapa de ADR-0010).

### 6.5 La pantalla de Cierre
`app/pages/close/`:
- `ClosePage.tsx` reemplaza la página vacía: `useWorkoutView`, y decide el estado: cargando, no disponible (AC-29), ya guardada (AC-28), sin series hechas (AC-30) o formulario.
- `CloseForm.tsx`: el estado de la pantalla (`level`, `redFlags`, `notes`, `saving`, `error`) en `useState`, sin Zustand ni guardado (spec §6.1). `assessPain` en cada render (es pura).
- `CloseSummary.tsx`: `workoutSummary(view, now)` con `now` fijado al montar (`useState(() => clock.now())`), y `isToday` igual (spec 004 plan §6.4).
- `CloseFooter.tsx`: "Guardar sesión", la ayuda y "Volver a la sesión".
- Guardar: `recordPain` con `date = workout.date` y luego `finishWorkout`; si los dos van bien, `navigate('/', { replace: true })`. `saving` deshabilita el botón (AC-27).
- La sesión ya guardada en `/sesion/:id/N` (AC-28): `SessionPage` distingue `completed` de los demás estados no disponibles.

### 6.6 A qué ejercicio vuelve "Volver a la sesión"
Los enlaces al Cierre llevan `state: { from: index }` (React Router). `ClosePage` lo acepta solo si es un entero entre 1 y el número de ítems; si no (URL escrita, recarga), usa `workoutProgress(view).current?.itemIndex ?? 1` (AC-21 a AC-23). No se guarda en ningún sitio.

### 6.7 "Hoy"
`TodayContent` añade dos consultas y sigue sin pintar hasta que todas respondan (spec 003 plan §6.7):
- `useCompletedWorkouts(training, { from: weekStart, to: addDays(weekStart, 6) })` → `done = new Set(workouts.map(w => w.plannedFor))` para `WeekSection` (N y tira), `OtherDays` (filas "hecha ✓") y la tarjeta.
- `usePainSummary(health)` → `PainNotice` arriba de la tarjeta y `back` (nivel) para el chip de `DayCard`, solo en el estado D.
- **Día hecho:** si `done` tiene hoy, `DoneDayCard` (nuevo, en `app/pages/today/`) llama a `useWorkoutView` con el workout de hoy y muestra "Hecha ✓" y "52 min · 10 series" con `workoutSummary(view, finishedAt)`; si hay dos, el más reciente (spec §7). `ExerciseDetails` no se muestra.
- **Vista previa** (`/dia/:date`): con el día en `done`, "Ya hiciste esta sesión." en lugar de `StartWorkoutButton`. `training/already-done` tiene su texto en `app/errors/messages.ts` por si llega igual (otra pestaña).

### 6.8 Sesión activa
- `SessionFooter` recibe `closeTo: string | null`: en el último ejercicio, si `progress.setsDone > 0`, el enlace principal "Terminar sesión" con `state: { from: index }` (AC-1 a AC-3).
- `ExitSheet` recibe `onFinish?: () => void`: con al menos una serie hecha añade "Terminar y guardar lo hecho" con su subtítulo, en segundo lugar (AC-4 a AC-6). Es un enlace, como "Salir y continuar después".

### 6.9 Componentes de `health/ui`
- `PainSelector`: `role="group"` con nombre "Dolor lumbar", 11 botones `aria-pressed`, el mensaje en `aria-live="polite"`; `data-band` para el color (`--warn` desde 4) y la barra en 7-10 (las pruebas no dependen de clases).
- `RedFlagsChecklist`: `<fieldset>` con `<legend>` "Señales de alarma (opcional)", cuatro casillas nativas y el aviso (`redFlagMessage`) en `aria-live="polite"`.
- `PainNotice` y el aviso de las banderas comparten un `SafetyNote` interno de `health/ui` (ámbar, icono decorativo). No va a `shared` hasta que otro módulo lo use (P-7).

### 6.10 Textos de error
`app/errors/messages.ts` añade `training/nothing-done` ("No hay series hechas para guardar."), `training/notes-too-long`, `training/already-done` ("Ya hiciste esta sesión."), `training/pain-required`, `health/pain-out-of-range` y `health/invalid-red-flag` (ADR-0010). Desde la interfaz solo pueden llegar los dos primeros y `already-done`; los demás protegen la API.

### 6.11 Presupuesto del bundle
Bundle inicial actual: 163.58 kB de 200 kB. `health` entra en el bundle inicial porque "Hoy" usa `usePainSummary`; son funciones y componentes pequeños, sin dependencias nuevas. Se mide en la tarea de cierre del punto de control C.

## 7. Estrategia de pruebas

Pruebas primero en `health` (P-5) y en las reglas nuevas de `training`. Los nombres citan la regla o el AC.

| Criterio | Tipo de prueba | Archivo |
|---|---|---|
| RN-HLT-01, 02, 06, 07 | Unitaria (dominio), primero | `modules/health/__tests__/pain.test.ts` |
| RN-HLT-03, 04, 05, 08, 12, 13 y textos | Unitaria (dominio), primero | `modules/health/__tests__/pain-alerts.test.ts` |
| RN-HLT-09, orden por `recordedAt`, `hasPainEntry` | Integración con `fake-indexeddb` | `modules/health/__tests__/health-service.test.ts` |
| `usePainSummary` en vivo | Hook | `modules/health/__tests__/hooks.test.tsx` |
| `PainSelector`, `RedFlagsChecklist`, `PainNotice` (AC-10 a AC-15) | Componente | `modules/health/__tests__/pain-ui.test.tsx` |
| RN-TRN-22, 25 | Unitaria (dominio), primero | `modules/training/__tests__/workout-finish.test.ts` |
| RN-TRN-06, 22, 23, 24 | Servicio con `PainGate` falso | `modules/training/__tests__/training-service.test.ts` |
| RN-TRN-24 con dos pestañas | Repositorio | `modules/training/__tests__/dexie-repository.test.ts` |
| `useCompletedWorkouts` | Hook | `modules/training/__tests__/hooks.test.tsx` |
| `WeekStrip` con `done` (AC-32 a AC-34, AC-36) | Componente | `modules/plan/__tests__/components.test.tsx` |
| AC-46 (v2 → v3) | Integración | `app/__tests__/db.test.ts` |
| `compose` con `health` y `painGate` | Integración | `app/__tests__/compose.test.ts` |
| AC-1 a AC-6 | Página | `app/__tests__/session-page.test.tsx`, `session-exit.test.tsx` |
| AC-7 a AC-31 | Página | `app/__tests__/close-page.test.tsx` |
| AC-32 a AC-45 | Página | `app/__tests__/today-page.test.tsx`, `day-card.test.tsx`, `day-preview.test.tsx` |
| AC-18, AC-24, AC-32, AC-39, AC-48, AC-50 | E2E: cerrar, guardar, "Hoy" después, sin conexión | `tests/e2e/close.spec.ts` |
| AC-47 | E2E con axe, 44 px y 320 px | `tests/e2e/a11y.spec.ts` |
| AC-49 | `npm run size` tras `npm run build` | CI |

Tras cada prueba en verde se rompe el código a propósito, para ver que falla la prueba correcta (handoff, notas).

## 8. Riesgos

- **Dos escrituras sin transacción común** (dolor, luego cierre): aceptado en la spec (§7, decisión 15); el orden y el reemplazo de RN-HLT-09 hacen que reintentar sea seguro.
- **Subida a v3 con otra pestaña abierta en v2:** la pestaña vieja bloquea la subida hasta cerrarse. Pasó igual en v1 → v2 y se verificó en el iPhone; se repite en la tarea de verificación.
- **"Hoy" con cinco consultas en vivo:** cada una con `useLiveQuery`; todas esperan antes de pintar. Si el render se nota lento en el iPhone, juntar las de `training` en una.
- **`state` de la navegación en iOS:** al volver a la app desde segundo plano, Safari puede recargar y perder `state`; el fallback de §6.6 lo cubre.
- **Contraste del ✓ y del ámbar** sobre los tokens actuales: se comprueba con axe y con Node antes de fijar los colores (handoff, notas).

## 9. Checklist de la constitución

- [x] **P-1:** ningún ejercicio sugerido; `blocksProgression` se calcula y queda para la fase 4; los textos de salud remiten a un profesional.
- [x] **P-2:** base v3 con prueba desde v2 (AC-46); guardar en dos pasos reintentables; nada se borra.
- [x] **P-3:** cambios de contrato en §3 antes del código; sin `[POR DEFINIR]`.
- [x] **P-4:** `training` solo conoce `PainGate`; `plan` recibe `done` por props; `app` compone; cada módulo con sus tablas.
- [x] **P-5:** dominio de `health` y RN-TRN-22 a 25 puros y con pruebas primero.
- [x] **P-6:** ≥ 44 px, axe y 320 px (AC-47); bundle (AC-49).
- [x] **P-7:** sin eventos, `bus`, Ajustes, `getWorkoutSummary` ni `SafetyNote` en `shared`.
- [x] **P-8:** sin entradas externas nuevas; textos en español.
