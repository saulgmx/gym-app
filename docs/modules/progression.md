# Contrato del módulo `progression`

**Versión del contrato:** 1.0 · **Depende de:** `training`, `plan`, `health` (API), `shared` · **Lo usan:** `app`, `training` (vía puerto `SuggestionProvider`)

## 1. Responsabilidad

Calcula qué cargar la próxima vez en cada ejercicio, cuándo sugerir deload y el volumen semanal por músculo. Todo lo que guarda es **derivado** y reconstruible.

**Pruebas primero** (P-5): cada regla RN-PRG se implementa después de su prueba.

## 2. Datos propios

| Tabla | Clave e índices | Contenido |
|---|---|---|
| `suggestions` | `exerciseId` | Última sugerencia por ejercicio (caché derivada) |
| `progressionSettings` | `id` (`'singleton'`) | Incrementos por equipo, deload manual |

```ts
interface ProgressionSettings {
  id: 'singleton';
  incrementsKg: Record<Equipment, number>;   // por defecto barbell 2.5, dumbbell 2, machine 5, cable 2.5 [PROPUESTO], bodyweight 1.25
  manualDeloadFrom?: LocalDate;              // RF-36 "el usuario lo marca"
}
```

## 3. Modelo de dominio

```ts
type SuggestionKind =
  | 'first_time'     // sin historial
  | 'increase' | 'hold' | 'decrease'
  | 'add_rep'        // métrica reps: +1 rep por serie
  | 'add_load'       // métrica reps: tope alcanzado → lastre
  | 'deload'
  | 'blocked';       // bandera roja o dolor en alerta

interface Suggestion {
  exerciseId: ID;
  kind: SuggestionKind;
  targetWeightKg: number | null;
  targetReps: [number, number] | null;
  targetRir: [number, number] | null;
  message: string;                  // en español, listo para mostrar
  reason: { basedOnWorkoutId: ID | null; ruleId: string };   // p. ej. 'RN-PRG-01'
  computedAt: Instant;
}

interface DeloadStatus {
  recommended: boolean;
  reasons: ('scheduled' | 'stalled_3_weeks' | 'pain_2_sessions' | 'manual')[];
}

interface WeeklyVolume { weekStart: LocalDate; byMuscle: Record<MuscleGroup, number> }  // series efectivas
```

El núcleo es una función pura:

```ts
// domain/suggest.ts
function suggest(input: {
  exercise: Exercise;
  repRange: [number, number];
  history: ExerciseSession[];       // más reciente primero
  pain: { lastLevelInSessionWithExercise: number | null; threshold: number; redFlagActive: boolean; alertLevel: boolean };
  incrementKg: number;
  deload: boolean;
  now: Instant;
}): Suggestion;
```

## 4. API pública (`index.ts`)

```ts
export function createProgression(deps: {
  db: ProgressionDb; clock: Clock; bus: EventBus;
  training: Pick<TrainingApi, 'getExerciseHistory' | 'getWorkoutExerciseIds' | 'listWorkouts'>;
  plan: Pick<PlanApi, 'getPosition' | 'getExercises' | 'getTodayPlan'>;
  health: Pick<HealthApi, 'getPainSummary' | 'getPainForWorkouts'>;
}): ProgressionApi;

interface ProgressionApi {
  getSuggestion(exerciseId: ID): Promise<Suggestion | null>;
  getSuggestions(exerciseIds: ID[]): Promise<Map<ID, Suggestion>>;
  getDeloadStatus(date: LocalDate): Promise<DeloadStatus>;
  getWeeklyVolume(weekStart: LocalDate): Promise<WeeklyVolume>;      // v1.1
  setManualDeload(from: LocalDate | null): Promise<Result<void>>;
  getSettings(): Promise<ProgressionSettings>;
  updateSettings(patch: Partial<Omit<ProgressionSettings, 'id'>>): Promise<Result<void>>;
  rebuild(): Promise<void>;                                          // recalcula todo desde training/health
  suggestionProvider: SuggestionProvider;                            // implementa el puerto de training
  dataPort: DataPort;                                                // solo progressionSettings
  subscribe(): void;                                                 // registra handlers en el bus
}

export function useSuggestion(exerciseId: ID): Suggestion | null | undefined;
export function useDeloadStatus(date: LocalDate): DeloadStatus | undefined;
export { SuggestionBanner, NextSessionList } from './ui';
```

## 5. Eventos

Escucha:

| Evento | Acción |
|---|---|
| `training/WorkoutCompleted` | Recalcula las sugerencias de `exerciseIds` |
| `training/WorkoutDiscarded` | Nada en v1 (las sugerencias se basan en sesiones completadas) |
| `health/PainRecorded` | Recalcula las sugerencias de los ejercicios de ese workout |
| `plan/PlanChanged` | Recalcula las sugerencias de las plantillas afectadas |
| `training/SetLogged` | v1.1: invalida el volumen semanal |

No publica eventos en v1. Todos los handlers son idempotentes (recalculan desde el estado).

## 6. Reglas de negocio

Precedencia: se evalúan en este orden y gana la primera que aplica.

| ID | Regla | Origen |
|---|---|---|
| RN-PRG-00 | **Nunca** se produce una sugerencia para un ejercicio `lumbarRisk: 'high'`; `suggest` devuelve `blocked` con mensaje de ejercicio no permitido. | P-1, QS-01 |
| RN-PRG-01 | Bandera roja activa o último dolor en nivel de alerta (7-10) → `blocked`: "No subas carga. Consulta a tu traumatólogo o fisioterapeuta antes de seguir con este ejercicio." | spec §6.2 |
| RN-PRG-02 | Deload activo (ver RN-PRG-20) → `deload`: mismo peso de la última sesión, 50% de series, RIR 4. | spec §6.3 |
| RN-PRG-03 | Sin historial → `first_time`, sin peso, RIR 3-4: "Primera vez: elige un peso que te deje 3-4 repeticiones en reserva." | spec §6.1.4 |
| RN-PRG-04 | El dolor superó el umbral en la última sesión que incluyó el ejercicio → `decrease` 10%. | spec §6.1.3 |
| RN-PRG-05 | `reps < min` en las 2 últimas sesiones con el mismo peso → `decrease` 5%. | spec §6.1.3 |
| RN-PRG-06 | Última sesión: todas las series planificadas hechas con `reps ≥ max` y `RIR ≥ 1` → `increase`. | spec §6.1.1 |
| RN-PRG-07 | En otro caso → `hold`: "Mantén X kg hasta llegar a N × M". | spec §6.1.2 |
| RN-PRG-10 | Incremento: `nuevo = max(w + paso, redondear(w × 1.025, paso))`, con `paso = incrementsKg[equipment]`. | spec §6.1.1 |
| RN-PRG-11 | Bajada: `nuevo = min(w − paso, redondearAbajo(w × (1 − p), paso))`, nunca < 0. | [PROPUESTO] |
| RN-PRG-12 | Métrica `reps` (dominadas, fondos): si no se llegó al tope → `add_rep` (+1 rep por serie); si se llegó en todas → `add_load` de `paso` (1.25-2.5 kg) y vuelta al mínimo del rango. | spec §6.1.5, plan.md |
| RN-PRG-13 | El mensaje usa el formato de la spec: "Sube a X kg. La última vez hiciste N × M con Y kg, el tope del rango." | spec §6.1.1 |
| RN-PRG-20 | Deload recomendado si: semana de deload del plan, **o** 3 semanas seguidas sin progreso en ningún ejercicio `isPrimary`, **o** dolor > umbral en 2 sesiones seguidas, **o** deload manual. | spec §6.3 |
| RN-PRG-21 | "Progreso" en una semana = la mejor serie de un ejercicio `isPrimary` supera a la de la semana anterior en peso, o en reps con el mismo peso. [PROPUESTO] | spec §6.3 |
| RN-PRG-30 | Serie efectiva para volumen: serie `done` con `RIR ≤ 4`; cuenta 1 para el músculo principal y 0.5 para cada secundario. [PROPUESTO] | RF-35 (v1.1) |

## 7. Pruebas de dominio (escribir antes del código)

- RN-PRG-06/10: 3 × 10 con 60 kg, rango 6-10, RIR 1, barra → `increase` a 62.5 kg (60 × 1.025 = 61.5 → redondea a 62.5).
- RN-PRG-10: 20 kg mancuerna → 22 kg (nunca menos de un paso).
- RN-PRG-07: 10, 10, 8 → `hold`.
- RN-PRG-06: 3 × 10 con RIR 0 → `hold` (no se cumple RIR ≥ 1).
- RN-PRG-05: 5 reps (min 6) en 2 sesiones con 60 kg → `decrease` a 57 kg o el paso inferior.
- RN-PRG-04: dolor 5 con umbral 3 en la sesión que incluyó el ejercicio → `decrease`.
- RN-PRG-01: bandera roja → `blocked` aunque se haya llegado al tope.
- RN-PRG-12: dominadas 3 × 10, rango 6-10 → `add_load`.
- RN-PRG-00: propiedad: para todo ejercicio `high` del catálogo de prueba, `kind === 'blocked'`.
- RN-PRG-20: cada condición por separado y ninguna.
- `rebuild()` produce las mismas sugerencias que el cálculo incremental.

## 8. Trazabilidad

RF-12 (vía puerto), RF-24, RF-30, RF-35, RF-36, RF-50, spec §6.1, §6.3.

## 9. Preguntas abiertas

1. Porcentajes de bajada: propuesta 5% por bajo rendimiento y 10% por dolor (la spec dice 5-10%).
2. Ejercicios `isPrimary`: propuesta: press de banca, press inclinado, dominadas, remo con apoyo de pecho, prensa, hack squat.
3. Ejercicios por tiempo (plancha): ¿sin sugerencia numérica, o +5 s por serie hasta el tope?
4. Asistencia (spec 002, decisión 7): en Dominadas y Fondos un `weightKg` negativo es ayuda de la máquina o la banda (RN-TRN-04). La progresión debe tratar "subir" como menos asistencia (−20 → −17.5 → … → 0 → lastre) y no aplicar el +2.5% a un valor negativo. Resolver antes de la fase 4.
