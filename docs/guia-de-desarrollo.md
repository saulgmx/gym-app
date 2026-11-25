# Guía de desarrollo: trampas conocidas y cómo evitarlas

Lecciones aprendidas al construir la app, ordenadas por tema. No son reglas nuevas: las reglas están en la constitución, los ADRs y `docs/README.md`. Aquí está cómo cumplirlas sin tropezar dos veces con la misma piedra.

Se agrega una nota cuando algo costó tiempo y puede volver a pasar. Se borra cuando el código o una herramienta ya lo impiden.

## 1. Entorno y shell

- **Node con mise:** Node `24.22.3` (`.tool-versions`; `mise install` en un equipo nuevo) y un Node 24 global (`~/.config/mise/config.toml`).
  - Los shims de mise van en `~/.zshenv` y otra vez en `~/.zprofile`, y `mise activate zsh` en `~/.zshrc`. `path_helper` (`/etc/zprofile`) corre después de `~/.zshenv` y pone `/opt/homebrew/bin` primero: sin la línea de `~/.zprofile`, un `node` que Homebrew instale como dependencia (pasó con Qwen Code y Volta) gana al fijado. Comprobar con `zsh -lic 'which -a node'`.
- **Instalación:** `npm ci --strict-allow-scripts` también en CI; `fsevents` está denegado en `allowScripts`.
- **Navegadores de Playwright:** `npx playwright install chromium webkit` en local. En CI vienen en la imagen `mcr.microsoft.com/playwright` del job `ci`, con la misma versión que `@playwright/test`: al actualizar Playwright, cambiar la etiqueta y el digest de la imagen en `ci.yml`.
- **Pipes:** verificar con `set -o pipefail` cuando se encadenan comandos con `|`, porque un `| tail` oculta el código de salida.
- **zsh:**
  - `echo =====` falla (usar comillas) y un glob sin coincidencias aborta el comando.
  - No divide variables sin comillas: las opciones de `curl` en una variable van como array, `R=(--resolve a)` y `curl "${R[@]}"`. Lo mismo con varios archivos de prueba en un script de mutantes: `T=(a.test.ts b.test.ts)` y `npx vitest run "${T[@]}"`. Con `$T`, Vitest recibe una sola ruta, no encuentra nada y todos los mutantes "sobreviven" (spec 005b T4).
- **Editar código desde la shell:**
  - Las comillas simples dentro de `node -e …` cortan el script: para editar código con comillas, usar la herramienta de edición.
  - `perl -0pi -e 's{…}{…}'` con llaves dentro del patrón o del reemplazo (imports de TypeScript) confunde los delimitadores y deja el archivo roto: para editar imports, usar la herramienta de edición.
- **DNS:** si el Mac preguntó por un nombre antes de que existiera, guarda el "no existe" (~30 min). Verificar con `dig +short nombre @1.1.1.1` y `curl --resolve nombre:443:IP`, o limpiar con `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`.

## 2. Pruebas con Vitest y Testing Library

### Escribir la prueba

- Comprobar con Node los valores esperados (contraste WCAG, prefijos UUID) en vez de escribirlos de memoria.
- Probar lo que se **ve**, no solo lo que se guarda: el signo de la asistencia se guardaba bien y se mostraba mal en reps y RIR, y solo lo encontró el iPhone (PR #17).
- `rejects.toThrow()` sin patrón acepta cualquier error, también un `TypeError` accidental: exigir el de la regla (`/RN-PLN-22/`). Los mensajes de error del dominio y de la infraestructura citan su regla.
- Una prueba de "vuelve a donde estaba" debe salir de un punto distinto del valor por defecto. En el ejemplo parcial, el ejercicio actual (RN-TRN-21) también es el 2, así que volver al 2 no probaba el `state` de la navegación (se abre el Cierre desde el 3).
- Una prueba de "mientras carga" con un `ready` que nunca se resuelve no prueba nada: la página no llega a consultar. Dejar colgada la consulta concreta (`vi.spyOn(api, 'listWorkoutHistory').mockReturnValue(new Promise(() => undefined))`).

### Datos de prueba

- Datos escritos directo en pruebas: que sean coherentes entre sí (un `programWeek` que corresponda a la fecha; series que pertenezcan al workout). Un dato imposible hace fallar la prueba por la razón equivocada.
- Datos rotos que la API ya impide (dos `completed` con el mismo `date`): `lastTestDatabase()` de `test-app.tsx` devuelve la base de los últimos servicios de prueba para escribir directo (`today-done.test.tsx`, AC-17).
- `addExtraSet` solo llega hasta `maxSets` (`TemplateItem.sets[1]`, RN-TRN-10): para ejemplos con serie extra, elegir un ítem con margen (en la semana 2, Fondos `[2, 3]`; Press inclinado `[3, 3]` ya empieza en su máximo).
- El seed se escribe con el tipo de entrada del esquema (`z.input<typeof planSeedSchema>`) en los fixtures; `plan-seed.summary.md` está en `.prettierignore` para que la comparación sea exacta.

### Asincronía

- `Suspense` (fase 1, C): en el entorno de `act`, React solo reintenta un componente suspendido en `use(promesa)` dentro de un `act` esperado con `await`. `src/app/__tests__/test-app.tsx` renderiza así. Para probar el orden real de arranque (promesa que se resuelve después), montar con `createRoot` y `IS_REACT_ACT_ENVIRONMENT = false` durante la prueba (`today-page.test.tsx`).
- El foco que se mueve en un `useEffect` llega después del render: esperarlo con `waitFor`, no con un `expect` justo después del texto nuevo.
- Pruebas de `app` que exportan o importan (spec 007): con la suite completa, IndexedDB tarda más que el `act` del clic. Esperar el efecto con `waitFor` (que se llamó a `deliverFile`, que el botón volvió), no suponerlo tras el `act`.
- Una prueba que dispara una exportación y termina sin esperarla deja la lectura de IndexedDB corriendo: con la suite completa, el archivo llega al `deliverFile` de la prueba siguiente (spec 008 T11). Esperar a que se llame `deliverFile` antes de terminar.
- `Promise.withResolvers` no está en el `lib` de TypeScript del proyecto: en pruebas, una promesa con `resolve` a mano.
- `vi.spyOn(Promise.prototype, 'then')` entra en recursión (Vitest usa promesas): reemplazar `then` a mano solo durante la llamada y restaurarlo en `finally` (`src/app/__tests__/compose.test.ts`).

### Formularios y archivos

- `user.upload(input, [])` no dispara `change`: para "cerrar el selector sin elegir", `fireEvent.change(input, { target: { files: [] } })`. El valor de un `<input type="file">` se limpia con `value = ''` para poder elegir el mismo archivo otra vez.
- En jsdom, comparar bytes como arrays: un `Uint8Array` de jsdom y uno de Node no son `toEqual` (spec 008 T9).
- El BOM en el código va como escape `﻿`: el carácter literal falla en lint (`no-irregular-whitespace`), y en T11 algo lo convirtió al guardar. Para leerlo en una prueba, `new TextDecoder('utf-8', { ignoreBOM: true })` (por defecto lo quita, igual que `blob.text()`).

### Kernel y eventos

- Las fechas `LocalDate` se calculan con `Date.UTC`; `systemClock` se prueba con `vi.stubEnv('TZ', …)` porque `src/` no tiene tipos de Node (`process`).
- Los eventos de ejemplo (`test/Pinged`, `test/Ponged`) viven en `src/shared/events/__tests__/test-events.ts`; por ampliación global, su tipo es visible en todo `src/`. Nada impide todavía importar `@/shared/events/testing` desde código de producción; si llega a pasar, añadir una regla con su fixture.

### Depurar y medir

- Vitest 5 oculta la consola de las pruebas que pasan: para depurar con `console.log`, hacer fallar la prueba a propósito.
- El reporte de cobertura en texto oculta los archivos al 100%; para verlos, usar `--coverage.reporter=json-summary`. Las pruebas de tipos (`*.test-d.ts`) no cuentan para la cobertura.

## 3. Mutaciones

Tras cada prueba en verde, romper el código a propósito y ver que falla la prueba correcta. En el bloque C de la fase 0 encontraron tres pruebas que pasaban sin probar nada: el `replace` de la redirección (T15), `showNotice` que reemplazaba el aviso (T16) y el rechazo de `persist()` sin capturar (T17: Vitest **no** marcó ese rechazo; la prueba espía `then`).

### Mutantes mal escritos

- Revisar el mutante antes de concluir (fase 1, B): uno que no hace el cambio que dice, uno que no compila (variable inexistente) o uno que solo cubre la mitad del cambio sobreviven o "mueren" sin probar nada.
- Un mutante que no compila no prueba nada, porque el build falla antes de las pruebas (spec 005b):
  - `cond ? a : b` → `false ? a : b` deja variables sin usar y `tsc -b` falla (`noUnusedLocals`).
  - `x && false ? …` estrecha `x` a `never` y su rama no compila.
  - Una condición que nunca se cumple y conserva el tipo sí sirve: `x?.name === '' ? …`.
- Un mutante con reemplazo global (`replace_all`, `sed …/g`) puede tocar más de lo que dice: en la spec 008 T5, "LF en vez de CRLF" también cambió la regex que decide las comillas (`/[,"\r\n]/`). Mirar el diff del mutante antes de contar el resultado.
- Un mutante que deja un `throw` incondicional "muere" sin probar nada: revisar que lo mate la prueba de su regla, no todas.
- Un mutante de un límite de errores debe quitarlo del árbol: si conserva `getDerivedStateFromError`, sigue atrapando el error y el mutante "sobrevive" sin probar nada.
- Dexie: una versión nueva que **no menciona** una tabla la conserva; solo la borra `tabla: null`. Un mutante "v3 olvida una tabla" es equivalente (spec 005).

### Scripts de mutación

- Copias de seguridad: `cp f bak && { cambio; prueba; cp bak f; }`, con nombre único (`$$.$RANDOM`). Con `a && b; cp bak f` el `cp` corre aunque falle `a` y restaura una copia vieja (pasó en T16).
- Vitest 5 con `--reporter=json` escribe en `.vitest/json/output.json` (no en stdout): pasar `--outputFile=<ruta fuera del repo>`.
- En Vitest, un archivo que no carga da "Test Files N failed" sin "Tests N failed": el script debe tratarlo como error del mutante, no como muerto ni como vivo.
- Si el mutante es de tipos, el script debe correr también los `*.test-d.ts` (`--typecheck`).
- Mutantes E2E: comprobar que `npm run build` sale bien antes de correr Playwright. Si no compila, Playwright prueba el `dist/` anterior y el mutante "sobrevive" o "muere" sin probar nada (pasó dos veces en la spec 005 T22). Reconstruir con el código real al terminar.

## 4. E2E con Playwright

### Datos y reloj

- Con una base vacía, el programa empieza el lunes de la semana de la primera visita (RN-PLN-13): el domingo 15 ya es la semana 1. Para abrir "Hoy" en otra fecha, `openTodayOn` (`tests/e2e/helpers.ts`) ancla el lunes 16 y luego mueve el reloj.
- `page.clock.install` (spec 003 T16): con el reloj pausado desde la carga, "Hoy" no sale del estado de carga (solo el `h1` oculto). Se deja fluir, y se pausa con `pauseAt` cuando la tarjeta ya se ve; desde ahí solo `runFor` lo mueve.
  - Se pausa respecto al `startedAt` guardado (en segundos enteros), no a una hora fija: en CI el clic de inicio puede llegar después de 1 s y se vería "18:41" (pasó en el PR #25; se reproduce con un `waitForTimeout(1500)` antes del clic).
  - El resto del E2E sigue con `setFixedTime` (`freezeClockAt`).
- Una serie sin valores no se marca hecha (RN-TRN-04): llenar kilos, reps y RIR antes del checkbox.
- Recarga: un campo se guarda unos milisegundos después del Enter, y recargar antes corta la escritura. Las pruebas esperan a que IndexedDB tenga el valor (`waitForStoredSet` en `tests/e2e/helpers.ts`) y luego recargan.

### Ayudantes

- Los ayudantes de sesión y Cierre (`startSession`, `doSet`, `cierreWithOneSet`, `painLevel`, `storedRows`) viven en `tests/e2e/helpers.ts`. `startSession` no navega, para poder empezar sin conexión sin recargar.
- Descargas (spec 007): quitar `navigator.share` y `canShare` con `addInitScript` (`withoutShare` en `tests/e2e/helpers.ts`) para que siempre descargue; `waitForEvent('download')` y `download.path()`; el selector de archivos con `waitForEvent('filechooser')` al tocar el botón.
- Un segundo "teléfono" es `browser.newContext({ ...devices[…], baseURL, timezoneId })`: con `exactOptionalPropertyTypes`, `test.info().project.use` no se puede pasar campo a campo.

### Localizadores

- `getByText` lee también el texto `aria-hidden`: el chip "Hecha ✓" no es `getByText('Hecha', { exact: true })`. Filtrar el `listitem` por su texto visible (spec 005 T22).
- Las pruebas de Testing Library comparan el nombre accesible exacto; Playwright, por subcadena.

### WebKit y límites de la emulación

- WebKit (como Safari) enfoca enlaces con `Alt+Tab`.
- WebKit no enfoca un botón al hacerle clic con el ratón: un diálogo abierto así no tiene a quién devolver el foco. Las pruebas E2E del foco devuelto abren con el teclado (`focus()` y Enter); con el dedo en iOS no hay foco visible que recuperar (spec 004 T6).
- El WebKit de Playwright 1.65 escribe los nombres cortos sin punto ("nov", "lun"), igual que Node. El `.replace('.', '')` de `format-date.ts` lo cubre `format-date-period.test.ts`, que hace que `Intl` añada el punto. En el iPhone la fecha se ve sin punto, pero eso no dice si Safari lo pone, porque la app lo quita.
- Dos clics de Playwright en dos pestañas nunca llegan a la vez: la segunda pestaña ve la sesión en vivo y su botón desaparece. AC-2 de spec 002 es secuencial en E2E; la simultaneidad la prueba `dexie-repository.test.ts`.
- Playwright no emula la zona segura (`env(safe-area-inset-*)` vale 0): el pie fijo se prueba por tamaños y posición; la zona segura, en el iPhone.
- `vite preview` sirve `dist/`: cualquier cambio (también un mutante) requiere reconstruir.

### Capturas

- Para revisar a mano: un E2E temporal con `page.screenshot({ fullPage: true })` en el scratchpad, borrado al terminar. En la captura de página completa, la barra fija sale a media altura: es un efecto de la captura, no un error.

## 5. Dexie e IndexedDB

- `fake-indexeddb`: `import 'fake-indexeddb/auto'` por archivo y una base con nombre propio (`crypto.randomUUID()`); cerrar y `Dexie.delete` en `afterEach`.
- `import 'fake-indexeddb/auto'` va **antes** de cualquier import que cargue Dexie (incluido el router o una página): Dexie toma `indexedDB` al cargarse y, si no está, falla con `MissingAPIError`.
- Un *hook* `creating` que lanza sirve para forzar un fallo a mitad de una transacción.
- `liveQuery` con una base cerrada **espera en silencio** a que se abra (el hook se queda en `undefined`): para probar que un error llega al *error boundary*, usar un *hook* `reading` que lanza.
- `useLiveQuery` conserva el resultado anterior al cambiar las dependencias (por eso los hooks fechan su resultado) y lanza los errores en el render. Con Dexie 4.4.7, una espera ajena (`setTimeout`) en la consulta no rompe el seguimiento (plan 001 §6.4).
- `between(from, to)` con `from > to` devuelve vacío, no lanza.

## 6. React y React Router

- React Router 8 navega con transiciones asíncronas: dentro del `act` síncrono de un clic normal, el trabajo pendiente se puede descartar y la navegación no llega. En las pruebas de `app`, los toques que navegan usan `tapToNavigate` (`src/app/__tests__/test-app.tsx`), y antes de tocar algo en "Hoy" hay que esperar a que cargue (`use(ready)`).
- Sin `errorElement`, una ruta que lanza muestra su propia pantalla en inglés y `AppErrorBoundary` no la ve.
- `RouterProvider` del navegador viene de `react-router/dom`.
- `NavLink` solo marca su propia ruta, y `NavLink to="/"` nunca está activo en otra (no necesita `end`). "Hoy" en `/dia/:date` usa `Link` con `aria-current` calculado (`TabBar.tsx`).
- `useLocation().state` llega como `any`: tiparlo como `unknown` y validarlo (`ClosePage`, plan 005 §6.6).
- Una página que guarda y luego navega debe guardar su estado en el componente que sigue montado: si la vista en vivo cambia (`completed`) y desmonta el formulario, sus `setState` se pierden (`ClosePage`, plan 005 §6.5).

## 7. Zod

- Zod 4 bajo la CSP: `z.config({ jitless: true })` antes de definir los esquemas. Si no, su prueba de `new Function` es una violación de `eval` en `csp.spec`.
- `zod/mini` (spec 002 T24): la misma API en funciones (`z.pipe`, `.check(z.minLength(1))`, `z.exactOptional(…)`). Las pruebas pueden seguir importando tipos de `zod`, que no entran en el bundle.

## 8. Accesibilidad

- axe (`label-content-name-mismatch`, WCAG 2.5.3) exige que el nombre de un control contenga todo su texto visible: un subtítulo dentro del botón va en el nombre, no en `aria-describedby` (spec 004 T13).
- El nombre accesible une los elementos en línea sin espacio y recorta los espacios del borde de cada elemento: en un enlace con varias partes (`HistoryRow`), el espacio separador va **entre** elementos (`{' '}`), no dentro del primero.
- Una región `role="status"` que siempre está montada (para que se anuncie): `findByRole('status')` la encuentra vacía al instante; esperar su texto con `waitFor`.
- A 320 px los nombres del seed caben aun sin `overflow-wrap: anywhere`: esa línea no se ejercita hasta que haya nombres propios (spec futura de plantillas).

## 9. Herramientas de verificación

- `eslint-plugin-boundaries` v7: el descriptor `layer` va primero con `exclusive: true`; el grafo de módulos vive en `config/module-graph.json`.
- dependency-cruiser lee `exports` (react-router 8 no tiene `main`) e ignora `virtual:*` (módulos de plugins de Vite).
- stylelint: `overrides.files` se resuelve respecto al archivo de configuración; la prueba pasa la configuración como objeto con `cwd` en los fixtures.
- `size-limit` mide con brotli salvo `"gzip": true`.
- Headers: la prueba de arquitectura lee la CSP de `docs/architecture.md` §7.10; cambiarla es editar ese documento y `vercel.json` a la vez. Vercel aplica headers por la ruta pedida, no por el archivo servido.

## 10. PWA e iOS

- Workbox: el precache por defecto omite `woff2` e íconos (por eso `globPatterns`).
- El generador de íconos añade 30% de relleno blanco salvo `padding: 0`.
- En la primera visita el service worker se instala pero no controla la página hasta recargar; `serviceWorker.ready` puede resolverse en `activating`.
- Aviso de versión nueva en iOS: aparece al volver a abrir la app, y "Actualizar" recarga y aplica la versión. Una versión sin cambios visibles parece que "no hizo nada". El aviso no aparece mientras haya una sesión activa (AC-37).
- **Datos de la PWA instalada (spec 007 T20):** la app de la pantalla de inicio guarda sus datos aparte de Safari. Ajustes de iOS → Safari → Datos de sitios web no la vacía (y además agrupa todo `saulgmx.com`, así que borraría otras apps del dominio). Para empezar de cero: mantener pulsado el icono → "Eliminar app" y reinstalarla desde Safari.
- **Consola del iPhone:** Web Inspector desde la Mac. iPhone: Ajustes → Apps → Safari → Avanzado → Web Inspector. Mac: Safari → Ajustes → Avanzado → "Mostrar funciones para desarrolladores web"; con cable, menú Desarrollo → el iPhone → la página. El handler global escribe "Unexpected error" seguido del error real.
- Safari del iPhone inyecta scripts propios (la hoja de compartir) que pueden fallar; llegan como evento `error` con `event.error` nulo. El handler global los ignora con `console.warn` (spec 007 decisión 19); un error de la app siempre trae el objeto (`only-throw-error`).
