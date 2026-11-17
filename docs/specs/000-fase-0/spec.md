# Spec: Fase 0, esqueleto instalable con fronteras verificadas

**ID:** 000 · **Estado:** Aprobada · **Fecha:** 16-nov-2026
**Requerimientos cubiertos:** RNF-01 (parcial: app shell offline), RNF-02 (presupuesto de bundle), RNF-03, RNF-05 (base), RNF-06, RNF-07, RNF-08, RNF-10 · CA-1 (parcial), CA-9 · QS-06 (parcial), QS-07, QS-10 · **Fase:** 0 (spec §13)
**ADRs aplicados:** 0001, 0002, 0003, 0005, 0006, 0008, 0009, 0010, 0011

## 1. Problema y objetivo

Antes de escribir funcionalidad hace falta un esqueleto que haga cumplir la arquitectura por sí solo: si un módulo rompe una frontera, el CI falla; si el bundle crece de más, el CI falla. El objetivo es una PWA instalable y vacía, con los 5 módulos, el kernel compartido y el bus de eventos probados, desplegada en su origen definitivo.

## 2. Alcance

- **Incluye:**
  - Proyecto Vite + React + TypeScript estricto, alias `@/` → `src/`, ESLint + Prettier, stylelint.
  - Estructura de carpetas de architecture §5: `src/app`, `src/shared/{kernel,events,ui}` y `src/modules/{plan,training,progression,health,data}` con sus capas y un `index.ts` cada uno.
  - `shared/kernel` completo según modules/shared.md §2 (tipos branded, `Clock`, `IdGenerator` con UUIDv7, `Result`, fechas, números, interfaz `DataPort`, `fixedClock`, `sequentialIds`), con pruebas.
  - `shared/events`: bus en memoria según modules/shared.md §3, con pruebas.
  - Reglas de fronteras (ADR-0008) en `npm run lint` y en CI, con pruebas que demuestran que fallan ante una violación.
  - `shared/ui/tokens.css` con los tokens de spec §7.4 y tipografías autoalojadas.
  - Router con páginas vacías del MVP y `TabBar` (Hoy, Progreso).
  - Manejo de errores base de `app` (ADR-0010): *error boundary*, handler global de `error`/`unhandledrejection` y mapa de mensajes (vacío).
  - PWA vacía con `vite-plugin-pwa` (`registerType: 'prompt'`, manifest, precache de la app shell) y `navigator.storage.persist()` al arrancar.
  - CI en GitHub Actions: `tsc`, lint (incluye fronteras), Vitest, build, `size-limit`, Playwright.
  - `vercel.json` con headers y fallback de SPA (ADR-0011), protección de `main` y primer despliegue.
- **No incluye:**
  - Dexie, esquemas, seed ni datos (fase 1). Ningún módulo tiene tablas todavía.
  - Lógica de negocio de cualquier módulo; los `create<Module>()` devuelven una API vacía.
  - Componentes de `shared/ui` distintos de los necesarios para el esqueleto (`TabBar` vive en `app`).
  - Pantallas Plan, Historial y Ajustes (v1.0), temporizador, gráficas.
  - Mostrar en Ajustes el resultado de `storage.persist()` (v1.0).

## 3. Historias de usuario

- Como desarrollador, quiero que el CI rechace un import que rompe las fronteras entre módulos, para que la arquitectura no se degrade aunque el código lo genere un asistente.
- Como desarrollador, quiero un kernel con reloj e IDs inyectables, para escribir reglas de dominio con pruebas deterministas.
- Como usuario, quiero instalar la app en mi celular desde su dirección definitiva, para que mis datos futuros no dependan del proveedor de hosting.
- Como usuario, quiero que la app abra sin conexión una vez instalada, para usarla en el gym sin señal.

## 4. Criterios de aceptación

### 4.1 Proyecto y calidad de código

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-1 | El repo recién clonado | Ejecuto `npm ci` y `npm run dev` | La app abre en `/` con el título "Hoy", `lang="es"` y tema oscuro |
| AC-2 | El código del esqueleto | Ejecuto `npm run typecheck` | Pasa con `strict`, `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes` activos |
| AC-3 | Un archivo con `any` explícito, `eval`, `new Function` o `dangerouslySetInnerHTML` | Ejecuto `npm run lint` | Falla (RNF-10, P-8) |

### 4.2 Fronteras (ADR-0008, QS-07, CA-9)

Cada criterio se prueba con un fixture que contiene la violación y una prueba que verifica que la herramienta la reporta.

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-4 | `training` importa `@/modules/plan/domain/...` (archivo interno) | Corre el lint | Falla; importar `@/modules/plan` (su `index.ts`) pasa |
| AC-5 | `training` importa `@/modules/progression` (dependencia no permitida en architecture §5.1) | Corre el lint | Falla |
| AC-6 | Dos archivos que se importan mutuamente | Corre `dependency-cruiser` | Falla (`no-circular`) |
| AC-7 | Un archivo en `**/domain/**` importa `react`, `dexie` o `zustand` | Corre el lint | Falla (`domain-is-pure`) |
| AC-8 | Un archivo en `shared/` importa un módulo o `app` | Corre el lint | Falla (`shared-no-modules`) |
| AC-9 | Una capa importa otra no permitida (por ejemplo, `ui` → `infrastructure`) | Corre el lint | Falla (architecture §5.2) |

### 4.3 `shared/kernel` (ADR-0009, ADR-0010)

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-10 | El generador UUIDv7 | Genero un ID | Cumple el formato RFC 9562 en minúsculas: versión `7`, variante `10xx`, y su timestamp decodificado es el `Date.now()` del momento |
| AC-11 | El generador UUIDv7 con un reloj detenido en el mismo milisegundo | Genero 10 000 IDs | Son únicos y su orden lexicográfico coincide con el orden de generación |
| AC-12 | El reloj del sistema retrocede | Genero un ID nuevo | Sigue siendo mayor que el anterior (monotonía por dispositivo) |
| AC-13 | `'2026-11-16T22:30:00-06:00'` y `'2026-11-16T23:00:00-05:00'` | Llamo `compareInstants` | El primero es posterior (resultado > 0), aunque como string sea menor |
| AC-14 | Una `LocalDate` | Uso `addDays`, `daysBetween`, `startOfIsoWeek`, `weekdayOf` | Resultados correctos al cruzar fin de mes, fin de año y año bisiesto; `startOfIsoWeek` siempre devuelve lunes |
| AC-15 | `fixedClock('2026-11-16T22:30:00-06:00')` | Llamo `now()` y `today()` | Devuelve ese `Instant` y `'2026-11-16'` |
| AC-16 | `ok(v)` y `err(e)` | Los uso en una función tipada `Result<T, E>` | El tipo se estrecha con `if (!r.ok)` (prueba de tipos) |
| AC-17 | `roundToStep`, `floorToStep`, `kgToLb`, `lbToKg` | Con valores de ejemplo (por ejemplo, 61.3 kg, paso 2.5) | Resultados esperados sin errores de coma flotante visibles |

### 4.4 `shared/events`

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-18 | Un handler suscrito | Publico un evento | El handler no corre de forma síncrona; corre tras `await flushEvents()` con el payload correcto |
| AC-19 | Dos handlers y el primero lanza un error | Publico un evento | El segundo corre, `publish` no lanza y `onError` recibe el error y el tipo de evento |
| AC-20 | Un handler suscrito | Llamo la función devuelta por `subscribe` y publico | El handler ya no corre |
| AC-21 | Un tipo de evento no declarado en `DomainEvents` o un payload con forma incorrecta | Corre `tsc` | Falla (prueba de tipos) |

### 4.5 App, navegación y UI base

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-22 | La app abierta | Toco "Progreso" en la `TabBar` | Navega a `/progreso`; la pestaña activa tiene `aria-current="page"` |
| AC-23 | La `TabBar` | Mido sus botones | Cada objetivo mide ≥ 44 × 44 px y tiene foco visible al navegar con teclado |
| AC-24 | Las rutas `/sesion/:workoutId/:exerciseIndex` y `/sesion/:workoutId/cierre` | Las abro | Muestran su página vacía **sin** `TabBar`; `cierre` no se confunde con un `exerciseIndex` |
| AC-25 | Una ruta inexistente | La abro | Redirige a `/` |
| AC-26 | Cualquier página del esqueleto | Corre axe en Playwright | Sin violaciones WCAG 2.2 A/AA |
| AC-27 | Un archivo CSS fuera de `tokens.css` con un color literal | Corre stylelint | Falla |
| AC-28 | Un componente lanza al renderizar | Se renderiza | Se muestra el aviso genérico del *error boundary* en español, no una pantalla en blanco |
| AC-29 | Una promesa rechazada sin capturar | Ocurre | Se muestra un aviso genérico en español y el error se registra en consola |

### 4.6 PWA, rendimiento y seguridad

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-30 | El build de producción | Lo sirvo y lo abro | Hay manifest válido (`display: standalone`, colores = `--bg`, íconos 192 y 512 y *maskable*) y un service worker activo |
| AC-31 | La app ya cargada una vez | Paso a modo sin conexión y recargo | La app shell carga y navega entre Hoy y Progreso (QS-06, parcial) |
| AC-32 | Hay una versión nueva del service worker en espera | Abro la app | Aparece "Hay una versión nueva" con botón "Actualizar"; no recarga sin confirmación |
| AC-33 | Primer arranque | La app inicia | Llama una vez a `navigator.storage.persist()` si existe; si no existe o lo niega, no hay error visible |
| AC-34 | El build de producción | Corre `size-limit` | El JS inicial pesa < 200 KB gzip; si lo supera, el CI falla (QS-10) |
| AC-35 | El build servido con los mismos headers que producción | Recorro las páginas en Playwright | Cero violaciones de CSP en consola (architecture §7.10) |

### 4.7 CI y despliegue (ADR-0011)

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-36 | Un PR | Se abre o actualiza | GitHub Actions corre typecheck, lint (con fronteras y stylelint), Vitest, build, `size-limit` y Playwright; falla si falla cualquiera |
| AC-37 | La rama `main` | Intento un push directo o un merge con CI en rojo | GitHub lo rechaza |
| AC-38 | Un merge a `main` con CI verde | Vercel despliega | La app responde en `https://gym.<dominio>` con los headers de ADR-0011 (CSP, `no-cache` en `index.html`, `sw.js` y `manifest.webmanifest`; `immutable` en `/assets/*`) |
| AC-39 | Producción | Abro directamente `https://gym.<dominio>/progreso` | Carga la app (fallback de SPA), no un 404 |

## 5. Reglas de negocio aplicables

Ninguna regla RN-* de módulo aplica: la fase 0 no tiene lógica de negocio. Aplican las reglas transversales de ADR-0008 (fronteras), ADR-0009 (IDs y tiempo), ADR-0010 (errores) y ADR-0011 (hosting), y las de modules/shared.md §3 (entrega asíncrona, aislamiento de fallos, desuscripción).

## 6. UX

- **Hoy (`/`):** título "Hoy" y estado vacío "Aún no hay un plan cargado."
- **Progreso (`/progreso`):** título "Progreso" y estado vacío "Aún no hay entrenamientos registrados."
- **Sesión y Cierre:** página vacía a pantalla completa con título "Sesión" o "Cierre de sesión" y un enlace "Volver a Hoy".
- **Título del documento:** cada página fija `<title>` como "<título de la página> · Gym" (WCAG 2.4.2), por ejemplo "Progreso · Gym".
- **`TabBar`:** inferior, dos pestañas con texto ("Hoy", "Progreso") e ícono SVG con `aria-hidden`; zona segura inferior de iOS respetada (`env(safe-area-inset-bottom)`).
- **Aviso de error genérico:** "Algo salió mal. Tus datos guardados no se han perdido. Recarga la app para continuar." (la opción de exportar respaldo llega en fase 3).
  - Error de render: el aviso sustituye la pantalla, con un botón "Recargar" (la PWA instalada no tiene barra del navegador).
  - Error asíncrono: banner no bloqueante con "Recargar" y "Cerrar"; un solo aviso a la vez, aunque lleguen varios errores.
- **Aviso de actualización:** "Hay una versión nueva." con botón "Actualizar".
- **Visual:** tema oscuro por defecto (RNF-06), tokens de spec §7.4, tipografías autoalojadas, tamaños en `rem` para respetar el tamaño de texto del sistema.
- **Estados:** sin conexión no requiere UI especial en esta fase (no hay red en tiempo de ejecución).

## 7. Casos límite

- `cierre` y `:exerciseIndex` comparten prefijo de ruta: la ruta estática debe ganar (AC-24).
- `:workoutId` o `:exerciseIndex` inválidos (por ejemplo `/sesion/abc/foo`): en esta fase se muestra la página Sesión vacía. Validar que el workout exista y que el índice esté en rango, y redirigir si no, llega en la fase 2, con los datos.
- Recarga directa en una ruta profunda en producción: la resuelve el fallback de SPA (AC-39).
- Primera visita sin conexión: no hay service worker todavía; la app no carga. Es el comportamiento esperado de cualquier PWA.
- Safari iOS 16 (RNF-07): el *target* del build y las APIs usadas (`crypto.getRandomValues`, `<dialog>`, `navigator.storage`) deben existir ahí; `storage.persist()` puede no estar disponible.
- `crypto.randomUUID` no se usa: genera v4, no v7.
- Reloj del sistema que retrocede o se ajusta (NTP, cambio manual): el generador mantiene la monotonía (AC-12).
- Las URLs de preview de Vercel no se usan para instalar la PWA (ADR-0011): su origen es distinto al de producción.

## 8. Preguntas abiertas

Ninguna. Decisiones cerradas el 16-nov-2026 (estaban como `[PROPUESTO]` en la arquitectura y los contratos, ya actualizados):

- **Tipado de eventos:** *declaration merging* de `DomainEvents` en el `events.ts` de cada módulo (architecture §7.2). El mapa explícito en `app/events.ts` queda como salida reversible (architecture §10).
- **`flushEvents()`:** se acepta; se exporta solo desde `@/shared/events/testing`, nunca desde la entrada pública de `shared/events` (modules/shared.md §3).
- **Stylelint contra colores literales fuera de `tokens.css`:** se acepta (architecture §7.11, AC-27).
- **Tipografías autoalojadas:** `@fontsource-variable/inter` y `@fontsource-variable/space-grotesk`, solo subconjunto latino, `font-display: swap` (architecture §7.10 y §7.11).

## 9. Checklist de la constitución

- [x] **P-1:** sin lógica de ejercicios en esta fase; nada puede sugerir un ejercicio `high`.
- [x] **P-2:** origen estable desde el primer despliegue (ADR-0011) y `storage.persist()`; aún no hay datos ni esquema.
- [x] **P-3:** cada cambio tiene spec o contrato; sin `[POR DEFINIR]`.
- [x] **P-4:** fronteras verificadas en CI con pruebas de que fallan (§4.2).
- [x] **P-5:** kernel puro con reloj e IDs inyectables; pruebas del kernel y del bus antes del código.
- [x] **P-6:** objetivos ≥ 44 px, axe sin violaciones y presupuesto de bundle en CI.
- [x] **P-7:** sin Dexie ni componentes que no use el esqueleto; módulos vacíos.
- [x] **P-8:** TypeScript estricto y regla contra `any`; aún no hay entradas externas que validar con Zod.
