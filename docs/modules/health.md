# Contrato del módulo `health`

**Versión del contrato:** 1.0 · **Depende de:** `shared` · **Lo usan:** `progression`, `app`, `training` (vía puerto `PainGate`)

## 1. Responsabilidad

Registro del dolor lumbar por sesión, banderas rojas, clasificación y alertas, y peso corporal. No conoce los ejercicios ni las series; trabaja con `workoutId` y fechas.

**Pruebas primero** (P-5). Los mensajes son orientativos, nunca diagnóstico (P-1).

## 2. Datos propios

| Tabla | Clave e índices | Contenido |
|---|---|---|
| `painEntries` | `id, &workoutId, recordedAt` | Un registro de dolor por sesión (índice único en `workoutId`) |
| `bodyMetrics` | `id, date` | Peso corporal |
| `healthSettings` | `id` (`'singleton'`) | Umbral de dolor y meta de peso |

## 3. Modelo de dominio

```ts
type RedFlag = 'radiating' | 'numbness' | 'weakness' | 'bladder_bowel';
type PainStatus = 'normal' | 'attention' | 'alert';

interface PainEntry {
  id: ID;
  workoutId: ID;
  date: LocalDate;
  recordedAt: Instant;
  level: number;                   // entero 0-10
  redFlags: RedFlag[];
}

interface BodyMetric { id: ID; date: LocalDate; weightKg: number }

interface HealthSettings {
  id: 'singleton';
  painThreshold: number;           // por defecto 3 (RF-51)
  weeklyGainGoalKg: [number, number];   // por defecto [0.2, 0.3] (plan.md)
}

interface PainAssessment {          // resultado puro de classify()
  status: PainStatus;
  message: string;
  redFlagMessage?: string;         // destacado; urgencias si bladder_bowel
  blocksProgression: boolean;
}

interface PainSummary {
  latest: PainEntry | null;
  latestAssessment: PainAssessment | null;
  persistentAlert: { reason: 'over_threshold_2x' | 'rising_3x' | 'red_flag'; since: LocalDate } | null;
  threshold: number;
  series: { date: LocalDate; level: number }[];   // para la gráfica (RF-33)
}
```

## 4. API pública (`index.ts`)

```ts
export function createHealth(deps: { db: HealthDb; clock: Clock; ids: IdGenerator; bus: EventBus }): HealthApi;

interface HealthApi {
  recordPain(workoutId: ID, input: { level: number; redFlags: RedFlag[]; date: LocalDate }): Promise<Result<PainAssessment>>; // RF-21, RF-22
  assessPain(level: number, redFlags: RedFlag[]): PainAssessment;      // puro, para la vista previa en ClosePage
  getPainSummary(opts?: { limit?: number }): Promise<PainSummary>;
  getPainForWorkouts(workoutIds: ID[]): Promise<Map<ID, PainEntry>>;
  hasPainEntry(workoutId: ID): Promise<boolean>;                       // implementa training.PainGate
  recordBodyWeight(date: LocalDate, weightKg: number): Promise<Result<BodyMetric>>;  // RF-34
  getBodyWeightSeries(range?: { from?: LocalDate; to?: LocalDate }): Promise<BodyWeightSeries>;
  getSettings(): Promise<HealthSettings>;
  updateSettings(patch: Partial<Omit<HealthSettings, 'id'>>): Promise<Result<void>>;
  painGate: PainGate;
  dataPort: DataPort;
}

export function usePainSummary(): PainSummary | undefined;
export function useBodyWeightSeries(): BodyWeightSeries | undefined;

interface BodyWeightSeries { points: BodyMetric[]; weeklyAverages: { weekStart: LocalDate; avgKg: number }[] }
export { PainSelector, RedFlagsChecklist, PainAlertBanner, PainHistoryChart, BodyWeightChart } from './ui';
```

## 5. Eventos

| Evento | Payload | Cuándo |
|---|---|---|
| `health/PainRecorded` | `{ workoutId, level, redFlags, status }` | Tras guardar el dolor |
| `health/PainAlertRaised` | `{ reason, latestLevel }` | Tras `PainRecorded`, si se cumple una condición de alerta persistente que no estaba activa |

No escucha eventos.

## 6. Reglas de negocio

| ID | Regla | Origen |
|---|---|---|
| RN-HLT-01 | `level` es entero en [0, 10]; si no, `health/pain-out-of-range`. | RF-21 |
| RN-HLT-02 | Clasificación fija: 0-3 `normal`, 4-6 `attention`, 7-10 `alert`, con los mensajes literales de spec §6.2. | RF-22 |
| RN-HLT-03 | "Supera el umbral" significa `level > painThreshold`. | spec §6.2, RF-51 |
| RN-HLT-04 | Alerta persistente `over_threshold_2x`: las 2 últimas entradas superan el umbral. | spec §6.2 |
| RN-HLT-05 | Alerta persistente `rising_3x`: las 3 últimas entradas son estrictamente crecientes y la última > 0. [PROPUESTO] | spec §6.2 |
| RN-HLT-06 | Cualquier bandera roja → `redFlagMessage` destacado y `blocksProgression = true`. Con `bladder_bowel`, el mensaje indica acudir a urgencias. | spec §6.2 |
| RN-HLT-07 | `alert` (7-10) → `blocksProgression = true`. | spec §6.2 |
| RN-HLT-08 | La alerta persistente es **derivada**: se calcula con las últimas entradas y desaparece sola cuando dejan de cumplirse las condiciones. Una bandera roja mantiene la alerta hasta que se registra una sesión sin banderas. [PROPUESTO] | — |
| RN-HLT-09 | Una entrada de dolor por workout. Registrar de nuevo sobre el mismo workout la reemplaza (permite corregir antes de cerrar). | RF-21 |
| RN-HLT-10 | `weightKg` del peso corporal en [30, 250]; una medición por día (la nueva reemplaza). [PROPUESTO] | RF-34 |
| RN-HLT-11 | Promedio semanal de peso: media de las mediciones de la semana ISO; la meta se compara contra el cambio entre promedios semanales. | plan.md |

## 7. Errores

`health/pain-out-of-range`, `health/invalid-red-flag`, `health/invalid-body-weight`.

## 8. Pruebas de dominio (escribir antes del código)

- RN-HLT-02: 0, 3 → `normal`; 4, 6 → `attention`; 7, 10 → `alert`; los mensajes coinciden con la spec.
- RN-HLT-04: [4, 4] con umbral 3 → alerta; [4, 3] → no.
- RN-HLT-05: [1, 2, 3] → `rising_3x`; [1, 2, 2] → no; [0, 0, 0] → no.
- RN-HLT-06: `bladder_bowel` → mensaje de urgencias y bloqueo.
- RN-HLT-08: tras [4, 4] una entrada 2 quita la alerta.
- `PainAlertRaised` se publica solo en la transición de "sin alerta" a "con alerta".

## 9. Trazabilidad

RF-21, RF-22, RF-33, RF-34, RF-51, spec §6.2.

## 10. Preguntas abiertas

1. Con umbral configurable, ¿se mantienen fijas las bandas 0-3/4-6/7-10 de los mensajes (propuesta) o se mueven con el umbral?
2. Validar los umbrales y mensajes con tu traumatólogo antes de depender de ellos (spec §14).
