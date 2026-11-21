# Contrato del módulo `progression`

**Depende de:** `training`, `plan`, `health` (API), `shared` · **Lo usan:** `app`, `training` (vía puerto `SuggestionProvider`)

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
  incrementsKg: Record<Equipment, number>;   // por defecto barbell 2.5, dumbbell 2, machine 5, cable 2.5 [PROPUESTO], bodyweight 2.5 (lastre)
  assistanceStepKg: number;                  // por defecto 5: paso de la asistencia en Dominadas y Fondos (RN-PRG-14)
  manualDeloadFrom?: LocalDate;              // RF-36 "el usuario lo marca"
}
```

Hasta que Ajustes los haga configurables (RF-50, spec 014), los valores por defecto son constantes del dominio (P-7), como el umbral de dolor en `health`.

## 3. Modelo de dominio

```ts
type SuggestionKind =
  | 'first_time'     // sin historial
  | 'increase' | 'hold' | 'decrease'
  | 'add_rep'        // métrica reps o time: +1 rep o +5 s por serie (RN-PRG-12)
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
| RN-PRG-04 | El dolor superó el umbral en la última sesión que incluyó el ejercicio → `decrease` 10% (bajada por dolor de RN-PRG-11; en asistencia o lastre, 2 escalones, RN-PRG-14; en `reps` o `time`, RN-PRG-12). | spec §6.1.3 |
| RN-PRG-05 | `reps < min` en las 2 últimas sesiones con el mismo peso → `decrease` 5% (bajada por rendimiento de RN-PRG-11; en asistencia o lastre, 1 escalón, RN-PRG-14; en `reps` o `time`, RN-PRG-12). | spec §6.1.3 |
| RN-PRG-06 | Última sesión: todas las series planificadas hechas con `reps ≥ max` y `RIR ≥ 1` → `increase`. | spec §6.1.1 |
| RN-PRG-07 | En otro caso → `hold`: "Mantén X kg hasta llegar a N × M". | spec §6.1.2 |
| RN-PRG-10 | Incremento: `nuevo = max(w + paso, redondear(w × 1.025, paso))`, con `paso = incrementsKg[equipment]`. | spec §6.1.1 |
| RN-PRG-11 | Bajada, siempre al menos un paso y nunca < 0: por rendimiento (RN-PRG-05, 5%) `nuevo = min(w − paso, redondear(w × 0.95, paso))`, al múltiplo más cercano, simétrico con RN-PRG-10; por dolor (RN-PRG-04, 10%) `nuevo = min(w − paso, redondearAbajo(w × 0.90, paso))`, hacia abajo, porque con dolor la duda se resuelve con menos carga (P-1). Ejemplos: barra 60 kg → 57.5 (rendimiento) y 52.5 (dolor); máquina 40 kg → 35 en los dos. No aplica a asistencia ni lastre (RN-PRG-14). | spec §6.1.3, pregunta 1 |
| RN-PRG-12 | Ejercicios sin peso, métrica `reps` (Dead bug) o `time` (Plancha, Pallof isométrico; los segundos van en `reps`): por debajo del tope → `add_rep`, +1 rep o +5 s por serie sin pasar del tope; en el tope en todas las series → `hold` en el tope (no hay lastre: estas métricas no guardan peso, RN-TRN-04). Bajada: por dolor (RN-PRG-04) → `decrease` al mínimo del rango; por rendimiento (RN-PRG-05) → `hold` en el mínimo. `targetWeightKg` siempre `null`. | spec §6.1.5, preguntas 3 y 4 |
| RN-PRG-14 | Asistencia y lastre (`equipment: 'bodyweight'` con `metric: 'weight'`: Dominadas, Fondos; peso negativo = asistencia, RN-TRN-04): sin porcentajes. El peso se mueve por una **escalera** de escalones: `assistanceStepKg` (5) por debajo de 0 e `incrementsKg.bodyweight` (2.5) desde 0 hacia arriba (… −10, −5, 0, 2.5, 5 …). Subir (RN-PRG-06) = 1 escalón arriba; bajar por rendimiento (RN-PRG-05) = 1 escalón abajo; por dolor (RN-PRG-04) = 2 escalones abajo. Un peso fuera de la escalera (bandas, −7.5) sube al escalón superior más cercano y baja al inferior. Cruza el 0 sin casos especiales. El mensaje dice la zona: bajar la asistencia, hacerlo sin asistencia, añadir lastre (texto en la spec 010). | spec §6.1.5, plan.md, pregunta 4 |
| RN-PRG-13 | El mensaje usa el formato de la spec: "Sube a X kg. La última vez hiciste N × M con Y kg, el tope del rango." | spec §6.1.1 |
| RN-PRG-20 | Deload recomendado si: semana de deload del plan, **o** 3 semanas seguidas sin progreso en ningún ejercicio `isPrimary`, **o** dolor > umbral en 2 sesiones seguidas, **o** deload manual. | spec §6.3 |
| RN-PRG-21 | "Progreso" en una semana = la mejor serie de un ejercicio `isPrimary` supera a la de la semana anterior en peso, o en reps con el mismo peso. Un ejercicio que no se hizo en alguna de las dos semanas no cuenta ni como progreso ni como estancamiento (alternar dominadas y jalón no dispara el deload). | spec §6.3, pregunta 2 |
| RN-PRG-30 | Serie efectiva para volumen: serie `done` con `RIR ≤ 4`; cuenta 1 para el músculo principal y 0.5 para cada secundario. [PROPUESTO] | RF-35 (v1.1) |

## 7. Pruebas de dominio (escribir antes del código)

- RN-PRG-06/10: 3 × 10 con 60 kg, rango 6-10, RIR 1, barra → `increase` a 62.5 kg (60 × 1.025 = 61.5 → redondea a 62.5).
- RN-PRG-10: 20 kg mancuerna → 22 kg (nunca menos de un paso).
- RN-PRG-07: 10, 10, 8 → `hold`.
- RN-PRG-06: 3 × 10 con RIR 0 → `hold` (no se cumple RIR ≥ 1).
- RN-PRG-05/11: 5 reps (min 6) en 2 sesiones con 60 kg de barra → `decrease` a 57.5 kg (60 × 0.95 = 57 → redondea a 57.5).
- RN-PRG-04/11: dolor 5 con umbral 3 en la sesión que incluyó el ejercicio, 60 kg de barra → `decrease` a 52.5 kg (60 × 0.9 = 54 → hacia abajo, 52.5).
- RN-PRG-11: máquina 40 kg → 35 kg por rendimiento y por dolor (al menos un paso); 2.5 kg de barra → nunca < 0.
- RN-PRG-01: bandera roja → `blocked` aunque se haya llegado al tope.
- RN-PRG-14: dominadas 3 × 10, rango 6-10, con −10 kg → `increase` a −5; con −5 → 0; con 0 → 2.5. Con 0 y 5 reps en 2 sesiones → −5; con 2.5 y dolor → −5 (2 escalones). Con −7.5 → sube a −5 y baja a −10.
- RN-PRG-12: plancha 2 × 40 s, rango 30-45 → `add_rep` a 45 s (sin pasar del tope); 2 × 45 s → `hold` en 45; dead bug con dolor sobre el umbral → `decrease` al mínimo. `targetWeightKg` siempre `null`.
- RN-PRG-21: un `isPrimary` hecho solo en una de las dos semanas no cuenta como progreso ni como estancamiento.
- RN-PRG-00: propiedad: para todo ejercicio `high` del catálogo de prueba, `kind === 'blocked'`.
- RN-PRG-20: cada condición por separado y ninguna.
- `rebuild()` produce las mismas sugerencias que el cálculo incremental.

## 8. Trazabilidad

RF-12 (vía puerto), RF-24, RF-30, RF-35, RF-36, RF-50, spec §6.1, §6.3. Specs de la fase 4: 010 (progresión), 011 (deload) y 014 (ajustes).

## 9. Decisiones

Cerradas el 20-nov-2026, al empezar la fase 4 (contrato v1.1):

1. **Porcentajes de bajada:** 5% por bajo rendimiento, redondeado al más cercano; 10% por dolor, redondeado hacia abajo; siempre al menos un paso (RN-PRG-11).
2. **Ejercicios `isPrimary`:** los 9 que ya marca el seed desde la spec 001: prensa de piernas, hack squat, press de banca con barra y con mancuernas, press inclinado con mancuernas y en máquina, dominadas, jalón al pecho y remo con apoyo de pecho (la propuesta más sus alternativas, porque la serie registra el ejercicio usado). El press de hombro no entra. "Progreso" según RN-PRG-21, que deja de ser propuesta.
3. **Ejercicios por tiempo y por reps:** +5 s o +1 rep por serie hasta el tope y mantener en el tope (RN-PRG-12). Se quita `add_load`: esas métricas no guardan peso.
4. **Asistencia y lastre:** escalera de pasos fijos, 5 kg de asistencia y 2.5 kg de lastre (RN-PRG-14, `assistanceStepKg`, `incrementsKg.bodyweight` de 1.25 a 2.5). RN-PRG-12 decía que Dominadas y Fondos son `metric: 'reps'`, pero el seed los tiene en `weight` con asistencia negativa desde la spec 002.
5. **Fin de la numeración (21-nov-2026):** el contrato deja de llevar número de versión (último: v1.1); el historial es git (`docs/README.md`, "Versiones y registro de cambios"; retro X-1).

Preguntas abiertas: ninguna.
