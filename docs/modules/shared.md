# Contrato de `shared` (shared kernel) y componentes de UI

**Depende de:** nada del proyecto · **Lo usan:** todos

## 1. Regla de oro

`shared` contiene **tipos, utilidades y componentes genéricos sin lógica de negocio**. Si algo menciona ejercicios, series, dolor o planes, no va aquí. Cada adición a `shared` se pregunta: "¿lo usarían 2 o más módulos y es independiente del gimnasio?".

## 2. `shared/kernel`

```ts
type ID = string & { readonly __brand: 'ID' };            // ULID (ADR-0009)
type LocalDate = string & { readonly __brand: 'LocalDate' };  // 'YYYY-MM-DD'
type Instant = string & { readonly __brand: 'Instant' };      // ISO 8601 con offset
type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;                     // 0 = domingo (como Date.getDay)

interface Clock { now(): Instant; today(): LocalDate }
interface IdGenerator { next(): ID }

type Result<T, E extends DomainError = DomainError> = { ok: true; value: T } | { ok: false; error: E };
interface DomainError { code: string; message: string; details?: unknown }
const ok: <T>(value: T) => Result<T, never>;
const err: <E extends DomainError>(error: E) => Result<never, E>;

// Fechas
function daysBetween(a: LocalDate, b: LocalDate): number;
function addDays(d: LocalDate, n: number): LocalDate;
function startOfIsoWeek(d: LocalDate): LocalDate;           // lunes
function weekdayOf(d: LocalDate): Weekday;

// Números
function roundToStep(value: number, step: number): number;
function floorToStep(value: number, step: number): number;
function kgToLb(kg: number): number;
function lbToKg(lb: number): number;

// Exportación: contrato que implementa cada módulo con datos (ver modules/data.md §3)
interface DataPort<T = unknown> { /* name, version, order, tables, exportData, validate, importData, wipe, csv? */ }

// Pruebas
function fixedClock(now: string): Clock;
function sequentialIds(prefix?: string): IdGenerator;
```

## 3. `shared/events`

```ts
export interface DomainEvents {}    // cada módulo lo amplía en su events.ts

export interface EventBus {
  publish<K extends keyof DomainEvents>(type: K, payload: DomainEvents[K]): void;
  subscribe<K extends keyof DomainEvents>(type: K, handler: (p: DomainEvents[K]) => void | Promise<void>): () => void;
}
export function createEventBus(opts?: { onError?: (e: unknown, type: string) => void }): EventBus;
```

Reglas: entrega asíncrona (microtarea), un handler que falla no afecta a los demás ni al publicador, `subscribe` devuelve la función para desuscribirse. En pruebas, `createEventBus` más `await flushEvents()` [PROPUESTO].

## 4. `shared/ui`

Componentes genéricos, accesibles y con objetivo táctil ≥ 44 px.

| Componente | Propósito |
|---|---|
| `Button` | Variantes `primary`, `secondary`, `ghost`; `aria-label` obligatorio si es solo icono |
| `IconButton` | Botón cuadrado de 44 px |
| `NumberField` | `<input>` con `inputmode`, `label`, pasos y teclado numérico |
| `Dialog`, `ConfirmDialog` | `<dialog>` nativo con foco atrapado |
| `ChipSelect` | Selección única con chips (RF-31 selector de ejercicio) |
| `Chart` | Envoltorio de uPlot (ADR-0004) con tabla alternativa accesible |
| `StatCard` | Valor + etiqueta |
| `SafetyNote` | Caja de aviso con `--warn` |
| `tokens.css` | Variables de spec §7.4 |

## 5. Dónde vive cada componente de la spec §7.5

| Componente | Ubicación | Motivo |
|---|---|---|
| `TabBar` | `app/` | Navegación de la app |
| `WeekStrip` | `plan/ui` | Muestra el calendario del plan |
| `ExerciseRow` | `app/pages` (composición) | Combina ejercicio (`plan`) y sugerencia (`progression`) |
| `SuggestionBanner` | `progression/ui` | |
| `SetRow`, `SetTable`, `RestTimer` | `training/ui` | |
| `PainSelector`, `RedFlagsChecklist` | `health/ui` | |
| `StatCard`, `Chart`, `ChipSelect`, `SafetyNote`, `ConfirmDialog` | `shared/ui` | Genéricos |
