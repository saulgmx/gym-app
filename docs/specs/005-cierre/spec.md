# Spec: Cierre de sesión

**ID:** 005 · **Estado:** Aprobada · **Fecha:** 18-nov-2026
**Requerimientos cubiertos:** RF-20, RF-21, RF-22, RF-23, RNF-01, RNF-05 · **Fase:** 3 (spec §13), primera parte
**Fuente de diseño:** [`docs/design-cierre.md`](../../design-cierre.md), tablero "Cierre" (`Cierre.dc.html`) del lienzo de diseño; [`docs/design-hoy.md`](../../design-hoy.md) para lo que cambia en "Hoy"
**ADRs aplicados:** 0002, 0005, 0009, 0010

## 1. Problema y objetivo

Hoy una sesión solo se puede descartar: no hay forma de terminarla, así que nada cuenta como entrenado y la app no sabe cómo está la espalda. El Cierre registra el dolor lumbar (obligatorio), las banderas rojas y las notas, marca la sesión como terminada y vuelve a "Hoy", que por fin muestra los días hechos y avisa si el dolor lo pide.

## 2. Alcance

La fase 3 se reparte en tres specs: esta (Cierre), la 006 (historial) y la 007 (exportar e importar, módulo `data`).

- **Incluye:**
  - **Módulo `health`, primera parte** (pruebas primero, P-5): clasificación del dolor (RN-HLT-01, 02, 06, 07), registro por workout (RN-HLT-09), alerta persistente (RN-HLT-03 a 05, 08), aviso de "Hoy" (RN-HLT-12) y `PainGate`. Tabla `painEntries`; la base sube a la versión 3.
  - **`finishWorkout`** en `training` con `PainGate` (RN-TRN-06), `listWorkouts` y el resumen `workoutSummary` (el plan reemplazó `getWorkoutSummary` por esta función pura).
  - **Pantalla de Cierre** en `/sesion/:workoutId/cierre`: resumen, dolor 0-10 con mensaje, banderas rojas, notas, "Guardar sesión" y "Volver a la sesión".
  - **Entradas al Cierre:** "Terminar sesión" en el pie del último ejercicio y "Terminar y guardar lo hecho" en el aviso de salida.
  - **"Hoy" con sesiones hechas:** ✓ en la tira, "N" de "N de M sesiones", filas "hecha ✓" en "Otra sesión de esta semana", la tarjeta de un día ya hecho, el aviso de dolor y el chip "Espalda N/10" (spec 003 §6.6).
- **No incluye:**
  - "Para la próxima sesión" y cualquier sugerencia (RF-24, fase 4, `progression`). Tampoco marcar ejercicios "para revisión" en la banda Atención (spec §6.2): es de `progression`.
  - Publicar `training/WorkoutCompleted`, `health/PainRecorded` y `health/PainAlertRaised`: nadie los escucha hasta la fase 4 (P-7, como en la spec 002).
  - Ajustes: cambiar el umbral (RF-51) y el aviso permanente "la app no es un dispositivo médico" (la pantalla de Ajustes no existe). El umbral es 3 y no se guarda (§8, decisión 9).
  - Peso corporal (`bodyMetrics`, RF-34), gráfica del dolor (RF-33), historial (spec 006), exportar el dolor (spec 007).
  - Editar o reabrir una sesión cerrada (RN-TRN-07; v1.1).

## 3. Historias de usuario

- Como usuario al terminar de entrenar, quiero registrar cómo quedó mi espalda en dos toques y guardar la sesión, para que cuente como hecha.
- Como usuario que no pudo terminar, quiero guardar lo que hice sin fingir que hice todo.
- Como usuario con espondilolistesis, quiero que la app me diga qué hacer si el dolor sube y que me mande al médico si marco una señal de alarma.
- Como usuario, quiero ver en "Hoy" qué días de la semana ya entrené y que me recuerde cuidar la espalda si la última sesión me dolió.

## 4. Criterios de aceptación

Las fechas suponen un programa que empieza el lunes 16-nov-2026. La semana 1 tiene Full body A el lunes y el viernes, cardio el martes, Full body B el miércoles y descanso el jueves (3 sesiones de pesas). Full body A en la semana 1 tiene 7 ejercicios y 10 series planificadas (Prensa 2, Press de banca 2, Dominadas 2 y 1 de cada uno de los otros cuatro).

**Ejemplo completo:** Full body A iniciada el lunes 16-nov a las 18:00, con las 10 series hechas, en el Cierre a las 18:52.
**Ejemplo parcial:** la misma sesión con las 2 series de Prensa, la 1.ª de Press de banca y las 2 de Dominadas hechas (5 series en 3 ejercicios).

### 4.1 Entrar al Cierre

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-1 | El ejemplo completo, en el ejercicio 7 | Miro el pie | "Último ejercicio de hoy" sobre "Anterior" (secundario) y "Terminar sesión" (principal, relleno de acento), en el lugar de "Siguiente" |
| AC-2 | AC-1 | Toco "Terminar sesión" | Voy a `/sesion/<id>/cierre`. El workout sigue `in_progress` |
| AC-3 | Una sesión sin ninguna serie hecha, en el ejercicio 7 | Miro el pie | Solo "Anterior", como en la spec 004 (AC-33): no hay nada que guardar |
| AC-4 | El ejemplo parcial, en el ejercicio 2 | Toco la flecha | El aviso de salida tiene cuatro opciones en este orden: "Seguir entrenando", "Terminar y guardar lo hecho" con el subtítulo "Irás al cierre para registrar el dolor", "Salir y continuar después" y "Descartar sesión" |
| AC-5 | AC-4 | Toco "Terminar y guardar lo hecho" | Voy a `/sesion/<id>/cierre` |
| AC-6 | Una sesión sin ninguna serie hecha | Toco la flecha | El aviso no tiene "Terminar y guardar lo hecho": quedan las tres opciones de la spec 004 (AC-12) |

### 4.2 Pantalla de Cierre

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-7 | El ejemplo completo | Abro el Cierre | Título "Sesión terminada" (`h1`) con un check decorativo; debajo "Lunes 16 de noviembre · Full body A". Resumen: "52 min", "10 series" y "7 ejercicios" |
| AC-8 | El ejemplo parcial, a las 18:30 | Abro el Cierre | El mismo título; resumen "30 min", "5 series" y "3 de 7 ejercicios" |
| AC-9 | Una sesión iniciada el lunes 16-nov | Abro el Cierre el martes 17-nov | El resumen no muestra los minutos (como la spec 004, AC-3): solo series y ejercicios |
| AC-10 | AC-7 | Miro la sección de dolor | "Dolor lumbar" con 11 botones de 0 a 10, ninguno elegido (`aria-pressed="false"`), y sin mensaje. "Guardar sesión" está deshabilitado y debajo dice "Elige el nivel de dolor para poder guardar" |
| AC-11 | AC-10 | Toco "2" | "2" queda con `aria-pressed="true"`; el mensaje dice "Molestia leve, dentro de lo normal. Sigue con el plan." (RN-HLT-02) y se anuncia una vez (`aria-live="polite"`); "Guardar sesión" se habilita y el texto de ayuda desaparece |
| AC-12 | AC-11 | Toco "5", luego "8" | Con 5: "Molestia alta. Baja la carga la próxima sesión y evita los ejercicios que la provocaron.", botón elegido en ámbar. Con 8: "Dolor alto. Detén el entrenamiento de esta zona y consulta a tu traumatólogo o fisioterapeuta.", con barra ámbar. Solo un botón queda elegido |
| AC-13 | AC-7 | Miro "Banderas rojas" | Cuatro casillas sin marcar, opcionales: "Dolor que baja por la pierna", "Hormigueo o adormecimiento", "Debilidad en el pie" y "Problemas de control de vejiga o intestino" |
| AC-14 | AC-13 | Marco "Hormigueo o adormecimiento" | Aparece el aviso ámbar "Consulta a un médico antes de seguir entrenando. No se sugerirá subir carga." [PROPUESTO] (RN-HLT-06) |
| AC-15 | AC-14 | Marco también "Problemas de control de vejiga o intestino" | El aviso cambia a "Acude a urgencias. No sigas entrenando hasta que te revise un médico." [PROPUESTO]. Al desmarcar todas, el aviso desaparece |
| AC-16 | AC-7 | Miro "Notas de la sesión" | Un campo de texto opcional, vacío, con etiqueta visible |
| AC-17 | AC-7, en un teléfono | Desplazo el contenido | "Guardar sesión" (56 px) y "Volver a la sesión" (48 px) quedan fijos abajo con la zona segura; el contenido no queda tapado por el pie |

### 4.3 Guardar y volver

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-18 | El ejemplo completo con dolor 2, "Hormigueo" marcado y la nota "Buena sesión" | Toco "Guardar sesión" | Se guarda una entrada de dolor `{ level: 2, redFlags: ['numbness'] }` del workout; luego el workout pasa a `completed` con `finishedAt` = ahora y `notes: "Buena sesión"`. Voy a "Hoy" con `replace` (atrás no vuelve al Cierre) |
| AC-19 | AC-18 con la nota vacía o solo espacios | Guardo | El workout no tiene `notes`. Una nota con espacios alrededor se guarda recortada |
| AC-20 | El ejemplo parcial, guardado | Miro los datos | El workout está `completed`; las 5 series no hechas siguen guardadas con `done: false` y no cuentan en el historial (RN-TRN-08) |
| AC-21 | AC-7 llegando desde el ejercicio 7 | Toco "Volver a la sesión" | Vuelvo a `/sesion/<id>/7`. Nada se guardó: ni dolor ni cambio de estado |
| AC-22 | AC-5 (desde el ejercicio 2), con dolor 4 elegido | Toco "Volver a la sesión" | Vuelvo a `/sesion/<id>/2`. Si vuelvo a abrir el Cierre, el dolor empieza sin elegir |
| AC-23 | Abro `/sesion/<id>/cierre` escribiendo la URL | Toco "Volver a la sesión" | Voy al ejercicio actual de RN-TRN-21 (o al 1 si todo está hecho) |
| AC-24 | AC-11 | Salgo del Cierre sin guardar (pestaña "Hoy", atrás) | La sesión sigue `in_progress` y "Hoy" muestra "Continuar sesión" |
| AC-25 | AC-18, si guardar el dolor falla | Toco "Guardar sesión" | No se llama a `finishWorkout`: la sesión sigue `in_progress`, sigo en el Cierre con lo que elegí y aparece el mensaje de ADR-0010 sobre el pie. Puedo reintentar (architecture §6.3) |
| AC-26 | AC-18, si el dolor se guarda y `finishWorkout` falla | Toco "Guardar sesión" | Sigo en el Cierre con el mensaje de ADR-0010; al reintentar, el dolor se reemplaza (RN-HLT-09) y no se duplica |
| AC-27 | Mientras guardo | Toco "Guardar sesión" otra vez | El botón está deshabilitado hasta que termina: se guarda una sola vez |

### 4.4 Sesiones que no se pueden cerrar

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-28 | Un workout ya `completed` | Abro su Cierre o su `/sesion/<id>/N` | "Esta sesión ya está guardada." y un enlace "Volver a Hoy" |
| AC-29 | Un workout `discarded` o inexistente | Abro su Cierre | "Esta sesión ya no está disponible." (como spec 002 AC-28) |
| AC-30 | Una sesión sin series hechas | Abro su Cierre escribiendo la URL | "No hay series hechas para guardar." y "Volver a la sesión"; no hay selector de dolor ni "Guardar sesión" |
| AC-31 | El Cierre abierto en dos pestañas | Guardo en una y luego en la otra | La segunda pasa a "Esta sesión ya está guardada." (vista en vivo); si llegó a tocar "Guardar", `finishWorkout` devuelve `training/workout-closed` y se ve el mismo texto |

### 4.5 "Hoy" con sesiones hechas

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-32 | El lunes guardado; es miércoles 18-nov | Abro "Hoy" | La tira marca el lunes con ✓ relleno de acento y se lee "lunes, Full body A, hecha"; el encabezado dice "1 de 3 sesiones". "Otra sesión de esta semana" muestra "Lun 16 · Full body A · hecha ✓" gris y no pulsable, y "Vie 20 · Full body A" pendiente |
| AC-33 | Full body A del viernes hecha el miércoles desde "Otra sesión" (`plannedFor` = viernes) | Abro "Hoy" | El ✓ va en el viernes, no en el miércoles: cuenta el día del plan (RN-TRN-23) |
| AC-34 | El miércoles guardado, el mismo miércoles | Abro "Hoy" | La tira marca el miércoles con ✓ dentro del anillo de hoy. La tarjeta "Tu sesión de hoy" muestra "Full body B", el chip "Hecha ✓" y el resumen "52 min · 10 series"; no tiene "Empezar sesión" ni "Ver los N ejercicios" |
| AC-35 | AC-34 | Abro `/dia/2026-11-18` | La vista previa dice "Ya hiciste esta sesión." y no tiene "Empezar sesión" |
| AC-36 | Un workout `discarded` el lunes | Abro "Hoy" | El lunes no tiene ✓ (spec 003 AC-13) |

### 4.6 Aviso de dolor y chip en "Hoy"

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-37 | Sin ninguna entrada de dolor | Abro "Hoy" | Ni aviso ni chip "Espalda" (spec 003 §6.6) |
| AC-38 | La última entrada: 3, sin banderas, sin alerta persistente | Abro "Hoy" (estado D) | Chip "Espalda 3/10" junto a bloque y RIR; sin aviso (RN-HLT-12) |
| AC-39 | La última entrada: 5 | Abro "Hoy" | Aviso ámbar arriba de la tarjeta: "Espalda baja 5/10 en la última sesión. Hoy baja la carga y evita los ejercicios que la provocaron." [PROPUESTO]; chip "Espalda 5/10" |
| AC-40 | Las 3 últimas entradas 1, 2 y 3 | Abro "Hoy" | Aviso: "Tu dolor lumbar subió en las 3 últimas sesiones (1 → 2 → 3). Hoy prioriza la técnica y no añadas carga." [PROPUESTO] (RN-HLT-05) |
| AC-41 | Las 2 últimas entradas 4 y 5 | Abro "Hoy" | Aviso de alerta persistente: "Espalda baja por encima de 3/10 en las 2 últimas sesiones. Hoy prioriza la técnica y no añadas carga; si sigue, consulta a tu traumatólogo o fisioterapeuta." [PROPUESTO] (RN-HLT-04, manda sobre Atención) |
| AC-42 | La última entrada: 8 | Abro "Hoy" | Aviso: "Espalda baja 8/10 en la última sesión. Detén el entrenamiento de esta zona y consulta a tu traumatólogo o fisioterapeuta." [PROPUESTO] |
| AC-43 | La última entrada con "Debilidad en el pie" | Abro "Hoy" | Aviso: "En la última sesión marcaste una señal de alarma. Consulta a un médico antes de seguir entrenando." [PROPUESTO]; con "Problemas de control de vejiga o intestino": "En la última sesión marcaste problemas de control de vejiga o intestino. Acude a urgencias antes de volver a entrenar." [PROPUESTO] |
| AC-44 | AC-39 con una sesión en curso (D2) | Abro "Hoy" | Ni aviso ni chip (spec 003 §6.6) |
| AC-45 | AC-41 y luego una sesión guardada con dolor 2 | Abro "Hoy" | Ya no hay aviso: la alerta es derivada (RN-HLT-08); chip "Espalda 2/10" |

### 4.7 Transversales

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-46 | Una base v2 con un workout en curso y series | Abro la versión nueva | La base sube a v3 con `painEntries`; el workout y sus series siguen intactos y se puede cerrar (P-2, como spec 002 AC-38) |
| AC-47 | El Cierre con dolor elegido, banderas, aviso y la nota; "Hoy" con aviso y chip; el aviso de salida con 4 opciones | Corre axe en Playwright | Sin violaciones WCAG 2.2 A/AA; cada control ≥ 44 × 44 px; nada desborda a 320 px |
| AC-48 | Sin conexión, con la app ya abierta una vez | Cierro y guardo una sesión | Todo funciona igual (RNF-01) |
| AC-49 | El build de producción | Corre `size-limit` | El JS inicial sigue < 200 KB gzip (QS-10) |
| AC-50 | Una sesión guardada | El aviso de versión nueva estaba esperando (spec 002 AC-37) | Ya no hay sesión activa: el aviso aparece al volver a "Hoy" |

## 5. Reglas de negocio aplicables

Del contrato [`modules/health.md`](../../modules/health.md) v1.1: RN-HLT-01 a 09 y 12. Del contrato [`modules/training.md`](../../modules/training.md) v1.18: RN-TRN-06, 07, 08, 09, 15 y 21.

Reglas nuevas, ya en los contratos (`training` v1.19, `health` v1.2):

| ID | Regla |
|---|---|
| RN-TRN-22 | `finishWorkout(workoutId, { notes })`: el workout debe estar `in_progress` (si no, `training/workout-closed`) y tener al menos una serie hecha (si no, `training/nothing-done`); luego `painGate.hasPainEntry` (RN-TRN-06). En ese orden. Pasa a `completed`, fija `finishedAt = clock.now()` y guarda `notes` recortadas, o sin `notes` si quedan vacías; máximo 2000 caracteres (si no, `training/notes-too-long`). Las series no hechas se conservan. |
| RN-TRN-23 | Un día de pesas de la semana está **hecho** si existe un workout `completed` con `plannedFor` igual a ese día. `discarded` e `in_progress` no cuentan. |
| RN-TRN-24 | `startWorkout` con un `plannedFor` que ya está hecho (RN-TRN-23) devuelve `training/already-done`. |
| RN-TRN-25 | Resumen del Cierre (`workoutSummary`): minutos = `floor((finishedAt ?? now) − startedAt)` en minutos, nunca negativo; series = series hechas; ejercicios = ítems con al menos una serie hecha, sobre el total de ítems. |
| RN-HLT-13 | Causa del aviso de "Hoy" (RN-HLT-12) cuando hay varias, de mayor a menor prioridad: `bladder_bowel` → otra bandera roja → `alert` (7-10) → `over_threshold_2x` → `rising_3x` → `attention` (4-6). Se muestra un solo texto, el de la causa de mayor prioridad (textos de AC-39 a AC-43). |

Cambios de documentos hechos al aprobar (18-nov):

| Documento | Cambio |
|---|---|
| `modules/training.md` | `finishWorkout`, `getWorkoutSummary` (luego `workoutSummary`, plan §3) y `listWorkouts` entran en `TrainingApi`; `painGate` en `createTraining`; errores `training/pain-required`, `nothing-done`, `notes-too-long` y `already-done`; RN-TRN-22 a 25 |
| `modules/health.md` | RN-HLT-13; textos del aviso de "Hoy" y de las banderas rojas como `[PROPUESTO]` hasta validarlos (spec §14) |
| `spec.md` §7.2 (v0.10) | Fila "Cierre" sin "próxima sesión" (fase 4); "Sesión activa" con "Terminar sesión" y "Terminar y guardar lo hecho" |
| Spec 004 | AC-12 (sin "Terminar y guardar"), AC-33 y §6.6 (sin "Terminar sesión") quedan reemplazados por AC-1, AC-3, AC-4 y AC-6 de esta spec (la 004 no se edita) |
| Spec 003 | §6.6 y las marcas "hecha" que dejaba para la fase 3 quedan definidas aquí (AC-32 a AC-45) |

## 6. UX

### 6.1 Cierre
- Pantalla completa sin barra de pestañas, como la sesión. `<title>` "Cierre de sesión · Gym".
- **Encabezado:** check decorativo (`aria-hidden`), `h1` "Sesión terminada" y la línea "Lunes 16 de noviembre · Full body A" (fecha del workout, `date`, con el formato largo de "Hoy").
- **Resumen:** tres cifras en fila, cada una con número grande y etiqueta ("52 min", "10 series", "7 ejercicios"; "3 de 7 ejercicios" si no todos tienen series hechas). Lista `<dl>` para el lector de pantalla. Los minutos se calculan al abrir y no se actualizan.
- **Dolor lumbar:** `h2` "Dolor lumbar", el texto "0 = nada, 10 = el peor dolor" y un grupo (`role="group"` con ese nombre) de 11 botones de 44 px con `aria-pressed`, en dos filas a 320 px. Desde 4, el elegido usa `--warn`. Debajo, la región `aria-live="polite"` con el mensaje de la banda (`health.assessPain`); en 7-10, con barra ámbar a la izquierda.
- **Banderas rojas:** `h2` "Señales de alarma (opcional)", cuatro casillas nativas de ≥ 44 px con su etiqueta. El aviso, en `SafetyNote` ámbar, aparece debajo con `aria-live="polite"`.
- **Notas:** `<textarea>` con la etiqueta "Notas de la sesión (opcional)", 3 líneas, sin contador hasta 2000 caracteres.
- **Pie fijo** con la zona segura: "Guardar sesión" (principal, 56 px) y "Volver a la sesión" (enlace secundario, 48 px). Sin dolor elegido, "Guardar sesión" está deshabilitado (`disabled`) y la ayuda "Elige el nivel de dolor para poder guardar" está visible encima; al guardar, "Guardando…".
- **Volver a la sesión:** al índice del ejercicio desde el que se llegó (lo pasa la navegación); sin él, el de RN-TRN-21.
- Lo elegido en el Cierre vive en el estado de la página: no se guarda hasta "Guardar sesión" (ni en Dexie ni en `localStorage`).

### 6.2 Sesión activa
- Pie del último ejercicio: "Anterior" (secundario) y "Terminar sesión" (principal, relleno de acento, enlace al Cierre) en lugar de "Siguiente", si hay al menos una serie hecha.
- Aviso de salida: "Terminar y guardar lo hecho" entre "Seguir entrenando" y "Salir y continuar después", superficie con subtítulo "Irás al cierre para registrar el dolor", solo con al menos una serie hecha. Su nombre accesible es todo su texto visible (spec 004 §6.3).

### 6.3 "Hoy"
- **Tira:** ✓ sobre círculo relleno de acento en días hechos; hoy hecho suma el anillo de acento. Estado "hecha" en el `aria-label`. "N" cuenta los días hechos de la semana (RN-TRN-23).
- **Otra sesión de esta semana:** filas hechas en gris (`--text-muted`), sin botón, "Lun 16 · Full body A · hecha ✓" (el ✓ con texto oculto "hecha").
- **Tarjeta de un día hecho:** eyebrow "Tu sesión de hoy", título, chip "Hecha ✓" y la línea "52 min · 10 series" del workout guardado; sin CTA ni lista de ejercicios. Chips de bloque y RIR como siempre.
- **Aviso de dolor:** `SafetyNote` ámbar (#FFB547) entre la fila superior y la tarjeta, informativo, sin botones, solo en el estado D. El texto sale de la causa (RN-HLT-13).
- **Chip "Espalda N/10":** en la tarjeta, junto a bloque y RIR, con la última entrada; en ámbar desde 4.

### 6.4 Estados generales
- **Cargando:** como la sesión (spec 002 §6).
- **Errores al guardar:** el texto de ADR-0010 sobre el pie del Cierre, con `role="alert"`; lo elegido se conserva.
- **Textos** en español; objetivos ≥ 44 px; contraste AA con los tokens existentes (ADR-0005).

## 7. Casos límite

- **Cierre después de medianoche:** el workout conserva su `date` (RN-TRN-09); los minutos se ocultan si hoy no es `date` (AC-9) y `finishedAt` es el instante real.
- **Reloj del sistema hacia atrás:** minutos = 0 (RN-TRN-25).
- **Dolor guardado y `finishWorkout` falla** (AC-26): queda una entrada de dolor de un workout `in_progress`. Si el usuario no reintenta y luego descarta, esa entrada sigue contando para el aviso de "Hoy". Riesgo aceptado: requiere un fallo de la base entre dos escrituras seguidas; `health` no conoce el estado de los workouts.
- **Otra pestaña marca o desmarca series** con el Cierre abierto: el resumen se recalcula en vivo; si se quedan sin series hechas, pasa a AC-30.
- **La sesión se descarta en otra pestaña** con el Cierre abierto: pasa a AC-29.
- **Dos workouts `completed` con el mismo `plannedFor`** (RN-TRN-24 lo impide; solo por un dato roto): el día cuenta una vez y la tarjeta usa el más reciente.
- **Nota con 2000 caracteres o más:** el campo no deja escribir más (`maxLength`); el límite de RN-TRN-22 protege la API.
- **Día de cardio o descanso:** no tienen ✓ (el cardio no se registra en v1, spec 003).

## 8. Preguntas abiertas

Ninguna que bloquee. Los textos de salud (banderas rojas en AC-14 y AC-15, aviso de "Hoy" en AC-39 a AC-43) se aprueban y siguen `[PROPUESTO]` solo hasta validarlos con el traumatólogo (spec §14); cambiarlos no cambia ninguna regla.

Decisiones cerradas el 18-nov-2026 (conversación con el dueño del producto):

1. **Alcance:** solo el Cierre; historial en la 006 y exportar/importar en la 007.
2. **Banderas rojas:** los textos del diseño, `[PROPUESTO]` hasta validarlos con el traumatólogo (spec §14). No bloquean esta spec.
3. **"Terminar sesión":** en el pie del último ejercicio, en lugar de "Siguiente".
4. **Notas:** `Workout.notes`, se guardan con `finishWorkout` y no se editan después (RN-TRN-07).
5. **Sesión parcial:** mismo Cierre, dolor obligatorio, título igual, "N de M" en ejercicios; cuenta como hecha en la tira (`design-cierre.md` §4).
6. **"Volver a la sesión":** al último ejercicio visto.
7. **Bandas y aviso de "Hoy":** pregunta 8 (`health.md` v1.1 §10).
8. **Eventos:** no se publican hasta que alguien los escuche (fase 4).
9. **Umbral:** 3 fijo en esta spec; `healthSettings` y su pantalla llegan con Ajustes (RF-51).
10. **Día ya hecho** (AC-34, AC-35, RN-TRN-24): la tarjeta muestra "Hecha ✓" con el resumen y sin "Empezar sesión"; no se puede iniciar otra sesión para el mismo día del plan.
11. **Sin series hechas no hay Cierre** (AC-3, AC-6, AC-30, RN-TRN-22): no aparecen las entradas y `finishWorkout` devuelve `training/nothing-done`.
12. **Aviso de "Hoy":** un texto por causa (AC-39 a AC-43) con la prioridad de RN-HLT-13.
13. **Resumen** (RN-TRN-25): minutos redondeados hacia abajo; "ejercicios" = ítems con al menos una serie hecha.
14. **Notas:** recortadas, vacías = sin notas, máximo 2000 caracteres (RN-TRN-22).
15. **Riesgo aceptado:** la entrada de dolor que queda si `finishWorkout` falla y la sesión se descarta después (§7).
16. **Subtítulo** de "Terminar y guardar lo hecho": "Irás al cierre para registrar el dolor".

## 9. Checklist de la constitución

- [x] **P-1:** no se sugiere ningún ejercicio; bandera roja y `alert` dejan `blocksProgression = true` para la fase 4 (RN-HLT-06, 07); los mensajes son orientativos y remiten a un profesional.
- [x] **P-2:** base v3 con migración y prueba desde v2 (AC-46); guardar es dolor y luego cierre, reintentable (AC-25, AC-26); no se borra nada; las series no hechas se conservan.
- [x] **P-3:** cambios de contrato y de spec en §5; sin `[POR DEFINIR]`; solo los textos de salud quedan `[PROPUESTO]` hasta la validación médica (§8).
- [x] **P-4:** `app` compone `health` y `training` (Cierre y "Hoy"); `training` solo conoce `PainGate`; cada módulo con sus tablas.
- [x] **P-5:** `health` y las reglas nuevas de `training` con pruebas primero.
- [x] **P-6:** ≥ 44 px, axe y 320 px (AC-47); bundle (AC-49).
- [x] **P-7:** sin eventos, Ajustes ni `bodyMetrics` hasta que se usen.
- [x] **P-8:** sin entradas externas nuevas (la nota es texto del usuario, sin Zod); textos en español.
