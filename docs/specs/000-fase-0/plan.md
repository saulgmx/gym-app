# Plan técnico: Fase 0, esqueleto instalable con fronteras verificadas

**Spec:** `specs/000-fase-0/spec.md` · **Estado:** Aprobado · **Fecha:** 16-nov-2026

## 1. Resumen de la solución

Proyecto Vite 8 + React 19 + TypeScript 6 con la estructura de architecture §5. El kernel y el bus de eventos se escriben con pruebas primero. Las reglas de fronteras se configuran una sola vez y se prueban contra un árbol de fixtures con violaciones conocidas. La PWA se construye con `vite-plugin-pwa`. Los headers de seguridad viven en `vercel.json` y `vite preview` los reutiliza, así que las pruebas E2E corren con la misma CSP que producción.

## 2. Módulos afectados

| Módulo | Cambio | ¿Cambia el contrato? |
|---|---|---|
| `shared/kernel` | Implementación completa de modules/shared.md §2 + `systemClock` y `createUuidV7Generator` | Sí: modules/shared.md §2 (se añaden las implementaciones de producción) |
| `shared/events` | `createEventBus` + entrada de pruebas `@/shared/events/testing` | No (ya documentado en §3) |
| `shared/ui` | Solo `tokens.css`, `fonts.css` y `base.css` (§6.10), y el helper `cx` | Sí: modules/shared.md §4 (nombres de tokens, hojas globales y `cx`) |
| `plan`, `training`, `progression`, `health`, `data` | Carpetas de capas vacías e `index.ts` con `create<Module>()` que devuelve `{}` | No |
| `app` | `main.tsx`, `compose.ts`, `router.tsx`, `TabBar`, 4 páginas vacías, manejo de errores, aviso de actualización | No (architecture §5.3) |

## 3. Cambios de contrato

Ya aplicado en modules/shared.md §2 (16-nov-2026):

```ts
// Implementaciones de producción
const systemClock: Clock;  // now(): Instant con el offset local; today(): LocalDate local
function createUuidV7Generator(opts?: {
  now?: () => number;                          // ms desde epoch; por defecto Date.now
  random?: (bytes: Uint8Array) => void;        // por defecto crypto.getRandomValues
}): IdGenerator;
```

Y en modules/shared.md §3: `flushEvents(): Promise<void>` espera a que terminen todos los handlers pendientes de cualquier bus creado en la prueba.

No hay eventos, puertos ni tablas nuevas.

## 4. Datos

Ninguno. La fase 0 no crea la base Dexie (fase 1) ni cambia el formato de exportación.

## 5. Flujo

Arranque (`app/main.tsx`):

```mermaid
sequenceDiagram
  participant M as main.tsx
  participant E as errors/
  participant C as compose.ts
  participant R as React
  M->>E: installGlobalErrorHandlers()
  M->>M: navigator.storage?.persist() (sin await bloqueante; fallo silencioso)
  M->>C: compose() → { bus, modules }
  M->>R: render <AppErrorBoundary><RouterProvider/><UpdatePrompt/><AppNotice/></AppErrorBoundary>
  Note over R: UpdatePrompt usa useRegisterSW (virtual:pwa-register/react)
  Note over R: errores de render en rutas → errorElement de la ruta raíz (§6.11)
```

## 6. Decisiones

Ninguna es estructural, así que no requieren un ADR. Las de versiones de herramientas se revisan en cada fase.

### 6.1 Versiones (npm, 16-nov-2026)

| Paquete | Versión | Nota |
|---|---|---|
| Node / npm | `24.22.3` / `11.19.1` (Node 24 LTS "Krypton") | Fijados con **Volta** en `package.json` (`"volta": { "node": "24.22.3", "npm": "11.19.1" }`): única fuente de la versión. CI la lee con `actions/setup-node` (`node-version-file: package.json`, que prioriza `volta.node`). Vercel usa `engines.node: "24.x"`, porque solo respeta la versión mayor. Sin `.nvmrc`. |
| `typescript` | `~6.0.3` | **No 7.0.** `typescript-eslint` exige `<6.1.0`. Pasar a 7 cuando `typescript-eslint` lo soporte. |
| `vite` / `@vitejs/plugin-react` | `^8.3.8` / `^6.3.0` | |
| `react` / `react-dom` / `@types/*` | `^19.3.1` / `^19.3.0` | |
| `react-router` | `^8.5.1` | Modo *data router* (`createBrowserRouter`) |
| `zustand` | `^5.1.0` | Solo para el aviso global (ADR-0006) |
| `vite-plugin-pwa` / `workbox-window` | `^2.0.0` / `^7.4.1` | |
| `@vite-pwa/assets-generator` | `^2.0.0` | Genera íconos desde un SVG; los PNG se versionan en el repo |
| `@fontsource-variable/inter`, `…/space-grotesk` | `^5.3.0` | |
| `vitest` / `@vitest/coverage-v8` | `^5.1.0` | Dos proyectos: `unit` (jsdom) y `architecture` (node) |
| `@testing-library/react` / `jest-dom` / `user-event` / `jsdom` | `^16.3.3` / `^7.0.1` / `^14.6.12` / `^31.0.1` | |
| `@playwright/test` / `@axe-core/playwright` | `^1.65.1` / `^4.14.0` | |
| `eslint` / `typescript-eslint` / `globals` | `^10.15.0` / `^8.73.0` / `^17.14.0` | |
| `eslint-plugin-boundaries` / `dependency-cruiser` | `^7.4.4` / `^18.8.0` | ADR-0008 |
| `eslint-plugin-react-hooks` | `^7.1.1` | |
| `prettier` / `eslint-config-prettier` | `^3.10.1` / `^10.1.8` | |
| `stylelint` / `stylelint-config-standard` / `stylelint-declaration-strict-value` | `^18.0.0` / `^41.0.0` / `^1.13.0` | |
| `size-limit` / `@size-limit/file` | `^14.3.0` | |

Zod y Dexie no se instalan en esta fase (P-7): todavía no hay datos ni entradas externas.

### 6.2 ESLint 10 sin `eslint-plugin-jsx-a11y`

`eslint-plugin-jsx-a11y` 6.10.2 no declara compatibilidad con ESLint 10.

- **Elegido:** ESLint 10 sin jsx-a11y. La accesibilidad la cubren axe en Playwright (AC-26) y las consultas por rol de Testing Library. Se vuelve a añadir cuando soporte ESLint 10.
- **Descartado:** ESLint 9.39, la última versión 9 (jul-2026). Ya no recibe evolución, y tarde o temprano habría que migrar.
- **Descartado:** forzar el peer con `overrides`. Es un riesgo silencioso en una herramienta de CI.

### 6.3 Headers: una sola fuente

- `vercel.json` contiene los headers y el rewrite de ADR-0011.
- `vite.config.ts` lee `vercel.json` y aplica sus headers globales (CSP y seguridad) a `preview.headers`. Playwright corre contra `vite preview`, así que las pruebas usan la misma CSP que producción (AC-35).
- Una prueba de arquitectura verifica que la CSP de `vercel.json` es exactamente la de architecture §7.10 y que existen las reglas de caché de ADR-0011.
- En `vite dev` **no** se aplica la CSP, porque Vite inyecta scripts *inline* para HMR.

### 6.4 Fronteras: una sola configuración, probada contra fixtures

- `eslint.config.js` define los elementos de `eslint-plugin-boundaries`:
  - `app`
  - `shared-kernel`, `shared-events` y `shared-ui`
  - `module` (captura `name`) con sus capas `domain`, `application`, `infrastructure`, `ui` y la entrada `index`
- Las reglas son las de architecture §5.1 y §5.2.
- `.dependency-cruiser.cjs`:
  - `no-circular`
  - `shared-no-modules`
  - `domain-is-pure`: prohíbe `react`, `react-dom`, `dexie` y `zustand` en `**/domain/**`
  - `not-to-unresolvable`
  - el grafo de §5.1
- `tests/architecture/fixtures/src/` es un árbol mínimo que imita `src/`. Tiene un archivo válido por regla y otro que la viola.
- `tests/architecture/boundaries.test.ts` corre la API de `ESLint` y `cruise()` de dependency-cruiser con **las mismas configuraciones** sobre ese árbol. Comprueba que cada violación se reporta con su regla y que los archivos válidos pasan (AC-4 a AC-9).
- El lint normal excluye `tests/architecture/fixtures/`.

### 6.5 UUIDv7 (ADR-0009)

- Se usa el método 1 de RFC 9562 §6.2: un contador de 12 bits en `rand_a`, que se reinicia con un valor aleatorio de 11 bits en cada milisegundo nuevo. Así deja margen antes de desbordarse.
- Si el reloj se repite o retrocede, se usa `lastMs` y se incrementa el contador.
- Si el contador se desborda, se usa `lastMs + 1`.
- `rand_b` lleva 62 bits aleatorios, la versión es `0111` y la variante `10`.
- `now` y `random` son inyectables. Las pruebas de AC-11 y AC-12 usan un reloj controlado.

### 6.6 Fechas sin sorpresas de horario de verano

- La aritmética de `LocalDate` se hace con `Date.UTC(y, m, d)`, nunca con la zona local.
- `systemClock.today()` formatea con `getFullYear`, `getMonth` y `getDate` locales.
- `systemClock.now()` formatea ISO con el offset de `getTimezoneOffset()`.
- `compareInstants` compara `Date.parse(a) - Date.parse(b)`.

### 6.7 Fuentes solo con subconjunto latino

Importar el CSS de `@fontsource-variable` declara todos los subconjuntos (cirílico, griego, vietnamita), y Workbox los precachearía todos.

`shared/ui/fonts.css` declara sus propios `@font-face` con solo los `woff2` latinos del paquete y `font-display: swap`. Vite los copia a `/assets` con hash.

### 6.8 Compatibilidad iOS 16 (RNF-07)

`build.target: ['es2022', 'safari16', 'ios16']`. El *baseline* por defecto de Vite 8 deja fuera Safari 16.0–16.3.

### 6.9 Presupuesto de bundle (QS-10)

`size-limit` con `@size-limit/file` y gzip sobre `dist/assets/*.js`, con límite de 200 KB.

En la fase 0 todo el JS es inicial. Cuando haya rutas diferidas (*lazy*), el patrón se ajustará para medir solo el JS inicial.

### 6.10 Estilos globales y colores literales (AC-27)

Tres hojas globales en `shared/ui`, importadas una vez desde `app/main.tsx`:

- `tokens.css`: variables de spec §7.4 (nombres en modules/shared.md §4). Único archivo con valores de color literales.
- `fonts.css`: `@font-face` latinos (§6.7).
- `base.css`: `color-scheme: dark`; `html { font-size: 100% }` para respetar el tamaño de letra del sistema, y medidas en `rem`; fondo y texto con tokens; `:focus-visible` con contorno en `--accent`; `prefers-reduced-motion` reduce animaciones y transiciones.

Stylelint (`stylelint-config-standard`) considera color literal:

- Con `stylelint-declaration-strict-value`, todo valor que no sea `var()` en `/color$/`, `fill` y `stroke`, y en `background`, `border` y `outline` gracias a `expandShorthand`. Se permiten `currentcolor`, `transparent`, `none`, `inherit`, `initial` y `unset`.
- Con `color-no-hex` y `color-named: never`, cualquier hexadecimal o color con nombre en cualquier propiedad (por ejemplo `box-shadow`).

`src/shared/ui/tokens.css` es el único archivo exento. La prueba corre la configuración real sobre fixtures CSS.

En los `*.module.css` las clases van en camelCase (`.backLink`), porque se leen desde TypeScript como `styles.backLink`; el resto sigue la convención kebab-case de `stylelint-config-standard`.

Contraste (calculado el 17-nov-2026): todos los textos superan AA sobre `--bg`, `--surface` y `--surface-2` (el mínimo es `--text-muted` sobre `--surface-2`, 6.68:1). `--border` (1.48:1 sobre `--bg`) es solo decorativo: no puede ser el único límite visible de un control (WCAG 1.4.11).

### 6.11 Errores inesperados (ADR-0010, AC-28, AC-29)

React Router captura los errores de render de sus rutas y, sin `errorElement`, muestra su propia pantalla en inglés: `AppErrorBoundary` nunca los vería. Por eso hay dos capturas con el mismo componente `ErrorFallback`:

- Una ruta raíz sin `path` envuelve todas las rutas con `errorElement: <ErrorFallback />`.
- `AppErrorBoundary` (componente de clase, sin dependencia) captura lo que queda fuera del router (`UpdatePrompt`, `AppNotice`).

`ErrorFallback`: `role="alert"`, texto genérico de spec 000 §6 y botón "Recargar" (`location.reload()`).

Errores asíncronos, en `src/app/errors/`:

- `installGlobalErrorHandlers(): () => void` escucha `error` y `unhandledrejection` en `window`; devuelve la función que los quita. Cada error se registra con `console.error` sin `preventDefault()`, así el navegador conserva su propio registro.
- Store de Zustand con un solo aviso (`notice | null`); un error nuevo con un aviso visible no apila otro.
- `AppNotice`: banner `role="alert"` no bloqueante con "Recargar" y "Cerrar".
- `messages.ts`: `type ErrorCode = never` y `errorMessages: Record<ErrorCode, string> = {}` hasta que los módulos exporten sus uniones de códigos; ahí también vive el texto genérico.

## 7. Estrategia de pruebas

| Criterio | Tipo de prueba | Archivo |
|---|---|---|
| AC-1 | E2E (carga `/`, título, `lang`) | `tests/e2e/shell.spec.ts` |
| AC-2 | `tsc --noEmit` en CI | `tsconfig.json` |
| AC-3 | Arquitectura (ESLint API sobre fixtures) | `tests/architecture/lint-rules.test.ts` |
| AC-4 a AC-9 | Arquitectura (ESLint + dependency-cruiser sobre fixtures) | `tests/architecture/boundaries.test.ts` |
| AC-10 a AC-12 | Unitaria | `src/shared/kernel/__tests__/id.test.ts` |
| AC-13 a AC-15 | Unitaria | `src/shared/kernel/__tests__/time.test.ts` |
| AC-16 | Tipos (`expectTypeOf`, `@ts-expect-error`) | `src/shared/kernel/__tests__/result.test-d.ts` |
| AC-17 | Unitaria | `src/shared/kernel/__tests__/numbers.test.ts` |
| AC-18 a AC-20 | Unitaria | `src/shared/events/__tests__/bus.test.ts` |
| AC-21 | Tipos | `src/shared/events/__tests__/bus.test-d.ts` |
| AC-22, AC-24, AC-25 | Componente (router en memoria) | `src/app/__tests__/router.test.tsx` |
| AC-23 | E2E (medir *bounding box*, tabular) | `tests/e2e/shell.spec.ts` |
| AC-26 | E2E + axe en cada página | `tests/e2e/a11y.spec.ts` |
| AC-27 | Arquitectura (stylelint API sobre un fixture CSS) | `tests/architecture/lint-rules.test.ts` |
| AC-28, AC-29 | Componente | `src/app/errors/__tests__/errors.test.tsx` |
| AC-30, AC-31 | E2E sobre `vite preview` (SW activo, `context.setOffline(true)`) | `tests/e2e/pwa.spec.ts` |
| AC-32 | Componente con `virtual:pwa-register/react` simulado | `src/app/__tests__/update-prompt.test.tsx` |
| AC-33 | Unitaria de `bootstrap()` con `navigator.storage` simulado | `src/app/__tests__/bootstrap.test.ts` |
| AC-34 | `size-limit` en CI | `.size-limit.json` |
| AC-35 | E2E: escucha `securitypolicyviolation` y la consola | `tests/e2e/csp.spec.ts` |
| AC-36 | Workflow de CI | `.github/workflows/ci.yml` |
| AC-37 | Manual: regla de protección de `main` | Verificación en GitHub |
| AC-38 | Arquitectura (contenido de `vercel.json`) + manual con `curl -I` en producción | `tests/architecture/headers.test.ts` |
| AC-39 | Manual: recarga de `/progreso` en producción | — |

- **Proyectos de Playwright:** `chromium` con viewport Pixel 7 y `webkit` con viewport iPhone 13, por RNF-07.
- **Cobertura:** umbral de 80% en `src/shared/kernel/**` y `src/modules/*/domain/**` (RNF-08).

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| Ecosistema recién salido de versiones mayores (TS 7, ESLint 10, Vite 8, Vitest 5): plugins rezagados | Versiones fijadas en §6.1 tras revisar sus peers; `npm ci` con `package-lock.json`; Renovate o Dependabot más adelante, no en esta fase |
| La API de `eslint-plugin-boundaries` 7 cambió respecto a ejemplos antiguos | La configuración se valida con las pruebas sobre fixtures, no a ojo |
| Pruebas de service worker inestables en Playwright | Esperar a `navigator.serviceWorker.ready` y que el SW controle la página antes de pasar a sin conexión; reintentos solo en CI |
| WebKit en CI con service workers | Si WebKit en Linux no soporta algún caso de SW, AC-31 corre solo en chromium y se verifica a mano en un iPhone; se documenta en `tasks.md` |
| La CSP rompe algo que solo aparece en el build | AC-35 corre contra `vite preview` con los mismos headers |
| El dominio aún no está comprado | AC-37 a AC-39 son las últimas tareas; el resto de la fase no depende de ellas |
| Vercel no ofrece Node 24 o cambia su política | `engines.node: "24.x"` lo fija; si cambia, se ajustan juntos `volta` y `engines` en `package.json` |
| Otra instalación de Node en el `PATH` antes que Volta: se ignora la versión fijada | Verificar con `which node` que resuelve a `~/.volta/bin/node`; T1 comprueba `node -v` = `v24.22.3` dentro del proyecto |

## 9. Checklist de la constitución

- [x] **P-1:** no hay salida de ejercicios en esta fase.
- [x] **P-2:** origen estable antes de cualquier dato (ADR-0011); `storage.persist()` al arrancar; sin esquema todavía.
- [x] **P-3:** spec aprobada; contrato de `shared` actualizado antes del código (§3).
- [x] **P-4:** fronteras configuradas una vez y probadas contra violaciones conocidas (§6.4).
- [x] **P-5:** kernel puro con `Clock` e `IdGenerator` inyectables; pruebas del kernel y del bus antes de implementarlos.
- [x] **P-6:** axe en E2E, objetivos de 44 px medidos y `size-limit` en CI.
- [x] **P-7:** sin Dexie ni Zod todavía; carpetas de módulo vacías; un solo archivo de headers.
- [x] **P-8:** `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`; `no-explicit-any` como error.
