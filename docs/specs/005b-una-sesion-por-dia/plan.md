# Plan técnico: Una sola sesión cerrada por día

**Spec:** `specs/005b-una-sesion-por-dia/spec.md` · **Estado:** Aprobado (19-nov-2026)

## 1. Resumen de la solución

`training` añade RN-TRN-27 a `createIfAllowed`, en la misma transacción que RN-TRN-01 y RN-TRN-24. Es una consulta más por el índice `date`, que ya existe. `startWorkout` traduce la razón nueva en `training/day-already-trained`.

En `app`, "Hoy" y la vista previa ya leen los workouts cerrados de la semana con `useCompletedWorkouts`. Con ellos saben si hoy ya hay una sesión cerrada:
- en "Hoy", la tarjeta de un día de pesas pendiente cambia el botón por un texto y "Otra sesión" muestra un aviso;
- en la vista previa, el botón cambia por un texto.

No hay API, tabla, índice ni migración nuevos.

## 2. Módulos afectados

| Módulo | Cambio | ¿Cambia el contrato? |
|---|---|---|
| `training` | `CreateResult` con `reason: 'trained'`; `createIfAllowed` (Dexie y el repositorio en memoria de las pruebas) comprueba RN-TRN-27; `startWorkout` devuelve `training/day-already-trained` | Ya cambió: `modules/training.md` v1.23 (PR #46) |
| `app` | Texto de `training/day-already-trained`, `formatWeekday`, `formatTrainedToday`, `DayCard`, `OtherDays`, `TodayPage` y `DayPreviewPage` | No (no es un módulo) |
| `plan`, `health`, `progression`, `data`, `shared` | Ninguno | No |

## 3. Cambios de contrato

Ninguno más. El contrato `training` v1.23 ya tiene:
- RN-TRN-27;
- el código `training/day-already-trained` en `TrainingErrorCode` y en §7;
- la razón `trained` de `createIfAllowed`;
- las pruebas de contrato.

`CreateResult` vive en `application/ports.ts` y no se exporta por `index.ts`. Cambiarlo no toca la API pública.

## 4. Datos

- Sin tablas ni índices nuevos. La base sigue en la v3.
- RN-TRN-27 usa el índice `date` de `workouts` (`where('date').equals(date)`), que ya existe desde la v2. Un `LocalDate` sí se compara como string (RN-TRN-26, ADR-0009).
- Sin migración y sin cambio en el formato de exportación. Los dos workouts cerrados del 18-nov en el iPhone no se tocan (spec AC-17).

## 5. Flujo

Un solo módulo escribe, así que no hace falta un diagrama de secuencia. El orden dentro de la transacción `rw` de `createIfAllowed` queda así:

```
1. ¿Hay algún workout in_progress?                    → { created: false, reason: 'active', activeId }  (RN-TRN-01)
2. ¿Hay un completed con plannedFor = workout.plannedFor? → { created: false, reason: 'done' }           (RN-TRN-24)
3. ¿Hay un completed con date = workout.date?          → { created: false, reason: 'trained' }        (RN-TRN-27)
4. add(workout) y bulkAdd(sets)                        → { created: true }
```

`startWorkout` traduce cada razón en su error, con un mensaje que cita la regla: `"<date> already has a completed workout (RN-TRN-27)"`.

## 6. Decisiones

### 6.1 La regla vive en el repositorio, como RN-TRN-24
Hay dos condiciones:
- la comprobación necesita leer otros workouts;
- dos pestañas no pueden pasarla a la vez (AC-7).

Las dos cosas solo se garantizan dentro de la transacción de `createIfAllowed`, donde ya están RN-TRN-01 y RN-TRN-24. IndexedDB serializa las transacciones `rw` sobre la misma tabla.

Se descartó una función pura del dominio que recibiera los workouts del día: añadiría una lectura previa sin quitar la comprobación en la transacción. Las pruebas de la regla van primero en el servicio (con el repositorio en memoria) y en el repositorio Dexie.

### 6.2 "Ya entrenaste hoy" se calcula en `app`, como "día hecho"
- `TodayPage` y `DayPreviewPage` ya tienen `completed` (`useCompletedWorkouts` con el rango de la semana).
- El rango filtra por `date` (RN-TRN-26), así que incluye todo workout cerrado hoy.
- El predicado es `completed.find((w) => w.date === today)`, el mismo patrón que `w.plannedFor === date` de la spec 005 (plan §6.7).
- Como `completed` viene ordenado del más reciente al más antiguo, el primero que coincide es el que nombra la tarjeta si hay dos (dato roto, spec §6.1).
- La variable se llama `closedToday` para no confundirla con `doneToday` (por `plannedFor`).
- No se añade una función a la API de `training` (P-7). Si aparece un tercer uso, se mueve a `training`.

### 6.3 "Hoy"
`TodayContent` no añade consultas: `closedToday = completed.find((w) => w.date === date)`.

**`DayCard`** recibe una prop nueva, `trained: { name: string; plannedFor: LocalDate } | null`:
- `TodayPage` la pasa solo si `closedToday` existe y hoy **no** está hecho (`!isDone`). Un día hecho sigue con la tarjeta de la spec 005 (AC-8 y AC-17).
- En el caso `workout` no hecho, con `trained`, `StartWorkoutButton` se cambia por `<p className={styles.trained}>{formatTrainedToday(trained.name, trained.plannedFor)}</p>`.
- Título, resumen y chips no cambian.
- `ExerciseDetails` sigue fuera de la tarjeta, como hoy (AC-9).
- `.trained` usa `--text-muted` y el mismo margen superior que el botón, para que la tarjeta no salte.
- Los casos `cardio`, `rest` y `none` ignoran `trained` (decisión 4).

**`OtherDays`** recibe `trainedToday: boolean`:
- Con `true`, añade debajo del `h2` el texto `<p className={styles.note}>{errorMessages['training/day-already-trained']}</p>`, en `--text-muted`.
- Las filas no cambian: las pendientes siguen siendo enlaces de 48 px y las hechas, texto gris.
- El texto es el mismo del mapa de errores, como hace la vista previa con `already-done`.

**D2:** sin cambios. `ActiveSessionCard` ocupa el lugar de la tarjeta y `OtherDays` no se muestra (AC-12).

### 6.4 Vista previa (`/dia/:date`)
`DayPreview` ya espera a `completed`. Se añade `closedToday = completed.some((w) => w.date === today)`. El prop `today` ya llega, y la semana de `date` es la de hoy, porque la vista previa solo acepta días de la semana actual.

El orden es:
1. Si el día del plan está hecho: "Ya hiciste esta sesión." (AC-14).
2. Si no, y `closedToday`: `errorMessages['training/day-already-trained']` (AC-13).
3. Si no, `StartWorkoutButton`.

Se sigue en vivo, como `done`: si otra pestaña cierra una sesión, el botón pasa al texto (AC-15). Las redirecciones no cambian.

**AC-16** no necesita código: si se toca el botón antes de que cambie, `StartWorkoutButton` ya muestra `errorMessages[result.error.code]` en su región `aria-live` y no navega.

### 6.5 Textos
- **`app/errors/messages.ts`:** `'training/day-already-trained': 'Ya entrenaste hoy. Podrás empezar otra sesión mañana.'`. El mapa exige un texto por código para compilar, así que entra en la misma tarea que el código del error (como en la spec 005, contrato decisión 24).
- **`formatWeekday(date)`** en `app/format-date.ts`: "viernes", en minúsculas, con el mismo `Intl` de `formatLongDate`. `formatLongDate` pasa a usarla.
- **`formatTrainedToday(name, plannedFor)`** en `app/pages/today/format.ts`: `Ya entrenaste hoy (${name} del ${formatWeekday(plannedFor)}).`
  - Si `plannedFor` es hoy no se llama: ese caso es la tarjeta hecha.
  - "Miércoles" y "sábado" llevan acento según `Intl`; la prueba lo fija.

### 6.6 Presupuesto del bundle
Bundle inicial actual: 168.76 kB de 200 kB. Entran dos textos, dos funciones de formato, un predicado y dos props: unos cientos de bytes. Se mide en la tarea de cierre (`npm run build` y `npm run size`).

## 7. Estrategia de pruebas

RN-TRN-27 va **prueba primero**: un commit en rojo local, que se sube con la tarea que lo pone en verde. Los nombres citan la regla o el AC (`RN-TRN-27: …`, `spec 005b AC-9: …`).

| Criterio | Tipo de prueba | Archivo |
|---|---|---|
| AC-1 a AC-6 (orden de errores, `discarded`, otro `date`, medianoche) | Servicio con el repositorio en memoria, primero | `modules/training/__tests__/training-service.test.ts` |
| RN-TRN-27 en la transacción, por el índice `date`; AC-7 (dos `startWorkout` concurrentes) | Repositorio con `fake-indexeddb`, primero | `modules/training/__tests__/dexie-repository.test.ts` |
| Texto de `training/day-already-trained` | Unitaria | `app/errors/__tests__/messages.test.ts` |
| `formatWeekday`, `formatTrainedToday` (con "miércoles" y "sábado") | Unitaria | `app/__tests__/today-format.test.ts` |
| `DayCard` con `trained` (pesas: texto sin botón; cardio y descanso: sin cambios) | Componente | `app/__tests__/day-card.test.tsx` |
| AC-8 a AC-12, AC-17 | Página, sobre el seed real | `app/__tests__/today-done.test.tsx` |
| AC-13 a AC-16 | Página | `app/__tests__/day-preview.test.tsx` |
| AC-8, AC-9, AC-13 y AC-19 (recorrido con y sin conexión) | E2E | `tests/e2e/close.spec.ts`, `describe('spec 005b …')` |
| AC-18 | E2E con axe, 44 px y 320 px | `tests/e2e/a11y.spec.ts` |
| Bundle | `npm run size` tras `npm run build` | CI |

**Más detalle:**
- **Servicio (AC-6):** un workout `completed` con `date` = martes y `finishedAt` el miércoles 00:40 no impide empezar el miércoles. Otro `completed` con `plannedFor` = miércoles y `date` = lunes tampoco cuenta para RN-TRN-27, aunque sí para RN-TRN-24 si se inicia el miércoles mismo. Así la prueba distingue las dos reglas.
- **Repositorio:**
  - Un mutante que compara `plannedFor` en lugar de `date`, o que olvida filtrar por `completed`, debe morir con su prueba.
  - El orden `done` antes que `trained` se prueba con un workout que cumple las dos.
- **Página "Hoy" (AC-9):**
  - Tarjeta sin "Empezar sesión" y con "Ya entrenaste hoy (Full body A del viernes).".
  - "Ver los 7 ejercicios" presente; la tira con el viernes "hecha" y el miércoles "pendiente".
  - En "Otra sesión", el aviso y "Lun 16" como enlace.
- **E2E (AC-9 y AC-13):**
  - El miércoles 18: abrir la vista previa del viernes, empezar, una serie, "Terminar y guardar lo hecho", dolor 0, guardar.
  - Comprobar en "Hoy" la tarjeta y el aviso, y en `/dia/2026-11-20`, "Ya hiciste esta sesión.".
  - Abrir `/dia/2026-11-16` y ver "Ya entrenaste hoy. Podrás empezar otra sesión mañana." sin botón.
  - Repetirlo sin conexión (AC-19), con los ayudantes de `tests/e2e/helpers.ts` (`openTodayOn`, `startSession`, `doSet`, `painLevel`).
- **axe (AC-18):** "Hoy" en el estado de AC-9 y la vista previa de AC-13. 320 px en los dos.
- **Estabilidad:** `npx playwright test --grep "spec 005b" --repeat-each=5` en Chromium y WebKit, en local.

Tras cada prueba en verde se rompe el código a propósito, para ver que falla la prueba correcta (handoff, notas).

## 8. Riesgos

- **Confundir `date` y `plannedFor`:** es el error más probable en el repositorio y en las páginas. Lo cubren los mutantes de §7 y los nombres `closedToday` frente a `doneToday`.
- **Datos del 18-nov en el iPhone:** dos workouts cerrados con el mismo `date`. Se verifica en el iPhone que "Hoy" y la tira siguen bien (AC-17). Como ese día ya pasó, la regla no se nota allí.
- **Medianoche con "Hoy" abierto:** `useToday` ya cambia la fecha a las 00:00 (spec 003). Con ella cambian `closedToday` y el aviso. No hay prueba nueva, porque es el mismo mecanismo que ya cubren las de la spec 003.
- **Repositorio en memoria distinto del de Dexie:** las pruebas del servicio usan el de memoria. Debe aplicar el mismo orden; las del repositorio Dexie lo confirman por su lado.

## 9. Checklist de la constitución

- [x] **P-1:** no se sugiere ningún ejercicio.
- [x] **P-2:** sin cambio de esquema ni migración; no se borra nada; los datos rotos se toleran (AC-17).
- [x] **P-3:** contrato `training` v1.23 aprobado antes del código; sin `[POR DEFINIR]`.
- [x] **P-4:** la regla está en `training` y sobre sus tablas; `app` solo lee `useCompletedWorkouts`; ningún import nuevo entre módulos.
- [x] **P-5:** RN-TRN-27 con pruebas primero en el servicio y el repositorio.
- [x] **P-6:** filas de 48 px sin cambios; axe y 320 px (AC-18); bundle medido.
- [x] **P-7:** sin API, índice ni dominio nuevos; el predicado se queda en `app` mientras tenga dos usos.
- [x] **P-8:** sin entradas externas nuevas; textos en español.
