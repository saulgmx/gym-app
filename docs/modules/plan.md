# Contrato del módulo `plan`

**Versión del contrato:** 1.0 · **Depende de:** `shared` · **Lo usan:** `training`, `progression`, `app`

## 1. Responsabilidad

Catálogo de ejercicios, programa por bloques, plantillas de sesión y calendario: responde "¿qué toca hoy?" y "¿en qué semana y bloque estoy?". No sabe nada de lo que se entrenó.

## 2. Datos propios

| Tabla | Clave e índices | Contenido |
|---|---|---|
| `exercises` | `id, name, muscleGroup, lumbarRisk` | Catálogo |
| `programs` | `id` | Programa (un solo programa activo en v1) |
| `blocks` | `id, programId` | Bloques con semanas, RIR y factores de volumen |
| `templates` | `id, blockId` | Plantillas de sesión con sus ejercicios (el día sale de `Block.schedule`) |

## 3. Modelo de dominio

```ts
type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'core';
type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight';
type LumbarRisk = 'low' | 'medium' | 'high';

interface Exercise {
  id: ID;
  name: string;
  muscleGroup: MuscleGroup;
  secondaryMuscles?: MuscleGroup[];      // [PROPUESTO] para volumen semanal (v1.1)
  equipment: Equipment;
  metric: 'weight' | 'reps' | 'time';    // 'time' para plancha [PROPUESTO]
  lumbarRisk: LumbarRisk;
  isPrimary: boolean;                    // [PROPUESTO] compuesto principal, usado por la regla de deload
  beltRecommended?: boolean;             // faja en series pesadas (prensa, hack squat)
  cue?: string;
  restSeconds: [number, number];
}

interface Program { id: ID; name: string; startDate: LocalDate; totalWeeks: number; blockIds: ID[] }

interface Block {
  id: ID; programId: ID; name: string;
  startWeek: number; endWeek: number;
  targetRir: [number, number];
  weekFactors: Record<number, number>;   // semana → factor; por defecto 1.0
  isDeload: boolean;
  schedule: ScheduleEntry[];             // [PROPUESTO] ver RN-PLN-03
}

type ScheduleEntry =
  | { weekday: Weekday; kind: 'workout'; templateId: ID; weekParity?: 'odd' | 'even' }
  | { weekday: Weekday; kind: 'cardio'; note: string }
  | { weekday: Weekday; kind: 'rest' };

interface SessionTemplate { id: ID; blockId: ID; name: string; items: TemplateItem[] }

interface TemplateItem {
  exerciseId: ID; order: number;
  sets: [number, number];                // rango de series
  reps: [number, number];                // rango de reps (o segundos si metric = 'time')
  note?: string;
}

// Valores de salida
interface ProgramPosition {
  status: 'not_started' | 'active' | 'finished';
  week: number | null;                   // 1..totalWeeks
  block: Block | null;
  isDeloadWeek: boolean;
  volumeFactor: number;
}

type TodayPlan =
  | { kind: 'workout'; position: ProgramPosition; template: SessionTemplate; plannedItems: PlannedItem[] }
  | { kind: 'cardio' | 'rest'; position: ProgramPosition; note?: string }
  | { kind: 'none'; position: ProgramPosition };   // fuera del programa

interface PlannedItem {
  exercise: Exercise; order: number;
  plannedSets: number;                   // tras aplicar el factor de volumen
  repRange: [number, number];
  targetRir: [number, number];
  note?: string;
}
```

## 4. API pública (`index.ts`)

```ts
export function createPlan(deps: { db: PlanDb; clock: Clock; ids: IdGenerator; bus: EventBus }): PlanApi;

interface PlanApi {
  ensureSeeded(seed: unknown): Promise<Result<void>>;                // valida con Zod; solo si está vacío
  getPosition(date: LocalDate): Promise<ProgramPosition>;
  getTodayPlan(date: LocalDate): Promise<TodayPlan>;
  getWeekPlan(weekStart: LocalDate): Promise<TodayPlan[]>;            // para WeekStrip
  getExercise(id: ID): Promise<Exercise | undefined>;
  getExercises(ids: ID[]): Promise<Exercise[]>;
  listExercises(filter?: { maxRisk?: LumbarRisk }): Promise<Exercise[]>;
  setStartDate(date: LocalDate): Promise<Result<void>>;              // RF-03
  jumpToWeek(week: number, today: LocalDate): Promise<Result<void>>; // RF-03: recalcula startDate
  updateTemplate(id: ID, items: TemplateItem[]): Promise<Result<void>>; // RF-04 (v1.0)
  dataPort: DataPort;
}

// Hooks reactivos (ui)
export function useTodayPlan(date: LocalDate): TodayPlan | undefined;
export function useWeekPlan(weekStart: LocalDate): TodayPlan[] | undefined;

// Componentes
export { WeekStrip, PlanExerciseList } from './ui';
export type { Exercise, Block, SessionTemplate, TemplateItem, ProgramPosition, TodayPlan, PlannedItem, LumbarRisk, Equipment, MuscleGroup };
```

## 5. Eventos

| Evento | Payload | Cuándo |
|---|---|---|
| `plan/PlanChanged` | `{ reason: 'start_date' \| 'template' \| 'seed'; templateIds?: ID[] }` | Tras confirmar un cambio en programa o plantillas |

No escucha eventos.

## 6. Reglas de negocio

| ID | Regla | Origen |
|---|---|---|
| RN-PLN-01 | `week = floor(días(startDate, date) / 7) + 1`. Si `date < startDate` → `not_started`; si `week > totalWeeks` → `finished`. | RF-02 |
| RN-PLN-02 | El bloque activo es el que cumple `startWeek ≤ week ≤ endWeek`. Siempre hay exactamente uno para cada semana del programa (lo valida el seed). | RF-02, spec §6.4 |
| RN-PLN-03 | La sesión del día sale de `block.schedule` por `weekday`. Si hay entradas con `weekParity`, se elige la que coincide con la paridad de la semana dentro del bloque (alternancia A/B/A – B/A/B del bloque 1). [PROPUESTO] | plan.md bloque 1 |
| RN-PLN-04 | `volumeFactor = block.weekFactors[week] ?? 1.0`; en semana de deload, `0.5`. | spec §6.3, §6.4 |
| RN-PLN-05 | `plannedSets = max(1, round(item.sets[0] × volumeFactor))`. Se planifica el mínimo del rango; el usuario puede añadir series hasta el máximo (RF-16). [PROPUESTO] | RF-05, plan.md |
| RN-PLN-06 | En deload, `targetRir = [4, 4]`. | spec §6.3 |
| RN-PLN-07 | **Ningún ejercicio `lumbarRisk: 'high'` puede estar en una plantilla.** `ensureSeeded` y `updateTemplate` lo rechazan con `plan/high-risk-exercise`. | P-1, spec §6.5 |
| RN-PLN-08 | Un ejercicio `medium` se puede añadir a una plantilla con confirmación explícita en la UI. | spec §6.5 |
| RN-PLN-09 | `jumpToWeek(n)` fija `startDate = lunes de la semana actual − (n − 1) × 7 días`. | RF-03 |
| RN-PLN-10 | La semana empieza en lunes (ISO 8601). | [PROPUESTO] |

## 7. Errores

`plan/invalid-seed`, `plan/high-risk-exercise`, `plan/template-not-found`, `plan/week-out-of-range`.

## 8. Pruebas de contrato

- RN-PLN-01: fecha anterior, primera, última y posterior al programa.
- RN-PLN-03: lunes de la semana 1 → Full body A; lunes de la semana 2 → Full body B.
- RN-PLN-05: semana 1 del bloque 1 (factor 0.7) con `sets: [3, 3]` → 2 series.
- RN-PLN-07: seed con "Peso muerto rumano" en una plantilla → `plan/high-risk-exercise`.
- El seed real (`plan.md`) pasa la validación y cubre las 15 semanas sin huecos.

## 9. Trazabilidad

RF-01, RF-02, RF-03, RF-04, RF-05, RF-17 (`cue`), spec §6.4, §6.5.

## 10. Preguntas abiertas

1. **Ejercicios `high`:** ¿bloqueo total sin opción de anularlo (propuesta actual), o advertencia con confirmación como dice la spec §6.5? La constitución P-1 sugiere bloqueo total.
2. **Ejercicios con alternativa** ("Dominadas o jalón al pecho", "Hack squat o prensa"): ¿un ejercicio con `alternatives: ID[]` o dos ejercicios distintos? Propuesta: `alternatives` y que la serie registre el ejercicio realmente usado (afecta a las sustituciones de v1.1).
3. **Alternancia A/B del bloque 1:** la spec §9.1 solo tiene `weekday` en la plantilla, lo que no permite alternar A/B/A y B/A/B. Propuesta: `Block.schedule` con `weekParity` (RN-PLN-03).
