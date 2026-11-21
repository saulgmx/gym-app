# Plan técnico: Temporizador de descanso

**Spec:** `specs/009-temporizador/spec.md` · **Estado:** Aprobado · **Fecha:** 20-nov-2026

Contratos actualizados al aprobar (20-nov), antes del código: `training.md` v1.36 (§4: `restTimer`, `restSignal`, `RestTimer`, formatos y tipos; decisión 38) y `architecture.md` §7.2 (el Wake Lock no escucha eventos). Ver §3.

## 1. Resumen de la solución

`training` calcula el descanso con una función pura de su dominio (`restOf`, RN-TRN-32 a 34) a partir de la última serie hecha, el `restSeconds` de su ejercicio, `now` y un ajuste opcional atado al `setId` de su serie. Otra función pura (`restSignal`, RN-TRN-35) decide los tonos y los anuncios al comparar dos lecturas. `training/ui` pone la tarjeta (`RestTimer`, solo presentación). `app` la cablea en el pie de la sesión (`RestSlot`): el tic de 250 ms, los ajustes en Zustand (`useSessionStore`), el tono con Web Audio (`RestSound`), la pantalla encendida (`ScreenWake`), la región de estado y el foco.

Sin tablas, índices ni migración: la base sigue en la v3 (AC-33). Sin dependencias nuevas.

## 2. Módulos afectados

| Módulo | Cambio | ¿Cambia el contrato? |
|---|---|---|
| `training` | `domain/rest.ts` (puras: `restOf`, `restSignal`); `application/rest.ts` (`restTimer`, lee `restSeconds` de la vista); `ui/RestTimer.tsx` y su CSS; `formatRestTime` y `formatRestRange` en `ui/format.ts` | Sí: `modules/training.md` v1.36 §4 |
| `app` | `session-store.ts` (`useSessionStore`); `rest-sound.ts` (`RestSound`); `wake-lock.ts` (`ScreenWake`); hooks `useRestTimer`, `useDocumentVisible`, `useScreenWakeWhile`; `RestSlot`; el pie pasa a un contenedor con `RestSlot` y el `<nav>`; `onClickCapture` en la sesión; `AppServices` con `restSound` y `screenWake` | No (no es un módulo); `architecture.md` §7.2 |
| `plan`, `health`, `progression`, `data`, `shared` | Ninguno | No |

## 3. Cambios de contrato

**`training` (v1.36, §4).** Reemplaza el comentario "RestTimer y el descanso (RN-TRN-32 a 35): firma en el plan de la spec 009":

```ts
// Descanso (RN-TRN-32 a 35, spec 009). El dominio (restOf) recibe restSeconds como función, como
// progressOf; application lo arma con view.exercises.
interface RestAdjustment { setId: ID; offsetSeconds: number; skipped: boolean } // RN-TRN-34; se ignora si setId no es la serie de referencia
interface RestState {
  setId: ID;                        // serie de referencia (RN-TRN-32)
  phase: 'resting' | 'ready';       // RN-TRN-33
  remainingSeconds: number;         // entero, hacia arriba; hasta minAt (resting) o maxAt (ready)
  range: [number, number];          // restSeconds sin ajustes, para "Rango 2:00–3:00"
}
interface RestSignal { tones: 0 | 1 | 2; announce: 'ready' | 'ended' | null } // RN-TRN-35

export function restTimer(view: WorkoutView, now: Instant, adjustment: RestAdjustment | null): RestState | null; // application/rest.ts; lanza si el ejercicio no está en la vista (§6.4 de la spec)
export function restSignal(prev: RestState | null, next: RestState | null, byTime: boolean): RestSignal;       // domain/rest.ts, pura
export function formatRestTime(seconds: number): string;          // 120 → "2:00", 36 → "0:36"
export function formatRestRange(range: [number, number]): string; // [120, 180] → "2:00–3:00" (guion U+2013)

function RestTimer(props: {
  rest: RestState;
  onShift: (seconds: 15 | -15) => void;
  onSkip: () => void;
}): JSX.Element;
export { RestTimer } from './ui';
```

Se añade a §4 una sección `RestTimer` con lo de §6.6 de este plan, y la decisión 38 en §10. RN-TRN-32 a 35 no cambian.

**`architecture.md` §7.2:** la fila `training/WorkoutStarted` deja de listar "app (Wake Lock, v1.0)" como consumidor: el Wake Lock depende del descanso, que `app` ya calcula, y no de un evento (P-7). §7.8 ya dice lo que hace este plan.

## 4. Datos

- Sin tablas, índices ni versión de Dexie nuevos: la base sigue en la v3 (AC-33).
- Sin cambio en el respaldo JSON (la versión del puerto de `training` sigue en 1) ni en el CSV (`CSV_VERSION` sigue en 1).
- Los ajustes viven solo en memoria (`useSessionStore`) y se pierden al recargar (AC-25).

## 5. Flujo

```mermaid
sequenceDiagram
  actor U as Usuario
  participant P as SessionPage (app)
  participant ST as SetTable (training/ui)
  participant T as training
  participant R as RestSlot (app)
  participant A as RestSound / ScreenWake (app)
  U->>P: toca el check de la serie
  P->>A: onClickCapture → restSound.unlock()
  P->>ST: click
  ST->>T: toggleSetDone(setId) (Dexie, completedAt)
  T-->>R: useWorkoutView trae la vista nueva
  R->>T: restTimer(view, now, ajuste) (pura)
  R->>T: restSignal(prev, next, byTime=false)
  R->>A: useScreenWakeWhile(true) → request('screen')
  loop cada 250 ms con la página visible
    R->>T: restTimer(view, clock.now(), ajuste)
    R->>T: restSignal(prev, next, byTime=true)
    alt resting → ready
      R->>A: play(1); anuncia "Ya puedes hacer la siguiente serie."
    else ready → sin descanso
      R->>A: play(2); anuncia "Descanso terminado."; suelta el Wake Lock
    end
  end
```

## 6. Decisiones

### 6.1 Función del dominio (paso 1, aprobado)

`restOf(state: WorkoutState, restSeconds: (exerciseId: ID) => [number, number], now: Instant, adjustment: RestAdjustment | null): RestState | null` en `domain/rest.ts`, y `restTimer(view, now, adjustment)` en `application/rest.ts`, que la arma con `view.exercises`, como `progressOf` y `workoutProgress`. El dominio no importa `plan` (architecture §5.2).

- **El ajuste lleva el `setId`** de la serie en la que se hizo. Si no coincide con la serie de referencia actual, `restOf` lo ignora (offset 0, sin salto). Así el "se reinicia" de RN-TRN-34 es puro y se prueba en el dominio; el store no vigila cambios de la vista.
- Los instantes se comparan con `Date.parse` (ADR-0009). Si `now < completedAt`, se usa `now = completedAt` (AC-28).
- `remainingSeconds = ceil((límite − now) / 1000)`. Con la precisión de segundos de `Clock` y de `completedAt`, es un entero exacto.
- Desempate de RN-TRN-32: mismo `completedAt` → mayor `order` del ítem de la serie y luego mayor `setNumber`.
- "Sin serie pendiente" mira todas las series del workout (planificadas y extra), no solo las del ejercicio de referencia.
- Una serie de referencia cuyo ejercicio no está en la vista es un dato roto: `restTimer` lanza y lo maneja el límite de errores de la sesión (spec §6.4, RN-TRN-17).
- Se descartó exponer `minAt` y `maxAt` en `RestState`: nadie fuera del dominio los necesita (P-7).

### 6.2 Store y tic (paso 2, aprobado)

**`useSessionStore`** en `src/app/pages/session/session-store.ts`, el nombre de architecture §7.8:

```ts
interface SessionState {
  restAdjustment: RestAdjustment | null;
  shiftRest(setId: ID, seconds: 15 | -15): void; // si setId ≠ el guardado, parte de offset 0 y sin salto
  skipRest(setId: ID): void;
}
```

Es un store de módulo: sobrevive a ir a "Hoy" o al Cierre y volver (AC-11) y se pierde al recargar (AC-25). Nunca se limpia: un ajuste de una serie vieja se ignora solo (§6.1).

**`useRestTimer(view, clock)`** en `app`, usado solo por `RestSlot`:

- Cada 250 ms lee `clock.now()` y llama a `restTimer`. Si el resultado es igual al anterior (mismos campos), devuelve el mismo objeto y React no redibuja (AC-34, como `Elapsed`). Con 1 s, el cambio de fase y el tono podrían llegar casi 1 s tarde.
- El intervalo solo corre mientras hay descanso y la página está visible.
- Llama a `restSignal(prev, next, byTime)` en cada lectura nueva y aplica su resultado (tono y anuncio).
- `byTime = true` solo en un tic con la página visible, y si desde la lectura anterior no cambiaron ni la vista ni el ajuste. Una vista nueva (marcar, desmarcar, añadir o quitar una serie), un control o la vuelta a primer plano leen con `byTime = false`. Al montar, `prev = null`.

### 6.3 Tonos y anuncios: `restSignal` (paso 2, aprobado)

Función pura en `domain/rest.ts` (RN-TRN-35), con pruebas primero:

| `prev` → `next` (mismo `setId`) | `byTime` | Resultado |
|---|---|---|
| `resting` → `ready` | `true` | 1 tono, anuncia `ready` (AC-12) |
| `ready` → `null` | `true` | 2 tonos, anuncia `ended` (AC-14) |
| `resting` → `null` (`min = max`, RN-PLN-24 lo permite) | `true` | 2 tonos, anuncia `ended` |
| `resting` → `ready` | `false` (control o vuelta a primer plano) | sin tono, anuncia `ready` (AC-19, AC-26) |
| Cualquier otro: `setId` distinto, `prev = null`, `ready` → `resting` (AC-21), `→ null` sin `byTime` (Saltar, −15 s que termina, vuelta tardía, dato que cambió) | — | nada (AC-20, AC-22, AC-27) |

**Al volver de segundo plano ya en "Ya puedes" se anuncia sin tono** (confirmado el 20-nov): la spec solo pedía que no sonara, y el anuncio sigue la regla de "los cambios a `ready` se anuncian". Al volver después del máximo no hay anuncio.

Los textos ("Ya puedes hacer la siguiente serie.", "Descanso terminado.") los pone `app` en la región de estado; el dominio solo dice cuál.

### 6.4 Sonido: `RestSound` (paso 3, aprobado)

```ts
// src/app/rest-sound.ts
export interface RestSound {
  unlock(): void;           // crea o reanuda el AudioContext; solo dentro de un toque
  play(tones: 1 | 2): void; // en silencio si el contexto no está 'running'
}
export function createRestSound(): RestSound;
```

- `compose` lo crea y `AppServices` lo expone como `restSound`. Las pruebas de `app` pasan un falso que registra las llamadas.
- **Activación (opción A):** `onClickCapture` en el contenedor de la sesión (`SessionPage`) llama a `unlock()` con cualquier toque, incluido el que marca la serie (RN-TRN-35). El check sigue dentro de `SetTable` y su contrato no cambia. Después de una recarga, el sonido vuelve con cualquier toque. Espacio sobre el checkbox también dispara `click`. Se descartó una prop `onSetDone` en `SetTable` (cambia el contrato y solo cubre ese toque).
- **Tono:** `OscillatorNode` seno de 880 Hz, 150 ms, ganancia 0.3 con rampas de 10 ms al empezar y al terminar (sin "clic"). El doble tono es otro igual que empieza 250 ms después del primero (150 ms + 100 ms de pausa), programado con `currentTime`.
- Solo `AudioContext` sin prefijo (objetivo iOS 18+). El `AudioContext` se crea en el primer `unlock()`, no al cargar.
- Todo va en `try/catch` y falla en silencio: sin API, suspendido o en modo silencio, queda el aviso visual y el anuncio (AC-16, AC-38).
- Sin archivos de audio: nada en el precache ni en la CSP (`media-src` no hace falta, AC-32).
- **Música de fondo:** se verifica en el iPhone (tarea manual). Solo si el tono pausa la música se añade `navigator.audioSession.type = 'ambient'` en `unlock()` (spec §7, P-7).

### 6.5 Pantalla encendida: `ScreenWake` (paso 4, aprobado)

```ts
// src/app/wake-lock.ts
export interface ScreenWake {
  request(): Promise<{ release(): Promise<void> }>; // navigator.wakeLock.request('screen')
}
export const browserScreenWake: ScreenWake | null;  // null si no existe navigator.wakeLock
```

- `compose` lo pasa a `AppServices` como `screenWake`. Las pruebas usan un falso que cuenta peticiones y liberaciones, o `null` (AC-38).
- **`useScreenWakeWhile(active)`** en `app`, usado por `RestSlot` con `active = rest !== null`: un efecto que depende de `[active, visible]`. Con `active && visible` pide el lock; la limpieza lo suelta. Cubre el fin por tiempo, "Saltar", el "−15 s" que termina, salir de la sesión (`RestSlot` se desmonta) y cerrar o descartar (la página deja de mostrar la sesión) (AC-35, AC-36).
- **Vuelta a primer plano:** el navegador suelta el lock al ocultarse; cuando `visible` vuelve a `true`, se pide otra vez solo si el descanso sigue (AC-37).
- **Carrera:** si la petición se resuelve después de la limpieza, se suelta en cuanto llega (bandera `cancelled`).
- Un rechazo se ignora con `.catch(() => {})`, sin aviso ni error sin capturar (AC-38). En la PWA instalada, iOS lo soporta desde la 18.4.
- `active` es booleano: el tic de 250 ms no vuelve a disparar el efecto.
- **`useDocumentVisible()`** (`visibilitychange`) lo comparten `useRestTimer` y `useScreenWakeWhile`.

### 6.6 Tarjeta, pie, foco y región de estado (paso 5, aprobado)

**`RestTimer` (`training/ui`)**, solo presentación; no sabe de reloj, store ni sonido:

- Un `role="group"` cuyo nombre es su título (`aria-labelledby`), con `data-rest` y `data-phase="resting" | "ready"`.
- Fila 1: el título ("Descanso" o "Ya puedes") y debajo el tiempo (`formatRestTime`, Space Grotesk 700, `font-variant-numeric: tabular-nums`, sin región viva); a la derecha "Rango …" (`formatRestRange`) en `--text-muted`.
- Fila 2: "−15 s" (U+2212), "+15 s" y "Saltar": botones secundarios del mismo ancho, ≥ 44 px de alto, nombre accesible = texto visible, sin `aria-label`.
- CSS por `data-phase`: en `resting`, título en `--text-muted` y fondo `--surface`; en `ready`, título en `--accent` y borde de 1 px en `--accent`. Sin colores nuevos, barra ni animaciones.

**`RestSlot` (`app/pages/session`)** cablea `useRestTimer`, `useSessionStore`, `restSound.play`, `useScreenWakeWhile`, la región de estado y el foco. Es lo único que se redibuja cada segundo (AC-34).

**El pie:** el contenedor fijo deja de ser el `<nav aria-label="Ejercicios">` y pasa a un `<div>` con `RestSlot` arriba y el `<nav>` de siempre debajo, para que la tarjeta no quede dentro de la navegación. `RestSlot` siempre está montado y siempre renderiza un `<p role="status" className="visually-hidden">`; la tarjeta solo aparece con descanso.

**Altura reservada:** `.screen:has([data-rest])` sube el `padding-bottom` en una cantidad fija (unos 8.5 rem: tarjeta más hueco; el valor exacto se mide en la tarea). Solo CSS (`:has()` desde Safari 15.4). Se descartó medir con `ResizeObserver`: más código para una altura fija.

**Foco (spec §6.1):**

- `RestSlot` sabe si el foco está dentro de la tarjeta con `onFocus` y `onBlur` en su contenedor (después de desmontarla, el foco ya está en `body`).
- Si la tarjeta desaparece con el foco dentro, lo mueve al primer `input` de la fila `[data-current]` de `SetTable` (atributo del contrato: la siguiente serie sin hacer del ejercicio que se ve). Sin fila actual, al primer enlace del `<nav>` del pie ("Anterior" o "Siguiente"). Si el foco estaba en otra parte, no se mueve.

**"Hoy" y el Cierre** no montan `RestSlot` (AC-11).

### 6.7 Presupuesto del bundle

Dos funciones puras, un componente, tres hooks y dos servicios pequeños; sin dependencias ni archivos de audio. Se mide en la tarea de la página (AC-31). Partida: 177.49 kB gzip de 200 kB.

## 7. Estrategia de pruebas

Pruebas primero en `domain/rest.ts` (commit en rojo local, sin push). `training` no lo exige (P-5), pero la spec lo pide (§9).

| Criterio | Tipo de prueba | Archivo |
|---|---|---|
| RN-TRN-32 a 34: AC-1 a 9, 13, 17 a 21, 23, 28 (fase, tiempo, rango, referencia, desempate, sin pendientes, ajuste de otra serie ignorado, `min = max`) | Unitaria (dominio) | `modules/training/__tests__/rest.test.ts` |
| RN-TRN-35: tabla de §6.3 (AC-12, 14, 19 a 22, 26, 27) | Unitaria (dominio) | `modules/training/__tests__/rest.test.ts` |
| `restTimer` con la vista (alternativa elegida AC-4, ejercicio que falta lanza) | Unitaria (application) | `modules/training/__tests__/rest.test.ts` |
| `formatRestTime`, `formatRestRange` | Unitaria | `modules/training/__tests__/format.test.ts` |
| `RestTimer`: textos, `data-phase`, nombres de los botones, callbacks | Componente | `modules/training/__tests__/rest-timer.test.tsx` |
| `useSessionStore`: suma, resta, salto, cambio de `setId` | Unitaria | `app/__tests__/session-store.test.ts` |
| `createRestSound` con un `AudioContext` falso: `unlock` crea o reanuda, `play` programa 1 o 2 osciladores, silencio si no está `running` o sin API | Unitaria | `app/__tests__/rest-sound.test.ts` |
| AC-1 a 3, 5, 10 a 15, 17 a 25, 34 con módulos reales, reloj falso, `RestSound` y `ScreenWake` falsos; foco (AC-22); región de estado; `byTime` y `visibilitychange` (AC-26, 27) | Integración de página | `app/__tests__/session-rest.test.tsx` |
| AC-35 a 38: peticiones y liberaciones del Wake Lock, rechazo, `null`, carrera | Integración de página | `app/__tests__/session-rest-wake.test.tsx` |
| AC-11 ("Hoy" y el Cierre sin tarjeta, vuelta con el tiempo correcto) | Integración de página | `app/__tests__/session-rest.test.tsx` |
| AC-1, 12, 14, 24, 30 (marcar, fases con `page.clock`, recarga, sin conexión); última fila no tapada a 320 px | E2E | `tests/e2e/rest.spec.ts` |
| AC-29 (axe, 44 px, 320 px con la tarjeta) | E2E | `tests/e2e/a11y.spec.ts` |
| AC-32 (descanso completo con tonos sin violaciones de CSP) | E2E | `tests/e2e/csp.spec.ts` |
| AC-31 | `npm run size` | CI |
| AC-33 | Sin cambio en `db.ts`; la prueba de la versión de la base sigue igual | `app/__tests__/db.test.ts` |
| AC-16, AC-39, música de fondo, Wake Lock en la PWA instalada | Manual en el iPhone | Tarea de verificación |

El E2E usa `page.clock` como la spec 003 T16 (pausar respecto al `completedAt` guardado, no a una hora fija). AC-34 se prueba contando renders de `SetTable` con un `Profiler` en la prueba de página.

## 8. Riesgos

- **Tic en segundo plano:** iOS congela los temporizadores. Como cada lectura usa `clock.now()` y `byTime` es `false` al volver, no hay tonos atrasados ni deriva (AC-26, 27). Lo cubre la prueba con `visibilitychange`.
- **`AudioContext` en iOS:** si `unlock()` no llega dentro del gesto (por ejemplo, un `await` antes), el contexto queda suspendido y no hay tono. Por eso se llama en `onClickCapture`, de forma síncrona. Se verifica en el iPhone.
- **Música de fondo:** el tono podría pausarla. Mitigación prevista en §6.4 (`audioSession.type = 'ambient'`), solo si pasa.
- **Wake Lock en la PWA instalada:** iOS < 18.4 no lo tiene; el temporizador funciona igual y la pantalla se puede bloquear (spec §7). Se acepta.
- **Altura fija del pie con la tarjeta:** si el texto crece (zoom de texto del sistema), la última fila podría quedar tapada. El E2E a 320 px lo vigila; si falla, se pasa a medir con `ResizeObserver`.
- **Foco por selector (`[data-current] input`):** acopla `app` al DOM de `SetTable`. El atributo está en el contrato y una prueba de página lo usa; si `SetTable` lo cambia, la prueba falla.
- **Dos pestañas:** los tonos pueden sonar en las dos (spec §7). Se tolera.

## 9. Checklist de la constitución

- [x] **P-1:** el temporizador solo mide tiempo; no sugiere ejercicios ni cargas, ni toca la progresión o las banderas rojas.
- [x] **P-2:** sin datos nuevos ni cambio de esquema (base v3, AC-33); respaldo y CSV sin cambios.
- [x] **P-3:** contrato `training` v1.36 y `architecture.md` §7.2 se actualizan antes del código (§3). Sin `[POR DEFINIR]`.
- [x] **P-4:** la regla y la tarjeta en `training`; `app` las compone por el `index.ts`. Sin tablas nuevas ni acceso a tablas ajenas. Sin eventos nuevos.
- [x] **P-5:** `restOf` y `restSignal` son puras, con `now` como parámetro y pruebas primero.
- [x] **P-6:** solo la tarjeta se redibuja (AC-34); botones ≥ 44 px, axe y 320 px (AC-29); bundle (AC-31).
- [x] **P-7:** sin almacenamiento, eventos, dependencias, barra, animaciones ni ajustes de sonido; `audioSession` solo si hace falta.
- [x] **P-8:** no entran datos de fuera; tipos sin `any`; textos en español, código en inglés.
