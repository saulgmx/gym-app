# Tareas: Rediseño de la sesión activa

**Plan:** `specs/004-rediseno-sesion/plan.md`

Cada tarea es pequeña (≤ 1-2 h), deja el CI verde y tiene una verificación concreta. No hay dominio nuevo, pero los componentes con comportamiento nuevo (`Dialog`, menú, aviso de salida) llevan sus pruebas antes que el código (plan §7): el commit en rojo se queda local y se sube con la tarea que lo pone en verde.

**Responsable:** C = Claude Code · U = usuario (requiere tu cuenta, tu dispositivo o una decisión tuya).

## A. Piezas de los módulos

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T1 | Pruebas de `Dialog`: `showModal` al abrir y `close` al cerrar; foco en `initialFocus` o en el primer control; foco devuelto al elemento que lo tenía; Escape llama a `onClose` sin cerrar solo; tocar el fondo (`target` = `<dialog>`) llama a `onClose` solo con `dismissOnBackdrop`, y un clic dentro nunca; `placement` como clase; `aria-labelledby` y `aria-describedby`. Pruebas de `ConfirmDialog` con `dismissOnBackdrop` (fondo → `onCancel`) y sin él (el fondo no hace nada) | `shared/ui` | Pruebas en rojo; las actuales de `confirm-dialog.test.tsx` siguen sin cambios. **Hecho (18-nov):** antes, el contrato fijó cinco reglas (foco inicial sin `initialFocus`, foco devuelto solo si `isConnected`, también al desmontarse abierto, fondo solo si `pointerdown` y `click` caen en el `<dialog>`, y `data-placement`) | AC-8, AC-13, AC-16 | C | ☑ |
| T2 | Implementar `Dialog` (`Dialog.tsx`, `Dialog.module.css` con `bottom` y `top`) y reescribir `ConfirmDialog` sobre él, con `dismissOnBackdrop` (contrato `shared` §4) | `shared/ui` | T1 en verde; las pruebas de "Hoy" y de la sesión siguen en verde sin cambios; stylelint pasa; mutaciones detectadas (sin devolver el foco, fondo siempre activo, Escape que cierra solo). **Hecho (18-nov):** 802 unitarias y 86 E2E en verde. 16 mutantes: 15 detectados por la prueba de su regla (dos pruebas añadidas para ello: el clic de teclado tras un toque cancelado en el fondo y el clic sin `pointerdown` tras cerrar). El otro, quitar `initialFocus={cancel}` de `ConfirmDialog`, es equivalente ("Cancelar" ya es el primer control); se deja explícito por P-2. El relleno pasa del `<dialog>` a su contenido, para que solo el fondo tenga el `<dialog>` como `target` | AC-8, AC-13, AC-16 | C | ☑ |
| T3 | Textos de la sesión en `training/ui/format.ts`: `formatRange` ([6, 10] → "6-10", [4, 4] → "4"), `formatTarget` ("2 × 6-10", "2 × 30-45 s") y `formatSetCount` ("1 serie", "2 series"); exportados por `index.ts` (contrato v1.18) | `training/ui`, `index.ts` | Pruebas unitarias primero, luego el código; mutaciones detectadas. **Hecho (18-nov):** 6 pruebas; 6 de 6 mutantes detectados (rango sin un solo valor, sin " s", " s" también en reps, series + 1, siempre plural, singular con 2) | AC-5, AC-20, AC-23, AC-24 | C | ☑ |
| T4 | `SetTable` y `SetRow`: columna "Seg" en `metric: 'time'`; `placeholder` de reps y RIR con `formatRange`, sin pista en kg; `data-current` en la fila de la serie de menor `setNumber` sin hacer (contrato v1.18) | `training/ui` | Pruebas de componente: "Seg" y el nombre "Serie 1, segundos"; pistas "6-10" y "3-4" (y "4" con RIR 4-4) que no se guardan; serie actual en el ejemplo, al marcarla y con una extra; las pruebas que citaban "s" se actualizan; stylelint pasa; mutaciones detectadas. **Hecho (18-nov):** 7 pruebas nuevas y la de "s" pasa a "Seg"; 8 de 8 mutantes detectados. La serie actual se marca con `data-current` (como `data-state` en "Hoy"), no con una clase, y se calcula con `sets.find` porque la vista ya viene por `setNumber` (RN-TRN-17). Pista en `--text-muted` sobre `--surface-2`: 6.68:1. 814 unitarias y 86 E2E en verde | AC-26 a AC-30 | C | ☑ |

**Punto de control A:** PR "session redesign module pieces".

## B. Encabezado y menú

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T5 | Pruebas de `SessionHeader` nuevo: una fila con "Salir de la sesión" (llama a `onExit`), "Ejercicio 2 de 7" con `aria-expanded` y `aria-haspopup="dialog"`, nombre accesible = texto visible, y `elapsed` tal cual llega (o nada con `null`). Menú: nombre y título `workout.name`; resumen "1 de 7 hechos · 1 en curso" y "7 de 7 hechos" sin "en curso"; estado y subtítulo de cada fila (pendiente, en curso, hecho, `time`, alternativa elegida); nombre accesible con el estado; `aria-current` en el que se ve, distinto del "en curso"; elegir llama a `onNavigate` y cierra; fondo y Escape cierran sin navegar; sin "Descartar sesión" | `training/ui` | Pruebas en rojo. **Hecho (18-nov):** antes, la spec 004 (AC-5, §6.2) y el contrato fijaron cuatro reglas: estado de la fila con texto oculto, pendiente con series hechas → "N de M series", foco en la fila que se ve y resumen como descripción; las filas llevan `data-state`. 17 pruebas sobre una vista con un ejercicio en cada estado; 16 en rojo (AC-3 ya pasaba) | AC-1, AC-4 a AC-11 | C | ☑ |
| T6 | Implementar `SessionHeader` con el `Dialog` de T2 (contrato v1.18). Mover `Elapsed` a `app/pages/Elapsed.tsx` y `formatElapsed` a `app/format-time.ts` (con sus pruebas); `ActiveSessionCard` cambia el import. `SessionPage` le pasa `<Elapsed />` o `null` según `isToday`, calculado una vez al montar (plan §6.4), y `onExit`, que **por ahora abre la confirmación de descarte actual** para no dejar el descarte sin acceso hasta T9. Actualizar las pruebas de página y el E2E de `session.spec` que usan "Ver ejercicios" | `training/ui`, `app/pages` | T5 en verde; pruebas de página: tiempo "18:42" con reloj fijo y sin tiempo en una sesión del día anterior; elegir en el menú lleva el foco al `h1` nuevo (`waitFor`); `npm run test:e2e` pasa; `npm run lint` (fronteras: `training/ui` no importa `plan` ni `Clock`); mutaciones detectadas. **Hecho (18-nov):** 827 unitarias y 86 E2E en verde; 14 de 14 mutantes detectados (AC-3 comprueba además que no queda una píldora vacía). `SessionContent` lee `clock.today()` una vez al montarse. El E2E del foco devuelto abre con el teclado: WebKit no enfoca un botón al hacerle clic (handoff, notas) | AC-1 a AC-11 | C | ☑ |

**Punto de control B:** PR "session redesign header and menu".

## C. Página de la sesión

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T7 | Textos en `app/pages/session/format.ts`: "Llevas N de M ejercicios y m:ss de entrenamiento." y, sin tiempo, "Llevas N de M ejercicios."; "Siguiente: <nombre> · <objetivo>" y "Último ejercicio de hoy" | `app/pages/session` | Pruebas unitarias primero; valores comprobados con Node; mutaciones detectadas. **Hecho (18-nov):** "ejercicio" concuerda con el total y "Último ejercicio de hoy" se usa también en una sesión de otro día (decisiones anotadas en spec §6.3 y §6.6); 6 pruebas, 6 de 6 mutantes detectados | AC-12, AC-18, AC-31 a AC-34 | C | ☑ |
| T8 | `ExerciseCard`: `h1`, compacta ("2 × 6-10 · RIR 3-4") o completa (chips, `cue` y nota sin etiqueta, "Cambiar a …" con su regla y su ayuda), mensaje de error visible en los dos modos, "Ver detalles" / "Ocultar detalles" con `aria-expanded` y `aria-controls`. `expanded` sube a `SessionContent` (plan §6.5) | `app/pages/session`, `app/pages` | Pruebas de página: empieza compacta; se conserva al pasar a otro ejercicio por "Siguiente" y por el menú; vuelve a compacta al montar de nuevo; Plancha en segundos; "RIR 4"; "Cambiar a …" deshabilitado con una serie hecha y ausente sin alternativa; las pruebas de spec 002 AC-22 a AC-24 pasan por "Ver detalles"; stylelint pasa; mutaciones detectadas. **Hecho (18-nov):** los detalles quedan en el DOM con `hidden`, para que `aria-controls` siempre apunte a algo. 840 unitarias y 86 E2E en verde; 13 de 13 mutantes detectados | AC-20 a AC-25 | C | ☑ |
| T9 | Pruebas del aviso de salida (`app/__tests__/session-exit.test.tsx`): título, texto con y sin tiempo, tres opciones en orden y sin "Terminar y guardar"; foco inicial en "Seguir entrenando"; seguir, fondo y Escape cierran con el foco en la flecha; "Salir y continuar después" va a "Hoy" sin tocar datos; "Descartar sesión" abre la confirmación con los textos de spec 003; "Cancelar", fondo y Escape vuelven al aviso; "Sí, descartar" deja el workout `discarded` con sus series y vuelve a "Hoy" con `replace`; un fallo muestra el mensaje de ADR-0010 | `app/__tests__` | Pruebas en rojo. **Hecho (18-nov):** antes, la spec 004 §6.3 fijó cuatro reglas: tiempo calculado al abrir, "Salir y continuar después" como enlace con navegación normal, nombre = texto principal y subtítulo como descripción, y el fallo del descarte cierra todo y muestra el motivo en la tarjeta. 14 pruebas, las 14 en rojo porque el aviso no existía | AC-12 a AC-18 | C | ☑ |
| T10 | Implementar `ExitSheet` (`Dialog` abajo con `dismissOnBackdrop`, estado `'closed' \| 'exit' \| 'confirm'`, `ConfirmDialog` con `dismissOnBackdrop`, plan §6.8) y conectarlo a `onExit`, en lugar del atajo de T6 | `app/pages/session` | T9 en verde; las pruebas de descarte de spec 002 AC-34 y spec 003 AC-26 pasan por el aviso; el E2E de descarte de `session.spec` se actualiza y pasa; stylelint pasa; mutaciones detectadas (cancelar que cierra todo, foco que no vuelve). **Hecho (18-nov):** 854 unitarias y 86 E2E en verde; el E2E AC-34 recorre aviso → confirmación → Escape (vuelve al aviso) → "Seguir entrenando" (foco en la flecha) → descartar. 12 mutantes: 11 detectados; quitar `initialFocus` de "Seguir entrenando" es equivalente (ya es el primer control) y se deja explícito, como en `ConfirmDialog`. Contraste del aviso: subtítulos 6.68:1 y 7.48:1, "Descartar sesión" 9.68:1 | AC-12 a AC-18 | C | ☑ |
| T11 | `SessionFooter`: línea "Siguiente: …" o "Último ejercicio de hoy" sobre "Anterior" (secundario) y "Siguiente" (principal, más ancho); sin "Anterior" en el primero ni "Siguiente" en el último | `app/pages/session` | Pruebas de página en el ejercicio 1, 2 y 7, con Plancha y con una alternativa elegida; las de spec 002 AC-25 siguen en verde; mutaciones detectadas. **Hecho (18-nov):** 5 pruebas nuevas; 7 de 7 mutantes detectados (uno se rehízo porque no compilaba). Los estilos del pie pasan a `SessionFooter.module.css`; "Anterior" queda con borde neutro y "Siguiente" más ancho, como el tablero; el contenido reserva el alto del pie más la zona segura. 859 unitarias y 86 E2E en verde | AC-31 a AC-34 | C | ☑ |
| T12 | Medir el bundle (`npm run build` y `npm run size`) | raíz | `npm run size` < 200 kB; medición anotada en plan §6.11. **Hecho (18-nov):** 163.58 kB (+1.67 kB desde 161.91 kB) | AC-37 | C | ☑ |

**Punto de control C:** PR "session redesign page".

## D. Verificación y cierre

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T13 | E2E: `session.spec` (menú y salto a un ejercicio; salir y continuar, ver D2 y volver; descartar desde el aviso con "Cancelar" que vuelve al aviso; campo escrito sin confirmar que se guarda al tocar la flecha; traza < 100 ms con el reloj corriendo; sin conexión) y `a11y.spec` (axe en la tarjeta compacta y completa, el menú, el aviso y la confirmación; objetivos ≥ 44 px; 320 px con la plantilla más larga) | `tests/e2e` | `npm run test:e2e` pasa local y en CI, en Chromium y WebKit; las pruebas nuevas, estables en 5 repeticiones; el foco al pasar del aviso a la confirmación comprobado en WebKit (riesgo del plan §8) | AC-14, AC-17, AC-19, AC-35, AC-36, AC-38 | C | ☐ |
| T14 | Tras el despliegue, en el iPhone (PWA instalada): empezar una sesión, abrir y cerrar el menú tocando el fondo, saltar a un ejercicio, abrir "Ver detalles" y pasar a otro, salir y continuar desde "Hoy", descartar desde el aviso con "Cancelar" en medio; modo avión | producción | Todo se ve como el tablero A3; el fondo cierra los diálogos; nada queda bajo la barra de inicio ni de Safari | AC-35 (manual en iOS), riesgos del plan §8 | U + C | ☐ |
| T15 | Actualizar `handoff.md`, marcar la spec y el plan como implementados y revisar los comandos de `CLAUDE.md` | docs | Revisión | — | C | ☐ |

**Punto de control D:** PR "session redesign handoff".

## Modelo recomendado por tarea

Guía para elegir el modelo de Claude Code en cada tarea (18-nov). Si el costo o los límites de uso no importan, Opus en todas es lo más simple y reduce el retrabajo.

| Punto | Modelo | Por qué |
|---|---|---|
| A (T1-T4) | Opus en T1-T2; Sonnet en T3-T4 | `Dialog` reemplaza la base de `ConfirmDialog` y tiene las trampas de foco de WebKit; los textos y la tabla son cambios chicos |
| B (T5-T6) | Opus | Mueve `Elapsed`, cambia la API de un componente público y toca fronteras y foco |
| C (T7-T12) | Sonnet en T7, T11 y T12; Opus en T8-T10 | T8-T10 son la página con estado compartido y la secuencia de dos diálogos |
| D (T13-T15) | Opus en T13; Sonnet en T15 | T13 es E2E en WebKit con diálogos encadenados, donde más se pierde con pruebas inestables. T14 es tuya en el iPhone |

Cambiar a Opus en cuanto Sonnet decida algo que no está en el plan o se atore con una prueba inestable. Con cualquier modelo, cada tarea cierra con `npm run lint` y `npm test` en verde y las mutaciones anotadas en "Verificación".

## Notas

- **Ramas:** primero se fusiona `docs/004-session-redesign-spec` (spec, plan, contratos y estas tareas). La implementación va en `feat/004-session-redesign-a` a `-d`, cada una desde `main` actualizado, con un commit por tarea y un PR por punto de control ("Create a merge commit").
- **Pruebas en rojo:** T1, T5 y T9 se quedan como commit local y se suben junto con la tarea que las pone en verde (T2, T6 y T10), para que el CI del PR nunca esté en rojo.
- **Paso intermedio de T6:** al quitar "Descartar sesión" del menú, la flecha abre la confirmación de descarte hasta que T10 traiga el aviso de salida. Así el punto de control B se puede fusionar sin dejar el descarte sin acceso.
- **Antes de cada tarea de pruebas:** revisar si el contrato deja comportamientos sin definir, proponerlos y, con tu aprobación, escribirlos en el contrato antes del código (handoff).
- **Mutaciones:** tras cada prueba en verde, romper el comportamiento a propósito y ver que falla la prueba de ese criterio, con copia de seguridad de nombre único (handoff).
- **Nombres de pruebas:** citan el criterio, por ejemplo `it('AC-16: Cancelar vuelve al aviso de salida')`.
- **Textos que cambian en pruebas existentes:** "s" pasa a "Seg" (T4), "Ver ejercicios" desaparece (T6) y el descarte pasa por el aviso de salida (T6 y T10). Las pruebas de spec 002 y 003 que los citan se actualizan en la misma tarea.
- **Foco en pruebas:** el que se mueve en un efecto llega después del render; esperarlo con `waitFor` (handoff).
