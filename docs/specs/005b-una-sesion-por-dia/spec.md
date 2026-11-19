# Spec: Una sola sesión cerrada por día

**ID:** 005b · **Estado:** Aprobada (19-nov-2026) · **Fecha:** 19-nov-2026
**Requerimientos cubiertos:** RF-10, RF-19, RNF-01, RNF-05 · **Fase:** 3 (spec §13), complemento de la spec 005
**Origen:** pregunta 9 del handoff (decidida el 18-nov-2026: una sola sesión cerrada por fecha)
**Fuente de diseño:** [`docs/design-hoy.md`](../../design-hoy.md) ("Otra sesión de esta semana" y la vista previa del día); no hay tablero nuevo
**ADRs aplicados:** 0009, 0010

## 1. Problema y objetivo

En T23 de la spec 005 se pudieron cerrar dos sesiones el mismo día: Full body B del miércoles y, desde "Otra sesión de esta semana", Full body A del viernes. La spec 005 lo permite, porque RN-TRN-24 solo impide repetir el mismo **día del plan** (`plannedFor`). El plan de hipertrofia supone una sesión de pesas por día, con su recuperación. Esta spec añade una regla: **un día real (`date` del workout) tiene como máximo una sesión cerrada**. "Hoy" y la vista previa dejan de ofrecer "Empezar sesión" cuando ya entrenaste ese día.

## 2. Alcance

Es una spec corta que complementa la 005. La 006 (historial) y la 007 (exportar e importar) no cambian de número.

- **Incluye:**
  - **RN-TRN-27** en `training`: `startWorkout` no crea un workout si ya hay uno `completed` con el mismo `date`. Se añade el error `training/day-already-trained` y su texto en `app`.
  - **"Hoy"** cuando ya entrenaste hoy:
    - La tarjeta de un día de pesas pendiente cambia "Empezar sesión" por un texto.
    - "Otra sesión de esta semana" muestra un aviso bajo el título.
  - **Vista previa (`/dia/:date`)**: muestra un texto en lugar de "Empezar sesión" cuando ya entrenaste hoy.
- **No incluye:**
  - Corregir o borrar los datos que ya están en el iPhone (dos sesiones cerradas el 18-nov). Se toleran como dato roto, sin cambiar la base ni migrar (§7, P-2).
  - Bloquear `finishWorkout`: el bloqueo al iniciar basta (§5).
  - Cambiar la sesión del día, la sesión libre (RF-06) o registrar el cardio, que siguen siendo trabajo futuro (`design-hoy.md`).
  - Cambios en la sesión activa, el Cierre o D2.

## 3. Historias de usuario

- Como usuario que ya entrenó hoy, quiero que la app no me ofrezca empezar otra sesión de pesas, para respetar la recuperación del plan.
- Como usuario, quiero seguir viendo qué sesiones me quedan esta semana aunque hoy ya no pueda empezarlas.

## 4. Criterios de aceptación

Las fechas suponen el programa de la spec 005 (§4), que empieza el lunes 16-nov-2026. La semana 1 tiene:
- lunes 16 y viernes 20: Full body A;
- martes 17 y sábado 21: cardio;
- miércoles 18: Full body B;
- jueves 19 y domingo 22: descanso.

"Guardada" significa un workout `completed`. Su `date` es el día en que empezó (RN-TRN-09) y su `plannedFor`, el día del plan.

### 4.1 Regla en `training`

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-1 | Full body B guardada el miércoles 18 (`date` = `plannedFor` = 18) | `startWorkout('2026-11-18', { plannedFor: '2026-11-20' })` | `training/day-already-trained`, sin `details`. No se crea nada |
| AC-2 | AC-1 | `startWorkout('2026-11-18')` (el mismo día del plan) | `training/already-done` (RN-TRN-24 va antes que RN-TRN-27) |
| AC-3 | AC-1 y además una sesión en curso (dato roto) | `startWorkout('2026-11-18', { plannedFor: '2026-11-20' })` | `training/workout-already-active` con su id (RN-TRN-01 va antes que todo) |
| AC-4 | Una sesión **descartada** el miércoles 18 y ninguna guardada | `startWorkout('2026-11-18', { plannedFor: '2026-11-20' })` | Se crea. `discarded` no cuenta |
| AC-5 | Full body A del lunes guardada el martes 17 (`date` = 17, `plannedFor` = 16) | `startWorkout('2026-11-18')` el miércoles | Se crea: solo cuenta el `date` del mismo día |
| AC-6 | Una sesión empezada el martes 17 a las 23:50 y guardada el miércoles 18 a las 00:40 (`date` = 17) | `startWorkout('2026-11-18')` | Se crea: el día es el de inicio (RN-TRN-09), no el de `finishedAt` |
| AC-7 | AC-1, con dos pestañas abiertas | Las dos llaman a `startWorkout('2026-11-18', { plannedFor: '2026-11-20' })` a la vez | Ninguna crea un workout. Las dos reciben `training/day-already-trained` |

### 4.2 "Hoy"

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-8 | AC-1, el mismo miércoles | Abro "Hoy" | La tarjeta muestra el día hecho, como en la spec 005 (AC-34). "Otra sesión de esta semana" tiene bajo el título el texto "Ya entrenaste hoy. Podrás empezar otra sesión mañana.". "Lun 16 · Full body A" y "Vie 20 · Full body A" siguen siendo enlaces a la vista previa |
| AC-9 | Full body A del viernes guardada el miércoles 18 (`date` = 18, `plannedFor` = 20); Full body B del miércoles sin hacer | Abro "Hoy" el miércoles | La tarjeta "Tu sesión de hoy" tiene el título "Full body B", el resumen, los chips y "Ver los 7 ejercicios". **No** tiene "Empezar sesión"; en su lugar dice "Ya entrenaste hoy (Full body A del viernes).". La tira marca el viernes con ✓ y el miércoles sigue "pendiente". "Otra sesión" tiene el aviso de AC-8, "Lun 16 · Full body A" como enlace y "Vie 20 · Full body A · hecha ✓" en gris |
| AC-10 | Full body A del lunes guardada el martes 17 (`date` = 17, `plannedFor` = 16) | Abro "Hoy" el martes (día de cardio) | La tarjeta de cardio no cambia. "Otra sesión" muestra el aviso de AC-8, "Lun 16 · Full body A · hecha ✓", y "Mié 18 · Full body B" y "Vie 20 · Full body A" como enlaces |
| AC-11 | AC-9 | Abro "Hoy" el jueves 19 | Sin el aviso. "Mié 18 · Full body B" (pasado y no hecho) vuelve a ser un enlace, y su vista previa tiene "Empezar sesión" |
| AC-12 | AC-9 con una sesión en curso | Abro "Hoy" | D2, como siempre: ni el texto de la tarjeta ni "Otra sesión" (spec 003) |

### 4.3 Vista previa del día

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-13 | AC-1 | Abro `/dia/2026-11-20` el miércoles | Nombre, RIR y ejercicios, como siempre. En lugar de "Empezar sesión" dice "Ya entrenaste hoy. Podrás empezar otra sesión mañana." |
| AC-14 | AC-9 | Abro `/dia/2026-11-20` el miércoles | "Ya hiciste esta sesión." (spec 005 AC-35). Si el día del plan está hecho, ese texto gana |
| AC-15 | La vista previa del viernes abierta en una pestaña y una sesión de hoy que se guarda en otra | Miro la primera pestaña | El botón pasa al texto de AC-13 sin recargar, porque la consulta es en vivo, como en AC-35 de la spec 005 |
| AC-16 | AC-15, si toco "Empezar sesión" antes de que cambie | — | No se crea nada. Debajo del botón aparece el texto de `training/day-already-trained` (ADR-0010) y sigo en la vista previa |

### 4.4 Transversales

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-17 | Dos sesiones guardadas con `date` 18-nov: Full body B del miércoles y Full body A del viernes (los datos que ya están en el iPhone) | Abro "Hoy" el miércoles | Nada falla ni se borra. La tira marca el miércoles y el viernes con ✓, "2 de 3 sesiones". La tarjeta muestra el miércoles hecho. "Otra sesión" muestra el aviso de AC-8 |
| AC-18 | AC-9 y AC-13 | Corre axe en Playwright | Sin violaciones WCAG 2.2 A/AA. Los enlaces miden ≥ 44 px y nada desborda a 320 px |
| AC-19 | Sin conexión, con la app ya abierta una vez | AC-1, AC-9 y AC-13 | Todo funciona igual (RNF-01) |

## 5. Reglas de negocio aplicables

Del contrato [`modules/training.md`](../../modules/training.md) v1.22: RN-TRN-01, 09, 14, 15, 23, 24 y 26.

Regla nueva, ya en el contrato (`training` v1.23):

| ID | Regla |
|---|---|
| RN-TRN-27 | `startWorkout(date, …)` con un workout `completed` cuyo `date` es igual a `date` devuelve `training/day-already-trained`, sin `details` y con un mensaje que cita la regla. Solo cuenta `date`, el día de inicio (RN-TRN-09); `plannedFor` y `finishedAt` no cuentan. `discarded` e `in_progress` no lo impiden. Se comprueba en la misma transacción que RN-TRN-01 y RN-TRN-24 (`repository.createIfAllowed`), en el orden activo → día del plan hecho (RN-TRN-24) → día ya entrenado (RN-TRN-27). El resultado suma la razón `{ created: false; reason: 'trained' }`. Dos `startWorkout` a la vez en un día ya entrenado no crean nada. |

**Por qué basta con iniciar:**
- Nunca hay dos workouts `in_progress` (RN-TRN-01).
- `date` se fija al crear el workout (RN-TRN-09).

Por eso un workout solo puede llegar a `completed` con un `date` que no tenía otra sesión cerrada al empezar. `finishWorkout` no cambia.

**Qué es "ya entrenaste hoy" en la interfaz:** existe un workout `completed` con `date` = hoy. Para saberlo basta `useCompletedWorkouts` con el rango de la semana, que "Hoy" y la vista previa ya consultan. Ese rango filtra por `date` (RN-TRN-26). No hace falta API nueva. El plan decide si el predicado vive en `training` o en `app`.

Cambios de documentos hechos al aprobar (19-nov):

| Documento | Cambio |
|---|---|
| `modules/training.md` (v1.23) | RN-TRN-27. El error `training/day-already-trained` en `TrainingErrorCode` y en §7. El resultado de `createIfAllowed` con `reason: 'trained'`. Pruebas de contrato. Decisión 25 |
| `spec.md` §7.2 (v0.11) | Fila "Hoy": "Empezar sesión" y "Otra sesión de esta semana" solo si hoy no hay una sesión cerrada |
| `design-hoy.md` | Una nota en "Otra sesión de esta semana" y en "Vista previa del día" que remite a esta spec |
| Spec 005 | AC-35 y la decisión 10 se complementan con AC-13 y AC-14 de esta spec. La 005 no se edita |

## 6. UX

### 6.1 "Hoy"
- **Tarjeta de un día de pesas pendiente cuando ya entrenaste hoy:**
  - Igual que en D (título, resumen "N ejercicios · ~M min", chips), pero sin "Empezar sesión".
  - En el lugar del botón va un párrafo con el estilo del resumen (`--text-muted`): "Ya entrenaste hoy (<sesión> del <día de la semana>).", por ejemplo "Ya entrenaste hoy (Full body A del viernes)."
  - La sesión es el `name` del workout guardado. El día es su `plannedFor` en minúsculas y sin fecha, porque está en la misma semana (RN-TRN-14).
  - El desplegable "Ver los N ejercicios" se mantiene.
  - Con dos sesiones guardadas hoy (dato roto), el texto usa la más reciente (RN-TRN-26).
- **Tarjeta de un día de pesas hecho:** sin cambios (spec 005 AC-34).
- **Cardio y descanso:** la tarjeta no cambia (§8, decisión 4).
- **"Otra sesión de esta semana":**
  - Bajo el `h2`, el párrafo "Ya entrenaste hoy. Podrás empezar otra sesión mañana." en `--text-muted`, solo si ya entrenaste hoy.
  - Las filas pendientes siguen siendo enlaces de 48 px a la vista previa, para ver lo que queda de la semana.
  - Las filas hechas no cambian (spec 005 AC-32).
- **Tira y "N de M":** sin cambios. Siguen contando por `plannedFor` (RN-TRN-23).

### 6.2 Vista previa (`/dia/:date`)
- Si el día del plan está hecho: "Ya hiciste esta sesión." (spec 005 AC-35).
- Si no, y ya entrenaste hoy: "Ya entrenaste hoy. Podrás empezar otra sesión mañana." en lugar de "Empezar sesión", en el mismo lugar y con el mismo estilo.
- Las redirecciones a "Hoy" no cambian: hoy mismo, sesión en curso, fuera de la semana y días que no son de pesas.

### 6.3 Textos y errores
- `training/day-already-trained` → "Ya entrenaste hoy. Podrás empezar otra sesión mañana." Es el mapa de `app` (ADR-0010) y el mismo texto del aviso y de la vista previa.
- Textos en español. Los textos nuevos son párrafos sin `aria-live`, salvo el error de AC-16, que usa la región de `StartWorkoutButton`. Contraste AA con `--text-muted` sobre la superficie (tokens existentes, ADR-0005).

## 7. Casos límite

- **Medianoche:**
  - Una sesión empezada antes de las 00:00 y guardada después cuenta para el día en que empezó (AC-6).
  - A las 00:00 se levanta el bloqueo: "Hoy" cambia de fecha con `useToday`, como ya hace.
- **Dato roto con dos sesiones guardadas el mismo día** (el iPhone, 18-nov): se muestra como en AC-17, sin corregirlo ni migrar. RN-TRN-27 solo impide crear una tercera.
- **Sesión en curso de otro día:** si el martes queda una sesión sin cerrar y el miércoles se guarda, cuenta para el martes. El miércoles queda libre (AC-6).
- **Cambio de zona horaria:** `date` es el día local al iniciar (ADR-0009). Viajar puede mover "hoy" respecto a ese `date`. Se acepta, como en el resto de la app.
- **Importar (spec 007):** un archivo con dos sesiones cerradas el mismo día se acepta. La validación de la spec 007 decidirá si lo avisa.

## 8. Preguntas abiertas

Ninguna. Las decisiones 4 y 5 se confirmaron al aprobar la spec (19-nov-2026).

Decisiones:

1. **(18-nov)** Una sola sesión cerrada por fecha, entendida como `date`, el día real en que se entrena.
2. **(19-nov)** Va como spec 005b, propia y corta. La 006 y la 007 conservan su número.
3. **(19-nov)** Si ya entrenaste hoy:
   - "Otra sesión de esta semana" sigue visible, con el aviso bajo el título y los enlaces a la vista previa.
   - La vista previa no tiene "Empezar sesión".
   - La tarjeta de un día de pesas pendiente conserva título, chips y desplegable, y cambia el botón por "Ya entrenaste hoy (…)".
4. **(19-nov)** La tarjeta de cardio o descanso no cambia cuando ya entrenaste hoy. La tira ya marca la sesión hecha y "Otra sesión" lleva el aviso.
5. **(19-nov)** Se bloquea solo al iniciar (`startWorkout`), no al cerrar (§5).

## 9. Checklist de la constitución

- [x] **P-1:** no se sugiere ningún ejercicio. La regla solo quita una forma de empezar.
- [x] **P-2:** no se borra ni se migra nada. Los datos rotos del 18-nov se conservan y se muestran (AC-17). Sin cambio de esquema.
- [x] **P-3:** RN-TRN-27 y los cambios de documentos en §5. Sin `[POR DEFINIR]`.
- [x] **P-4:**
  - La regla vive en `training` (`createIfAllowed`, sus propias tablas).
  - `app` solo lee `useCompletedWorkouts`.
  - Sin dependencias nuevas.
- [x] **P-5:** RN-TRN-27 con prueba primero en el repositorio y en el servicio, citando su ID.
- [x] **P-6:**
  - Los enlaces conservan sus 48 px.
  - Hay axe y 320 px (AC-18).
  - El bundle apenas cambia: dos textos y un predicado.
- [x] **P-7:** sin API nueva, sin índice nuevo y sin bloqueo en `finishWorkout`.
- [x] **P-8:** sin entradas externas nuevas. Textos en español.
