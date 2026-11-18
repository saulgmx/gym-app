# Spec: Fase 2, sesión activa

**ID:** 002 · **Estado:** Implementada (17-nov-2026) · **Fecha:** 17-nov-2026
**Requerimientos cubiertos:** RF-10, RF-11, RF-12 (parcial: la columna "anterior"; la sugerencia de peso llega con `progression` en la fase 4), RF-13, RF-14, RF-16, RF-17, RF-19, RNF-01, RNF-02, RNF-05, RNF-09 (versión 2 del esquema) · CA-3 · QS-03, QS-05 · **Fase:** 2 (spec §13)
**ADRs aplicados:** 0006, 0009, 0010, 0012

## 1. Problema y objetivo

"Hoy" ya dice qué toca, pero no se puede registrar nada. En esta fase el usuario inicia la sesión del día (u otra de la semana), registra peso, repeticiones y RIR de cada serie con una mano y en menos de 5 s, y no pierde nada si cierra la app a la mitad. Cerrar la sesión con el dolor lumbar es de la fase 3: en esta fase una sesión solo se descarta.

## 2. Alcance

- **Incluye:**
  - Módulo `training` con sus cuatro capas: dominio (validación de series, instantánea del plan, reglas RN-TRN-*), servicio con puertos, repositorio Dexie y UI (`SetRow`, `SetTable`, `SessionHeader`).
  - Base Dexie `gym-app` **versión 2**: añade `workouts` y `sets` (agregar tablas no requiere `upgrade`, architecture §7.3).
  - API de `training` usada en esta fase: `startWorkout`, `logSet`, `toggleSetDone`, `addExtraSet`, `removeSet`, `chooseExercise`, `discardWorkout`, `getActiveWorkout`, `getWorkout`, `getExerciseHistory`, y los hooks `useWorkout`, `useActiveWorkout` y `useLastSession`.
  - Puerto `SuggestionProvider` con una implementación nula en `app/compose.ts` (siempre `null`); la real llega con `progression` (fase 4).
  - `plan` (contrato v1.11): `PlannedItem.alternatives`, `getExercise` y `getExercises` en `PlanApi`, y la regla del seed RN-PLN-15 (i).
  - "Hoy": "Iniciar sesión", "Continuar sesión", "Descartar sesión" y "Otra sesión de esta semana".
  - Página de sesión activa (`/sesion/:workoutId/:exerciseIndex`): ejercicio actual, tabla de series, columna "anterior", consejo técnico, cambio a la alternativa, navegación entre ejercicios, series extra y "Descartar sesión".
  - Aviso de actualización de la PWA aplazado mientras hay una sesión activa (architecture §7.9).
- **No incluye:**
  - Terminar la sesión: `finishWorkout`, la pantalla de Cierre, el dolor lumbar y `PainGate` (fase 3). RN-TRN-06 no cambia.
  - Historial, `getWorkoutSummary`, `listWorkouts`, `getWorkoutExerciseIds` y `dataPort` de `training` (fase 3).
  - Sugerencias de peso (RF-30, fase 4), temporizador de descanso (RF-15, fase 4) y Wake Lock (RF-18).
  - Sesión libre fuera del plan (RF-06) y sesiones de otra semana.
  - Marcar en la tira de la semana qué días ya se entrenaron: llega con el historial (fase 3).
  - Eventos de `training`: nadie los escucha todavía (ver §5, cambio del contrato).
  - Corregir un workout cerrado (RN-TRN-07, v1.1).

## 3. Historias de usuario

- Como usuario en el gym, quiero iniciar la sesión de hoy con un toque y ver los ejercicios con sus series ya creadas, para no armar nada a mano.
- Como usuario, quiero registrar peso, repeticiones y RIR de cada serie con una mano y marcarla como hecha, para llevar el registro sin interrumpir el entrenamiento.
- Como usuario, quiero que la siguiente serie ya tenga el peso que acabo de usar, para no escribirlo cada vez.
- Como usuario, quiero cerrar la app o quedarme sin batería a mitad de sesión y, al volver, seguir donde iba.
- Como usuario, quiero cambiar a la alternativa de un ejercicio (por ejemplo, jalón al pecho si las dominadas están ocupadas).
- Como usuario, quiero ver el consejo técnico de cada ejercicio ("Costillas abajo, sin arco"), para cuidar la zona lumbar.
- Como usuario, quiero hacer el sábado la sesión que falté el viernes, sin cambiar el plan.
- Como usuario, quiero añadir una serie extra cuando me siento bien, o quitar una que no voy a hacer.

## 4. Criterios de aceptación

Las fechas de ejemplo suponen un programa que empieza el lunes 16-nov-2026. En la semana 1 (factor 0.7, RIR 3-4) el lunes y el viernes son Full body A, el miércoles Full body B, el martes y el sábado cardio, y el jueves y el domingo descanso. Full body A empieza con Prensa de piernas (`sets: [3, 3]` → 2 series planificadas) y Press de banca con barra (alternativa: Press de banca con mancuernas).

### 4.1 Iniciar y recuperar la sesión

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-1 | Lunes 16-nov, sin sesión activa | Toco "Iniciar sesión" en "Hoy" | Se crea un workout `in_progress` con `date = plannedFor = 2026-11-16`, `templateId` de Full body A, `programWeek = 1` y los 7 ejercicios en orden; Prensa tiene 2 series vacías (`weightKg`, `reps` y `rir` en `null`, `isExtra: false`). Navego a `/sesion/<id>/1` (RN-TRN-02) |
| AC-2 | Un workout `in_progress` | Llamo otra vez a `startWorkout` (por ejemplo, desde otra pestaña, o dos llamadas a la vez) | Devuelve `training/workout-already-active` con el id del activo; queda un solo workout `in_progress` (RN-TRN-01) |
| AC-3 | Jueves 19-nov (descanso) o martes 17-nov (cardio) | Abro "Hoy" | No hay "Iniciar sesión" para hoy; `startWorkout` del día devuelve `training/no-plan-today` |
| AC-4 | He completado 3 series y escrito el peso de la 4.ª | Cierro la app y la vuelvo a abrir (o recargo) | "Hoy" muestra "Continuar sesión"; al tocarlo voy al primer ejercicio con series pendientes y veo las 3 series hechas y el peso de la 4.ª (RF-19, QS-03, CA-3) |
| AC-5 | Una sesión `in_progress` iniciada el lunes 16-nov | Abro "Hoy" el martes 17-nov | Veo "Continuar sesión del lunes 16 de noviembre" y "Descartar sesión"; no se ofrece iniciar otra |
| AC-6 | Una sesión iniciada a las 23:30 del lunes | Sigo registrando después de medianoche | El workout conserva `date = 2026-11-16` (RN-TRN-09) |

### 4.2 Otra sesión de esta semana

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-7 | Sábado 21-nov (cardio), sin sesión activa | Abro "Hoy" | La sección "Otra sesión de esta semana" ofrece "Lun 16 · Full body A", "Mié 18 · Full body B" y "Vie 20 · Full body A" |
| AC-8 | La sección del AC-7 | Toco "Vie 20 · Full body A" | Veo la lista de ejercicios de ese día y "Iniciar sesión"; al iniciar, el workout tiene `date = 2026-11-21`, `plannedFor = 2026-11-20` y los ítems del viernes (RN-TRN-14) |
| AC-9 | Miércoles 18-nov | Abro "Hoy" | La sesión del día es Full body B y la sección ofrece el lunes y el viernes (días futuros incluidos), no el miércoles |
| AC-10 | Hoy es el sábado 21-nov | Llamo a `startWorkout` con `plannedFor` del lunes 23-nov (otra semana) o del martes 17-nov (cardio) | `training/planned-date-out-of-week` y `training/no-plan-today`, sin crear nada (RN-TRN-14) |
| AC-11 | Hay una sesión activa | Abro "Hoy" | No aparece la sección "Otra sesión de esta semana" |

### 4.3 Registrar series

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-12 | Una serie vacía de Prensa | Escribo 60 en kg | Se guarda en una sola escritura antes de que la operación devuelva (RN-TRN-03); al recargar sigue ahí |
| AC-13 | Serie 1 de Prensa con 60 kg y 10 reps | Toco el check | Queda `done: true` con `completedAt = clock.now()`; la serie 2, vacía, recibe 60 kg en la misma transacción (RN-TRN-05, RN-TRN-11) |
| AC-14 | La serie 2 ya tiene 65 kg, o ya está hecha | Marco la serie 1 con 60 kg | La serie 2 no cambia (RN-TRN-11) |
| AC-15 | Una serie hecha | Toco el check otra vez | `done: false`, se borra `completedAt` y los valores se conservan (RN-TRN-05) |
| AC-16 | Una serie de Prensa sin reps, o sin peso | Toco el check | No se marca; devuelve `training/invalid-set-values`, el foco va al primer campo que falta y se muestra el motivo (RN-TRN-04) |
| AC-17 | Una serie de Dead bug (`metric: 'reps'`) o de Plancha (`metric: 'time'`) | Miro la fila y marco con 10 reps (o 40 s) | No hay columna de kg; la serie se marca con `weightKg: null`. En Plancha la columna dice "s" (RN-TRN-04) |
| AC-18 | Una serie de Dominadas | Escribo 0 kg y 8 reps y marco | Se acepta: 0 kg es peso corporal sin lastre |
| AC-19 | Cualquier serie | Escribo 600 kg, 60.1 kg, 101 reps, 11 de RIR o un valor no numérico, o un peso negativo en un ejercicio que no admite asistencia | Se rechaza con `training/invalid-set-values`, el valor guardado no cambia y se muestra el rango válido (RN-TRN-04) |
| AC-19b | Una serie de Dominadas o Fondos | Activo "Con asistencia", escribo 20 y 8 reps y marco | La columna dice "Asist. kg", se guarda `weightKg: -20` y la fila muestra "Asistencia 20 kg"; la serie siguiente, vacía, hereda −20 (RN-TRN-04, RN-TRN-11). Con 101 de asistencia se rechaza |
| AC-20 | Una serie ya hecha de una sesión `in_progress` | Cambio sus reps | Se guarda y la serie sigue hecha (RN-TRN-07: mientras está en curso, todo se edita) |
| AC-21 | El build de producción | Marco una serie (traza de Playwright) | El cambio visible llega en < 100 ms (QS-05, RNF-02) |

### 4.4 Ejercicio actual, alternativa y navegación

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-22 | `/sesion/<id>/2` en Full body A | Abro la página | Veo "Ejercicio 2 de 7", "Press de banca con barra", "2 × 6-10 · RIR 3-4", la nota "Costillas abajo, sin arco" y la tabla de series (RF-17) |
| AC-23 | El ejercicio 2 sin series hechas | Toco "Cambiar a Press de banca con mancuernas" | El ítem y sus series pasan a Press de banca con mancuernas en una transacción, con los pesos reiniciados al prellenado (`null` en esta fase); la columna "anterior" es la del ejercicio nuevo; aparece "Cambiar a Press de banca con barra" para volver (RN-TRN-13) |
| AC-24 | El ejercicio 2 con una serie hecha | Miro el control de cambio | Está deshabilitado con el texto "Para cambiar de ejercicio, desmarca las series hechas"; la API devuelve `training/item-has-done-sets` |
| AC-25 | Cualquier ejercicio | Toco "Siguiente" o "Anterior" | Voy a `/sesion/<id>/3` o `/sesion/<id>/1`; en el primero no hay "Anterior" y en el último no hay "Siguiente" |
| AC-26 | La sesión en curso | Abro la lista de ejercicios | Veo los 7 en orden con su avance ("1 de 2 series") y cuáles faltan; tocar uno navega a él (RF-14) |
| AC-27 | `/sesion/<id>/9` (fuera de rango) o `/sesion/<id>/abc` | Abro la URL | Me redirige (`replace`) al primer ejercicio con series pendientes |
| AC-28 | Un `workoutId` inexistente, descartado o completado | Abro `/sesion/<id>/1` | Veo "Esta sesión ya no está disponible." y un enlace a "Hoy"; nada es editable |

### 4.5 Columna "anterior"

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-29 | Un workout `completed` del 9-nov con Prensa 60 × 10 y 60 × 9 (insertado en la prueba), y uno `discarded` posterior | Veo la Prensa en la sesión del 16-nov | La columna "anterior" muestra "60 × 10" y "60 × 9" en las series 1 y 2 (RF-12, RN-TRN-08) |
| AC-30 | Sin sesiones `completed` del ejercicio, o con menos series que la sesión actual | Miro la columna | "—" en las series sin dato |

### 4.6 Series extra y descarte

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-31 | Prensa en la semana 1 (2 planificadas, `sets: [3, 3]`) | Toco "Añadir serie" | Aparece la serie 3 con `isExtra: true`; al llegar a 3 el botón se deshabilita ("Máximo 3 series") y la API devuelve `training/max-sets-reached` (RF-16, RN-PLN-05) |
| AC-32 | Prensa con 3 series, la 2 sin hacer | Quito la serie 2 | Se borra y la 3 pasa a ser la 2 (RN-TRN-10) |
| AC-33 | Una serie hecha, o la única serie del ejercicio | Miro "Quitar serie" | No está disponible; la API devuelve `training/set-not-removable` (RN-TRN-10) |
| AC-34 | Una sesión en curso | Toco "Descartar sesión" y confirmo en el diálogo | El workout queda `discarded`, vuelvo a "Hoy" y puedo iniciar otra; si cancelo, nada cambia (P-2) |
| AC-35 | Un workout `discarded` | Llamo a cualquier operación de series, a `chooseExercise` o a `discardWorkout` | `training/workout-closed`, sin cambios (RN-TRN-07) |

### 4.7 Transversales

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-36 | La app ya abierta una vez | En modo avión inicio una sesión, registro series y recargo | Todo funciona y se conserva (RNF-01, QS-06 parcial) |
| AC-37 | Hay una versión nueva de la app y una sesión activa | Uso la app | No aparece el aviso de actualización; aparece al volver a "Hoy" sin sesión activa (architecture §7.9) |
| AC-38 | Una base `gym-app` v1 con el plan cargado (la del iPhone) | Abro la versión nueva | La base sube a v2 sin perder el plan ni `startDate` (RNF-09) |
| AC-39 | La sesión activa y "Hoy" con sesión activa | Corre axe en Playwright | Sin violaciones WCAG 2.2 A/AA; cada control táctil mide ≥ 44 × 44 px |
| AC-40 | El build de producción | Corre `size-limit` | El JS inicial sigue < 200 KB gzip (QS-10) |
| AC-41 | Ningún ejercicio `high` en el seed (RN-PLN-07) | Inicio cualquier sesión o cambio a cualquier alternativa | Ningún workout contiene un ejercicio `high`; una prueba recorre todas las plantillas y alternativas del seed (P-1, QS-01) |

## 5. Reglas de negocio aplicables

Del contrato [`modules/training.md`](../../modules/training.md) v1.1: RN-TRN-01 a 05, 07 a 10. RN-TRN-06 queda para la fase 3. Del contrato [`modules/plan.md`](../../modules/plan.md) v1.10: RN-PLN-05, 07 y 11.

Cambios y reglas nuevas, ya movidos a los contratos (`training` v1.2, `plan` v1.11) al aprobar esta spec:

| ID | Regla | Origen |
|---|---|---|
| RN-PLN-15 (i) | Dentro de una plantilla, el principal y las alternativas de un ítem no aparecen en ningún otro ítem. Un fallo devuelve `plan/invalid-seed`. | Decisión 4 |
| `PlannedItem` (cambia) | Añade `alternatives: Exercise[]`, ya resueltos y en el orden del seed; vacío si no hay. `PlanApi` implementa `getExercise` y `getExercises` (orden de `ids`, sin los que no existen). | Decisión 4 |
| `Workout` (cambia) | Añade `plannedFor: LocalDate`, el día del plan cuya sesión se hace. | Decisión 5 |
| `WorkoutItem` (cambia) | Añade `options: ID[]` (principal primero y luego alternativas), `maxSets: number` (`item.sets[1]`, sin aplicar el factor de volumen) y `note?: string`. `exerciseId` es el ejercicio elegido. | Decisiones 3 y 4 |
| RN-TRN-02 (amplía) | Los ítems salen de `plan.getTodayPlan(plannedFor)`. Cada serie inicial tiene `weightKg` = prellenado de `SuggestionProvider` (o `null`), `reps` y `rir` en `null`, `done: false` e `isExtra: false`. | Decisiones 2 y 5 |
| RN-TRN-04 (amplía) | `metric: 'weight'`: `weightKg` obligatorio para marcar, 0 = peso corporal sin lastre. `metric: 'reps'` y `'time'`: `weightKg` siempre `null`. `reps` cuenta segundos si `metric = 'time'`, con rango `0 ≤ reps ≤ 600`. Asistencia: en ejercicios `equipment: 'bodyweight'` con `metric: 'weight'` (Dominadas, Fondos), `weightKg` negativo es la ayuda de la máquina o la banda, con rango `−100 ≤ weightKg ≤ 500`; en los demás, `weightKg ≥ 0`. Múltiplo de 0.25 en ambos casos. Valores no finitos se rechazan. | Seed: Dead bug, Plancha, Dominadas; decisión 7 |
| RN-TRN-10 (amplía) | `removeSet` solo aplica a series no hechas y nunca deja un ejercicio sin series; renumera `setNumber`. Si no aplica, `training/set-not-removable`. `addExtraSet` añade la serie `n + 1` con `isExtra: true` mientras `n < maxSets`; si no, `training/max-sets-reached`. | RF-16, RN-PLN-05 |
| RN-TRN-11 | Al marcar una serie como hecha, la serie `setNumber + 1` del mismo ejercicio, si no está hecha y su `weightKg` es `null`, recibe ese `weightKg`, en la misma transacción. Reps y RIR no se copian. | Decisión 2, P-6 |
| RN-TRN-12 | Un `exerciseId` aparece en un solo ítem de un workout. Lo garantiza RN-PLN-15 (i); `startWorkout` lo comprueba y lanza si no se cumple (dato inconsistente, como RN-PLN-16). | Decisión 4 |
| RN-TRN-13 | `chooseExercise(workoutId, fromExerciseId, toExerciseId)`: `toExerciseId` debe estar en `options` del ítem (si no, `training/invalid-exercise-choice`) y ninguna serie del ítem puede estar hecha (si no, `training/item-has-done-sets`). En una transacción cambia `exerciseId` del ítem y de sus series, y reinicia `weightKg` al prellenado del ejercicio nuevo. | Decisión 4, RN-PLN-11 |
| RN-TRN-14 | `startWorkout(date, { plannedFor })`: `plannedFor` (por defecto `date`) está en la misma semana ISO que `date` (si no, `training/planned-date-out-of-week`) y su plan es `workout` (si no, `training/no-plan-today`). | Decisión 5 |
| RN-TRN-15 | `discardWorkout` pasa un workout `in_progress` a `discarded` y conserva sus series; no se borra nada. Los workouts `discarded` no aparecen en el historial (RN-TRN-08) ni bloquean RN-TRN-01. | Decisión 1 |
| Eventos (cambia) | `createTraining` no recibe `bus` y no publica eventos hasta que un módulo los escuche: `WorkoutCompleted` llega con `progression` (fase 4). Los eventos del contrato §5 se mantienen como diseño. | P-7, handoff (bloque C) |
| Errores (cambia) | Se añaden `training/planned-date-out-of-week`, `training/max-sets-reached`, `training/set-not-removable`, `training/invalid-exercise-choice` y `training/item-has-done-sets`. | Esta spec |

## 6. UX

- **"Hoy", botón principal:** con sesión activa, "Continuar sesión" (con la fecha si es de otro día: "Continuar sesión del lunes 16 de noviembre") y, debajo, "Descartar sesión" como acción secundaria. Sin sesión activa y en un día de pesas, "Iniciar sesión" debajo de la lista de ejercicios. En cardio, descanso o fuera del programa, sin botón.
- **"Otra sesión de esta semana":** sección bajo la tarjeta del día, con un botón por día de pesas de la semana distinto de hoy ("Vie 20 · Full body A"). Lleva a una vista previa con el título de la sesión, `PlanExerciseList` del día y "Iniciar sesión". Se oculta con sesión activa o si no hay otros días de pesas.
- **Sesión activa:** pantalla completa, sin barra inferior (spec §7.1). Arriba, `SessionHeader`: nombre de la sesión, "Ejercicio 2 de 7" y "Ver ejercicios" (lista con el avance de cada uno). Luego el nombre del ejercicio (`h1`), "2 × 6-10 · RIR 3-4", el consejo (`cue` del ejercicio y nota de la plantilla) y, si hay alternativa, "Cambiar a …".
- **Tabla de series (`SetTable` y `SetRow`):** columnas Serie, Anterior, kg, Reps (o "s"), RIR y check. Inputs numéricos con `inputmode="decimal"` (kg) o `"numeric"` (reps, RIR) y nombre accesible por fila ("Serie 1, kilos"). El valor se guarda al confirmar el campo (`change`), no en cada tecla. En Dominadas y Fondos, un interruptor "Con asistencia" sobre la tabla (el teclado decimal de iOS no tiene signo menos): activado, la columna dice "Asist. kg", lo escrito se guarda en negativo y la fila muestra "Asistencia 20 kg". Arranca activado si alguna serie del ejercicio ya tiene peso negativo. La fila hecha se distingue por algo más que el color (check visible y texto "hecha" para lectores de pantalla). Las series extra llevan la etiqueta "extra".
- **Errores de un campo:** mensaje bajo la fila con `aria-live="polite"`, por ejemplo "El peso va de 0 a 500 kg, en pasos de 0.25." o "Faltan las repeticiones.". El campo con error conserva lo escrito hasta que se corrige; lo guardado no cambia.
- **Pie de la pantalla:** "Anterior" y "Siguiente" grandes, al alcance del pulgar; "Añadir serie" y "Quitar serie" junto a la tabla; "Descartar sesión" al final de "Ver ejercicios", con `ConfirmDialog`: "¿Descartar la sesión? Las series registradas no contarán en tu historial." con "Descartar" y "Cancelar".
- **Cargando:** como en "Hoy", sin spinner ni estado vacío mientras Dexie responde.
- **Errores inesperados:** el aviso genérico de ADR-0010. Los códigos esperados de §5 tienen su texto en el mapa de `app` (ADR-0010).
- **Objetivos táctiles** ≥ 44 × 44 px en todos los controles, también el check y los inputs; contraste AA con los tokens existentes.

## 7. Casos límite

- **Dos pestañas:** RN-TRN-01 se comprueba dentro de la transacción que crea el workout (AC-2). Las dos pestañas ven los cambios de la otra por `useLiveQuery`.
- **La app se cierra entre escribir y confirmar un campo:** se pierde solo lo que no se confirmó; todo lo confirmado ya está guardado (RN-TRN-03).
- **Medianoche durante la sesión:** RN-TRN-09 (AC-6). **Medianoche con una sesión de "otro día"**: la sesión sigue activa y se puede continuar o descartar (AC-5).
- **Cambio de semana con una sesión activa:** RN-TRN-14 solo se comprueba al iniciar; la sesión sigue.
- **El seed cambia entre versiones:** la sesión guarda su instantánea (`items`), así que no le afecta.
- **Ejercicio de la instantánea que ya no existe en el catálogo** (no pasa en v1: el catálogo no cambia): la página muestra el error genérico, no un ejercicio vacío.
- **Semana de deload:** las series planificadas son el 50%, pero `maxSets` es el máximo sin factor, así que se pueden añadir series hasta el máximo normal.
- **Fallo de escritura** (cuota llena, base cerrada): la operación rechaza, el valor en pantalla vuelve a lo guardado y se muestra el aviso genérico.
- **Safari borra el almacenamiento:** se pierde la sesión activa. La protección llega con la exportación (fase 3); en la fase 2 las sesiones solo se descartan.

## 8. Preguntas abiertas

Ninguna.

Decisiones cerradas el 17-nov-2026:

1. **Fin de sesión en la fase 2:** solo "Descartar", con confirmación. "Continuar sesión" tiene prioridad en "Hoy" y muestra la fecha si la sesión es de otro día.
2. **Prellenado:** `SuggestionProvider` nulo; columna "anterior" desde ya; RN-TRN-11.
3. **RF opcionales:** entran RF-14, RF-16 y RF-17; RF-15 y RF-18 quedan para la fase 4.
4. **Alternativas:** `PlannedItem.alternatives`, `getExercise(s)`, RN-PLN-15 (i), RN-TRN-12 y 13; solo sin series hechas.
5. **Días sin pesas y otra sesión de la semana:** sin botón en cardio y descanso, con defensa en `training`; `plannedFor` y RN-TRN-14.
6. **Workouts cerrados:** inmutables, también las notas (RN-TRN-07, contrato `training` v1.1).
7. **Dominadas y fondos asistidos:** `weightKg` negativo para la asistencia (RN-TRN-04), con el interruptor "Con asistencia" en la UI. Pendiente para la fase 4: la progresión debe tratar "subir" como menos asistencia (anotarlo en `modules/progression.md`).

## 9. Checklist de la constitución

- [x] **P-1:** las alternativas vienen del seed validado (RN-PLN-07) y una prueba recorre todas (AC-41); no hay sugerencias en esta fase.
- [x] **P-2:** cada cambio se guarda en una escritura (RN-TRN-03); descartar pide confirmación y no borra datos (RN-TRN-15); versión 2 del esquema con prueba de subida desde v1 (AC-38).
- [x] **P-3:** cada cambio de contrato está en §5; sin `[POR DEFINIR]`.
- [x] **P-4:** `training` usa `plan` solo por su API; "Hoy" y la sesión combinan módulos en `app/pages`.
- [x] **P-5:** las reglas RN-TRN-* viven en el dominio, con reloj e IDs como puertos.
- [x] **P-6:** < 100 ms por serie (AC-21), ≥ 44 px y axe (AC-39), presupuesto de bundle (AC-40).
- [x] **P-7:** sin eventos, temporizador, historial ni cierre; `SuggestionProvider` nulo en lugar de un proveedor provisional.
- [x] **P-8:** sin entradas externas nuevas (el seed ya se valida con Zod); textos en español.
