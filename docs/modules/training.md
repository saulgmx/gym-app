# Contrato del módulo `training`

**Versión del contrato:** 1.0 · **Depende de:** `plan` (API), `shared` · **Lo usan:** `progression`, `app`

## 1. Responsabilidad

Sesión en curso, registro de series e historial de sesiones. Es la fuente de verdad de lo que se entrenó. No calcula sugerencias ni interpreta el dolor.

## 2. Datos propios

| Tabla | Clave e índices | Contenido |
|---|---|---|
| `workouts` | `id, date, status, templateId` | Sesiones |
| `sets` | `id, workoutId, exerciseId, [exerciseId+completedAt]` | Series |

## 3. Modelo de dominio

```ts
interface Workout {
  id: ID;
  templateId: ID | null;            // null = sesión libre (RF-06)
  programWeek: number | null;
  date: LocalDate;                  // día local al iniciar
  startedAt: Instant;
  finishedAt?: Instant;
  status: 'in_progress' | 'completed' | 'discarded';
  items: WorkoutItem[];             // instantánea del plan al iniciar
  notes?: string;
}

interface WorkoutItem {
  exerciseId: ID;
  order: number;
  plannedSets: number;
  repRange: [number, number];
  targetRir: [number, number];
}

interface SetLog {
  id: ID;
  workoutId: ID;
  exerciseId: ID;
  setNumber: number;                // 1..n dentro del ejercicio
  weightKg: number | null;          // null en ejercicios de peso corporal sin lastre
  reps: number | null;              // o segundos si metric = 'time'
  rir: number | null;
  done: boolean;
  isExtra: boolean;
  completedAt?: Instant;
}

interface ExerciseSession {          // salida de getExerciseHistory
  workoutId: ID; date: LocalDate; repRange: [number, number];
  sets: SetLog[];                   // solo las completadas, en orden
}
```

**Cambio respecto a spec §9.1:** `lumbarPain` y `redFlags` salen de `Workout` y pasan a `health.PainEntry` (el módulo `health` es dueño del dolor). Se añade `items` como instantánea para que editar una plantilla no altere el historial.

## 4. API pública (`index.ts`)

```ts
export function createTraining(deps: {
  db: TrainingDb; clock: Clock; ids: IdGenerator; bus: EventBus;
  plan: Pick<PlanApi, 'getTodayPlan' | 'getExercises'>;
}): TrainingApi;

export function configureTraining(ports: { suggestions: SuggestionProvider; painGate: PainGate }): void;

interface TrainingApi {
  startWorkout(date: LocalDate): Promise<Result<Workout>>;                                // RF-10
  logSet(setId: ID, input: { weightKg?: number | null; reps?: number | null; rir?: number | null }): Promise<Result<SetLog>>; // RF-11, RF-13
  toggleSetDone(setId: ID): Promise<Result<SetLog>>;
  addExtraSet(workoutId: ID, exerciseId: ID): Promise<Result<SetLog>>;                    // RF-16
  removeSet(setId: ID): Promise<Result<void>>;                                            // RF-16, solo extras o no hechas
  finishWorkout(workoutId: ID, input: { notes?: string }): Promise<Result<Workout>>;     // RF-20, RF-23
  discardWorkout(workoutId: ID): Promise<Result<void>>;
  getActiveWorkout(): Promise<Workout | undefined>;                                       // RF-19
  getWorkout(id: ID): Promise<Workout | undefined>;
  getWorkoutSummary(id: ID): Promise<WorkoutSummary | undefined>;                         // RF-20
  listWorkouts(range?: { from?: LocalDate; to?: LocalDate }): Promise<Workout[]>;         // RF-32
  getExerciseHistory(exerciseId: ID, opts?: { limit?: number; before?: LocalDate }): Promise<ExerciseSession[]>;
  getWorkoutExerciseIds(workoutId: ID): Promise<ID[]>;
  dataPort: DataPort;
}

interface WorkoutSummary { durationMin: number; setsDone: number; setsPlanned: number; exercises: number }

// Hooks
export function useWorkout(id: ID): { workout: Workout; sets: SetLog[] } | undefined;
export function useActiveWorkout(): Workout | null | undefined;
export function useLastSession(exerciseId: ID, before: LocalDate): ExerciseSession | null | undefined;  // "anterior" de RF-12

// Componentes
export { SetRow, SetTable, SessionHeader, RestTimer } from './ui';
```

### Puertos que requiere (`application/ports.ts`)

```ts
export interface PrefillSuggestion {           // tipo propio de training
  weightKg: number | null; reps?: number; message: string; tone: 'up' | 'hold' | 'down' | 'neutral' | 'blocked';
}
export interface SuggestionProvider {
  getPrefill(exerciseId: ID): Promise<PrefillSuggestion | null>;
}
export interface PainGate {
  hasPainEntry(workoutId: ID): Promise<boolean>;
}
```

Los implementan `progression` y `health`; los conecta `app/compose.ts`.

## 5. Eventos

| Evento | Payload | Cuándo |
|---|---|---|
| `training/WorkoutStarted` | `{ workoutId, date }` | Tras crear el workout |
| `training/SetLogged` | `{ workoutId, setId, exerciseId, done }` | Tras guardar una serie |
| `training/WorkoutCompleted` | `{ workoutId, date, exerciseIds }` | Tras cerrar |
| `training/WorkoutDiscarded` | `{ workoutId }` | Tras descartar |

No escucha eventos.

## 6. Reglas de negocio

| ID | Regla | Origen |
|---|---|---|
| RN-TRN-01 | Solo puede haber un workout `in_progress`. `startWorkout` con uno activo devuelve `training/workout-already-active` y su id. | RF-19 |
| RN-TRN-02 | `startWorkout` crea `items` desde `plan.getTodayPlan(date)` y `plannedSets` series vacías por ejercicio, con `weightKg` prellenado desde `SuggestionProvider`. | RF-10, RF-12 |
| RN-TRN-03 | Cada cambio de una serie se persiste en una sola escritura antes de devolver (sin guardado global). | RF-13 |
| RN-TRN-04 | Para marcar `done`: `reps` no nulo; `weightKg` no nulo si `metric = 'weight'`. Rangos: `0 ≤ weightKg ≤ 500`, `0 ≤ reps ≤ 100`, `0 ≤ rir ≤ 10`, `weightKg` múltiplo de 0.25. | RF-11 |
| RN-TRN-05 | Al marcar `done` se fija `completedAt = clock.now()`; al desmarcar se borra. | RF-11 |
| RN-TRN-06 | `finishWorkout` exige `painGate.hasPainEntry(workoutId)`; si no, `training/pain-required`. | RF-21 |
| RN-TRN-07 | Un workout `completed` o `discarded` no admite cambios de series en v1 (solo `notes`). [PROPUESTO] | — |
| RN-TRN-08 | `getExerciseHistory` devuelve solo workouts `completed` y series `done`, del más reciente al más antiguo. | RF-12, RF-31 |
| RN-TRN-09 | `date` del workout es el día local en que empezó, aunque termine después de medianoche. | ADR-0009 |
| RN-TRN-10 | `removeSet` solo aplica a series extra o no completadas; renumera `setNumber`. | RF-16 |

## 7. Errores

`training/workout-not-found`, `training/workout-already-active`, `training/workout-closed`, `training/set-not-found`, `training/invalid-set-values`, `training/pain-required`, `training/no-plan-today`.

## 8. Pruebas de contrato

- Iniciar → registrar 3 series → recargar (nueva instancia con la misma base) → `getActiveWorkout` devuelve el workout y las 3 series (QS-03).
- RN-TRN-01: segundo `startWorkout` falla con el id del activo.
- RN-TRN-06: `finishWorkout` sin dolor falla; con `PainGate` falso en memoria que devuelve `true` funciona y publica `WorkoutCompleted`.
- RN-TRN-08: series no hechas y workouts descartados no aparecen en el historial.
- Con `SuggestionProvider` falso: el peso prellenado es el sugerido.

## 9. Trazabilidad

RF-10 a RF-16, RF-19, RF-20, RF-23, RF-32.
