# Contrato del módulo `data`

**Versión del contrato:** 1.4 · **Depende de:** `shared` · **Lo usan:** `app`

## 1. Responsabilidad

Exportar e importar todos los datos (JSON). Más adelante: exportar las series a CSV (RF-40), recordar respaldos (RF-42) y borrar todo (RF-43). No conoce los módulos: trabaja con los `DataPort` que `app/compose.ts` le registra.

## 2. Datos propios

Ninguno en la spec 007. La tabla `dataMeta` (`id: 'singleton'`, `lastExportAt`, `lastImportAt`) entra con el recordatorio de respaldo (RF-42), con su versión de base.

## 3. Contrato `DataPort`

La interfaz vive en `shared/kernel/data-port.ts` (no en `data`), porque cada módulo la implementa y ningún módulo puede importar `data`.

```ts
export interface DataPort<T = unknown> {
  name: string;                         // 'plan', 'training', 'health'; más adelante 'progression', 'app'
  version: number;                      // versión del formato de exportación de este módulo
  order: number;                        // orden de importación: plan 10, training 20, health 30, progression 35, app 40
  tables: string[];                     // tablas Dexie que toca (para la transacción única)
  exportData(): Promise<T>;             // filas tal como están guardadas
  validate(raw: unknown, fromVersion: number): Result<T>;   // migra y valida con Zod y las reglas del módulo
  describe(data: T): DataDescription;   // pura: facts de la vista previa y referencias (provides/requires)
  current(): Promise<LocalFacts>;       // estado local; solo lecturas Dexie, también dentro de la transacción
  importData(data: T): Promise<void>;   // vacía sus tablas y escribe las del archivo; dentro de la transacción
  csv?(): Promise<{ filename: string; content: string }>;   // training aporta las series (spec futura del CSV)
}
```

`ImportFacts`, `LocalFacts` y `DataDescription` están en [`shared.md`](shared.md) §2. `wipe` entra con RF-43. Ningún puerto ve los datos de otro: las referencias entre módulos (RN-DAT-11) se cruzan en `data` con `describe`.

En la spec 007 hay tres puertos: `plan`, `training` y `health`. El de `progression` (solo `progressionSettings`; las `suggestions` son derivadas y se reconstruyen con `rebuild()`) y el de `app` (`uiPreferences`) entran cuando esos módulos tengan datos.

## 4. Formato de exportación

```json
{
  "app": "gym-app",
  "schemaVersion": 1,
  "exportedAt": "2026-11-19T22:30:00-06:00",
  "modules": {
    "plan":     { "version": 1, "data": { "exercises": [], "program": {}, "blocks": [], "templates": [] } },
    "training": { "version": 1, "data": { "workouts": [], "sets": [] } },
    "health":   { "version": 1, "data": { "painEntries": [] } }
  }
}
```

- JSON con sangría de 2 espacios. Nombre: `gym-respaldo-<LocalDate de hoy>.json`, tipo `application/json`.
- `modules` tiene exactamente un elemento por puerto registrado, en orden de `order`. Cada `data` lo define su contrato: RN-PLN-29 (el formato del seed con `program.startDate`), RN-TRN-30 y RN-HLT-21; las filas son los objetos del dominio tal como están guardados.
- CSV de series (spec futura, RF-40): `date,workoutId,exercise,setNumber,weightKg,reps,rir,isExtra,completedAt`, UTF-8 con BOM para que Excel lo abra bien.

## 5. API pública (`index.ts`)

```ts
export function createData(deps: { db: Dexie; clock: Clock }): DataApi;

export type DataErrorCode =
  | 'data/file-too-large' | 'data/not-gym-app-file' | 'data/unsupported-version'
  | 'data/invalid-module-data' | 'data/workout-in-progress';

interface InvalidModuleDataDetails {
  module: string | null;                 // null: el sobre (módulos que faltan o sobran)
  cause: string;                         // código del puerto ('plan/high-risk-exercise'…), 'data/module-mismatch' o 'data/missing-reference'
  details?: unknown;                     // los details del puerto, o { kind, id } de la referencia rota
}

interface DataApi {
  registerDataPort<T>(port: DataPort<T>): void;                     // lanza con un name u order repetido
  exportAll(): Promise<{ filename: string; blob: Blob }>;           // RF-40, RN-DAT-01, 09
  previewImport(file: Blob): Promise<Result<PendingImport, DataError>>;   // RF-41, RN-DAT-02, 05, 11, 12, 13
}

interface PendingImport {
  preview: ImportPreview;
  commit: () => Promise<Result<void, DataError>>;   // RN-DAT-03, 04, 05, 10; una segunda llamada rechaza. Propiedad, no método (se pasa a la UI)
}

interface ImportPreview {                // RN-DAT-13
  exportedAt: Instant;
  schemaVersion: number;
  completedWorkouts: number;
  doneSets: number;                      // series hechas de las sesiones completed
  painEntries: number;
  dateRange: { from: LocalDate; to: LocalDate } | null;   // date de las completed
  hasActiveWorkout: boolean;             // el archivo trae un in_progress
  programStartDate: LocalDate;
  currentCompletedWorkouts: number;      // completed que hay hoy en el dispositivo
}
```

`previewImport` junta los `facts` de `describe` de cada puerto y el `current()` local (spec 007 plan §6.3). Los datos validados viven dentro de `commit`, que no se puede llamar con una vista previa inventada. La transacción sobre las tablas de todos los puertos la abre `data` con `db`. `onImported` (para `progression.rebuild()`) vuelve en la fase 4.

## 6. Reglas de negocio

| ID | Regla | Origen |
|---|---|---|
| RN-DAT-01 | La exportación incluye siempre `schemaVersion`, `exportedAt` y la versión de cada módulo. | RNF-09 |
| RN-DAT-02 | **Revisar un archivo**, en este orden, y el primer fallo gana: tamaño ≤ 10 MB sin leerlo (`data/file-too-large`); JSON válido con `app === 'gym-app'` (`data/not-gym-app-file`); `schemaVersion` y la versión de cada módulo ≤ las actuales (`data/unsupported-version`); el sobre con exactamente los módulos registrados; cada parte se migra desde su versión y se valida con su puerto, en orden de `order` (`data/invalid-module-data` con `details.module` y la causa); sin sesión en curso local (`data/workout-in-progress`). Nada se escribe al revisar. | RF-41, RNF-10, spec 007 |
| RN-DAT-03 | `commitImport` es todo o nada: una transacción; si un puerto falla, no cambia nada. | P-2 |
| RN-DAT-04 | El orden de importación sigue `order` ascendente. | spec §8.9 |
| RN-DAT-05 | Restaurar no se permite si en el dispositivo hay un workout `in_progress`: se comprueba al revisar y otra vez dentro de la transacción de `commitImport`. Exportar siempre se permite, también con una sesión en curso. | P-2, spec 007 |
| RN-DAT-08 | Exportar e importar es ida y vuelta exacta: `import(export(db))` produce una base equivalente, y exportarla otra vez da el mismo archivo salvo `exportedAt`. | CA-6, QS-04 |
| RN-DAT-09 | **Exportar** escribe todas las filas de cada tabla de cada puerto, tal como están guardadas, en un JSON con sangría de 2 espacios. `exportedAt` es `clock.now()`; el nombre es `gym-respaldo-<LocalDate de hoy>.json`. | RF-40, spec 007 |
| RN-DAT-10 | **Restaurar reemplaza todo:** dentro de una transacción `rw` sobre las tablas de todos los puertos, cada puerto vacía sus tablas y escribe las del archivo, en orden de `order`. Las tablas quedan exactamente con el contenido del archivo. | RF-41, spec 007 |
| RN-DAT-11 | **Referencias entre módulos:** un respaldo se rechaza si una serie apunta a un workout que no está, si un ítem de un workout o una serie usa un ejercicio que no está en el plan del archivo, o si una entrada de dolor apunta a un workout que no está. Se valida contra el contenido del archivo, no contra la base local. | P-2, spec 007 |
| RN-DAT-12 | **Datos tolerados:** al validar no se comprueban RN-TRN-27 ni RN-TRN-06: dos `completed` con el mismo `date` y un `completed` sin entrada de dolor se aceptan, como ya los muestra el historial. Lo que la app nunca tolera (dos `in_progress`, dos entradas de dolor por workout, ejercicios `high`) se rechaza. | spec 007 |
| RN-DAT-13 | **Vista previa** (`ImportPreview`): `exportedAt`, `schemaVersion`, sesiones `completed` y sus series hechas, entradas de dolor, rango de `date` de las `completed` (`null` sin ninguna), si trae un workout `in_progress`, `startDate` del programa y las sesiones `completed` que hay hoy en el dispositivo. | RF-41, P-2, spec 007 |

**Detalle de la revisión** (casos de borde, antes de T3 de la spec 007, decisión 3):

- Las funciones de la revisión son puras y reciben el texto del archivo y los puertos como `{ name, version }` ordenados por `order`, no los puertos enteros.
- **Paso 2, sobre** (forma con Zod, `infrastructure`, ADR-0012): es `data/not-gym-app-file` si el texto no es JSON, si no es un objeto, si `app ≠ 'gym-app'`, si tiene una clave de más, si `schemaVersion` no es entero ≥ 1, si `exportedAt` no es un `Instant` (`instantSchema`), si `modules` no es un objeto o si un módulo no es `{ version: entero ≥ 1, data }`.
- **Paso 3, versiones:** `schemaVersion > 1`, o la versión de un módulo **registrado** mayor que la de su puerto → `data/unsupported-version` con `details: { module: string | null, version, supported }` (`module: null` para `schemaVersion`). Un módulo no registrado no se mira aquí: lo atrapa el paso 4.
- **Paso 4, módulos:** si las claves de `modules` no son exactamente los puertos registrados → `data/invalid-module-data` con `module: null`, `cause: 'data/module-mismatch'` y `details: { missing, unexpected }` (nombres, en orden de puertos y del archivo).
- **Paso 6, referencias:** se devuelve la primera rota: en orden de puertos, luego por tipo en el orden de su `requires` y luego por ID en el orden del arreglo. Un puerto puede ofrecer lo que él mismo requiere. Un tipo que nadie ofrece está roto.
- **Vista previa:** cada cifra la aporta un solo puerto (una clave con valor distinto de `undefined`). Si dos la aportan, o si falta `programStartDate`, `buildPreview` lanza: es un error de composición. `currentCompletedWorkouts` sale de `LocalFacts` (0 si nadie la da). `hasActiveWorkout` de la vista previa es el del archivo; el local solo decide el paso 7.

**Detalle del servicio** (casos de borde, antes de T11 de la spec 007, decisión 4):

- **Puertos:** `registerDataPort` lanza con un `name` o un `order` repetido; se pueden registrar en cualquier orden y se usan ordenados por `order`. Sin puertos, `exportAll` y `previewImport` lanzan (error de composición).
- **Exportar:** una transacción `r` sobre la unión de las tablas de todos los puertos; JSON con sangría de 2 y un salto de línea al final; `Blob` de tipo `application/json`; `exportedAt = clock.now()` y el nombre con `clock.today()`.
- **Leer el archivo:** `size ≤ 10 × 1024 × 1024` bytes pasa (un byte más no) y se lee con `file.text()`. Si la lectura falla, la promesa rechaza (ADR-0010).
- **Fallos que son bugs:** si un `validate` o un `importData` lanza, la promesa rechaza; no es un `Result`. En `commit()`, eso aborta la transacción y no cambia nada.
- **`commit()`:** una transacción `rw` sobre la unión de las tablas; dentro, `current()` de cada puerto (solo RN-DAT-05: cualquier otro cambio desde la vista previa da igual, porque se reemplaza todo) e `importData` en orden. Se puede llamar una sola vez: la segunda llamada rechaza, también si la primera no ha terminado.

RN-DAT-06 (recordatorio de respaldo, RF-42) y RN-DAT-07 (`wipeAll`, RF-43) salen del contrato hasta su spec; sus IDs no se reutilizan.

## 7. Errores

`data/file-too-large`, `data/not-gym-app-file` (no es JSON o el sobre no tiene la forma de §4), `data/unsupported-version`, `data/invalid-module-data` (`InvalidModuleDataDetails`: `module`, `cause` y los `details` del puerto, por ejemplo `plan/high-risk-exercise`), `data/workout-in-progress`. `data/wrong-confirmation` entra con RF-43.

Un fallo de la base al leer o escribir no es un `Result`: la promesa rechaza y lo muestra el aviso genérico (ADR-0010), como RN-TRN-18 y RN-HLT-16.

## 8. Pruebas

- QS-04: base con datos de prueba → exportar → base vacía → importar → comparación profunda (RN-DAT-08).
- Import con `training` inválido → nada cambia (ni siquiera `plan`) (RN-DAT-03).
- Un puerto que lanza a mitad de `commit()` → nada cambia.
- Cada error de RN-DAT-02 en su orden, con un archivo que falla en dos puntos a la vez.
- Referencias rotas (RN-DAT-11) y datos tolerados (RN-DAT-12).
- `schemaVersion` o versión de módulo mayor que la actual → `data/unsupported-version`. La migración desde una versión anterior se prueba cuando exista una versión 2.

## 9. Trazabilidad

RF-40 (parte JSON), RF-41, RNF-09, RNF-10, CA-6. Más adelante: RF-40 (CSV), RF-42, RF-43.

## 10. Decisiones (19-nov-2026)

1. **Spec 007, respaldo (contrato v1.1):** el contrato se recorta a lo que entra en la spec 007: sin `dataMeta`, `exportCsv`, `wipeAll` ni `getBackupStatus`; tres puertos (`plan`, `training`, `health`); RN-DAT-02 y 05 sin `[PROPUESTO]` (10 MB; restaurar bloqueado con una sesión en curso, exportar siempre); restaurar reemplaza todo (RN-DAT-10); referencias entre módulos validadas sobre el archivo (RN-DAT-11); datos tolerados (RN-DAT-12); vista previa (RN-DAT-13). Las firmas exactas las fija el plan técnico.
2. **Plan de la spec 007 (contrato v1.2):** `DataPort` gana `describe` y `current` y pierde `wipe`; `createData({ db, clock })` sin `TransactionRunner`, `DataDb` ni `onImported`; `previewImport` devuelve un `PendingImport` con `commit()` en lugar de `commitImport(preview)`; `registerDataPort` lanza con un nombre u orden repetido; el plan va como `program` (RN-PLN-29); `InvalidModuleDataDetails`. Orden de la revisión: spec 007 plan §6.9.
3. **Casos de borde de la revisión, antes de T3 de la spec 007 (contrato v1.3, 19-nov-2026):** entradas de las funciones puras, qué es un sobre inválido, `details` de versiones y de módulos que faltan o sobran (`data/module-mismatch`), orden de la primera referencia rota, y que `buildPreview` lance si dos puertos aportan la misma cifra (§6, "Detalle de la revisión"). El sobre se valida con Zod en `infrastructure` (ADR-0012), como el esquema del seed; versiones, módulos, referencias y vista previa son dominio.
4. **Casos de borde del servicio, antes de T11 de la spec 007 (contrato v1.4, 19-nov-2026):** registro y orden de los puertos, sin puertos lanza, transacciones sobre la unión de tablas, formato del archivo, límite exacto de 10 MB, lectura solo con `file.text()` (en jsdom `new Response(file)` da `"[object File]"`, así que no sirve de respaldo), fallos de puertos como rechazo y `commit()` de una sola vez (§6, "Detalle del servicio").
