# Contrato de `shared` (shared kernel) y componentes de UI

**Depende de:** nada del proyecto · **Lo usan:** todos

## 1. Regla de oro

`shared` contiene **tipos, utilidades y componentes genéricos sin lógica de negocio**. Si algo menciona ejercicios, series, dolor o planes, no va aquí. Cada adición a `shared` se pregunta: "¿lo usarían 2 o más módulos y es independiente del gimnasio?".

## 2. `shared/kernel`

```ts
type ID = string & { readonly __brand: 'ID' };            // UUIDv7 (ADR-0009)
type LocalDate = string & { readonly __brand: 'LocalDate' };  // 'YYYY-MM-DD'
type Instant = string & { readonly __brand: 'Instant' };      // ISO 8601 con offset
type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;                     // 0 = domingo (como Date.getDay)

interface Clock { now(): Instant; today(): LocalDate }
interface IdGenerator { next(): ID }

type Result<T, E extends DomainError = DomainError> = { ok: true; value: T } | { ok: false; error: E };
interface DomainError<C extends string = string> { code: C; message: string; details?: unknown }  // message: técnico, solo logs (ADR-0010)
const ok: <T>(value: T) => Result<T, never>;
const err: <E extends DomainError>(error: E) => Result<never, E>;

// Fechas
function daysBetween(a: LocalDate, b: LocalDate): number;  // b − a en días (positivo si b es posterior)
function addDays(d: LocalDate, n: number): LocalDate;      // n puede ser negativo
function startOfIsoWeek(d: LocalDate): LocalDate;           // lunes
function weekdayOf(d: LocalDate): Weekday;
function compareInstants(a: Instant, b: Instant): number;  // < 0, 0 o > 0 (como Array.sort); nunca comparar Instant como string

// Números (resultados sin ruido de coma flotante: 0.1 + 0.2 con paso 0.1 → 0.3)
function roundToStep(value: number, step: number): number;  // al múltiplo más cercano; la mitad sube (61.25, 2.5 → 62.5)
function floorToStep(value: number, step: number): number;  // al múltiplo inferior
function kgToLb(kg: number): number;  // 1 lb = 0.45359237 kg exacto; redondeado a 2 decimales
function lbToKg(lb: number): number;  // ídem

// Exportación: contrato que implementa cada módulo con datos (ver modules/data.md §3)
interface DataPort<T = unknown> { /* name, version, order, tables, exportData, validate, importData, wipe, csv? */ }

// Implementaciones de producción
const systemClock: Clock;  // now(): Instant con el offset local; today(): LocalDate local
function createUuidV7Generator(opts?: {
  now?: () => number;                     // ms desde epoch; por defecto Date.now
  random?: (bytes: Uint8Array) => void;   // por defecto crypto.getRandomValues
}): IdGenerator;                          // RFC 9562, monótono por dispositivo (ADR-0009)

// Pruebas
function fixedClock(now: string): Clock;                 // today() = fecha del propio string, sin depender de la zona de la máquina
function sequentialIds(prefix?: string): IdGenerator;    // 'id-0001', 'id-0002'…: el orden del string coincide con el de creación
```

## 3. `shared/events`

```ts
export interface DomainEvents {}    // cada módulo lo amplía en su events.ts

export interface EventBus {  // propiedades función: no usan `this`, se pueden pasar sueltas
  publish: <K extends keyof DomainEvents>(type: K, payload: DomainEvents[K]) => void;
  subscribe: <K extends keyof DomainEvents>(type: K, handler: (p: DomainEvents[K]) => void | Promise<void>) => () => void;
}
export function createEventBus(opts?: { onError?: (e: unknown, type: string) => void }): EventBus;
```

Reglas:

- Entrega asíncrona (microtarea): `publish` nunca ejecuta un handler de forma síncrona.
- Destinatarios: los suscritos al momento de `publish`, excepto los que se desuscriban antes de la entrega (como `EventTarget`).
- Cada handler corre en su propia microtarea, en orden de suscripción, sin esperar a los demás: un handler `async` lento no retrasa al resto.
- Un handler que falla (lanza o devuelve una promesa rechazada) no afecta a los demás ni al publicador; el error va a `onError(error, type)`. Por omisión, `onError` hace `console.error('[events] <type>', error)`.
- `subscribe` devuelve la función para desuscribirse.

En pruebas, `createEventBus` más `await flushEvents()`, exportado solo desde `@/shared/events/testing` (nunca desde la entrada pública). `flushEvents(): Promise<void>` espera a que terminen todos los handlers pendientes de cualquier bus creado en la prueba, incluidos los eventos que esos handlers publiquen en cascada.

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
| `tokens.css` | Variables de spec §7.4: colores `--bg`, `--surface`, `--surface-2`, `--border`, `--text`, `--text-muted`, `--accent`, `--warn`; `--font-heading` (Space Grotesk), `--font-body` (Inter); `--radius-input` (0.75rem), `--radius-button` (1rem), `--radius-card` (1.25rem); `--touch-min` (2.75rem = 44 px). Único archivo con colores literales (stylelint) |
| `fonts.css` | `@font-face` autoalojados, solo subconjunto latino, `font-display: swap` |
| `cx(...classes)` | Une clases de CSS Modules en un `string`, ignorando `undefined`, `null` y `false` (ver abajo) |
| `base.css` | Estilos globales: tema oscuro, `rem`, foco visible con `--accent`, movimiento reducido |

```ts
function cx(...classes: (string | false | null | undefined)[]): string;
// cx('a', undefined, false && 'b', 'c') → 'a c'; cx() → ''
```

Vite tipa cada CSS Module como un índice de strings, así que con `noUncheckedIndexedAccess` cada clase es `string | undefined`, y con `exactOptionalPropertyTypes` no encaja en props que exigen `string` (por ejemplo `NavLink`). `cx` siempre devuelve `string` y sirve también para clases condicionales. No detecta erratas en nombres de clase; eso lo cubren las pruebas de componente y E2E (decisión del 17-nov-2026, T15).

Los componentes se importan desde `@/shared/ui` (su `index.ts`); las hojas globales `.css` se importan una sola vez desde `app/main.tsx`.

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
