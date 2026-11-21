# Tareas: Temporizador de descanso

**Plan:** `specs/009-temporizador/plan.md`

Cada tarea es pequeña (≤ 1-2 h), deja el CI verde y tiene una verificación concreta.

- **Prueba primero:** en el dominio del descanso (`restOf`, `restTimer`, `restSignal`), la tarea de pruebas va antes que la de implementación. El commit en rojo se queda local y se sube con la tarea que lo pone en verde. En `app` y en los formatos, las pruebas se escriben primero dentro de la misma tarea.
- **Antes de escribir pruebas:** revisar si el contrato deja comportamientos sin definir. Si los deja, proponerlos y, con tu aprobación, escribirlos en los docs antes del código.
- **Mutaciones:** tras cada prueba en verde, romper el código a propósito y ver que falla la prueba correcta.

**Responsable:** C = Claude Code · Q = Qwen 3.6 35B local con `~/qwen-calib/run-qwen.sh` (ADR-0014 propuesto; calibración de UI) · U = usuario (requiere tu dispositivo o una decisión tuya).

## A. Dominio de `training`

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T1 | Pruebas de `restOf` y `restTimer` (`training/__tests__/rest.test.ts`) con los datos de la spec §4: "2:00" al marcar (AC-1) y "0:36" a las 18:11:24 (AC-2); aislamiento "1:00" (AC-3); el `restSeconds` del ejercicio elegido (AC-4); otra serie marcada reemplaza la referencia (AC-5); sin pendientes no hay descanso, y una extra lo devuelve con el tiempo ya contado (AC-6, AC-7); desmarcar la referencia o otra serie (AC-8, AC-9); `ready` con el tiempo hasta el máximo (AC-12, AC-13); fin en `now ≥ maxAt`; ±15 s mueven los dos extremos (AC-17 a AC-21); "Saltar" (AC-22); un ajuste de otro `setId` se ignora (RN-TRN-34); reloj que retrocede (AC-28); desempate por `order` y `setNumber`; `min = max`; offsets distintos en `completedAt` y `now` (ADR-0009); el ejercicio que falta en la vista lanza citando RN-TRN-32 | `training/domain`, `application` | Pruebas en rojo | RN-TRN-32 a 34; AC-1 a AC-9, AC-12, AC-13, AC-17 a AC-22, AC-28 | C | ☐ |
| T2 | Implementar `restOf` en `domain/rest.ts` y `restTimer` en `application/rest.ts`; exportar `restTimer` y los tipos por `index.ts` | `training` | T1 en verde; `npm run lint`; `npx tsc -b --force`; mutaciones detectadas (instantes comparados como texto, `floor` en vez de `ceil`, ajuste aplicado a otra serie, buscar pendientes solo en el ejercicio de referencia, sin la regla del reloj que retrocede, `>` en vez de `≥` en el máximo, desempate al revés, `restSeconds` del principal en vez del elegido) | Ídem | C | ☐ |
| T3 | Pruebas de `restSignal` (en `rest.test.ts`): la tabla del plan §6.3, fila por fila, más `prev = null`, `setId` distinto, `ready` → `resting` (AC-21) y `→ null` sin `byTime` (Saltar, −15 s, vuelta tardía) | `training/domain` | Pruebas en rojo | RN-TRN-35; AC-12, AC-14, AC-19 a AC-22, AC-26, AC-27 | C | ☐ |
| T4 | Implementar `restSignal` en `domain/rest.ts` y exportarla | `training/domain` | T3 en verde; `npm run lint`; mutaciones detectadas (suena sin `byTime`, sin comprobar el `setId`, sin anunciar `ready` tras un control, anuncia el fin sin `byTime`, `min = max` con 1 tono) | Ídem | C | ☐ |
| T5 | `formatRestTime` y `formatRestRange` en `ui/format.ts`, exportadas por `index.ts` | `training/ui` | Pruebas primero en `format.test.ts`: `120` → "2:00", `36` → "0:36", `0` → "0:00", `600` → "10:00"; `[120, 180]` → "2:00–3:00" con U+2013; mutaciones detectadas (sin rellenar los segundos, guion normal) | RN-TRN-33; AC-1, AC-3 | C | ☐ |

**Punto de control A:** PR "rest: domain". No cambia nada visible.

## B. Servicios de `app`

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T6 | `useSessionStore` en `app/pages/session/session-store.ts` (plan §6.2) | `app` | Pruebas primero (`session-store.test.ts`): +15, −15 y suma de varios; "Saltar"; un `setId` nuevo parte de 0 y sin salto; mutaciones detectadas (conserva el offset al cambiar de serie, el salto no se reinicia) | RN-TRN-34; AC-17, AC-18, AC-22 | C | ☐ |
| T7 | `RestSound` en `app/rest-sound.ts` (plan §6.4); `restSound` en `AppServices`, creado en `compose`; el falso en `test-app.tsx` | `app` | Pruebas primero (`rest-sound.test.ts`, `AudioContext` falso): el contexto se crea en el primer `unlock()` y no al crear el servicio; `unlock()` reanuda uno suspendido; `play(1)` y `play(2)` programan 1 o 2 osciladores de 880 Hz con el segundo 250 ms después; sin `running` o sin API no hace nada ni lanza; mutaciones detectadas (crea el contexto al cargar, suena suspendido, una sola nota en `play(2)`, sin `try/catch`) | RN-TRN-35; AC-16, AC-38 | C | ☐ |
| T8 | `ScreenWake` en `app/wake-lock.ts`, `useDocumentVisible` y `useScreenWakeWhile` (plan §6.5); `screenWake` en `AppServices` y en `compose` | `app` | Pruebas primero (`screen-wake.test.tsx`, falso que cuenta): pide con `active && visible`, suelta al pasar a `false` o al desmontar, vuelve a pedir al volver visible, no pide si ya no está activo, la carrera (se resuelve tras la limpieza y se suelta), rechazo y `null` sin errores sin capturar; mutaciones detectadas (sin limpieza, sin la bandera `cancelled`, sin `catch`, sin depender de `visible`) | AC-35 a AC-38 | C | ☐ |

**Punto de control B:** PR "rest: app services". No cambia nada visible.

## C. Tarjeta en la sesión

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T9 | Pruebas de `RestTimer` (`training/__tests__/rest-timer.test.tsx`) y el esqueleto que fija su interfaz: `ui/RestTimer.tsx` con `RestTimerProps` exportado (`rest: RestState`, `onShift(15 \| -15)`, `onSkip()`) y un cuerpo vacío, exportado por `index.ts`. Pruebas: `role="group"` con nombre "Descanso" o "Ya puedes"; `data-rest` y `data-phase`; el tiempo con `formatRestTime`; "Rango 2:00–3:00"; tres botones con nombre exacto "−15 s" (U+2212), "+15 s" y "Saltar", sin `aria-label`; cada botón llama a su callback; el tiempo no está en una región viva | `training/ui` | Pruebas en rojo; el esqueleto compila (`npx tsc -b --force`) y pasa lint | AC-1, AC-3, AC-12, AC-15, AC-29 (nombres) | C | ☐ |
| T10 | Cuerpo de `RestTimer` y su CSS (plan §6.6): filas, tipografía con cifras tabulares, botones del mismo ancho y ≥ 44 px, `data-phase` con los tokens de la spec §6.1. Brief en `~/qwen-calib/009-T10/` (ver notas) | `training/ui` | T9 en verde; `npm run lint` (ESLint y stylelint); `npx tsc -b --force`; ningún archivo fuera de lo permitido; mutaciones de UI: sin `role="group"` (T9), color literal en el CSS (stylelint), botón de menos de 44 px (no lo ven jsdom ni el lint: lo detecta el E2E de AC-29 en T14). Revisión visual en T12 | AC-1, AC-3, AC-12, AC-29 | Q | ☐ |
| T11 | `useRestTimer(view, clock)` en `app` (plan §6.2): tic de 250 ms con el mismo objeto si no cambió, intervalo solo con descanso y página visible, `byTime` según la tabla del plan y `restSignal` en cada lectura | `app` | Pruebas primero (`rest-timer-hook.test.tsx`, reloj falso y temporizadores falsos): AC-12 y AC-14 suenan y anuncian; un control, una vista nueva o la vuelta a primer plano leen con `byTime = false` (AC-19, AC-26, AC-27); sin tonos al montar; mutaciones detectadas (`byTime` siempre `true`, sin `visibilitychange`, objeto nuevo en cada tic, intervalo sin descanso) | RN-TRN-35; AC-12, AC-14, AC-19, AC-26, AC-27, AC-34 | C | ☐ |
| T12 | `RestSlot` en `app/pages/session`: `useRestTimer`, `useSessionStore`, `restSound.play`, `useScreenWakeWhile`, `<p role="status">` siempre montado, foco (spec §6.1); el pie pasa a `<div>` con `RestSlot` y el `<nav>`; `onClickCapture` con `restSound.unlock()` en `SessionPage`; `.screen:has([data-rest])`. Correr los E2E en local antes del PR (el pie es compartido) | `app/pages/session` | Pruebas primero (`session-rest.test.tsx`, `session-rest-wake.test.tsx`, módulos reales, reloj, `RestSound` y `ScreenWake` falsos): AC-1 a AC-3, AC-5, AC-10, AC-11, AC-12 a AC-15 (anuncios), AC-17 a AC-25, AC-35 a AC-38; foco tras "Saltar" con y sin serie pendiente y sin mover el foco si estaba fuera (AC-22); AC-34 con un `Profiler` que cuenta los renders de `SetTable`; mutaciones detectadas (sin `role="status"` o montado solo con la tarjeta, sin `unlock` en el toque, foco al `body`, tic en `SessionPage`). **Revisión visual:** E2E temporal con capturas de Playwright de las dos fases a tamaño normal y a 320 px, en el scratchpad, revisadas por Claude y borradas al terminar; en el mismo E2E se mide con `boundingBox()` que "−15 s", "+15 s" y "Saltar" miden ≥ 44 × 44 px, para encontrar un fallo de T10 antes del PR de C y no hasta T14. Un problema en lo que hizo Qwen vuelve a T10 como ronda de revisión (notas) | AC-1 a AC-25, AC-34 a AC-38 | C | ☐ |
| T13 | Medir el bundle (`npm run build` y `npm run size`) | raíz | `npm run size` < 200 kB; la medición se anota en el plan §6.7 | AC-31 | C | ☐ |

**Punto de control C:** PR "rest: session card". Tras C, el temporizador funciona en la app.

## D. Verificación y cierre

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T14 | E2E: `tests/e2e/rest.spec.ts` (marcar y ver "2:00"; fases con `page.clock` pausado respecto al `completedAt` guardado; recarga a las 18:11:00 con "1:00"; sin conexión; la última fila no queda tapada a 320 px); la sesión con la tarjeta en `a11y.spec.ts` (axe, botones ≥ 44 × 44 px, 320 px); un descanso completo con tonos en `csp.spec.ts` | `tests/e2e` | Chromium y WebKit en verde; mutantes E2E detectados tras reconstruir (botón de 40 px, tarjeta sin reserva de altura) | AC-1, AC-12, AC-14, AC-24, AC-29, AC-30, AC-32 | C | ☐ |
| T15 | Verificación en el iPhone con la PWA instalada: en modo silencio no suena y el cambio visual ocurre (AC-16); sin descanso la pantalla se bloquea (AC-39); con descanso no se bloquea (Wake Lock, iOS ≥ 18.4); el tono con música de otra app sonando: si la pausa, se añade `audioSession.type = 'ambient'` (plan §6.4) en una tarea nueva | — | Resultado anotado aquí | AC-16, AC-35, AC-39 | U | ☐ |
| T16 | `handoff.md`; evidencia de la calibración en el handoff y en ADR-0014 (ver notas) | docs | — | — | C | ☐ |

**Punto de control D:** PR de cierre de la spec 009.

## Notas

- **Olas en C:** T9 primero (Opus). En cuanto T9 está en rojo con el esqueleto commiteado en local, se lanza T10 en segundo plano y se trabaja T11 mientras tanto. T12 espera a T10 y a T11.
- **T10 en un worktree aparte:** si Qwen trabajara en la misma carpeta que T11, `run-qwen.sh` contaría los cambios de Opus como suyos (fuera de `allowed.txt`) y el intento 1 exige el árbol limpio.
  - `git worktree add --detach ../gym-app-q-009-T10 HEAD` (con el commit en rojo de T9) y, desde la raíz de ese worktree, `~/qwen-calib/run-qwen.sh 009-T10 1` en segundo plano. Qwen no ejecuta comandos, así que el worktree no necesita `node_modules`.
  - **Calentamiento antes de cada intento**, para que la duración sea solo de Qwen: una petición mínima dispara la carga JIT con la configuración guardada, sin cargar el modelo a mano. Después `run-qwen.sh` debe reportar `cold_start=no`; si el calentamiento falla o sale `yes` de todos modos, se anota así en la evidencia.
    ```sh
    curl -sf http://localhost:1234/v1/chat/completions -H "content-type: application/json" \
      -d '{"model":"qwen/qwen3.6-35b-a3b","max_tokens":1,"messages":[{"role":"user","content":"ok"}]}' >/dev/null
    ```
  - Las rondas de revisión (intentos 2 y 3) corren en el mismo worktree, que conserva lo del intento anterior.
  - Para verificar, se aplica en el repo principal el estado final del worktree respecto de su `HEAD` (`git -C ../gym-app-q-009-T10 diff HEAD > …/final.patch` y `git apply`), no el `.patch` de un solo intento, que es relativo al anterior. Lint, typecheck, pruebas y mutaciones corren en el repo principal.
  - Al cerrar T10: `git worktree remove ../gym-app-q-009-T10`.
- **Rondas de revisión de T10:** si la verificación o la revisión visual de T12 encuentran un problema en lo que hizo Qwen, se le manda como ronda de revisión (`brief-2.md`, como en la 008 T5) en vez de corregirlo Opus, y se anota aparte en la evidencia (qué encontró la revisión y en qué ronda se corrigió). Hasta 3 intentos (ADR-0014); después escala a Opus.
- **T10 es una hoja:** `RestTimer` solo recibe `RestTimerProps` (fijado en el contrato `training.md` v1.36 y en el esqueleto de T9) y no usa hooks propios, el store, el reloj, el sonido ni el Wake Lock. Si el brief obliga a Qwen a decidir de dónde sale el tiempo, la tarea está mal partida.
- **`allowed.txt` de T10:** `src/modules/training/ui/RestTimer.tsx` y `src/modules/training/ui/RestTimer.module.css`. Ni `index.ts` (lo exporta T9) ni las pruebas.
- **Brief de T10:** apunta a `rest-timer.test.tsx` (sin copiarlo) y a `RestTimer.tsx` (el esqueleto con `RestTimerProps`), pero no al plan ni a la spec: copia los extractos que necesita.
  - Estructura: fila 1 con el título ("Descanso" o "Ya puedes") y debajo el tiempo, y a la derecha "Rango …"; fila 2 con "−15 s", "+15 s" y "Saltar", del mismo ancho.
  - Tipografía: el tiempo grande en Space Grotesk 700 (`--font-heading`) con `font-variant-numeric: tabular-nums`; "Rango …" en `--text-muted`.
  - Tokens por `data-phase`: en `resting`, título en `--text-muted` y fondo `--surface`; en `ready`, título en `--accent` y borde de 1 px en `--accent`. Sin barra de progreso ni animaciones.
  - `src/shared/ui/tokens.css` es el único archivo con colores literales; en el CSS, solo variables (`--surface`, `--accent`, `--text-muted`…). stylelint lo exige (`declaration-strict-value`, `color-no-hex`, `color-named`).
  - Clases de CSS Modules en camelCase (`selector-class-pattern`) y `cx()` de `@/shared/ui` para combinarlas (con `noUncheckedIndexedAccess`, cada clase es `string | undefined`).
  - Objetivos táctiles ≥ 44 px y contraste WCAG 2.2 AA con los tokens existentes, sin colores nuevos.
  - Los textos van en línea en el componente, como en `SessionHeader.tsx`: `training/ui` no tiene archivo de textos, así que no hay claves que agregar.
  - Nombre accesible = texto visible, sin `aria-label` (WCAG 2.5.3); "−15 s" con U+2212.
  - Todo código de ejemplo del brief pasa `npm run lint` (ESLint y stylelint) y `tsc` antes de enviarse.
- **Evidencia para ADR-0014 (T16):**
  - Por intento: duración de la ejecución por separado del tiempo de carga del modelo (JIT: con el calentamiento de "Olas en C", `cold_start=no`; si sale `yes`, la duración incluye la carga y se anota así), número de turnos y de errores de herramienta (`.jsonl`), archivos tocados fuera de `allowed.txt`, resultado de lint, typecheck y pruebas, y mutaciones detectadas.
  - La causa de cada fallo: brief, prueba, modelo o infraestructura.
  - **Desviación de ADR-0014:** en T10 las pruebas de UI las escribió Opus (T9), no Qwen, como pide el ADR ("En UI, Opus define los criterios y Qwen escribe las pruebas"). Que Qwen escriba pruebas de UI queda para la spec 012.
  - **Criterio de aceptación del ADR** (es `Propuesto`, así que se edita; aprobado por el dueño del producto el 20-nov): spec 008 T5 (dominio), spec 008 T9 (`application`) y spec 009 T10 (UI) cubren los tres perfiles, pero un solo dato de UI es poco. ADR-0014 pasa a `Aceptado` después de la spec 012 (progreso), con varias tareas `Q` en olas y la tasa de escalamiento real.
