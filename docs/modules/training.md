# Contrato del módulo `training`

**Versión del contrato:** 1.10 · **Depende de:** `plan` (API), `shared` · **Lo usan:** `progression`, `app`

## 1. Responsabilidad

Sesión en curso, registro de series e historial de sesiones. Es la fuente de verdad de lo que se entrenó. No calcula sugerencias ni interpreta el dolor.

## 2. Datos propios

| Tabla | Clave e índices | Contenido |
|---|---|---|
| `workouts` | `id, date, status, templateId` | Sesiones |
| `sets` | `id, workoutId, exerciseId, [exerciseId+completedAt]` | Series |

Llegan en la versión 2 de la base (spec 002).

## 3. Modelo de dominio

```ts
interface Workout {
  id: ID;
  templateId: ID | null;            // null = sesión libre (RF-06)
  programWeek: number | null;
  date: LocalDate;                  // día local al iniciar (RN-TRN-09)
  plannedFor: LocalDate;            // día del plan cuya sesión se hace; = date salvo "otra sesión de la semana" (RN-TRN-14)
  startedAt: Instant;
  finishedAt?: Instant;
  status: 'in_progress' | 'completed' | 'discarded';
  items: WorkoutItem[];             // instantánea del plan al iniciar
  notes?: string;
}

interface WorkoutItem {
  exerciseId: ID;                   // el ejercicio elegido (RN-TRN-13); único en el workout (RN-TRN-12)
  options: ID[];                    // principal primero y luego alternativas; [exerciseId] si no hay
  order: number;
  plannedSets: number;
  maxSets: number;                  // TemplateItem.sets[1], sin factor de volumen (RN-TRN-10)
  repRange: [number, number];
  targetRir: [number, number];
  note?: string;                    // nota de la plantilla (consejo técnico, RF-17)
}

interface SetLog {
  id: ID;
  workoutId: ID;
  exerciseId: ID;
  setNumber: number;                // 1..n dentro del ejercicio
  weightKg: number | null;          // null si metric ≠ 'weight'; negativo = asistencia (RN-TRN-04)
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
// Los puertos entran como dependencias (sin configureTraining, spec 002 plan §6.2). `bus` se añade
// cuando un módulo escuche los eventos de §5 (fase 4); `painGate`, con finishWorkout (fase 3) (P-7).
export function createTraining(deps: {
  db: Dexie; clock: Clock; ids: IdGenerator;
  plan: Pick<PlanApi, 'getTodayPlan' | 'getExercises'>;
  suggestions: SuggestionProvider;
}): TrainingApi;

// Tablas propias, para que app/db.ts componga db.version(n).stores({...}).
export const trainingStores: Record<'workouts' | 'sets', string>;

export type TrainingErrorCode =
  | 'training/workout-not-found' | 'training/workout-already-active' | 'training/workout-closed'
  | 'training/set-not-found' | 'training/invalid-set-values' | 'training/no-plan-today'
  | 'training/planned-date-out-of-week' | 'training/max-sets-reached' | 'training/set-not-removable'
  | 'training/invalid-exercise-choice' | 'training/item-has-done-sets';
  // 'training/pain-required' entra con finishWorkout (fase 3)

interface InvalidSetValuesDetails {     // details de training/invalid-set-values; app elige el texto
  field: 'weightKg' | 'reps' | 'rir';
  reason: 'missing' | 'not-a-number' | 'out-of-range' | 'step' | 'not-allowed';
}
interface WorkoutAlreadyActiveDetails { workoutId: ID }

interface WorkoutView {                 // lo que necesita la página de sesión, en una consulta
  workout: Workout;
  sets: SetLog[];                       // por ítem y setNumber
  exercises: Record<ID, Exercise>;      // todas las options de todos los ítems
}

// Fase 2 implementa estas operaciones. finishWorkout, getWorkoutSummary, listWorkouts,
// getWorkoutExerciseIds y dataPort entran en TrainingApi en la fase 3, cuando se implementan.
interface TrainingApi {
  startWorkout(date: LocalDate, opts?: { plannedFor?: LocalDate }): Promise<Result<Workout>>; // RF-10, RN-TRN-14
  logSet(setId: ID, input: { weightKg?: number | null; reps?: number | null; rir?: number | null }): Promise<Result<SetLog>>; // RF-11, RF-13
  toggleSetDone(setId: ID): Promise<Result<SetLog>>;
  addExtraSet(workoutId: ID, exerciseId: ID): Promise<Result<SetLog>>;                    // RF-16
  removeSet(setId: ID): Promise<Result<void>>;                                            // RF-16, RN-TRN-10
  chooseExercise(workoutId: ID, fromExerciseId: ID, toExerciseId: ID): Promise<Result<Workout>>; // RN-TRN-13
  discardWorkout(workoutId: ID): Promise<Result<void>>;                                   // RN-TRN-15
  getActiveWorkout(): Promise<Workout | undefined>;                                       // RF-19
  getWorkout(id: ID): Promise<Workout | undefined>;
  getWorkoutView(id: ID): Promise<WorkoutView | undefined>;
  getExerciseHistory(exerciseId: ID, opts?: { limit?: number; before?: LocalDate }): Promise<ExerciseSession[]>;
}

// Fase 3
//   finishWorkout(workoutId: ID, input: { notes?: string }): Promise<Result<Workout>>;  // RF-20, RF-23
//   getWorkoutSummary(id: ID): Promise<WorkoutSummary | undefined>;                     // RF-20
//   listWorkouts(range?: { from?: LocalDate; to?: LocalDate }): Promise<Workout[]>;     // RF-32
//   getWorkoutExerciseIds(workoutId: ID): Promise<ID[]>;
//   dataPort: DataPort;
interface WorkoutSummary { durationMin: number; setsDone: number; setsPlanned: number; exercises: number }

// Hooks (ui, useLiveQuery). Reciben la API, como los de plan. null = no existe; undefined = cargando.
export function useWorkoutView(training: TrainingApi, id: ID): WorkoutView | null | undefined;
export function useActiveWorkout(training: TrainingApi): Workout | null | undefined;
export function useLastSession(training: TrainingApi, exerciseId: ID, before: LocalDate): ExerciseSession | null | undefined; // "anterior" de RF-12

// Componentes. Los textos de error llegan con describeError desde app (ADR-0010); el contexto
// dice la métrica del ejercicio y si la asistencia está activa, para elegir el texto del rango.
interface SetErrorContext { metric: 'weight' | 'reps' | 'time'; assisted: boolean }
function SetTable(props: {
  training: TrainingApi; view: WorkoutView; exerciseId: ID;
  describeError: (error: TrainingError, context: SetErrorContext) => string;
}): JSX.Element;
function SessionHeader(props: { view: WorkoutView; index: number; onNavigate: (index: number) => void }): JSX.Element;
export { SetRow, SetTable, SessionHeader } from './ui';   // RestTimer en la fase 4
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

Los implementan `progression` y `health`; los pasa `app/compose.ts` en `createTraining`. Hasta la fase 4, `compose` pasa un `SuggestionProvider` nulo (siempre `null`); después, uno que delega en `progression`, asignada tras crear `training`, para no crear un ciclo (spec 002 plan §6.2). `PainGate` llega con `finishWorkout` (fase 3).

## 5. Eventos

| Evento | Payload | Cuándo |
|---|---|---|
| `training/WorkoutStarted` | `{ workoutId, date }` | Tras crear el workout |
| `training/SetLogged` | `{ workoutId, setId, exerciseId, done }` | Tras guardar una serie |
| `training/WorkoutCompleted` | `{ workoutId, date, exerciseIds }` | Tras cerrar |
| `training/WorkoutDiscarded` | `{ workoutId }` | Tras descartar |

No escucha eventos. Los eventos se publican desde que un módulo los escuche (`WorkoutCompleted`, `progression`, fase 4); hasta entonces son diseño (spec 002, P-7).

## 6. Reglas de negocio

| ID | Regla | Origen |
|---|---|---|
| RN-TRN-01 | Solo puede haber un workout `in_progress`. `startWorkout` con uno activo devuelve `training/workout-already-active` y su id. Se comprueba en la misma transacción que crea el workout. Si aun así hubiera más de uno (dato roto), `getActiveWorkout` devuelve el de `startedAt` más reciente en lugar de lanzar, para que se puedan descartar uno por uno (P-2). | RF-19, decisión 9 |
| RN-TRN-02 | `startWorkout` crea `items` desde `plan.getTodayPlan(plannedFor)` y `plannedSets` series por ejercicio, con `weightKg` = prellenado de `SuggestionProvider` (o `null`), `reps` y `rir` en `null`, `done: false` e `isExtra: false`. El prellenado es defensivo: en `metric` `reps` o `time` el peso empieza en `null`, y una sugerencia que no cumple RN-TRN-04 se ignora (`null`), sin error, porque un fallo del proveedor nunca impide entrenar. IDs: primero el del workout y luego los de las series, en el orden de los ítems y de `setNumber`. | RF-10, RF-12, spec 002, decisión 7 |
| RN-TRN-03 | Cada cambio de una serie se persiste en una sola escritura antes de devolver (sin guardado global). | RF-13 |
| RN-TRN-04 | Para marcar `done`: `reps` no nulo; `weightKg` no nulo si `metric = 'weight'` (0 = peso corporal sin lastre). Con `metric: 'reps'` o `'time'`, `weightKg` es siempre `null`. Rangos: `0 ≤ reps ≤ 100` (`0 ≤ reps ≤ 600` segundos si `metric = 'time'`), `0 ≤ rir ≤ 10`, `0 ≤ weightKg ≤ 500`, salvo asistencia: en ejercicios `equipment: 'bodyweight'` con `metric: 'weight'` (Dominadas, Fondos), `−100 ≤ weightKg ≤ 500`, y un valor negativo es la ayuda de la máquina o la banda. `weightKg` múltiplo de 0.25; `reps` y `rir`, enteros. Valores no finitos se rechazan y `-0` se guarda como 0. `rir` puede quedar `null` al marcar. Al registrar (`logSet`), un campo omitido no cambia y `null` lo borra; se revisan los rangos de los valores no nulos y, si la serie ya está hecha, también lo obligatorio, para que una serie `done` siempre sea válida. Un fallo es `training/invalid-set-values` con `details: { field, reason }` del primer campo en el orden kg → reps → RIR, y no cambia lo guardado: `missing` (falta para marcar), `not-a-number`, `out-of-range` (fuera de los límites), `step` (peso no múltiplo de 0.25, o reps o RIR no enteros) y `not-allowed` (peso en `reps` o `time`, o negativo sin asistencia). | RF-11, spec 002, decisión 6 |
| RN-TRN-05 | Al marcar `done` se fija `completedAt = clock.now()`; al desmarcar se borra y los valores se conservan. | RF-11 |
| RN-TRN-06 | `finishWorkout` exige `painGate.hasPainEntry(workoutId)`; si no, `training/pain-required`. | RF-21 |
| RN-TRN-07 | `completed` y `discarded` son estados finales en v1: ninguna operación cambia sus series ni sus `notes`, y todas devuelven `training/workout-closed`. Un workout `discarded` no se recupera. Mientras está `in_progress` todo se puede editar, también las series ya hechas. | P-7, decisión 1 |
| RN-TRN-08 | `getExerciseHistory` devuelve solo workouts `completed` y series `done`, del más reciente al más antiguo (por `date` y, si coinciden, por `startedAt`). `before` es exclusivo (`date < before`); sin `limit`, todas. Las series van por `setNumber` y `repRange` sale del ítem de ese ejercicio en ese workout. Un workout sin series hechas del ejercicio no aparece. | RF-12, RF-31, decisión 9 |
| RN-TRN-09 | `date` del workout es el día local en que empezó, aunque termine después de medianoche. | ADR-0009 |
| RN-TRN-10 | `removeSet` solo aplica a series no hechas y nunca deja un ejercicio sin series; renumera `setNumber`. Si no aplica, `training/set-not-removable`. `addExtraSet` añade la serie `n + 1` con `isExtra: true` mientras `n < maxSets` (cuenta todas las series del ejercicio); si no, `training/max-sets-reached`. La serie nueva copia el `weightKg` de la última serie del ejercicio, con `reps` y `rir` en `null`. Renumerar conserva `isExtra`. | RF-16, RN-PLN-05, decisión 8 |
| RN-TRN-11 | Al marcar una serie como hecha, la serie `setNumber + 1` del mismo ejercicio, si no está hecha y su `weightKg` es `null`, recibe ese `weightKg`, en la misma transacción. Reps y RIR no se copian. | P-6, decisión 2 |
| RN-TRN-12 | Un `exerciseId` aparece en un solo ítem de un workout. Lo garantiza RN-PLN-15 (i); `startWorkout` lo comprueba y lanza si no se cumple (dato inconsistente, como RN-PLN-16). | Decisión 3 |
| RN-TRN-13 | `chooseExercise(workoutId, fromExerciseId, toExerciseId)`: `toExerciseId` debe estar en `options` del ítem (si no, `training/invalid-exercise-choice`) y ninguna serie del ítem puede estar hecha (si no, `training/item-has-done-sets`). En una transacción cambia `exerciseId` del ítem y de sus series, reinicia `weightKg` al prellenado del ejercicio nuevo (defensivo, como RN-TRN-02) y `reps` y `rir` a `null`. Con `from == to` no cambia nada y devuelve ok. | RN-PLN-11, decisiones 3 y 8 |
| RN-TRN-14 | `startWorkout(date, { plannedFor })`: `plannedFor` (por defecto `date`) está en la misma semana ISO que `date` (`startOfIsoWeek` iguales; si no, `training/planned-date-out-of-week`) y su plan es `workout` (si no, `training/no-plan-today`). Orden: semana, plan del día y, dentro de la transacción, RN-TRN-01. La semana la comprueba el dominio; el plan del día, `application`. | Decisiones 4 y 7 |
| RN-TRN-16 | Si el `SuggestionProvider` rechaza, la sugerencia es `null` y el fallo se registra con `console.error`, al iniciar y al elegir una alternativa: un fallo del proveedor nunca impide entrenar. Al iniciar, las sugerencias se piden en paralelo. | Decisiones 7 y 9 |
| RN-TRN-17 | `getWorkoutView`: series por el `order` de su ítem y luego por `setNumber`; `exercises` con todas las `options` de todos los ítems. Si `plan` no devuelve alguno, lanza (dato inconsistente; la página muestra el error genérico). Un workout inexistente → `undefined`. | Spec 002 §7, decisión 9 |
| RN-TRN-18 | Un fallo del almacenamiento (la base lanza) es un error inesperado: la promesa rechaza, no se devuelve un `Result`, y lo muestra el aviso genérico (ADR-0010). Convertir `QuotaExceededError` en `data/storage-full` llega con el módulo `data` (fase 3). | ADR-0010, RN-PLN-21 |
| RN-TRN-19 | Hooks (`useWorkoutView`, `useActiveWorkout`, `useLastSession`, con `useLiveQuery`): devuelven `undefined` mientras cargan y mientras el resultado pertenece a otra clave (otro `id`, o otro ejercicio o fecha), y `null` si no existe; se actualizan solos al cambiar las tablas que leen (también las de `plan` en `useWorkoutView`); un error de la consulta se lanza en el render y lo captura el *error boundary* de la ruta. `useLastSession` es `getExerciseHistory(exerciseId, { before, limit: 1 })[0]`. | RN-PLN-26, spec 002 plan §6.4 |
| RN-TRN-15 | `discardWorkout` pasa un workout `in_progress` a `discarded` y conserva sus series; no se borra nada ni se fija `finishedAt` (es del cierre). Los workouts `discarded` no aparecen en el historial (RN-TRN-08) ni cuentan para RN-TRN-01. | P-2, decisión 2 |

## 7. Errores

`training/workout-not-found`, `training/workout-already-active`, `training/workout-closed`, `training/set-not-found`, `training/invalid-set-values`, `training/pain-required`, `training/no-plan-today`, `training/planned-date-out-of-week`, `training/max-sets-reached`, `training/set-not-removable`, `training/invalid-exercise-choice`, `training/item-has-done-sets`.

## 8. Pruebas de contrato

- Iniciar → registrar 3 series → recargar (nueva instancia con la misma base) → `getActiveWorkout` devuelve el workout y las 3 series (QS-03).
- RN-TRN-01: segundo `startWorkout` falla con el id del activo; dos llamadas concurrentes → un solo workout.
- RN-TRN-02: semana 1, Full body A → 7 ítems en orden, Prensa con 2 series vacías; con `SuggestionProvider` falso, el peso prellenado es el sugerido.
- RN-TRN-04: cada límite de rango, peso no múltiplo de 0.25, no finito, negativo fuera de Dominadas y Fondos, y `weightKg` no nulo con `metric: 'reps'` → `training/invalid-set-values`; 0 kg y −20 kg en Dominadas se aceptan.
- RN-TRN-06: `finishWorkout` sin dolor falla; con `PainGate` falso en memoria que devuelve `true` funciona y publica `WorkoutCompleted`.
- RN-TRN-07: tras descartar, cada operación de escritura → `training/workout-closed`.
- RN-TRN-08: series no hechas y workouts descartados no aparecen en el historial.
- RN-TRN-10: quitar una serie hecha o la única → `training/set-not-removable`; renumeración; extra hasta `maxSets`.
- RN-TRN-11: la siguiente vacía hereda el peso; con peso o hecha no cambia; la última serie no afecta a nadie.
- RN-TRN-12: un plan con el mismo ejercicio en dos ítems → `startWorkout` lanza.
- RN-TRN-13: cambio válido, ida y vuelta; fuera de `options`; con una serie hecha.
- RN-TRN-14: otro día de la semana (pasado y futuro), otra semana y un día de cardio.
- P-1: iniciar cada plantilla del seed y elegir cada alternativa → ningún ejercicio `high`.

## 9. Trazabilidad

RF-10 a RF-17, RF-19, RF-20, RF-23, RF-32.

## 10. Decisiones (17-nov-2026)

1. **Workouts cerrados inmutables (pregunta 6, contrato v1.1):** sin excepción para las notas, que no tienen operación de edición ni pantalla hasta Historial (v1.0). Riesgo aceptado: un error de dedo en una serie cerrada queda en la gráfica (RF-31) y la exportación; la progresión se corrige sola en la siguiente sesión porque usa la más reciente. Corregir workouts cerrados llega en v1.1 con su propia spec y un evento para que `progression` recalcule (RN-TRN-07).
2. **Spec 002, fase 2 (contrato v1.2):** la sesión solo se descarta en esta fase (RN-TRN-15) y `finishWorkout` llega en la fase 3; `SuggestionProvider` nulo y herencia del peso (RN-TRN-11); sin `bus` hasta que alguien escuche; métricas `reps` y `time`, y asistencia con peso negativo (RN-TRN-04); extras hasta `maxSets` (RN-TRN-10).
3. **Alternativas (spec 002, decisión 4):** `WorkoutItem.options`, un ejercicio por workout (RN-TRN-12) y cambio solo sin series hechas (RN-TRN-13).
4. **Otra sesión de esta semana (spec 002, decisión 5):** `Workout.plannedFor` y RN-TRN-14.
5. **Plan de la spec 002 (contrato v1.3):** sin `configureTraining` (puertos en `createTraining`), `trainingStores`, `TrainingErrorCode` con `details` tipados, `WorkoutView` y `getWorkoutView`, hooks con la API como parámetro (`useWorkoutView` reemplaza a `useWorkout`) y `describeError` en los componentes. Las operaciones de la fase 3 salen de `TrainingApi` hasta implementarse.
6. **Valores de una serie, antes de T4 (contrato v1.4):** `parseNumber` acepta espacios, signo, dígitos y un separador decimal (`,` o `.`); `""` → `null` y cualquier otro texto → `NaN`. `reps` y `rir` enteros; `logSet` parcial; una serie hecha siempre es válida; motivos y orden de los errores en RN-TRN-04. Funciones del dominio: `parseNumber(text)` (`".5"` → 0.5) y `checkSetValues(values, exercise, { forDone })`, que devuelve los valores normalizados.
7. **Creación del workout, antes de T6 (contrato v1.5):** orden de las comprobaciones de `startWorkout` (RN-TRN-14), orden de los IDs y prellenado defensivo (RN-TRN-02). Funciones del dominio: `checkPlannedFor(date, plannedFor)` y `createWorkout({ session, date, plannedFor, now, ids, exercises, prefill })`, que lanza si falta un ejercicio en `exercises` o si se repite uno (RN-TRN-12).
8. **Cambios del workout, antes de T8 (contrato v1.6):** la serie extra copia el peso de la última (RN-TRN-10); `chooseExercise` con `from == to` no cambia nada y al cambiar reinicia todos los valores de las series (RN-TRN-13); descartar no fija `finishedAt` (RN-TRN-15). RN-TRN-07 se comprueba antes que cualquier otro error, y RN-TRN-11 solo actúa al marcar. Un `exerciseId` que no es de ningún ítem (`addExtraSet`, `from` de `chooseExercise`) es un bug y lanza, como RN-PLN-16. Funciones del dominio: reciben `{ workout, sets }` y devuelven `Result<{ changes, value }>` con `changes = { workout?, put, remove }`.
9. **Servicio, antes de T10 (contrato v1.7):** un proveedor que falla cuenta como `null` (RN-TRN-16); orden y contenido de `getWorkoutView` (RN-TRN-17) y de `getExerciseHistory` (RN-TRN-08); varios `in_progress` → el más reciente (RN-TRN-01); un workout o una serie inexistentes → `training/workout-not-found` o `training/set-not-found`. `maxSets` sale de `template.items` emparejando por `order`. `logSet` y `toggleSetDone` leen el workout para pedir a `plan` todas sus `options` y aplican el cambio en `mutate`, que vuelve a leer.
10. **Almacenamiento, antes de T12 (contrato v1.8):** un fallo de la base rechaza la promesa (RN-TRN-18), como en `plan`.
11. **Hooks, antes de T14 (contrato v1.9):** RN-TRN-19, el mismo patrón que RN-PLN-26 con `null` para "no existe".
12. **Textos de error, T15 (contrato v1.10):** `describeError` recibe `SetErrorContext` (métrica y asistencia) para que `app` elija el texto de `invalid-set-values`; los textos viven en `app/errors/messages.ts` (ADR-0010).
