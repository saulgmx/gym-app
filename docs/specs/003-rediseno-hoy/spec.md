# Spec: Rediseño de "Hoy"

**ID:** 003 · **Estado:** Aprobada (18-nov-2026) · **Fecha:** 18-nov-2026
**Requerimientos cubiertos:** RF-02, RF-05 (cómo se ve el deload), RF-10, RF-19, RNF-05, RNF-06 · **Fase:** entre la 2 y la 3 (no está en spec §13; ver §2)
**Fuente de diseño:** [`docs/design-hoy.md`](../../design-hoy.md), tableros "D. Combinación A+B" y "D2. Sesión en curso" del lienzo de diseño
**ADRs aplicados:** 0005, 0010

## 1. Problema y objetivo

"Hoy" ya funciona, pero cuesta ver de un vistazo **qué sesión toca hoy**: la lista de ejercicios ocupa casi toda la pantalla y la tarjeta de sesión en curso solo dice el nombre. El rediseño pone la sesión del día en una tarjeta grande con su duración estimada, y con una sesión en curso muestra cuánto llevas, cuánto falta y en qué ejercicio vas. Solo usa datos que ya existen. Lo que depende de las fases 3 y 4 queda con un lugar reservado.

## 2. Alcance

Feature de interfaz, sin cambios en la base de datos. Va antes de la fase 3; la spec de la fase 3 pasa a ser la 004.

- **Incluye:**
  - Estado **D (sin sesión en curso):** fila superior, tarjeta "Tu sesión de hoy" (también en cardio y descanso), desplegable "Ver los N ejercicios", tira "Esta semana" y "Otra sesión de esta semana".
  - Estado **D2 (sesión en curso):** tarjeta "Sesión en curso" con tiempo transcurrido, avance por ejercicio, tiempo restante estimado, "Vas en", "Continuar sesión" y "Descartar sesión".
  - Estimación de duración: reglas nuevas RN-PLN-27 y RN-TRN-20 (§5).
  - Avance de una sesión en curso: regla nueva RN-TRN-21 (§5).
  - Tira de la semana nueva: círculos, marcas y "N de M sesiones". En esta spec "N" es siempre 0 (ver "No incluye").
  - Texto nuevo de la confirmación de descarte, el mismo en "Hoy" y en la sesión activa.
  - "Empezar sesión" en lugar de "Iniciar sesión", también en `/dia/:date`.
  - Spec §7.2, §7.3 y §13 actualizadas al aprobar (spec v0.7).
- **No incluye:**
  - **Marcar días hechos** en la tira (✓), contar "N" y las filas "hecha ✓" de "Otra sesión de esta semana": necesitan workouts `completed` (fase 3, `finishWorkout`).
  - **"Hoy subes":** necesita sugerencias de `progression` (fase 4). No se construye hasta entonces (P-7).
  - **Aviso de dolor y chip "Espalda N/10":** necesitan `health` (fase 3). Su lugar queda anotado en §6.6.
  - **Hoja "Cambiar sesión"**, `ScheduleOverride` y sesión libre (RF-06): spec futura. Sin ella la tira solo sigue `block.schedule`.
  - **Registrar cardio:** el cardio siempre se ve pendiente.
  - **Chequeo previo de espalda** (Bien / Molestia / Dolor): idea aplazada en el diseño.
  - Rediseño de la sesión activa ([`docs/design-sesion-activa.md`](../../design-sesion-activa.md)): spec aparte.

## 3. Historias de usuario

- Como usuario, al abrir la app quiero ver en grande qué sesión toca hoy y cuánto me va a llevar, para organizar mi tiempo en el gym.
- Como usuario, quiero ver los ejercicios del día solo si los busco, para que la pantalla no se llene.
- Como usuario, quiero ver la semana entera con qué toca cada día (pesas, cardio, descanso).
- Como usuario a mitad de sesión, quiero volver a "Hoy" y ver cuánto llevo, cuánto falta y en qué ejercicio voy, para retomar sin perderme.
- Como usuario, antes de descartar una sesión quiero saber cuántas series perdería.

## 4. Criterios de aceptación

Las fechas suponen un programa que empieza el lunes 16-nov-2026. En la semana 1 (factor 0.7, RIR 3-4) el lunes y el viernes son Full body A, el miércoles Full body B, el martes y el sábado cardio, y el jueves y el domingo descanso. Full body A tiene 7 ejercicios: Prensa de piernas (2 series planificadas), Press de banca con barra (2), Dominadas (2), Curl femoral (1), Elevaciones laterales (1), Curl con barra Z (1) y Dead bug (1).

### 4.1 Estado D: sin sesión en curso, día de pesas

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-1 | Lunes 16-nov, sin sesión activa | Abro "Hoy" | Fila superior: "Lunes 16 nov" y el chip "Semana 1 de 15". Tarjeta "Tu sesión de hoy" con el título "Full body A", "7 ejercicios · ~50 min", los chips "Bloque 1 · Full body" y "RIR 3-4", y "Empezar sesión" |
| AC-2 | AC-1 | Toco "Empezar sesión" | Se crea el workout como en spec 002 AC-1 y navego a `/sesion/<id>/1` (RF-10) |
| AC-3 | AC-1 | Miro debajo de la tarjeta | El desplegable "Ver los 7 ejercicios" está cerrado. Al abrirlo veo los 7 en orden con series × reps ("Prensa de piernas · 2 × 8-12") y la nota de la plantilla si la hay; no hay cargas |
| AC-4 | Un ejercicio `metric: 'time'` (Plancha) en el desplegable | Lo miro | Las reps se muestran en segundos: "3 × 30-45 s" |
| AC-5 | Semana 15 (deload, RIR 4) en un día de pesas | Abro "Hoy" | Chips del bloque, "RIR 4" y "Descarga"; las series y la duración ya usan el 50% (RN-PLN-04, RN-PLN-05) |
| AC-6 | Miércoles 18-nov (Full body B, semana 1) y lunes 23-nov (Full body B, semana 2, factor 1) | Abro "Hoy" | "~55 min" y "~75 min" (RN-PLN-27) |

### 4.2 Estado D: días sin pesas y fuera del programa

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-7 | Martes 17-nov (cardio) | Abro "Hoy" | Tarjeta con el eyebrow "Tu sesión de hoy", el título "Cardio", la nota del seed ("Cardio suave 30-40 min (bici, elíptica o caminata inclinada)") y solo el chip del bloque. Sin CTA, sin desplegable y sin chip de RIR |
| AC-8 | Jueves 19-nov (descanso) | Abro "Hoy" | Igual que AC-7 con el título "Descanso" y "Recupera: dormir y comer bien también es entrenar." |
| AC-9 | Domingo 15-nov (antes del programa) o un día después de la semana 15 | Abro "Hoy" | La fila superior muestra solo la fecha; la tarjeta dice "El plan empieza el lunes 16 de noviembre." o "Terminaste el plan de 15 semanas."; no aparecen ni la tira ni "Otra sesión de esta semana" |

### 4.3 Tira "Esta semana"

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-10 | Miércoles 18-nov | Miro "Esta semana" | Encabezado "Esta semana" y "0 de 3 sesiones". Siete días L a D: L, X y V con anillo vacío; M y S con "C"; J y D con "–". El miércoles tiene el anillo de acento de hoy y ● |
| AC-11 | Jueves 19-nov (descanso) y sábado 21-nov (cardio) | Miro el día de hoy en la tira | El anillo de hoy rodea la marca del día: "–" el jueves, "C" el sábado |
| AC-12 | Miércoles 18-nov, con lector de pantalla | Recorro la tira | Es una lista de 7 días. Leo "lunes, Full body A, no hecha", "martes, cardio", "miércoles, hoy, Full body B, pendiente", "jueves, descanso" y "viernes, Full body A, pendiente". Las letras y marcas no se leen aparte |
| AC-13 | Miércoles 18-nov, con una sesión del lunes descartada | Miro la tira | El lunes sigue con anillo vacío: `discarded` no cuenta como hecha |
| AC-14 | Una sesión en curso | Miro "Hoy" | La tira se ve igual que sin sesión (D2 §6.3) |

### 4.4 "Otra sesión de esta semana"

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-15 | Sábado 21-nov, sin sesión activa | Miro debajo de la tira | "Otra sesión de esta semana" con los mismos días que en spec 002 AC-7 a AC-11; el botón de la vista previa en `/dia/:date` dice "Empezar sesión" |

### 4.5 Estado D2: sesión en curso

Ejemplo: sesión de Full body A iniciada el lunes 16-nov a las 18:00, con las 2 series de Prensa y la 1.ª de Press de banca hechas.

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-16 | El ejemplo, a las 18:18:42 | Abro "Hoy" | En lugar de "Tu sesión de hoy" está la tarjeta "Sesión en curso" con borde de acento: el tiempo "18:42", el título "Full body A", "1 de 7 ejercicios hechos", "Faltan ~25 min", la barra de 7 segmentos (1 hecho, 1 actual, 5 pendientes), "Vas en: Press de banca con barra · serie 2", "Continuar sesión" y "Descartar sesión". No aparecen el desplegable ni "Otra sesión de esta semana" |
| AC-17 | AC-16 | Pasa un segundo | El tiempo pasa a "18:43". Con más de una hora se muestra "1:05:12" |
| AC-18 | AC-16 | Toco "Continuar sesión" | Voy a `/sesion/<id>/2` (el ejercicio de "Vas en") |
| AC-19 | Una sesión iniciada el lunes 16-nov | Abro "Hoy" el martes 17-nov | El botón dice "Continuar sesión del lunes 16 de noviembre" (spec 002 AC-5) y no se muestra el tiempo transcurrido |
| AC-20 | Una sesión con todas las series hechas | Abro "Hoy" | "7 de 7 ejercicios hechos", los 7 segmentos hechos, y no aparecen ni "Faltan" ni "Vas en" |
| AC-21 | Una sesión recién iniciada (ninguna serie hecha) | Abro "Hoy" | "0 de 7 ejercicios hechos", "Faltan ~40 min" (sin calentamiento), el primer segmento actual y "Vas en: Prensa de piernas · serie 1" |
| AC-22 | Añado una serie extra a Prensa (3.ª, sin hacer) en el ejemplo | Vuelvo a "Hoy" | Prensa ya no cuenta como hecha: "0 de 7 ejercicios hechos" y "Vas en: Prensa de piernas · serie 3" (RN-TRN-21) |

### 4.6 Descartar

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-23 | El ejemplo de §4.5 | Toco "Descartar sesión" | Diálogo "¿Descartar la sesión?" con "Las 3 series que registraste en 2 ejercicios no contarán en tu historial. No se puede deshacer.", "Sí, descartar" y "Cancelar" |
| AC-24 | Una sesión con 1 serie hecha, o con ninguna | Toco "Descartar sesión" | "La serie que registraste en 1 ejercicio no contará en tu historial. No se puede deshacer." o "No registraste ninguna serie. No se puede deshacer." |
| AC-25 | AC-23 | Confirmo | El workout queda `discarded` (RN-TRN-15) y "Hoy" vuelve al estado D. Si cancelo, nada cambia |
| AC-26 | La sesión activa, "Ver ejercicios" → "Descartar sesión" | Toco | El mismo diálogo, con los mismos textos que en "Hoy" |

### 4.7 Transversales

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-27 | "Hoy" en los estados D (pesas, cardio, fuera del programa) y D2 | Corre axe en Playwright | Sin violaciones WCAG 2.2 A/AA; cada control táctil mide ≥ 44 × 44 px; el título de la sesión de 44 px no desborda a 320 px de ancho (`overflow-wrap: anywhere`) |
| AC-28 | El build de producción | Corre `size-limit` | El JS inicial sigue < 200 KB gzip (QS-10) |
| AC-29 | Sin conexión, con la app ya abierta una vez | Abro "Hoy" en D y D2 | Todo se ve igual (RNF-01) |

## 5. Reglas de negocio aplicables

Del contrato [`modules/plan.md`](../../modules/plan.md): RN-PLN-01 a 06. Del contrato [`modules/training.md`](../../modules/training.md): RN-TRN-01, 09, 14 y 15.

Reglas nuevas, ya movidas a los contratos al aprobar esta spec (`plan` v1.13, `training` v1.15). El plan técnico fija la forma exacta de la API.

| ID | Regla | Origen |
|---|---|---|
| RN-PLN-27 | Duración estimada de una sesión planificada, en segundos: `600 + Σ por ítem (plannedSets × (trabajo + descansoMedio) + 90)`. `trabajo` = 45 s por serie, o la media de `repRange` si `metric = 'time'`. `descansoMedio` = media de `exercise.restSeconds`. Se muestra en minutos redondeados al múltiplo de 5 más cercano (`Math.round`), mínimo 5. Las constantes (600 de calentamiento, 45 de trabajo, 90 de cambio) tienen nombre en el dominio. | Decisión 3, `plan.md` ("60 min por sesión", calentamiento de 10 min) |
| RN-TRN-20 | Tiempo restante de un workout en curso: la fórmula de RN-PLN-27 **sin** los 600 s de calentamiento, contando solo las series no hechas (planificadas y extra) y 90 s por cada ítem que tenga al menos una serie no hecha. Usa el ejercicio elegido del ítem (RN-TRN-13). Mismo redondeo. Si no queda ninguna serie, no hay estimación. No depende del reloj. | Decisión 3 |
| RN-TRN-21 | Avance de un workout en curso: un ítem está **hecho** si todas sus series están hechas (también las extra). El ítem **actual** es el primero, en orden, con una serie no hecha; su serie actual es la de menor `setNumber` no hecha. Si no hay ninguno, no hay ítem actual. Es la misma regla con la que `/sesion/:workoutId` elige el ejercicio (spec 002 AC-4). | Decisión 4, spec 002 §7.2 |

No cambia ninguna regla existente. La confirmación de descarte cambia de texto pero no de comportamiento: RN-TRN-15 conserva las series, así que el texto dice "no contarán en tu historial" y no "se borrarán" (decisión 8).

## 6. UX

### 6.1 Fila superior
Fecha corta ("Miércoles 18 nov") y chip "Semana 1 de 15". Fuera del programa, solo la fecha. El `h1` "Hoy" se mantiene oculto visualmente (`visually-hidden`), para que la página siga teniendo título; la fecha es lo primero que se ve.

### 6.2 Tarjeta del día (estado D)
- **Pesas:** eyebrow "Tu sesión de hoy"; título con el nombre de la plantilla (`h2`, 44 px, `overflow-wrap: anywhere`); "N ejercicios · ~M min"; chips de bloque (`block.name`) y RIR ("RIR 3-4", o "RIR 4" si el mínimo y el máximo coinciden), y "Descarga" en semana de deload; CTA "Empezar sesión" a lo ancho.
- **Cardio o descanso:** el mismo eyebrow "Tu sesión de hoy" (una sola etiqueta en todos los estados de D, sin excepciones); título "Cardio" o "Descanso"; como texto, la nota del seed tal cual (cardio) o el texto fijo de descanso, que vive en la app porque las entradas `rest` del seed no tienen nota; solo el chip de bloque. Idea futura del diseño: título "Cardio suave" y duración por separado, que exigen campos nuevos en el seed.
- **Fuera del programa:** el mensaje actual, sin chips.
- **Desplegable** (`<details>` y `<summary>`, solo en días de pesas): "Ver los N ejercicios", cerrado al abrir la página. Cada fila: nombre, "series × reps" (o "× s" si es tiempo) y la nota de la plantilla debajo si la hay. Sin cargas, también en la fase 4.
- El botón de "Cambiar sesión" del diseño no aparece hasta su spec.

### 6.3 Tarjeta "Sesión en curso" (estado D2)
Ocupa el lugar de la tarjeta del día; nunca se ven las dos. Borde de acento.
- Eyebrow "Sesión en curso" con un punto de estado (decorativo, `aria-hidden`) y el tiempo transcurrido desde `startedAt` (`m:ss` o `h:mm:ss`), que se actualiza cada segundo. Para lectores de pantalla el tiempo no es una región viva: no se anuncia cada segundo.
- Título con el nombre del workout (44 px).
- "N de M ejercicios hechos" y "Faltan ~X min" (RN-TRN-21, RN-TRN-20). La barra de M segmentos es decorativa (`aria-hidden`): el texto ya da el avance. Hecho = acento; actual = anillo de acento; pendiente = `--surface-2`.
- Recuadro "Vas en: <ejercicio> · serie N".
- "Continuar sesión" (principal) y "Descartar sesión" (secundario con borde en `--warn`).
- Sin desplegable, sin "Otra sesión de esta semana" y sin "Cambiar sesión".

### 6.4 Tira "Esta semana"
- Encabezado `h2` "Esta semana" y, a la derecha, "N de M sesiones". M = días de pesas de la semana según el plan; N = 0 hasta la fase 3.
- `<ol>` de 7 días, lunes a domingo. Cada `<li>` contiene un elemento con `role="img"` y `aria-label`, así se conserva la lista y cada día se lee como una imagen con nombre.
- Círculo de 32 px con la letra encima. Marcas: anillo vacío (pesas pendiente o no hecha), "C" con borde punteado (cardio), "–" (descanso). Hoy suma un anillo de acento de 2 px alrededor de su marca; en un día de pesas pendiente, ● dentro. "✓ con relleno de acento" se añade en la fase 3.
- `aria-label`: "<día>, <sesión>, <estado>". Sesión = nombre de la plantilla, "cardio" o "descanso". Estado, solo en días de pesas: "pendiente" (hoy y futuro) o "no hecha" (pasado). Hoy añade "hoy" detrás del día.
- Contraste: el anillo vacío usa `--border` (≈1.5:1). Es aceptable porque no es la única señal: un día de pesas pendiente es el único sin marca dentro. Ninguna regla futura puede depender solo del anillo (WCAG 1.4.11).
- No es interactiva.

### 6.5 "Otra sesión de esta semana"
El comportamiento no cambia respecto a spec 002 §6 (AC-7 a AC-11): debajo de la tira, en todos los estados de D (pesas, cardio y descanso), sin el día de hoy, solo con días de la semana ISO actual (RN-TRN-14), y oculta con sesión en curso. El toque abre la vista previa en `/dia/:date`; no inicia el workout directamente, para que un toque accidental no cree una sesión. Cambia el estilo: botones de 48 px con borde neutro (`--border`), que no compiten con el CTA principal. Las filas "hecha ✓" (grises, no pulsables) llegan con la fase 3.

### 6.6 Fase 3: aviso de dolor y última molestia (solo anotado)
- Aviso de dolor (`SafetyNote` ámbar, informativo, sin botones) entre la fila superior y la tarjeta, solo cuando aplica.
- Chip "Espalda N/10" en la tarjeta, junto a bloque y RIR, si hay alguna lectura.
- Sin dato, ninguno de los dos. En D2, ninguno de los dos.
- Cuándo aparece el aviso lo define `health` (pregunta pendiente 8): el diseño propone "última lectura ≥ 3/10", y la spec §6.2 dice "sobre el umbral 2 sesiones seguidas o subiendo 3".

### 6.7 Estados generales
- **Cargando:** como ahora, nada hasta que respondan todas las consultas (no parpadea "Empezar sesión" antes de "Continuar").
- **Errores:** los de ADR-0010, sin cambios.
- **Textos** en español; objetivos táctiles ≥ 44 px (CTA, `summary` del desplegable, botones de D2 y de "Otra sesión").

## 7. Casos límite

- **Medianoche con D2 abierto:** el tiempo transcurrido sigue contando desde `startedAt`; al cambiar el día local, el botón pasa a "Continuar sesión del …" y el tiempo se oculta (AC-19).
- **Sesión en curso de un día fuera del programa** (por ejemplo, la semana 15 ya terminó): se ve D2 igual; la tira se oculta.
- **Sesión en curso de otra semana:** D2 igual; la tira es la de la semana actual.
- **Cambio de ejercicio por la alternativa** (RN-TRN-13): "Vas en" y el tiempo restante usan el ejercicio elegido.
- **Quitar una serie** (RN-TRN-10) puede volver "hecho" a un ítem: el avance se recalcula en vivo (`useLiveQuery`).
- **Reloj del sistema hacia atrás** (tiempo transcurrido negativo): se muestra "0:00".
- **Datos inconsistentes** (un ítem sin series): no puede pasar (RN-TRN-10); si pasa, el ítem cuenta como hecho y no rompe la página.

## 8. Preguntas abiertas

Ninguna.

Decisiones cerradas el 18-nov-2026 (conversación con el dueño del producto):

1. **Alcance:** D y D2 con datos existentes; "Cambiar sesión" en una spec futura; la sesión activa en otra spec.
2. **Tira:** hoy es un anillo que se suma a la marca del día; pasado no hecho = pendiente; fuera del programa se oculta; cardio siempre pendiente; `aria-label` con el nombre de la sesión; `role="img"` por día.
3. **Duración:** fórmula B con calentamiento (RN-PLN-27); "Faltan" con lo pendiente y sin calentamiento, oculto en 0 (RN-TRN-20).
4. **D2:** sin "Cambiar sesión", sin "Hoy subes" y sin desplegable.
5. **Días sin pesas:** misma tarjeta, sin próxima sesión.
6. **"Otra sesión de esta semana"** se queda.
7. **Desplegable sin cargas**; "Hoy subes" en la fase 4.
8. **Aviso de seguridad** = el aviso persistente de §6.2; su lugar y el del chip de espalda, en §6.6. El disparador queda en la pregunta pendiente 8.
9. **Alineación con `design-hoy.md`** (actualizado el 18-nov): chip con el nombre completo del bloque (el seed no tiene número); texto del descarte según RN-TRN-15; `aria-label` con sesión y estado; tiempo transcurrido oculto en una sesión de otro día; "Otra sesión de esta semana" abre la vista previa.
10. **Eyebrow único:** "Tu sesión de hoy" en todos los estados de D, también en cardio y descanso; reemplaza el "Hoy" aprobado antes para esos días. Una sola etiqueta, sin lógica extra. D2 mantiene "Sesión en curso".
11. **`h1` "Hoy" oculto visualmente** (`visually-hidden`, §6.1): la pantalla se ve como el diseño y conserva su título para lectores de pantalla y axe.

## 9. Checklist de la constitución

- [x] **P-1:** no se sugiere ningún ejercicio nuevo; todo sale del plan validado (RN-PLN-07).
- [x] **P-2:** sin cambios de esquema; descartar sigue pidiendo confirmación y no borra nada (RN-TRN-15), y el texto ya no dice lo contrario.
- [x] **P-3:** reglas nuevas en §5; sin `[POR DEFINIR]`.
- [x] **P-4:** "Hoy" sigue en `app/pages`; `training` usa `plan` solo por su API (RN-TRN-20).
- [x] **P-5:** RN-PLN-27, RN-TRN-20 y RN-TRN-21 son funciones puras del dominio.
- [x] **P-6:** ≥ 44 px, axe y contraste (AC-27); bundle (AC-28).
- [x] **P-7:** "Hoy subes", ✓ de la tira, dolor y "Cambiar" no se construyen hasta que tengan datos.
- [x] **P-8:** sin entradas externas nuevas.
