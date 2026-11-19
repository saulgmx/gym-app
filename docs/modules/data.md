# Contrato del módulo `data`

**Versión del contrato:** 1.1 · **Depende de:** `shared` · **Lo usan:** `app`

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
  exportData(): Promise<T>;
  validate(raw: unknown, fromVersion: number): Result<T>;   // migra y valida con Zod y las reglas del módulo
  importData(data: T): Promise<void>;   // reemplaza todo el contenido del módulo; se llama dentro de la transacción
  wipe(): Promise<void>;
  csv?(): Promise<{ filename: string; content: string }>;   // training aporta las series (spec futura del CSV)
}
```

La firma de `validate` puede cambiar en el plan técnico de la spec 007 para que un puerto vea las partes ya validadas de los anteriores (RN-DAT-11) sin romper las fronteras.

En la spec 007 hay tres puertos: `plan`, `training` y `health`. El de `progression` (solo `progressionSettings`; las `suggestions` son derivadas y se reconstruyen con `rebuild()`) y el de `app` (`uiPreferences`) entran cuando esos módulos tengan datos.

## 4. Formato de exportación

```json
{
  "app": "gym-app",
  "schemaVersion": 1,
  "exportedAt": "2026-11-19T22:30:00-06:00",
  "modules": {
    "plan":     { "version": 1, "data": { "exercises": [], "programs": [], "blocks": [], "templates": [] } },
    "training": { "version": 1, "data": { "workouts": [], "sets": [] } },
    "health":   { "version": 1, "data": { "painEntries": [] } }
  }
}
```

- JSON con sangría de 2 espacios. Nombre: `gym-respaldo-<LocalDate de hoy>.json`, tipo `application/json`.
- `modules` tiene exactamente un elemento por puerto registrado. La forma exacta de cada `data` la fija el plan técnico; las filas son los objetos del dominio tal como están guardados.
- CSV de series (spec futura, RF-40): `date,workoutId,exercise,setNumber,weightKg,reps,rir,isExtra,completedAt`, UTF-8 con BOM para que Excel lo abra bien.

## 5. API pública (`index.ts`)

```ts
export function createData(deps: { db: DataDb; clock: Clock; transaction: TransactionRunner; onImported: () => Promise<void> }): DataApi;

interface DataApi {
  registerDataPort(port: DataPort): void;
  exportAll(): Promise<{ filename: string; blob: Blob }>;           // RF-40, RN-DAT-01, 09
  previewImport(file: File): Promise<Result<ImportPreview, DataError>>;   // RF-41, RN-DAT-02, 05, 13
  commitImport(preview: ImportPreview): Promise<Result<void, DataError>>; // RN-DAT-03, 04, 05, 10
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

Los nombres exactos, cómo `previewImport` obtiene las cifras de cada módulo sin conocerlos, dónde guarda los datos validados para `commitImport` y si `exportAll` devuelve un `Blob` o un `File` los fija el plan técnico de la spec 007. `onImported` no hace nada hasta la fase 4, cuando `compose.ts` lo conecte a `progression.rebuild()`. `TransactionRunner` lo aporta `app/db.ts` para ejecutar todo el import en una transacción sobre las tablas de todos los puertos; sin `dataMeta`, `DataDb` puede no hacer falta (lo decide el plan).

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

RN-DAT-06 (recordatorio de respaldo, RF-42) y RN-DAT-07 (`wipeAll`, RF-43) salen del contrato hasta su spec; sus IDs no se reutilizan.

## 7. Errores

`data/file-too-large`, `data/not-gym-app-file`, `data/unsupported-version`, `data/invalid-module-data` (con `details.module` y la causa: la ruta Zod o el código de error del módulo, por ejemplo `plan/high-risk-exercise`), `data/workout-in-progress`. `data/wrong-confirmation` entra con RF-43.

Un fallo de la base al leer o escribir no es un `Result`: la promesa rechaza y lo muestra el aviso genérico (ADR-0010), como RN-TRN-18 y RN-HLT-16.

## 8. Pruebas

- QS-04: base con datos de prueba → exportar → base vacía → importar → comparación profunda (RN-DAT-08).
- Import con `training` inválido → nada cambia (ni siquiera `plan`) (RN-DAT-03).
- Un puerto que lanza a mitad de `commitImport` → nada cambia.
- Cada error de RN-DAT-02 en su orden, con un archivo que falla en dos puntos a la vez.
- Referencias rotas (RN-DAT-11) y datos tolerados (RN-DAT-12).
- `schemaVersion` o versión de módulo mayor que la actual → `data/unsupported-version`. La migración desde una versión anterior se prueba cuando exista una versión 2.

## 9. Trazabilidad

RF-40 (parte JSON), RF-41, RNF-09, RNF-10, CA-6. Más adelante: RF-40 (CSV), RF-42, RF-43.

## 10. Decisiones (19-nov-2026)

1. **Spec 007, respaldo (contrato v1.1):** el contrato se recorta a lo que entra en la spec 007: sin `dataMeta`, `exportCsv`, `wipeAll` ni `getBackupStatus`; tres puertos (`plan`, `training`, `health`); RN-DAT-02 y 05 sin `[PROPUESTO]` (10 MB; restaurar bloqueado con una sesión en curso, exportar siempre); restaurar reemplaza todo (RN-DAT-10); referencias entre módulos validadas sobre el archivo (RN-DAT-11); datos tolerados (RN-DAT-12); vista previa (RN-DAT-13). Las firmas exactas las fija el plan técnico.
