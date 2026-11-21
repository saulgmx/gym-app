# Contrato del módulo `health`

**Depende de:** `shared` · **Lo usan:** `progression`, `app`, `training` (vía puerto `PainGate`)

## 1. Responsabilidad

Registro del dolor lumbar por sesión, banderas rojas, clasificación y alertas, y peso corporal. No conoce los ejercicios ni las series; trabaja con `workoutId` y fechas.

**Pruebas primero** (P-5). Los mensajes son orientativos, nunca diagnóstico (P-1).

## 2. Datos propios

| Tabla | Clave e índices | Contenido |
|---|---|---|
| `painEntries` | `id, &workoutId` | Un registro de dolor por sesión (índice único en `workoutId`). Sin índice en `recordedAt`: un `Instant` no se ordena como string (ADR-0009), así que las últimas se ordenan en memoria (RN-HLT-14) |
| `bodyMetrics` | `id, date` | Peso corporal |
| `healthSettings` | `id` (`'singleton'`) | Umbral de dolor y meta de peso |

La spec 005 crea solo `painEntries` (base v3; `healthStores`, que compone `app/db.ts`). `bodyMetrics` llega con el peso corporal (fase 4) y `healthSettings` con Ajustes (RF-51); hasta entonces el umbral es 3 (P-7).

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

interface PainAssessment {          // resultado puro de assessPain()
  status: PainStatus;
  message: string;
  redFlagMessage?: string;         // destacado; urgencias si bladder_bowel
  blocksProgression: boolean;
}

type NoticeCause = 'bladder_bowel' | 'red_flag' | 'alert' | 'over_threshold_2x' | 'rising_3x' | 'attention';

interface PainSummary {             // "últimas" = por recordedAt, de la más reciente a la más antigua
  latest: PainEntry | null;
  latestAssessment: PainAssessment | null;
  persistentAlert: { reason: 'over_threshold_2x' | 'rising_3x' | 'red_flag' } | null;
  notice: { cause: NoticeCause; message: string } | null;   // aviso de Hoy (RN-HLT-12, 13; textos §6.1)
  threshold: number;                                        // 3 hasta Ajustes (RF-51)
  // series (RF-33) y persistentAlert.since entran cuando una pantalla los use (P-7)
}
```

## 4. API pública (`index.ts`)

```ts
// `bus` entra cuando se publiquen los eventos de §5 (fase 4), como en training (P-7).
export function createHealth(deps: { db: Dexie; clock: Clock; ids: IdGenerator }): HealthApi;

// Tablas propias, para que app/db.ts componga db.version(n).stores({...}).
export const healthStores: Record<'painEntries', string>;   // painEntries: 'id, &workoutId'

export type HealthErrorCode = 'health/pain-out-of-range' | 'health/invalid-red-flag' | 'health/invalid-backup'; // RN-HLT-21 (spec 007)

// Specs 005 a 007. Lo demás entra con su feature: peso corporal (fase 4) y getSettings/updateSettings
// (Ajustes, RF-51).
interface HealthApi {
  recordPain(workoutId: ID, input: { level: number; redFlags: RedFlag[]; date: LocalDate }): Promise<Result<PainAssessment, HealthError>>; // RF-21, RF-22, RN-HLT-01, 09
  assessPain(level: number, redFlags: RedFlag[]): PainAssessment;      // puro, para la vista previa del Cierre
  getPainSummary(): Promise<PainSummary>;                              // RN-HLT-14, 17
  hasPainEntry(workoutId: ID): Promise<boolean>;                       // RN-HLT-18
  getPainForWorkouts(workoutIds: ID[]): Promise<Map<ID, PainEntry>>;   // RN-HLT-20, historial (spec 006)
  painGate: PainGate;                                                  // { hasPainEntry }, para training
  dataPort: DataPort;                                                  // painEntries (spec 007, decisión 14)
}
// Todas las operaciones async rechazan si falla la base (RN-HLT-16).

export function usePainSummary(health: HealthApi): PainSummary | undefined;   // useLiveQuery; undefined = cargando (RN-HLT-19)
export function usePainForWorkouts(health: HealthApi, workoutIds: ID[]): Map<ID, PainEntry> | undefined; // RN-HLT-20 (spec 006)

// Componentes (spec 005 plan §6.9). Más adelante: PainHistoryChart (RF-33), BodyWeightChart (RF-34).
// Sin `assessment` (contrato v1.8): cada uno deriva su texto de su propio value, para que el aviso
// de las banderas salga aunque no haya nivel elegido (AC-14 parte de AC-7).
function PainSelector(props: { value: number | null; onChange: (level: number) => void }): JSX.Element;
function RedFlagsChecklist(props: { value: RedFlag[]; onChange: (flags: RedFlag[]) => void }): JSX.Element;
function PainNotice(props: { notice: NonNullable<PainSummary['notice']> }): JSX.Element;   // aviso ámbar de Hoy
export { PainSelector, RedFlagsChecklist, PainNotice } from './ui';
// Etiquetas de las señales (spec 006 plan §6.4): las del Cierre, en ui/labels.ts, que RedFlagsChecklist también usa.
export function formatRedFlags(flags: RedFlag[]): string;   // "Hormigueo o adormecimiento, Debilidad en el pie" (orden de RED_FLAGS)

// Futuro (fuera de las specs 005 a 007)
//   recordBodyWeight(date: LocalDate, weightKg: number): Promise<Result<BodyMetric>>;  // RF-34
//   getBodyWeightSeries(range?: { from?: LocalDate; to?: LocalDate }): Promise<BodyWeightSeries>;
//   getSettings(): Promise<HealthSettings>;
//   updateSettings(patch: Partial<Omit<HealthSettings, 'id'>>): Promise<Result<void>>;
//   useBodyWeightSeries(health): BodyWeightSeries | undefined;
interface BodyWeightSeries { points: BodyMetric[]; weeklyAverages: { weekStart: LocalDate; avgKg: number }[] }
```

### Funciones del dominio (`domain/pain.ts`, spec 005 plan §6.4)

- `checkPainInput(level, redFlags)` → `Result<{ level: number; redFlags: RedFlag[] }, HealthError>` (RN-HLT-01, 15).
- `assessPain(level, redFlags)` → `PainAssessment` (RN-HLT-02, 06, 07); lanza si la entrada no pasa `checkPainInput` (RN-HLT-01).
- `persistentAlert(latestFirst, threshold)` → `PainSummary['persistentAlert']` (RN-HLT-03, 04, 05, 08).
- `noticeOf(latestFirst, threshold)` → `PainSummary['notice']` (RN-HLT-12, 13).
- `bandMessage(level)` → `string`: el mensaje de la banda (RN-HLT-02), el mismo `message` de `assessPain`. Confía en su entrada (0-10 desde el selector).
- `redFlagMessage(flags)` → `string | undefined`: el aviso de las banderas (RN-HLT-06), urgencias con `bladder_bowel`, `undefined` sin banderas. `assessPain` lo usa, así que el texto sale de un solo sitio. Confía en su entrada (las casillas solo dan valores de `RedFlag`).

`latestFirst: readonly Pick<PainEntry, 'level' | 'redFlags'>[]`, de la más reciente a la más antigua. El dominio confía en su entrada: el orden lo da el servicio (RN-HLT-14), las entradas se validaron al guardarse (RN-HLT-01, 15; la importación las valida con Zod en la spec 007) y `threshold` es la constante 3 hasta que Ajustes la valide (RF-51). No se revalida nada ni se modifica el arreglo.

Los textos de §6.1 viven en `domain/messages.ts`: son reglas de spec §6.2, no errores, así que no pasan por el mapa de ADR-0010. Los que llevan N, U o la secuencia son funciones.

### Componentes (`ui/`, spec 005 §6.1 y plan §6.9, contrato v1.8)

Los textos de los componentes viven con ellos; la página solo los coloca. Las pruebas leen roles, nombres y atributos `data-*`, no clases.

- **`PainSelector`:** pinta el `h2` "Dolor lumbar", la ayuda "0 = nada, 10 = el peor dolor" y un `role="group"` nombrado por el `h2` (`aria-labelledby`) y descrito por la ayuda (`aria-describedby`). Dentro, 11 `<button type="button">` del 0 al 10, con el número como texto y nombre, y `aria-pressed` (`true` solo en `value`). Cada botón lleva `data-band` con la banda de su nivel (`normal`, `attention` o `alert`); el CSS pinta en `--warn` el elegido desde 4. Tocar un botón llama a `onChange(nivel)`, también el ya elegido: no hay forma de volver a "sin elegir". Debajo, una región `aria-live="polite"` **siempre presente**: vacía con `value = null`; si no, `bandMessage(value)` y `data-band` de esa banda (barra ámbar en `alert`).
- **`RedFlagsChecklist`:** `<fieldset>` cuya `<legend>` contiene el `h2` "Señales de alarma (opcional)". Cuatro casillas nativas, en el orden de `RED_FLAGS`: "Dolor que baja por la pierna" (`radiating`), "Hormigueo o adormecimiento" (`numbness`), "Debilidad en el pie" (`weakness`) y "Problemas de control de vejiga o intestino" (`bladder_bowel`), marcadas según `value`. Marcar o desmarcar llama a `onChange` con las banderas **en el orden de `RED_FLAGS`**, no en el de los toques. Debajo, una región `aria-live="polite"` siempre presente: con banderas, el `SafetyNote` con `redFlagMessage(value)`; sin banderas, vacía (AC-15).
- **`PainNotice`:** un `SafetyNote` con `role="note"`, `data-cause={notice.cause}` y `notice.message`. Sin `aria-live`: aparece al cargar "Hoy", no por una acción.
- **`SafetyNote`** (interno, no se exporta, P-7): recuadro ámbar con un icono SVG decorativo (`aria-hidden`) y el texto.

## 5. Eventos

| Evento | Payload | Cuándo |
|---|---|---|
| `health/PainRecorded` | `{ workoutId, level, redFlags, status }` | Tras guardar el dolor |
| `health/PainAlertRaised` | `{ reason, latestLevel }` | Tras `PainRecorded`, si se cumple una condición de alerta persistente que no estaba activa |

No escucha eventos.

## 6. Reglas de negocio

| ID | Regla | Origen |
|---|---|---|
| RN-HLT-01 | `level` es entero en [0, 10]; si no, `health/pain-out-of-range`. Los valores no finitos (`NaN`, `Infinity`) se rechazan y `-0` se acepta como 0. `checkPainInput(level, redFlags)` revisa primero el nivel y luego las banderas (RN-HLT-15), y devuelve solo el primer error, sin `details` (como RN-TRN-04). Si todo es válido, devuelve `ok({ level, redFlags })` con el nivel normalizado (`-0` → 0) y un arreglo nuevo con las banderas en el orden recibido; `[]` es válido. `assessPain` con una entrada que no pasa `checkPainInput` lanza una excepción cuyo mensaje cita la regla incumplida (`RN-HLT-01` o `RN-HLT-15`): es un error de programación, como RN-PLN-16. Los mensajes técnicos de los errores (`message` del `Result`) también citan su regla. | RF-21, spec 005 |
| RN-HLT-02 | Clasificación fija: 0-3 `normal`, 4-6 `attention`, 7-10 `alert`, con los mensajes literales de spec §6.2. No depende de `painThreshold`. `status` y `message` dependen solo del nivel: una bandera roja no cambia la banda. | RF-22 |
| RN-HLT-03 | "Supera el umbral" significa `level > painThreshold`. | spec §6.2, RF-51 |
| RN-HLT-04 | Alerta persistente `over_threshold_2x`: las 2 últimas entradas superan el umbral. Solo cuentan las 2 primeras de `latestFirst`; con menos de 2 entradas no se cumple. | spec §6.2 |
| RN-HLT-05 | Alerta persistente `rising_3x`: las 3 últimas entradas son estrictamente crecientes y la última > 0. Solo cuentan las 3 primeras de `latestFirst`; con menos de 3 entradas no se cumple. | spec §6.2 |
| RN-HLT-06 | Cualquier bandera roja → `redFlagMessage` destacado y `blocksProgression = true`. Con `bladder_bowel`, el mensaje indica acudir a urgencias (§6.1), aunque haya otras banderas. Sin banderas, `PainAssessment` no tiene la propiedad `redFlagMessage` (no basta con `undefined`: `exactOptionalPropertyTypes`). | spec §6.2 |
| RN-HLT-07 | `alert` (7-10) → `blocksProgression = true`. `blocksProgression` es `true` solo con `alert` o con alguna bandera (RN-HLT-06); `normal` y `attention` sin banderas no bloquean. | spec §6.2 |
| RN-HLT-08 | La alerta persistente es **derivada**: se calcula con las últimas entradas y desaparece sola cuando dejan de cumplirse las condiciones. Una bandera roja mantiene la alerta hasta que se registra una sesión sin banderas: `red_flag` se cumple solo si la **última** entrada tiene banderas. `persistentAlert` devuelve una sola razón, con prioridad `red_flag` → `over_threshold_2x` → `rising_3x` (el orden de RN-HLT-13); sin entradas, `null`. | Spec 005 (AC-45) |
| RN-HLT-09 | Una entrada de dolor por workout. Registrar de nuevo sobre el mismo workout la reemplaza, con el mismo `id` y `recordedAt` nuevo (permite reintentar el cierre). `recordPain` valida primero (`checkPainInput`); con un error devuelve ese `Result` sin leer ni escribir la base. Si es válida, guarda `{ id, workoutId, date, recordedAt: clock.now(), level, redFlags }` con el nivel y las banderas normalizados, y devuelve `ok(assessPain(...))`. La búsqueda por `workoutId` y la escritura van en una transacción `rw`: si existe, la entrada se reemplaza entera (nivel, banderas, `date` y `recordedAt` nuevos) y solo conserva el `id`; `ids.next()` solo se llama al crear. Dos pestañas que registran el mismo workout se serializan y queda una sola entrada, la última. `health` no comprueba que el workout exista (no conoce `training`; lo garantiza el Cierre) ni valida `date` (`LocalDate` tipado que `app` toma del workout). | RF-21, spec 005 |
| RN-HLT-10 | `weightKg` del peso corporal en [30, 250]; una medición por día (la nueva reemplaza). [PROPUESTO] | RF-34 |
| RN-HLT-11 | Promedio semanal de peso: media de las mediciones de la semana ISO; la meta se compara contra el cambio entre promedios semanales. | plan.md |
| RN-HLT-12 | Aviso de dolor en Hoy: se muestra si `latestAssessment.status` no es `normal`, si `latest.redFlags` no está vacío o si `persistentAlert` no es `null`. Es un solo aviso; su texto depende de la causa (RN-HLT-13, §6.1). Sin entradas, no hay aviso. `noticeOf` es `null` exactamente cuando no se cumple ninguna de esas condiciones; `rising_3x` puede dar aviso con la última entrada en `normal` ([1, 2, 3], AC-40). | spec §6.2 |
| RN-HLT-13 | Causa del aviso de Hoy (RN-HLT-12) cuando hay varias, de mayor a menor prioridad: `bladder_bowel` en la última → otra bandera roja en la última → `alert` (7-10) → `over_threshold_2x` → `rising_3x` → `attention` (4-6). Se muestra un solo texto, el de la causa de mayor prioridad (§6.1). La causa combina `assessPain` de la última entrada con `persistentAlert`. Con umbral 3, `over_threshold_2x` siempre llega con la última ≥ 4, así que gana a `attention`. | Spec 005 |
| RN-HLT-14 | Las "últimas entradas" (RN-HLT-04, 05, 08, 12) se ordenan por `recordedAt`, de la más reciente a la más antigua: una sesión vieja cerrada tarde es la última. `getPainSummary` lee todas las entradas y las ordena en memoria con `compareInstants` (ADR-0009: nunca como string, ni por `id`, que se conserva al reemplazar); con instantes iguales, primero el `id` mayor, para que el orden sea determinista. | Spec 005 plan §6.3 |
| RN-HLT-15 | `redFlags` solo contiene valores de `RedFlag` y ninguno se repite; si no, `health/invalid-red-flag`, por la primera bandera que falle en el orden recibido. | RF-21, spec 005 |
| RN-HLT-16 | Un fallo del almacenamiento (la base lanza) es un error inesperado: la promesa rechaza, no se devuelve un `Result`, y lo muestra el aviso genérico (ADR-0010), como RN-TRN-18. Vale para todas las operaciones del servicio; un fallo a mitad del reemplazo de RN-HLT-09 no deja nada a medias (transacción). | ADR-0010, spec 005 |
| RN-HLT-17 | `getPainSummary` arma el resumen con el dominio sobre las entradas de RN-HLT-14: `latest` es la `PainEntry` completa más reciente, `latestAssessment = assessPain(latest)`, `persistentAlert` y `notice` con `threshold`, que es la constante 3 del servicio hasta Ajustes (RF-51). Sin entradas: `{ latest: null, latestAssessment: null, persistentAlert: null, notice: null, threshold: 3 }`. | Spec 005 |
| RN-HLT-18 | `hasPainEntry(workoutId)` es `true` si existe una entrada con ese `workoutId` y `false` si no (también con uno desconocido). `painGate` es `{ hasPainEntry }`, la misma función. | RN-TRN-06, spec 005 |
| RN-HLT-19 | `usePainSummary(health)` (en `ui/hooks.ts`, con `useLiveQuery`) devuelve `undefined` solo mientras carga y nunca `null`: sin entradas devuelve el resumen vacío de RN-HLT-17. No lleva clave, porque no recibe parámetros y `health` es una sola instancia por `compose` (sus dependencias son `[health]`). Se actualiza solo al cambiar `painEntries`: `getPainSummary` solo espera promesas de Dexie y el resto es síncrono. Un error de la consulta se lanza en el render y lo captura el *error boundary* de la ruta, como RN-TRN-19. | RN-TRN-19, spec 005 |
| RN-HLT-20 | `getPainForWorkouts(workoutIds)` devuelve un mapa con la entrada de cada id que tiene una (RN-HLT-09: como mucho una por workout); los ids sin entrada no están; los ids repetidos cuentan una vez; con la lista vacía, mapa vacío sin leer la base. Rechaza si falla la base (RN-HLT-16). `usePainForWorkouts(health, ids)` sigue RN-HLT-19: `undefined` mientras carga o con el resultado de otra lista de ids, y se actualiza con `painEntries`. La clave es `ids.join('|')` en el orden recibido (un UUIDv7 no contiene `|`): la misma lista en otro orden es otra clave y pasa un instante por `undefined`; un arreglo nuevo con los mismos ids en cada render no repite la consulta. Con `[]`, `undefined` y luego un mapa vacío, sin leer la base. Cada valor es la `PainEntry` guardada tal cual; el orden de las claves del mapa no está garantizado (se busca con `get`). `health` no comprueba que los workouts existan. | RF-32, spec 006 |
| RN-HLT-21 | **Respaldo de health** (`dataPort`: `name 'health'`, `version 1`, `order 30`). Formato `{ painEntries }`, tal como están guardadas. `validate`: esquema estricto de `PainEntry` (nivel entero 0-10, banderas de `RED_FLAGS` sin repetir, `date` `LocalDate`, `recordedAt` `Instant`; un fallo es `health/invalid-backup` con `details: { rule: 'schema', issues }`) y después la función pura `checkHealthBackup` (`domain/backup.ts`), que devuelve el primer fallo: IDs únicos (`rule: 'unique-id'`) y como mucho una entrada por `workoutId` (`'one-per-workout'`, RN-HLT-09), con el ID implicado en `details`. `describe`: `requires.workout` = `workoutId` de cada entrada y `facts.painEntries`. `current`: `{}`. `importData` vacía `painEntries` y escribe con `bulkAdd`. **Casos de borde** (decisión 16): (a) las banderas se aceptan en cualquier orden; una repetida es un error de esquema; (b) primero `unique-id` (`{ rule, id }`) y después `one-per-workout` (`{ rule, workoutId }`); el esquema da `{ rule: 'schema', issues }`; (c) no se comprueba que `date` coincida con la del workout (`health` no ve los workouts, RN-HLT-09); (d) `describe`: `requires.workout` en el orden de las entradas, `facts.painEntries` = número de entradas, `provides` vacío; (e) filas por `id`, `current()` = `{}`, solo `fromVersion` 1 (otra lanza) y transacciones propias que se anidan en la de `data`, como `plan` y `training`. | RF-40, RF-41, spec 007 |

### 6.1 Textos

Aprobados en la spec 005 y validados sin cambios con el traumatólogo el 20-nov-2026 (decisión 17, T24 de la spec 005). N = nivel de la última entrada; U = umbral; los dos se escriben como enteros (`String`). En `rising_3x`, "a → b → c" va en orden cronológico (a = la más antigua de las tres, c = la última), separados por " → " (U+2192 con un espacio a cada lado): `latestFirst` [3, 2, 1] → "(1 → 2 → 3)".

| Causa | Texto |
|---|---|
| Bandera roja en el Cierre (`redFlagMessage`) | "Consulta a un médico antes de seguir entrenando. No se sugerirá subir carga." |
| `bladder_bowel` en el Cierre | "Acude a urgencias. No sigas entrenando hasta que te revise un médico." |
| Hoy: `bladder_bowel` | "En la última sesión marcaste problemas de control de vejiga o intestino. Acude a urgencias antes de volver a entrenar." |
| Hoy: otra bandera roja | "En la última sesión marcaste una señal de alarma. Consulta a un médico antes de seguir entrenando." |
| Hoy: `alert` | "Espalda baja N/10 en la última sesión. Detén el entrenamiento de esta zona y consulta a tu traumatólogo o fisioterapeuta." |
| Hoy: `over_threshold_2x` | "Espalda baja por encima de U/10 en las 2 últimas sesiones. Hoy prioriza la técnica y no añadas carga; si sigue, consulta a tu traumatólogo o fisioterapeuta." |
| Hoy: `rising_3x` | "Tu dolor lumbar subió en las 3 últimas sesiones (a → b → c). Hoy prioriza la técnica y no añadas carga." |
| Hoy: `attention` | "Espalda baja N/10 en la última sesión. Hoy baja la carga y evita los ejercicios que la provocaron." |

## 7. Errores

`health/pain-out-of-range`, `health/invalid-red-flag`, `health/invalid-backup` (RN-HLT-21), `health/invalid-body-weight`.

## 8. Pruebas de dominio (escribir antes del código)

- RN-HLT-01: 0 y 10 válidos; −1, 11, 2.5, `NaN`, `Infinity` y `-Infinity` → `health/pain-out-of-range` con el mensaje que cita `RN-HLT-01`; `-0` → `ok` con nivel 0 (`Object.is`); nivel y bandera inválidos a la vez → solo el error del nivel; válido → `ok({ level, redFlags })` con las banderas en el orden recibido y un arreglo distinto del de entrada; `[]` válido; `assessPain` con nivel inválido lanza `/RN-HLT-01/`.
- RN-HLT-15: bandera desconocida y bandera repetida → `health/invalid-red-flag` con el mensaje que cita `RN-HLT-15`; `assessPain` con una bandera inválida lanza `/RN-HLT-15/`.
- RN-HLT-02: 0, 3 → `normal`; 4, 6 → `attention`; 7, 10 → `alert`; los mensajes coinciden con la spec; con umbral 5, un 4 sigue siendo `attention`; un 2 con `numbness` sigue siendo `normal` con el mensaje de su banda.
- RN-HLT-06: `bladder_bowel` → mensaje de urgencias y bloqueo, también junto a otra bandera; cualquier otra bandera → mensaje de consultar a un médico y bloqueo; sin banderas, sin la propiedad `redFlagMessage`.
- RN-HLT-07: 7 y 10 sin banderas → bloquea; 0, 3, 4 y 6 sin banderas → no bloquea.

Desde aquí, las listas de entradas van de la más reciente a la más antigua (`latestFirst`), con umbral 3, salvo cuando se dice "cronológico".

- RN-HLT-04: [4, 4] → alerta; [4, 3] y [3, 4] → no; [4] → no; [4, 4, 0] → alerta (solo cuentan las 2 primeras).
- RN-HLT-05: cronológico [1, 2, 3] (`latestFirst` [3, 2, 1]) → `rising_3x`; cronológico [1, 2, 2] → no; [0, 0, 0] → no; [3, 2] → no (menos de 3); `latestFirst` [3, 2, 1, 9] → sí (solo cuentan las 3 primeras).
- RN-HLT-08: [2, 4, 4] → `null` (un 2 tras [4, 4] quita la alerta); [2 con `numbness`, 4, 4] → `red_flag` (manda sobre `over_threshold_2x`); [5 con `numbness`, 4] → `red_flag`; [2 sin banderas, 4 con `numbness`] → `null` (la bandera no era de la última); sin entradas → `null`; el arreglo de entrada no cambia.
- RN-HLT-12: última 3 sin banderas ni alerta persistente → sin aviso; última 4 → aviso; última 2 con `numbness` → aviso; cronológico [1, 2, 3] → aviso (`rising_3x`); sin entradas → sin aviso.
- RN-HLT-13: [5, 4] → `over_threshold_2x` antes que `attention`; última 8 con `numbness` → `red_flag` antes que `alert`; `numbness` y `bladder_bowel` → `bladder_bowel`; cronológico [1, 2, 5] → `rising_3x` antes que `attention`.
- Textos (§6.1): `attention` y `alert` con N; `over_threshold_2x` con "por encima de 3/10" (U); `latestFirst` [3, 2, 1] → "(1 → 2 → 3)".
- `PainAlertRaised` se publica solo en la transición de "sin alerta" a "con alerta".

Servicio (integración con `fake-indexeddb`, spec 005 T5):

- RN-HLT-09: un nivel o una bandera inválidos devuelven el error sin tocar la base (ni lectura ni escritura) y sin llamar a `ids.next()`; válido → guarda la entrada con `recordedAt = clock.now()` y el nivel normalizado (`-0` → 0), y devuelve la evaluación; registrar otra vez el mismo workout conserva el `id`, cambia nivel, banderas, `date` y `recordedAt`, no duplica y no llama a `ids.next()`; dos `recordPain` concurrentes del mismo workout dejan una sola entrada.
- RN-HLT-14: una sesión del lunes cerrada después de la del martes es la última; dos `recordedAt` con offsets distintos se ordenan por instante, no por string; con instantes iguales, primero el `id` mayor.
- RN-HLT-17: sin entradas, el resumen vacío con `threshold: 3`; con entradas, `latest`, `latestAssessment`, `persistentAlert` y `notice` coinciden con el dominio.
- RN-HLT-18: `hasPainEntry` y `painGate.hasPainEntry` → `true` tras registrar, `false` con un workout desconocido.
- RN-HLT-16: si la base lanza, `recordPain`, `getPainSummary` y `hasPainEntry` rechazan; un fallo a mitad del reemplazo deja la entrada anterior intacta.

Hook (spec 005 T8):

- RN-HLT-19: `undefined` en el primer render y luego el resumen vacío (nunca `null`); registrar dolor, nuevo o reemplazado, actualiza el resultado sin volver a renderizar desde fuera; con otra instancia de `health` consulta la nueva; una lectura que lanza (un *hook* `reading` de Dexie) hace llegar su error al *error boundary*. No sirve una base cerrada: `liveQuery` espera en silencio a que se abra y el hook se queda en `undefined`. Que otra pestaña escriba no se prueba con `fake-indexeddb`, como en `training`.

Componentes (spec 005 T13, contrato v1.8):

- Dominio: `bandMessage` de 0, 3, 4, 6, 7 y 10 es el `message` de `assessPain`; `redFlagMessage([])` es `undefined`, con una bandera el texto de consultar a un médico y con `bladder_bowel`, en cualquier posición, el de urgencias; `assessPain` da el mismo `redFlagMessage`.
- `PainSelector` (AC-10 a AC-12): grupo "Dolor lumbar" descrito por la ayuda, con 11 botones del 0 al 10; sin `value`, todos con `aria-pressed="false"` y la región `aria-live="polite"` presente y vacía; con `value` 2, solo el "2" pulsado y el mensaje de su banda; con 5 y 8, sus mensajes y `data-band`; tocar un botón, también el elegido, llama a `onChange` con su número; el `data-band` de cada botón es el de su nivel.
- `RedFlagsChecklist` (AC-13 a AC-15): grupo "Señales de alarma (opcional)" con cuatro casillas en orden, sin marcar con `[]`; marcar "Hormigueo" llama a `onChange(['numbness'])`; con `['weakness']`, marcar "Dolor que baja por la pierna" da `['radiating', 'weakness']`; desmarcar quita la bandera; con `['numbness']` el aviso de consultar a un médico, con `['numbness', 'bladder_bowel']` el de urgencias, y con `[]` la región `aria-live` presente y vacía.
- `PainNotice` (AC-39 y AC-43): `role="note"` con el texto y `data-cause`; el icono no tiene nombre accesible.

## 9. Trazabilidad

RF-21, RF-22, RF-33, RF-34, RF-40 y RF-41 (`dataPort`, spec 007), RF-51, spec §6.2.

## 10. Decisiones y preguntas abiertas

Decisiones (pregunta 8, 18-nov-2026, contrato v1.1):

1. **Bandas fijas:** 0-3/4-6/7-10 y sus mensajes no se mueven con el umbral; el umbral solo decide `over_threshold_2x` (RN-HLT-02, RN-HLT-03).
2. **"Sube 3 sesiones":** 3 últimas entradas estrictamente crecientes, la última > 0 (RN-HLT-05).
3. **Aviso en Hoy:** última lectura ≥ 4, banderas rojas en la última o alerta persistente; un solo aviso con texto por causa (RN-HLT-12, spec §6.2). Reemplaza la propuesta del diseño de Hoy ("última ≥ 3/10"), que chocaba con la banda Normal.

4. **Spec 005, Cierre (contrato v1.2):** prioridad entre causas del aviso (RN-HLT-13) y textos de §6.1; solo `painEntries` en la base v3; los eventos de §5 no se publican hasta que `progression` los escuche (fase 4).
5. **Plan de la spec 005 (contrato v1.3):** API reducida a lo que usa el Cierre (`recordPain`, `assessPain`, `getPainSummary`, `hasPainEntry`, `painGate`), `createHealth` sin `bus`, `healthStores`, `HealthErrorCode`, `usePainSummary(health)` y los componentes `PainSelector`, `RedFlagsChecklist` y `PainNotice` (`PainAlertBanner` pasa a llamarse así). `PainSummary` gana `notice` y pierde `series` y `since` hasta que se usen. Orden por `recordedAt` (RN-HLT-14). Funciones del dominio en §4.
6. **Entrada y clasificación del dolor (contrato v1.4, 18-nov-2026, antes de T1 de la spec 005):** se revisa primero el nivel y se devuelve solo el primer error; no finitos rechazados y `-0` como 0; `checkPainInput` válido devuelve el nivel normalizado y un arreglo nuevo de banderas en su orden; `assessPain` lanza con una entrada inválida (error de programación); `status` y `message` solo dependen del nivel y `redFlagMessage` solo existe con banderas; `blocksProgression` = `alert` o alguna bandera; RN-HLT-15 para las banderas; los mensajes técnicos citan su regla (RN-HLT-01, 02, 06, 07, 15).
7. **Alertas y aviso de "Hoy" (contrato v1.5, 18-nov-2026, antes de T3 de la spec 005):** `persistentAlert` y `noticeOf` reciben `Pick<PainEntry, 'level' | 'redFlags'>` de la más reciente a la más antigua y confían en su entrada (orden del servicio, entradas validadas al guardarse, umbral constante); solo cuentan las 2 o 3 primeras y con menos no se cumple la condición; `persistentAlert` da una sola razón (`red_flag` → `over_threshold_2x` → `rising_3x`) y `red_flag` solo con banderas en la última; RN-HLT-08 deja de ser `[PROPUESTO]` (AC-45); `noticeOf` es `null` exactamente cuando no se cumple RN-HLT-12; N y U como enteros y "a → b → c" en orden cronológico; los textos con valores son funciones en `messages.ts` (RN-HLT-04, 05, 08, 12, 13).
8. **Servicio y almacenamiento (contrato v1.6, 18-nov-2026, antes de T5 de la spec 005):** `painEntries` pierde el índice `recordedAt` (ADR-0009: un `Instant` no se ordena como string; corrige el plan §4) y las últimas se ordenan en memoria con `compareInstants`, con empate por `id` mayor (RN-HLT-14); `recordPain` valida sin tocar la base, normaliza, reemplaza en una transacción conservando solo el `id` y llama a `ids.next()` solo al crear; `health` no comprueba que el workout exista ni valida `date` (RN-HLT-09); un fallo de la base rechaza (RN-HLT-16); resumen vacío y `threshold: 3` constante (RN-HLT-17); `hasPainEntry` y `painGate` (RN-HLT-18).
9. **Hook (contrato v1.7, 18-nov-2026, antes de T8 de la spec 005):** `usePainSummary` devuelve `undefined` solo al cargar y nunca `null`, sin clave porque no tiene parámetros, se actualiza con `painEntries` y lanza sus errores en el render (RN-HLT-19).
10. **Componentes (contrato v1.8, 18-nov-2026, antes de T13 de la spec 005):** `PainSelector` y `RedFlagsChecklist` pierden `assessment` y derivan su texto de su propio `value` con `bandMessage` y `redFlagMessage`, porque el aviso de las banderas debe salir sin nivel elegido (AC-14 parte de AC-7); los textos viven con los componentes; no se puede quitar la elección del dolor; las regiones `aria-live` están siempre en el DOM; las banderas vuelven en el orden de `RED_FLAGS`; `legend` con `h2`; `PainNotice` con `role="note"` y sin `aria-live`; `SafetyNote` interno (§4, "Componentes").
11. **Spec 006, historial (contrato v1.9, 19-nov-2026):** `getPainForWorkouts` sale de "Futuro" y entra en `HealthApi` con su hook `usePainForWorkouts` (RN-HLT-20), para el chip de la lista y el detalle. El historial muestra el nivel y las señales marcadas, sin los mensajes de banda ni de las señales: son consejos para la próxima sesión y solo salen en el Cierre y en "Hoy".
12. **Plan de la spec 006 (contrato v1.10, 19-nov-2026):** `formatRedFlags` exporta las etiquetas del Cierre para el detalle del historial; las etiquetas salen de `RedFlagsChecklist` a `ui/labels.ts`. `getPainForWorkouts` lee por el índice único `&workoutId` (`anyOf`).
13. **Casos de borde de RN-HLT-20, antes de T3 de la spec 006 (contrato v1.11, 19-nov-2026):** la clave de `usePainForWorkouts` es `ids.join('|')` en el orden recibido; con `[]` da un mapa vacío sin leer la base; los valores son las entradas tal cual y el orden del mapa no está garantizado.
14. **Spec 007, respaldo (contrato v1.12, 19-nov-2026):** `dataPort` entra en `HealthApi`. Exporta `painEntries` tal cual (sin `bodyMetrics` ni ajustes, que no existen todavía). Al importar valida el esquema (nivel entero 0-10, banderas de `RED_FLAGS`), IDs únicos, como mucho una entrada por workout (RN-HLT-09) y que cada `workoutId` esté en los workouts del archivo (RN-DAT-11). Importar reemplaza la tabla. La forma de sus datos, su versión y cómo ve los workouts del archivo sin depender de `training` los fija el plan técnico de la spec 007.
15. **Plan de la spec 007 (contrato v1.13, 19-nov-2026):** RN-HLT-21 y el código `health/invalid-backup`, con pruebas primero (P-5). `health` no ve los workouts del archivo: declara sus `workoutId` en `describe` como `requires.workout` y `data` los cruza con lo que ofrece `training` (RN-DAT-11).
16. **Casos de borde de RN-HLT-21, antes de T9 de la spec 007 (contrato v1.14, 19-nov-2026):** banderas en cualquier orden y sin repetir; orden de las reglas y sus `details`; sin comprobar `date` contra el workout; `describe` sin `provides`; filas por `id`, `current()` vacío, solo `fromVersion` 1 y transacciones que se anidan.
17. **Textos validados (contrato v1.15, 20-nov-2026, T24 de la spec 005):** el traumatólogo validó sin cambios los textos de §6.1 y el aviso médico de Ajustes (spec 007 §6.1); dejan de ser `[PROPUESTO]`. Ninguna regla cambia.
18. **Fin de la numeración (21-nov-2026):** el contrato deja de llevar número de versión (último: v1.15); el historial es git (`docs/README.md`, "Versiones y registro de cambios"; retro X-1).

Preguntas abiertas:

1. Validar los umbrales con tu traumatólogo antes de depender de ellos (spec §14). Los mensajes ya están validados (decisión 17).
