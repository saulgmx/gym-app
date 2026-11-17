# Contrato del módulo `plan`

**Versión del contrato:** 1.10 · **Depende de:** `shared` · **Lo usan:** `training`, `progression`, `app`

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
  metric: 'weight' | 'reps' | 'time';    // 'time' para plancha
  lumbarRisk: LumbarRisk;
  isPrimary: boolean;                    // compuesto principal, usado por la regla de deload
  beltRecommended?: boolean;             // faja en series pesadas (prensa, hack squat)
  cue?: string;
  restSeconds: [number, number];
}

interface Program { id: ID; name: string; startDate: LocalDate; totalWeeks: number; blockIds: ID[] }

interface Block {
  id: ID; programId: ID; name: string;
  startWeek: number; endWeek: number;
  targetRir: [number, number];
  weekRir?: Record<number, [number, number]>; // semana → RIR; por defecto targetRir (RN-PLN-06)
  weekFactors: Record<number, number>;   // semana → factor; por defecto 1.0
  isDeload: boolean;
  schedule: ScheduleEntry[];             // ver RN-PLN-03
}

type ScheduleEntry =
  | { weekday: Weekday; kind: 'workout'; templateId: ID; weekParity?: 'odd' | 'even' }
  | { weekday: Weekday; kind: 'cardio'; note: string }
  | { weekday: Weekday; kind: 'rest' };

interface SessionTemplate { id: ID; blockId: ID; name: string; items: TemplateItem[] }

interface TemplateItem {
  exerciseId: ID; order: number;         // ejercicio principal
  alternatives?: ID[];                   // "Dominadas o jalón al pecho"; ver RN-PLN-11
  sets: [number, number];                // rango de series
  reps: [number, number];                // rango de reps (o segundos si metric = 'time')
  note?: string;
}

// Valores de salida
interface ProgramPosition {
  status: 'not_started' | 'active' | 'finished';
  startDate: LocalDate;                  // del programa, también fuera de él (RN-PLN-01)
  totalWeeks: number;
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
// `ids` y `bus` se añaden con la primera operación que los necesite (updateTemplate, PlanChanged) (P-7).
export function createPlan(deps: { db: Dexie; clock: Clock }): PlanApi;

// Tablas propias, para que app/db.ts componga db.version(n).stores({...}).
export const planStores: Record<'exercises' | 'programs' | 'blocks' | 'templates', string>;

export type PlanErrorCode =
  | 'plan/invalid-seed' | 'plan/high-risk-exercise' | 'plan/template-not-found' | 'plan/week-out-of-range';

// Fase 1 implementa ensureSeeded, getPosition, getTodayPlan y getWeekPlan. El resto entra en PlanApi
// cuando se implementa (fase 2: getExercise(s) y listExercises; v1.0: RF-03, RF-04; fase 3: dataPort).

interface PlanApi {
  ensureSeeded(seed: unknown): Promise<Result<void>>;                // RN-PLN-13 a 15: valida y carga si está vacío
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

// Hooks reactivos (ui, useLiveQuery). Reciben la API: `ui` no lee el contexto de `app`.
export function useTodayPlan(plan: PlanApi, date: LocalDate): TodayPlan | undefined;
export function useWeekPlan(plan: PlanApi, weekStart: LocalDate): TodayPlan[] | undefined;

// Componentes
function WeekStrip(props: { days: TodayPlan[]; weekStart: LocalDate; today: LocalDate }): JSX.Element;
function PlanExerciseList(props: { items: PlannedItem[] }): JSX.Element;
export { WeekStrip, PlanExerciseList } from './ui';
export type { PlanApi, Exercise, Block, SessionTemplate, TemplateItem, ProgramPosition, TodayPlan, PlannedItem, LumbarRisk, Equipment, MuscleGroup };
```

## 5. Eventos

| Evento | Payload | Cuándo |
|---|---|---|
| `plan/PlanChanged` | `{ reason: 'start_date' \| 'template' \| 'seed'; templateIds?: ID[] }` | Tras confirmar un cambio en programa o plantillas |

No escucha eventos.

## 6. Reglas de negocio

| ID | Regla | Origen |
|---|---|---|
| RN-PLN-01 | `week = floor(días(startDate, date) / 7) + 1`. Si `date < startDate` → `not_started`; si `week > totalWeeks` → `finished`. Fuera del programa: `week: null`, `block: null`, `isDeloadWeek: false`, `volumeFactor: 1`. `startDate` y `totalWeeks` del programa están siempre, dentro y fuera de él ("Semana 1 de 15", "El plan empieza el lunes 16 de noviembre."). | RF-02 |
| RN-PLN-02 | El bloque activo es el que cumple `startWeek ≤ week ≤ endWeek`. Siempre hay exactamente uno para cada semana del programa (lo valida el seed). | RF-02, spec §6.4 |
| RN-PLN-03 | La sesión del día sale de `block.schedule` por `weekday`. Si hay entradas con `weekParity`, se elige la que coincide con la paridad de la semana dentro del bloque (`week − block.startWeek + 1`; alternancia A/B/A – B/A/B del bloque 1). Manda el calendario: una sesión que no se hizo no desplaza a las siguientes. | plan.md bloque 1 |
| RN-PLN-04 | `volumeFactor = block.weekFactors[week] ?? 1.0`; en semana de deload, `0.5`. | spec §6.3, §6.4 |
| RN-PLN-05 | `plannedSets = max(1, round(item.sets[0] × volumeFactor))`, con `Math.round` (un .5 sube: 3 × 0.5 → 2). Se planifica el mínimo del rango; el usuario puede añadir series hasta el máximo (RF-16). | RF-05, plan.md |
| RN-PLN-06 | `targetRir = [4, 4]` en deload; si no, `block.weekRir[week] ?? block.targetRir` (semana del programa, como `weekFactors`). | spec §6.3, plan.md semanas 1, 5 y 9 |
| RN-PLN-07 | **Ningún ejercicio `lumbarRisk: 'high'` puede estar en una plantilla**, ni como principal ni como alternativa. Bloqueo total, sin opción de anularlo. `ensureSeeded`, `updateTemplate` y la importación de `dataPort` lo rechazan con `plan/high-risk-exercise`. El seed tampoco puede traer un ejercicio `high` en el catálogo, aunque ninguna plantilla lo use (P-1). | P-1, spec §6.5 |
| RN-PLN-08 | Un ejercicio `medium` se puede añadir a una plantilla con confirmación explícita en la UI. | spec §6.5 |
| RN-PLN-09 | `jumpToWeek(n)` fija `startDate = lunes de la semana actual − (n − 1) × 7 días`. | RF-03 |
| RN-PLN-10 | La semana empieza en lunes (ISO 8601). `getWeekPlan` normaliza la fecha recibida con `startOfIsoWeek` y devuelve 7 días, de lunes a domingo. | Spec 001 |
| RN-PLN-11 | `alternatives` contiene IDs de ejercicios existentes, distintos del principal, sin repetir y con la misma `metric` que el principal. `PlannedItem` muestra el principal; la serie registra el ejercicio que realmente se usó, y cada ejercicio lleva su propia progresión. | plan.md |
| RN-PLN-12 | Una entrada de `schedule` puede apuntar a una plantilla de cualquier bloque del mismo programa. El bloque Deload (semana 15) reutiliza el calendario y las plantillas del bloque 3. | Spec 001 |
| RN-PLN-13 | El seed no trae fecha: `ensureSeeded` fija `startDate = startOfIsoWeek(clock.today())`, con `clock.today()` leído al llamar a `ensureSeeded`, no al crear el módulo. | Spec 001 |
| RN-PLN-14 | `ensureSeeded` es atómico e idempotente: valida todo antes de escribir y escribe en una sola transacción, solo si las 4 tablas del plan están vacías. Con llamadas concurrentes, el seed se aplica una vez. Si `programs` está vacía pero otra tabla tiene filas (estado corrupto), lanza sin escribir; la escritura usa inserciones (`bulkAdd`), nunca reemplazos. | P-2, spec 001 |
| RN-PLN-15 | Validación del seed, además del esquema Zod: (a) todo ID referenciado existe; (b) los bloques cubren las semanas 1..`totalWeeks` sin huecos ni solapes (RN-PLN-02); (c) cada día de cada bloque tiene una entrada sin `weekParity` o exactamente dos, una `odd` y una `even`; (d) RN-PLN-11; (e) IDs únicos dentro de cada tabla; (f) `block.programId` es el del programa y `program.blockIds` son exactamente los bloques del seed, ordenados por `startWeek`; (g) las claves de `weekRir` y `weekFactors` son semanas del propio bloque; (h) `order` único dentro de cada plantilla. Un fallo devuelve `plan/invalid-seed`. La forma y el rango de cada valor los valida el esquema Zod (RN-PLN-24, ADR-0012). | ADR-0012, spec 001 |
| RN-PLN-19 | La validación del seed (`validateSeed`, dominio puro) devuelve el primer error en este orden: RN-PLN-07 (seguridad primero), (a) referencias, (b) semanas, (c) calendario, (d) alternativas, y después (e) a (h). El error lleva un `message` técnico en inglés y `details` con los IDs implicados; el usuario solo ve el mensaje genérico. | P-1, ADR-0010 |
| RN-PLN-16 | Un día sin entrada en `schedule`, una plantilla o un ejercicio inexistentes al calcular el plan del día son un bug (RN-PLN-15 lo impide): se lanza una excepción, no un `Result`. | ADR-0010 |
| RN-PLN-17 | Los `plannedItems` se ordenan por `TemplateItem.order`, no por la posición en el arreglo. | Spec 001 |
| RN-PLN-20 | `ensureSeeded` siempre analiza y valida el seed, también si la base ya tiene programa: primero el parser (esquema Zod), luego `validateSeed` y al final la escritura (`seedIfEmpty`). Devuelve el primer error tal cual y no ejecuta los pasos siguientes. | P-2, ADR-0012 |
| RN-PLN-21 | Un fallo del almacenamiento (la base lanza) es un error inesperado: la promesa se rechaza, no se devuelve un `Result`. | ADR-0010 |
| RN-PLN-22 | `getPosition`, `getTodayPlan` y `getWeekPlan` sin programa cargado son un bug (la UI espera a `ready`): lanzan una excepción. | ADR-0010 |
| RN-PLN-23 | Las consultas no guardan caché: cada llamada lee el almacenamiento, para que `useLiveQuery` vea los cambios (spec 001, plan §6.4). | Spec 001 |
| RN-PLN-24 | Esquema Zod del seed (forma, antes de RN-PLN-15): (a) rechaza claves desconocidas en todos los niveles; (b) IDs UUIDv7 en minúsculas; (c) `sets`, `reps`, `restSeconds`, `startWeek`, `endWeek`, `totalWeeks` y `order` son enteros ≥ 1; (d) RIR (`targetRir` y valores de `weekRir`) enteros de 0 a 5; (e) todo rango `[min, max]` cumple `min ≤ max`; (f) `weekFactors` en (0, 1]; (g) claves de `weekRir` y `weekFactors`: enteros positivos escritos como texto; (h) `name`, `note`, `cue` y la nota de cardio no vacíos ni solo espacios (los opcionales se omiten); (i) `exercises`, `blocks`, `templates`, `items`, `blockIds` y `schedule` no vacíos, y `alternatives`, si aparece, también; (j) `lumbarRisk: 'high'` es válido para el esquema: lo rechaza RN-PLN-07; (k) un fallo es `plan/invalid-seed` con `details` = lista de `{ path, code }`; (l) la salida es `PlanSeed` con los tipos *branded* del kernel, comprobado con una prueba de tipos. | ADR-0012, P-8 |
| RN-PLN-25 | Almacenamiento: cada tabla guarda los objetos del dominio tal cual (`Exercise`, `Program` con `startDate`, `Block`, `SessionTemplate`). La lectura toma el único programa, sus bloques (índice `programId`), todas las plantillas y todos los ejercicios. Más de un programa es un bug: lanza. | P-2, ADR-0010 |
| RN-PLN-26 | Hooks (`useTodayPlan`, `useWeekPlan`, con `useLiveQuery`): devuelven `undefined` mientras cargan y mientras el resultado pertenece a otra fecha (nunca el plan de ayer con la fecha de hoy, AC-20); se actualizan solos al cambiar las tablas del plan (spec 001 plan §6.4); un error de la consulta se lanza en el render y lo captura el *error boundary* de la ruta (AC-21). | Spec 001 |
| RN-PLN-18 | Notas del día: en cardio, la `note` de la entrada del calendario; en descanso, ninguna (el texto lo pone la UI); en pesas, la `note` de cada `TemplateItem` en su `PlannedItem`. | Spec 001 §6 |

## 7. Errores

`plan/invalid-seed`, `plan/high-risk-exercise`, `plan/template-not-found`, `plan/week-out-of-range`.

## 8. Pruebas de contrato

- RN-PLN-01: fecha anterior, primera, última y posterior al programa.
- RN-PLN-03: lunes de la semana 1 → Full body A; lunes de la semana 2 → Full body B.
- RN-PLN-05: semana 1 del bloque 1 (factor 0.7) con `sets: [3, 3]` → 2 series.
- RN-PLN-07: seed con "Peso muerto rumano" en una plantilla, como principal o como alternativa → `plan/high-risk-exercise`.
- RN-PLN-06: semanas 1, 2, 9, 10 y 15 → [3, 4], [2, 3], [3, 3], [1, 3] y [4, 4].
- RN-PLN-11: alternativa inexistente, igual al principal, repetida o con otra `metric` → `plan/invalid-seed`.
- RN-PLN-12: lunes de la semana 15 → Push del bloque 3 al 50%.
- RN-PLN-13: primer arranque un miércoles → `startDate` es el lunes de esa semana.
- RN-PLN-14: dos `ensureSeeded` concurrentes → un solo programa; segunda llamada con datos → no cambia nada.
- RN-PLN-15: un seed por cada caso (a)–(c) → `plan/invalid-seed` y la base vacía.
- RN-PLN-01: fuera del programa → `week: null`, `block: null`, `isDeloadWeek: false`, `volumeFactor: 1`; dentro y fuera, `startDate` y `totalWeeks` del programa.
- RN-PLN-10: `getWeekPlan` con un jueves → 7 días desde el lunes de esa semana.
- RN-PLN-16: plantilla o ejercicio inexistentes en el cálculo del día → lanza.
- RN-PLN-17: ítems guardados en desorden → salen por `order`.
- RN-PLN-18: cardio con su nota; descanso sin nota; nota del ítem en su `PlannedItem`.
- RN-PLN-07: ejercicio `high` solo en el catálogo → `plan/high-risk-exercise`.
- RN-PLN-15: un seed por cada caso (e)–(h) → `plan/invalid-seed`.
- RN-PLN-19: seed con un `high` y una referencia rota → `plan/high-risk-exercise`; `details` nombra los IDs.
- RN-PLN-13: primer arranque en lunes → ese lunes; en domingo → el lunes anterior.
- RN-PLN-20: parser que falla → su error, sin validar ni escribir; reglas que fallan → su error, sin escribir; seed inválido con programa ya cargado → error y la base no cambia.
- RN-PLN-21: el repositorio rechaza → `ensureSeeded` y las consultas rechazan.
- RN-PLN-22: consultas sin programa → lanzan.
- RN-PLN-23: tras un cambio en el repositorio, la siguiente consulta lo refleja.
- RN-PLN-14: un fallo a mitad de la escritura → rechaza y las 4 tablas quedan vacías; dos conexiones a la misma base → un solo programa; filas sin programa → lanza sin escribir.
- RN-PLN-25: más de un programa → lanza.
- RN-PLN-26: cambiar la fecha nunca devuelve el plan de la fecha anterior; escribir en `programs` o `templates` actualiza el hook sin volver a renderizar; sin programa, el error llega al *error boundary*.
- RN-PLN-24: un seed por cada caso (a)–(i) → `plan/invalid-seed` con su ruta; un `high` pasa el esquema.
- El seed real (`plan.md`) pasa la validación y cubre las 15 semanas sin huecos.

## 9. Trazabilidad

RF-01, RF-02, RF-03, RF-04, RF-05, RF-17 (`cue`), spec §6.4, §6.5.

## 10. Decisiones (17-nov-2026)

1. **Ejercicios `high`:** bloqueo total, sin opción de anularlo (RN-PLN-07, P-1).
2. **Ejercicios con alternativa** ("Dominadas o jalón al pecho", "Hack squat o prensa"): `TemplateItem.alternatives`, y la serie registra el ejercicio realmente usado (RN-PLN-11). En la fase 1 "Hoy" muestra el principal; elegir la alternativa llega en la fase 2.
3. **Alternancia A/B del bloque 1:** `Block.schedule` con `weekParity`, por paridad de la semana dentro del bloque y según el calendario (RN-PLN-03).
4. **Series planificadas:** el mínimo del rango; se pueden añadir extras hasta el máximo (RN-PLN-05).
5. **Spec 001 (contrato v1.2):** fecha de inicio al cargar el seed (RN-PLN-13), `Block.weekRir` (RN-PLN-06), deload con las plantillas del bloque 3 (RN-PLN-12), carga atómica (RN-PLN-14) y validación del seed (RN-PLN-15); se confirman RN-PLN-10, `isPrimary` y `metric: 'time'`.
6. **Plan de la spec 001 (contrato v1.3):** `createPlan({ db, clock })`, `planStores`, `PlanErrorCode`, hooks con la API como parámetro y firmas de `WeekStrip` y `PlanExerciseList`.
7. **Casos de borde del calendario, antes de T3 (contrato v1.4):** posición fuera del programa (RN-PLN-01), redondeo con `Math.round` (RN-PLN-05), `getWeekPlan` normaliza al lunes (RN-PLN-10), datos inconsistentes lanzan (RN-PLN-16), orden por `order` (RN-PLN-17) y notas del día (RN-PLN-18).
8. **Validación del seed, antes de T5 (contrato v1.5):** `high` rechazado también en el catálogo (RN-PLN-07); reglas (e)–(h) de RN-PLN-15; orden de errores con seguridad primero y `details` (RN-PLN-19); forma y rangos de cada valor en Zod.
9. **Servicio de aplicación, antes de T7 (contrato v1.6):** puertos `SeedParser` y `PlanRepository` (spec 001, plan §6.9); `ensureSeeded` valida siempre y se detiene en el primer error (RN-PLN-20); fallos del almacenamiento como rechazo (RN-PLN-21); consultas sin programa lanzan (RN-PLN-22); sin caché (RN-PLN-23); `clock.today()` al llamar (RN-PLN-13). `getExercise(s)` y `listExercises` pasan a la fase 2, cuando `training` las use (P-7).
10. **Esquema del seed, antes de T9 (contrato v1.7):** ADR-0012 reemplaza a ADR-0007 (Zod valida la forma, el dominio las reglas incluido `high`; el seed se valida en cada arranque). Detalle del esquema en RN-PLN-24.
11. **Persistencia, antes de T10 (contrato v1.8):** "vacía" son las 4 tablas; un estado parcial lanza sin escribir y la escritura usa `bulkAdd` (RN-PLN-14); objetos del dominio tal cual y un solo programa (RN-PLN-25).
12. **Hooks, antes de T15 (contrato v1.9):** `useLiveQuery` conserva el resultado anterior al cambiar las dependencias, así que cada resultado lleva su fecha y el hook devuelve `undefined` si no coincide; los errores se lanzan en el render, como hace `useLiveQuery`, para el *error boundary* (RN-PLN-26).
13. **Página "Hoy", antes de T17 (contrato v1.10):** `ProgramPosition` gana `startDate` y `totalWeeks`, siempre presentes, para el encabezado y los mensajes fuera del programa (RN-PLN-01).
