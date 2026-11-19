# Tareas: Cierre de sesión

**Plan:** `specs/005-cierre/plan.md`

Cada tarea es pequeña (≤ 1-2 h), deja el CI verde y tiene una verificación concreta. En `health` y en las reglas nuevas de `training` (RN-TRN-22 a 26), la tarea de pruebas va antes que la de implementación (P-5): el commit en rojo se queda local y se sube con la tarea que lo pone en verde. Antes de escribir pruebas, revisar si el contrato deja comportamientos sin definir; proponerlos y, con tu aprobación, escribirlos en los docs antes del código (handoff, notas).

**Responsable:** C = Claude Code · U = usuario (requiere tu cuenta, tu dispositivo o una decisión tuya).

## A. Dominio de `health`

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T1 | Pruebas de `checkPainInput` y `assessPain` (`domain/pain.ts`): 0-10 enteros válidos; −1, 11, 2.5, `NaN` → `health/pain-out-of-range`; bandera desconocida o repetida → `health/invalid-red-flag`; bandas 0, 3 / 4, 6 / 7, 10 con los mensajes literales de spec §6.2; la banda no depende del umbral; cualquier bandera → `redFlagMessage` y `blocksProgression`; `bladder_bowel` → mensaje de urgencias; `alert` → `blocksProgression`; casos de borde del contrato v1.4 (`Infinity`, `-0`, orden de errores, `assessPain` lanza) | `health/domain` | Pruebas en rojo; valores comprobados con Node | RN-HLT-01, 02, 06, 07, 15; AC-11, AC-12, AC-14, AC-15 | C | ☐ |
| T2 | Implementar `checkPainInput`, `assessPain` y los textos de `domain/messages.ts` (contrato §6.1) | `health/domain` | T1 en verde; 100% de cobertura del archivo; mutaciones detectadas (límites de banda, bandera que no bloquea, urgencias sin `bladder_bowel`) | Ídem | C | ☐ |
| T3 | Pruebas de `persistentAlert` y `noticeOf` con entradas de la más reciente a la más antigua y umbral 3: [4, 4] alerta y [4, 3] no (RN-HLT-04); [1, 2, 3] `rising_3x`, [1, 2, 2] y [0, 0, 0] no (05); tras [4, 4] un 2 la quita (08); bandera en la última → `red_flag`; aviso: última 3 sin nada → `null`, 4 → `attention`, 2 con `numbness` → `red_flag`, sin entradas → `null` (12); prioridad de RN-HLT-13 (los casos de §8 del contrato); el texto de cada causa con N, U y la secuencia "1 → 2 → 3" | `health/domain` | Pruebas en rojo | RN-HLT-03 a 05, 08, 12, 13; AC-37 a AC-45 | C | ☐ |
| T4 | Implementar `persistentAlert` y `noticeOf` | `health/domain` | T3 en verde; 100% de cobertura; mutaciones detectadas (`>` por `≥` en el umbral, creciente no estricto, prioridad invertida, aviso sin entradas) | Ídem | C | ☐ |

**Punto de control A:** PR "close health domain".

## B. Persistencia de `health` y base v3

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T5 | Pruebas del servicio de `health` con `fake-indexeddb`: `recordPain` valida (T1) y no escribe si falla; guarda `{ workoutId, date, recordedAt, level, redFlags }`; registrar otra vez el mismo workout conserva el `id`, cambia `recordedAt` y no duplica (RN-HLT-09); `hasPainEntry` y `painGate.hasPainEntry`; `getPainSummary` ordena por `recordedAt` (una sesión del lunes cerrada después de la del martes es la última, RN-HLT-14) y arma `latest`, `latestAssessment`, `persistentAlert`, `notice` y `threshold: 3`; un fallo de la base rechaza (como RN-TRN-18) | `health/application`, `infrastructure` | Pruebas en rojo | RN-HLT-09, 14; AC-18, AC-26 | C | ☐ |
| T6 | Implementar `createHealth({ db, clock, ids })`, el repositorio Dexie, `healthStores` y `index.ts` (contrato v1.3) | `health/application`, `infrastructure` | T5 en verde; `npm run lint` (fronteras: `health` no importa ningún módulo); mutaciones detectadas | Ídem | C | ☐ |
| T7 | Base v3 en `app/db.ts` con `healthStores`; `compose` crea `health` antes que `training`, comparte un solo `IdGenerator` y le pasa `painGate` | `app` | Prueba de subida v2 → v3: un workout en curso con series sigue intacto (AC-46); `compose.test.ts` comprueba que `training` recibe el `painGate` de `health`; los E2E siguen en verde | AC-46 | C | ☐ |
| T8 | `usePainSummary(health)` con `useLiveQuery` | `health/ui` | Prueba de hook: `undefined` al cargar, se actualiza al registrar dolor, un error se lanza en el render (como RN-TRN-19) | AC-37 a AC-45 | C | ☐ |

**Punto de control B:** PR "close health persistence".

## C. `training`: cerrar y listar

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T9 | Pruebas del dominio: `finishWorkout(state, { notes, now, hasPain })` en el orden de RN-TRN-22 (cerrado → sin series → sin dolor), `completed` con `finishedAt`, notas recortadas, vacías → sin `notes`, 2001 caracteres → `training/notes-too-long`, series no hechas intactas; `workoutSummary(view, now)`: 52 min 59 s → 52, reloj hacia atrás → 0, parcial → 5 series y 3 de 7 ítems | `training/domain` | Pruebas en rojo | RN-TRN-22, 25; AC-7, AC-8, AC-18 a AC-20 | C | ☐ |
| T10 | Implementar `finishWorkout` y `workoutSummary` en el dominio; `workoutSummary` exportado por `index.ts` | `training/domain`, `index.ts` | T9 en verde; 100% de cobertura de lo nuevo; mutaciones detectadas | Ídem | C | ☐ |
| T11 | Pruebas del servicio y del repositorio: `finishWorkout` con un `PainGate` falso (sin dolor → `pain-required`; con dolor → `completed`; lo pregunta antes de la transacción); `listWorkouts` solo `completed`, rango con límites incluidos y orden (RN-TRN-26); `startWorkout` de un día hecho → `already-done`, con uno activo gana `workout-already-active` (RN-TRN-24); dos `startWorkout` concurrentes tras un cierre → ninguno crea | `training/application`, `infrastructure` | Pruebas en rojo | RN-TRN-06, 22 a 24, 26; AC-31, AC-35 | C | ☐ |
| T12 | Implementar `finishWorkout`, `listWorkouts` y `createIfAllowed` en el servicio y el repositorio; `painGate` en `createTraining`; `useCompletedWorkouts`; textos de los errores nuevos en `app/errors/messages.ts` (plan §6.10) | `training/application`, `infrastructure`, `ui`; `app/errors` | T11 en verde; prueba del hook; `npm run lint`; mutaciones detectadas | Ídem | C | ☐ |

**Punto de control C:** PR "close training".

## D. Componentes de los módulos

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T13 | Pruebas de `PainSelector`, `RedFlagsChecklist` y `PainNotice`: grupo "Dolor lumbar" con 11 botones y `aria-pressed`; mensaje en `aria-live="polite"`; `data-band`; `fieldset` con cuatro casillas nativas y el aviso de banderas; `PainNotice` con su texto | `health/ui` | Pruebas en rojo | AC-10 a AC-15, AC-39 | C | ☐ |
| T14 | Implementar los tres componentes con un `SafetyNote` interno (plan §6.9) | `health/ui` | T13 en verde; stylelint; contraste del ámbar y del botón elegido comprobado con Node; mutaciones detectadas | Ídem | C | ☐ |
| T15 | `WeekStrip` con `done` (contrato `plan` v1.15): ✓ relleno de acento, "hecha" en el `aria-label`, hoy hecho con su anillo; cardio y descanso nunca hechos | `plan/ui` | Pruebas de componente primero; las de spec 003 siguen en verde; contraste del ✓ con Node; mutaciones detectadas | AC-32 a AC-34, AC-36 | C | ☐ |

**Punto de control D:** PR "close module components".

## E. Páginas

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T16 | Pruebas de la página de Cierre (`close-page.test.tsx`): encabezado y resumen (completo, parcial, otro día); "Guardar sesión" deshabilitado con su ayuda hasta elegir; guardar llama a `recordPain` y luego a `finishWorkout` y vuelve a "Hoy" con `replace`; notas; "Volver a la sesión" con `state`, sin él y con un `state` inválido; error en el primer paso (no cierra) y en el segundo (reintento sin duplicar); doble toque; estados ya guardada, no disponible y sin series; otra pestaña guarda | `app/__tests__` | Pruebas en rojo | AC-7 a AC-31 | C | ☐ |
| T17 | Implementar `app/pages/close/` (`ClosePage`, `CloseForm`, `CloseSummary`, `CloseFooter`) en lugar de la página vacía; `SessionPage` distingue `completed` ("Esta sesión ya está guardada.") | `app/pages/close`, `app/pages` | T16 en verde; stylelint; mutaciones detectadas (cerrar sin dolor, navegar sin `replace`, orden de las dos escrituras) | Ídem | C | ☐ |
| T18 | Entradas al Cierre: "Terminar sesión" en `SessionFooter` (último ejercicio con series hechas) y "Terminar y guardar lo hecho" en `ExitSheet`, ambos con `state: { from }` | `app/pages/session` | Pruebas de página primero; las de spec 004 AC-12 y AC-33 se actualizan; mutaciones detectadas | AC-1 a AC-6 | C | ☐ |
| T19 | "Hoy" con sesiones hechas: `useCompletedWorkouts` y `usePainSummary` en `TodayContent` (todas las consultas antes de pintar); `done` a `WeekSection` (N), `WeekStrip` y `OtherDays` (filas "hecha ✓"); `DoneDayCard`; `PainNotice` y el chip "Espalda N/10" solo en D | `app/pages/today`, `app/pages` | Pruebas de página primero (`today-page`, `day-card`); las de spec 003 siguen en verde; mutaciones detectadas | AC-32 a AC-34, AC-36 a AC-45 | C | ☐ |
| T20 | Vista previa de un día hecho: "Ya hiciste esta sesión." sin "Empezar sesión"; `StartWorkoutButton` muestra el texto de `already-done` si llega desde otra pestaña | `app/pages` | Pruebas de página primero (`day-preview`); mutaciones detectadas | AC-35 | C | ☐ |
| T21 | Medir el bundle (`npm run build` y `npm run size`) | raíz | `npm run size` < 200 kB; medición anotada en plan §6.11 | AC-49 | C | ☐ |

**Punto de control E:** PR "close pages".

## F. Verificación y cierre

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T22 | E2E: `close.spec` (sesión completa y parcial hasta "Hoy" con ✓, "1 de 3", "hecha ✓" y el aviso; salir del Cierre sin guardar; sin conexión; aviso de versión nueva tras guardar) y `a11y.spec` (axe en el Cierre con dolor, banderas y nota; "Hoy" con aviso y chip; el aviso de salida con 4 opciones; 44 px y 320 px) | `tests/e2e` | `npm run test:e2e` pasa local y en CI, en Chromium y WebKit; las pruebas nuevas, estables en 5 repeticiones | AC-18, AC-24, AC-32, AC-39, AC-47, AC-48, AC-50 | C | ☐ |
| T23 | Tras el despliegue, en el iPhone (PWA instalada): la base sube a v3 sin perder datos; terminar una sesión real con dolor y una bandera; ver "Hoy" con ✓, la tarjeta hecha y el aviso; terminar una parcial desde el aviso de salida; modo avión | producción | Todo se ve como el tablero Cierre; nada queda bajo la barra de inicio ni de Safari; la sesión aparece hecha | AC-46 a AC-48 (manual en iOS), riesgos del plan §8 | U + C | ☐ |
| T24 | Validar con tu traumatólogo o fisioterapeuta los textos de salud (`health.md` §6.1) | fuera del repo | Si cambian, se actualizan el contrato y la spec (AC-14, AC-15, AC-39 a AC-43) en un PR de docs; si no, se quita `[PROPUESTO]`. No bloquea el cierre de la spec | spec §14 | U | ☐ |
| T25 | Actualizar `handoff.md`, marcar la spec y el plan como implementados y revisar los comandos de `CLAUDE.md` | docs | Revisión | — | C | ☐ |

**Punto de control F:** PR "close handoff".

## Modelo recomendado por tarea

Guía para elegir el modelo de Claude Code en cada tarea. Si el costo o los límites de uso no importan, Opus en todas es lo más simple y reduce el retrabajo.

| Punto | Modelo | Por qué |
|---|---|---|
| A (T1-T4) | Opus | Reglas de salud con pruebas primero; un error aquí es de seguridad (P-1) |
| B (T5-T8) | Opus | Primera persistencia de `health`, base v3 y la composición |
| C (T9-T12) | Opus en T9-T12 | Transacciones, orden de errores y concurrencia entre pestañas |
| D (T13-T15) | Sonnet | Componentes con contrato y pruebas ya definidos |
| E (T16-T21) | Opus en T16-T19; Sonnet en T20 y T21 | El Cierre y "Hoy" combinan tres módulos y varios estados |
| F (T22-T25) | Opus en T22; Sonnet en T25 | E2E estables en WebKit; T23 y T24 son tuyas |

## Notas

- El orden A → B → C deja `health` listo antes de que `training` lo necesite; C no depende de B salvo por `compose` (T7), que ya pasa el `painGate` real.
- Hasta T18 no hay forma de llegar al Cierre desde la interfaz; hasta T19, "Hoy" no muestra nada nuevo. Cada PR deja la app usable como estaba.
- T24 puede hacerse en cualquier momento; si cambian los textos, solo cambian `domain/messages.ts` y sus pruebas.
