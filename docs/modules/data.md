# Contrato del módulo `data`

**Versión del contrato:** 1.0 · **Depende de:** `shared` · **Lo usan:** `app`

## 1. Responsabilidad

Exportar e importar todos los datos (JSON), exportar las series a CSV, recordar respaldos y borrar todo. No conoce los módulos: trabaja con los `DataPort` que `app/compose.ts` le registra.

## 2. Datos propios

| Tabla | Clave | Contenido |
|---|---|---|
| `dataMeta` | `id` (`'singleton'`) | `lastExportAt`, `lastImportAt`, `persistGranted` [PROPUESTO] |

## 3. Contrato `DataPort`

La interfaz vive en `shared/kernel/data-port.ts` (no en `data`), porque cada módulo la implementa y ningún módulo puede importar `data`.

```ts
export interface DataPort<T = unknown> {
  name: string;                         // 'plan', 'training', 'health', 'progression', 'app'
  version: number;                      // versión del formato de exportación de este módulo
  order: number;                        // orden de importación: plan 10, training 20, health 30, progression 35, app 40
  tables: string[];                     // tablas Dexie que toca (para la transacción única)
  exportData(): Promise<T>;
  validate(raw: unknown, fromVersion: number): Result<T>;   // migra y valida con Zod
  importData(data: T): Promise<void>;   // reemplaza todo el contenido del módulo; se llama dentro de la transacción
  wipe(): Promise<void>;
  csv?(): Promise<{ filename: string; content: string }>;   // training aporta las series
}
```

El `DataPort` de `progression` exporta solo `progressionSettings`. Las `suggestions` son derivadas: no se exportan y se reconstruyen con `rebuild()` tras importar [PROPUESTO].

## 4. Formato de exportación

```json
{
  "app": "gym-app",
  "schemaVersion": 1,
  "exportedAt": "2026-11-16T22:30:00-06:00",
  "modules": {
    "plan":     { "version": 1, "data": { "exercises": [], "programs": [], "blocks": [], "templates": [] } },
    "training": { "version": 1, "data": { "workouts": [], "sets": [] } },
    "health":   { "version": 1, "data": { "painEntries": [], "bodyMetrics": [], "settings": {} } },
    "progression": { "version": 1, "data": { "settings": {} } },
    "app":      { "version": 1, "data": { "uiPreferences": {} } }
  }
}
```

CSV de series (RF-40): `date,workoutId,exercise,setNumber,weightKg,reps,rir,isExtra,completedAt`, UTF-8 con BOM para que Excel lo abra bien.

## 5. API pública (`index.ts`)

```ts
export function createData(deps: { db: DataDb; clock: Clock; transaction: TransactionRunner; onImported: () => Promise<void> }): DataApi;

interface DataApi {
  registerDataPort(port: DataPort): void;
  exportAll(): Promise<{ filename: string; blob: Blob }>;           // RF-40, RF-42
  exportCsv(): Promise<{ filename: string; blob: Blob } | null>;
  previewImport(file: File): Promise<Result<ImportPreview>>;        // RF-41
  commitImport(preview: ImportPreview): Promise<Result<void>>;
  wipeAll(confirmation: 'BORRAR'): Promise<Result<void>>;           // RF-43
  getBackupStatus(): Promise<{ lastExportAt: Instant | null; reminderDue: boolean }>;  // RF-42
}

interface ImportPreview {
  exportedAt: Instant; schemaVersion: number;
  counts: Record<string, number>;       // por tabla
  dateRange: { from: LocalDate; to: LocalDate } | null;
  warnings: string[];
}

export { BackupReminder, ImportDialog } from './ui';
```

`onImported` lo conecta `compose.ts` a `progression.rebuild()`. `TransactionRunner` lo aporta `app/db.ts` para ejecutar todo el import en una transacción sobre las tablas de todos los puertos.

## 6. Reglas de negocio

| ID | Regla | Origen |
|---|---|---|
| RN-DAT-01 | La exportación incluye siempre `schemaVersion`, `exportedAt` y la versión de cada módulo. | RNF-09 |
| RN-DAT-02 | Importar: archivo ≤ 10 MB [PROPUESTO]; `app === 'gym-app'`; cada parte se migra a su versión actual y se valida con Zod antes de escribir nada. | RF-41, RNF-10 |
| RN-DAT-03 | `commitImport` es todo o nada: una transacción; si un puerto falla, no cambia nada. | P-2 |
| RN-DAT-04 | El orden de importación sigue `order` ascendente. | spec §8.9 |
| RN-DAT-05 | Importar no se permite con un workout `in_progress` [PROPUESTO]. | P-2 |
| RN-DAT-06 | Recordatorio de respaldo si `lastExportAt` es nulo o tiene más de 30 días y hay al menos un workout. | RF-42 |
| RN-DAT-07 | `wipeAll` exige la confirmación literal y borra todas las tablas, salvo que el usuario vuelva a cargar el seed. | RF-43 |
| RN-DAT-08 | Exportar e importar es ida y vuelta exacta: `import(export(db))` produce una base equivalente. | CA-6, QS-04 |

## 7. Errores

`data/file-too-large`, `data/not-gym-app-file`, `data/unsupported-version`, `data/invalid-module-data` (con `details.module` y la ruta Zod), `data/workout-in-progress`, `data/wrong-confirmation`.

## 8. Pruebas

- QS-04: base con datos de prueba → exportar → base vacía → importar → comparación profunda.
- Import con `training` inválido → nada cambia (ni siquiera `plan`).
- JSON de versión 1 importado tras subir a versión 2 → se migra.

## 9. Trazabilidad

RF-40 a RF-43, RNF-09, RNF-10, CA-6.
