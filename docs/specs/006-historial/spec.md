# Spec: Historial de sesiones

**ID:** 006 · **Estado:** Aprobada (19-nov-2026) · **Fecha:** 19-nov-2026
**Requerimientos cubiertos:** RF-32, RNF-01, RNF-05 · **Fase:** 3 (spec §13), segunda parte
**Fuente de diseño:** sin tablero propio; reutiliza las piezas de "Hoy" (`docs/design-hoy.md`) y del Cierre (`docs/design-cierre.md`): cifras del resumen, chip "Espalda", filas de "Otra sesión de esta semana"
**ADRs aplicados:** 0002, 0005, 0009, 0010

## 1. Problema y objetivo

Las sesiones cerradas solo se ven como ✓ en la semana actual de "Hoy": no hay forma de revisar qué se hizo la semana pasada, con qué pesos ni cómo quedó la espalda. El historial lista todas las sesiones guardadas, agrupadas por semana del programa, y muestra el detalle de cada una serie por serie, con el dolor lumbar y las notas.

## 2. Alcance

La fase 3 se reparte en 005 (Cierre), 005b (una sesión cerrada por día), esta (historial) y 007 (exportar e importar, módulo `data`).

- **Incluye:**
  - **Pestaña "Historial"** en la barra inferior, entre "Hoy" y "Progreso" (§8, decisión 1).
  - **Lista** en `/historial`: sesiones `completed` de la más reciente a la más antigua, agrupadas por semana del programa (decisión 2), cada una con su resumen (RN-TRN-25) y su chip de dolor (decisión 3).
  - **Detalle** en `/historial/:workoutId`: nombre, fecha, día del plan si es otro (decisión 6), resumen, dolor lumbar y señales de alarma, ejercicios con sus series hechas (los que no tienen ninguna, en gris con "Sin series", decisión 4) y notas. Solo lectura.
  - **Enlaces desde "Hoy"** al detalle: la tarjeta de un día hecho y las filas "hecha ✓" de "Otra sesión de esta semana" (decisión 5).
  - **`health.getPainForWorkouts`** (de "Futuro" a la API, pruebas primero, P-5) y la consulta del historial en `training`.
  - **Bloque de una semana del programa** en `plan`, para el encabezado de cada grupo (RN-PLN-28).
- **No incluye:**
  - Gráficas por ejercicio (RF-31) y del dolor (RF-33): fase 4, en Progreso. Progreso sigue vacía.
  - Filtros, búsqueda, comparar con la sesión anterior, récords personales, volumen semanal (RF-35).
  - Editar, reabrir o borrar una sesión (RN-TRN-07; v1.1).
  - Sesiones `discarded` o `in_progress` (RN-TRN-15, RN-TRN-26): la sesión en curso se continúa desde "Hoy".
  - Cardio: no se registra en v1.
  - Paginación o carga por partes: unas 200 sesiones al año se leen de una vez (P-7, §7).
  - Enlace al detalle desde "Ya entrenaste hoy (…)" y desde la vista previa de un día hecho (decisión 5).
  - Exportar e importar (spec 007).

## 3. Historias de usuario

- Como usuario en el gym, quiero ver qué pesos y repeticiones hice la última vez en una sesión completa, para saber dónde estoy.
- Como usuario, quiero repasar las semanas anteriores del programa y ver cuáles sesiones hice completas y cuáles a medias.
- Como usuario con espondilolistesis, quiero ver cómo quedó mi espalda en cada sesión y si marqué alguna señal de alarma, para contárselo a mi traumatólogo.
- Como usuario, quiero tocar un día hecho en "Hoy" y ver qué hice ese día.

## 4. Criterios de aceptación

Las fechas suponen un programa que empieza el lunes 16-nov-2026; hoy es el miércoles 25-nov (semana 2). La semana 1 tiene Full body A el lunes y el viernes y Full body B el miércoles; la semana 2 empieza con Full body B el lunes 23. Las semanas 1 a 4 son el "Bloque 1 · Full body". Full body A tiene 7 ejercicios y 10 series planificadas (Prensa 2, Press de banca 2, Dominadas 2 y 1 de cada uno de los otros cuatro).

**Datos de ejemplo** (todos `completed`):

| Sesión | `date` | `plannedFor` | Series hechas | Inicio → fin | Dolor |
|---|---|---|---|---|---|
| **L16**: Full body A | lun 16-nov | lun 16-nov | las 10 | 18:00 → 18:52 | 2, sin señales |
| **M18**: Full body A del viernes | mié 18-nov | vie 20-nov | 2 de Prensa, 1.ª de Press de banca, 2 de Dominadas (5 en 3 ejercicios) | 18:00 → 18:30 | 5, "Hormigueo o adormecimiento" |
| **L23**: Full body B | lun 23-nov | lun 23-nov | todas | 18:00 → 18:45 | 3, sin señales |

En L16, la 2.ª serie de Prensa fue de 100 kg × 9 con RIR 2 y Dominadas se hizo con la alternativa Jalón al pecho. En L23 hay una serie extra de Fondos en paralelas (3.ª, 0 kg × 8, RIR 1), además de las planificadas. Una de las Dominadas de M18 fue con asistencia de 20 kg × 8 y RIR 2. La nota de L16 es "Buena sesión".

### 4.1 Navegación

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-1 | Cualquier pantalla con barra inferior | Miro la barra | Tres pestañas en este orden: "Hoy", "Historial" y "Progreso", cada una con icono decorativo y ≥ 44 px |
| AC-2 | AC-1 | Toco "Historial" | Voy a `/historial`; la pestaña tiene `aria-current="page"`. `<title>` "Historial · Gym" |
| AC-3 | Estoy en `/historial/<id>` | Miro la barra | "Historial" sigue marcada (`aria-current="page"`); "Hoy" no |

### 4.2 Lista

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-4 | Ninguna sesión `completed` | Abro "Historial" | `h1` "Historial" y "Aún no hay sesiones guardadas. Cuando termines una, aparecerá aquí." |
| AC-5 | Los datos de ejemplo | Abro "Historial" | Dos grupos, del más reciente al más antiguo: "Semana 2" con L23 y "Semana 1" con M18 y L16, en ese orden (RN-TRN-26) |
| AC-6 | AC-5 | Miro el encabezado de cada grupo | `h2` "Semana 2" y debajo "Bloque 1 · Full body · 23-29 nov"; `h2` "Semana 1" y "Bloque 1 · Full body · 16-22 nov" (RN-PLN-28) |
| AC-7 | AC-5 | Miro la fila de L16 | "Lun 16 · Full body A", debajo "52 min · 10 series · 7 ejercicios" y el chip "Espalda 2/10" en el color normal |
| AC-8 | AC-5 | Miro la fila de M18 | "Mié 18 · Full body A del viernes", debajo "30 min · 5 series · 3 de 7 ejercicios" y el chip "Espalda 5/10" en ámbar, más el chip "Señal de alarma" en ámbar |
| AC-9 | AC-5 | Toco la fila de L16 | Voy a `/historial/<id de L16>`. Toda la fila es un enlace de ≥ 44 px cuyo nombre accesible contiene todo su texto visible |
| AC-10 | Una sesión en curso y otra descartada, además de los datos de ejemplo | Abro "Historial" | Solo salen las tres `completed` |
| AC-11 | Dos sesiones `completed` con el mismo `date` (las del 18-nov en el iPhone, anteriores a RN-TRN-27) | Abro "Historial" | Salen las dos, la de `startedAt` más reciente primero |
| AC-12 | Una sesión `completed` fuera del programa (`programWeek` nulo) | Abro "Historial" | Va en su propio grupo con `h2` "Fuera del programa" y debajo el rango de su semana ("9-15 nov") |
| AC-13 | "Historial" abierto | Cierro una sesión en otra pestaña | La lista la muestra sin recargar (vista en vivo) |

### 4.3 Detalle

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-14 | L16 | Abro su detalle | `h1` "Full body A"; debajo "Lunes 16 de noviembre · Semana 1". `<title>` "Full body A · Historial · Gym". Una flecha "Volver" arriba a la izquierda |
| AC-15 | M18 | Abro su detalle | Debajo del `h1`: "Miércoles 18 de noviembre · Semana 1 · sesión del viernes" (decisión 6) |
| AC-16 | L16 | Miro el resumen | Las tres cifras del Cierre: "52 min", "10 series" y "7 ejercicios" (`<dl>`, RN-TRN-25). Con M18: "30 min", "5 series" y "3 de 7 ejercicios" |
| AC-17 | L16 | Miro "Dolor lumbar" | `h2` "Dolor lumbar" y "2/10"; sin señales de alarma, no hay más texto |
| AC-18 | M18 | Miro "Dolor lumbar" | "5/10" en ámbar y "Señales de alarma: Hormigueo o adormecimiento". No se muestran los consejos de la banda ni de las señales (§6.2) |
| AC-19 | L16 | Miro "Ejercicios" | `h2` "Ejercicios" y los 7 en el orden de la sesión, cada uno con su nombre en `h3` y sus series hechas en una lista ordenada por `setNumber` |
| AC-20 | AC-19 | Miro Prensa | "1 · 100 × 10 · RIR 2" y "2 · 100 × 9 · RIR 2" (kilos con coma decimal, como la sesión) |
| AC-21 | AC-19 | Miro Dominadas | El `h3` dice "Jalón al pecho" y debajo "En lugar de Dominadas" (el ejercicio elegido, RN-TRN-13) |
| AC-22 | L23 | Miro Fondos en paralelas | La 3.ª serie lleva la marca "Extra" |
| AC-23 | M18 | Miro Dominadas | La serie con asistencia dice "Asist. 20 × 8 · RIR 2" |
| AC-24 | Un ejercicio medido por tiempo (Plancha) con una serie de 40 s y RIR 2 | Miro su detalle | "1 · 40 s · RIR 2"; uno medido por repeticiones (`metric: 'reps'`) muestra solo las reps: "1 · 12 · RIR 1" |
| AC-25 | M18 | Miro los ejercicios | Los 4 sin series hechas salen en su orden, con su nombre en gris y "Sin series" (decisión 4). Las series no hechas de Press de banca no salen (RN-TRN-08) |
| AC-26 | L16 | Miro "Notas" | `h2` "Notas" y "Buena sesión" con sus saltos de línea. Sin notas, la sección no sale |
| AC-27 | Llegué desde la lista | Toco "Volver" | Vuelvo a `/historial` |
| AC-28 | Llegué desde "Hoy" (AC-33, AC-34) | Toco "Volver" | Vuelvo a "Hoy" |
| AC-29 | Abro `/historial/<id>` escribiendo la URL | Toco "Volver" | Voy a `/historial` |
| AC-30 | Un id inexistente, `discarded` o `in_progress` | Abro `/historial/<id>` | "Esta sesión no está en el historial." y un enlace "Ver el historial" |
| AC-31 | El detalle no tiene controles de edición | Miro la pantalla | No hay campos, casillas ni botones para cambiar series, dolor o notas (RN-TRN-07) |
| AC-32 | Una sesión `completed` sin entrada de dolor (dato roto: RN-TRN-06 lo impide) | Abro su detalle y la lista | La sección "Dolor lumbar" dice "Sin registro"; la fila de la lista no tiene chip |

### 4.4 Enlaces desde "Hoy"

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-33 | Miércoles 18-nov con Full body B ya guardada ese día (spec 005 AC-34) | Miro la tarjeta "Tu sesión de hoy" | Además de "Hecha ✓" y el resumen, un enlace "Ver detalle" (≥ 44 px) que lleva a `/historial/<id>` |
| AC-34 | L16 guardada; es miércoles 18-nov | Miro "Otra sesión de esta semana" | La fila "Lun 16 · Full body A · hecha ✓" sigue gris, pero ahora es un enlace a `/historial/<id de L16>` (reemplaza "no pulsable" de la spec 005 AC-32) |
| AC-35 | Dos `completed` con el mismo `plannedFor` (dato roto, spec 005 §7) | Toco la fila o "Ver detalle" | Lleva al más reciente, el mismo cuyo resumen muestra la tarjeta |

### 4.5 Transversales

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-36 | La lista con los datos de ejemplo y el detalle de L16 y de M18 | Corre axe en Playwright | Sin violaciones WCAG 2.2 A/AA; cada control ≥ 44 × 44 px; nada desborda a 320 px |
| AC-37 | Sin conexión, con la app ya abierta una vez | Abro la lista y un detalle | Todo funciona igual (RNF-01) |
| AC-38 | El build de producción | Corre `size-limit` | El JS inicial sigue < 200 KB gzip (QS-10) |
| AC-39 | Sin cambios de esquema | Abro la versión nueva con una base v3 | La base sigue en v3; no hay migración (P-2) |

## 5. Reglas de negocio aplicables

Del contrato [`modules/training.md`](../../modules/training.md) v1.23: RN-TRN-07, 08, 13, 15, 25 y 26. Del contrato [`modules/health.md`](../../modules/health.md) v1.8: RN-HLT-09, 14 y 16. Del contrato [`modules/plan.md`](../../modules/plan.md) v1.16: RN-PLN-01 y 03.

Reglas nuevas, ya en los contratos (`training` v1.24, `health` v1.9, `plan` v1.17):

| ID | Regla |
|---|---|
| RN-TRN-28 | **Lista del historial.** Para cada workout de `listWorkouts` (RN-TRN-26), con su orden, la consulta devuelve el workout y su resumen (RN-TRN-25, calculado con sus series). Un workout `completed` siempre tiene `finishedAt`, así que el resumen no depende de `now`. Una consulta para toda la lista, no una por workout. |
| RN-TRN-29 | **Detalle del historial** (función pura del dominio sobre una `WorkoutView`): un elemento por ítem del workout, en el orden de `items`, con el ejercicio elegido (`exerciseId`), el principal (`options[0]`) si es otro, y sus series **hechas** de ese ejercicio ordenadas por `setNumber` (también las extra). Un ítem sin series hechas sale con la lista vacía. Las series no hechas, o hechas de un ejercicio que no es el elegido, no salen (RN-TRN-08). Solo para workouts `completed`; para otro estado, `null`. |
| RN-HLT-20 | `getPainForWorkouts(workoutIds)` devuelve un mapa con la entrada de cada id que tiene una (RN-HLT-09: como mucho una por workout); los ids sin entrada no están; ids repetidos cuentan una vez; con la lista vacía, mapa vacío sin leer la base. Rechaza si falla la base (RN-HLT-16). Su hook `usePainForWorkouts(health, ids)` sigue RN-HLT-19: `undefined` mientras carga o con el resultado de otra lista de ids, y se actualiza con `painEntries`. |
| RN-PLN-28 | **Bloque de una semana del programa:** el bloque cuya `startWeek ≤ week ≤ endWeek`, o ninguno si `week` está fuera del programa. Depende solo de `week`, no de `startDate`: si se cambia la fecha de inicio (RF-03), las semanas ya entrenadas conservan su bloque, porque `Workout.programWeek` es parte de la instantánea. |

Cambios de documentos hechos al aprobar (19-nov):

| Documento | Cambio |
|---|---|
| `spec.md` §7.1 y §7.2 (v0.12) | Barra inferior con Hoy, Historial y Progreso (v1.0 añade Plan y Ajustes). La fila "Historial (v1.0)" pasa a "Historial", con lista agrupada por semana y detalle en `/historial/:workoutId` (spec 006); "Hoy" enlaza los días hechos al detalle. Las rutas viven en §7.2; `architecture.md` no las lista y no cambia |
| `modules/training.md` (v1.24) | RN-TRN-28 y 29; la API la fija el plan (§8, decisión 9) |
| `modules/health.md` (v1.9) | `getPainForWorkouts` sale de "Futuro" y entra en `HealthApi`, con `usePainForWorkouts` (RN-HLT-20) |
| `modules/plan.md` (v1.17) | RN-PLN-28; la función o consulta la fija el plan (§8, decisión 9) |
| Spec 005 | AC-32 ("gris y no pulsable") queda reemplazado por AC-34 de esta spec en lo de "no pulsable" (la 005 no se edita) |

## 6. UX

### 6.1 Lista (`/historial`)
- Con barra inferior, como "Hoy". `h1` "Historial".
- **Grupos por semana:** una sección por semana ISO del `date` (lunes a domingo, la misma semana que `plannedFor`, RN-TRN-14), de la más reciente a la más antigua. `h2` "Semana N" con `N = programWeek`; debajo, en `--text-muted`, el nombre del bloque (RN-PLN-28) y el rango "16-22 nov" (o "30 nov-6 dic" si cruza de mes). Sin `programWeek`: `h2` "Fuera del programa" y solo el rango.
- **Filas:** como las de "Otra sesión de esta semana", pero pulsables: primera línea "Lun 16 · Full body A" (`formatShortDay`, y "Full body A del viernes" si `plannedFor ≠ date`, con `formatWeekday`); segunda línea, en `--text-muted`, "52 min · 10 series · 7 ejercicios" o "3 de 7 ejercicios"; a la derecha, el chip "Espalda N/10" (ámbar desde 4, como en "Hoy") y, si hay señales de alarma, un chip "Señal de alarma" en ámbar. Un chevron decorativo indica que la fila abre algo.
- Lista de cada grupo con `<ul>`; cada fila es un `<a>` de ≥ 44 px.
- **Vacío:** el texto de AC-4, sin enlaces.

### 6.2 Detalle (`/historial/:workoutId`)
- Con barra inferior y "Historial" marcada. Encabezado: flecha "Volver" (enlace de 44 px con `aria-label="Volver"`, §8 decisión 10), `h1` con el nombre, y debajo la fecha larga (`formatLongDateTitle`), "Semana N" y, si `plannedFor ≠ date`, "sesión del viernes".
- **Resumen:** las mismas tres cifras del Cierre (`<dl>`), sin recalcular en vivo.
- **Dolor lumbar:** `h2`, el nivel "N/10" grande (ámbar desde 4) y, si las hay, "Señales de alarma: …" con las etiquetas del Cierre separadas por coma, en el orden de `RED_FLAGS`. **Sin los mensajes de banda ni de las señales:** son consejos para la próxima sesión y en "Hoy" ya se muestran con la última entrada; repetirlos en sesiones viejas confunde (§8, decisión 7).
- **Ejercicios:** `h2` "Ejercicios"; por ítem, `h3` con el nombre del ejercicio elegido, "En lugar de <principal>" si es una alternativa, y una `<ol>` con una línea por serie hecha: "N · <valor> · RIR R", donde el valor es el de la celda "anterior" de la sesión (`formatPrevious`: "100 × 10", "Asist. 20 × 8", "12", "40 s"); las extra llevan "Extra" al final. Sin series hechas: el `h3` en `--text-muted` y "Sin series".
- **Notas:** `h2` "Notas" y el texto con `white-space: pre-line`; sin notas, nada.
- **Volver:** al lugar de origen que pasa la navegación (`state`, como el Cierre en la spec 005); sin él, a `/historial`.
- **No existe o no está cerrada:** el texto de AC-30 con el enlace "Ver el historial".

### 6.3 "Hoy"
- **Tarjeta de un día hecho:** enlace secundario "Ver detalle" debajo del resumen (texto con subrayado o borde, ≥ 44 px), al workout cuyo resumen muestra la tarjeta.
- **"Otra sesión de esta semana":** las filas hechas mantienen su aspecto gris y su "✓ hecha", y pasan a ser enlaces al detalle. Las pendientes no cambian.

### 6.4 Estados generales
- **Cargando:** como "Hoy" (spec 001); la lista no muestra el vacío mientras carga.
- **Errores de lectura:** al *error boundary* (ADR-0010), como los demás hooks.
- **Textos** en español; objetivos ≥ 44 px; contraste AA con los tokens existentes (ADR-0005); sin colores nuevos.

## 7. Casos límite

- **Sesión que cruza la medianoche:** va en el grupo y con la fecha de su `date` (RN-TRN-09); los minutos usan `finishedAt` (RN-TRN-25), así que en el historial siempre se muestran, a diferencia del Cierre de otro día (spec 005 AC-9).
- **Reloj hacia atrás:** minutos = 0 (RN-TRN-25).
- **Fecha de inicio cambiada (RF-03):** el número de semana y el bloque salen de `programWeek`, guardado al iniciar (RN-PLN-28); dos semanas ISO distintas pueden tener el mismo número y salen como dos grupos, cada uno con su rango de fechas.
- **Semana con sesiones de dos `programWeek`** (solo si se cambió la fecha de inicio a mitad de semana): el encabezado usa el `programWeek` de la sesión más reciente del grupo.
- **Ejercicio borrado del catálogo:** `useWorkoutView` lanza si `plan` no devuelve uno (RN-TRN-17), así que el detalle muestra el error genérico (ADR-0010); no hay texto propio (§8, decisión 10). No debería pasar: el catálogo no se borra en v1.
- **Muchas sesiones:** se leen todas. Con 3-4 por semana son ~200 al año y la consulta usa el índice `date`; si en la verificación pasa de 100 ms, el plan propone una carga por partes en otra spec.
- **Posición al volver a la lista:** no se conserva el desplazamiento (no se pide; el navegador lo hace con "atrás", no con la flecha).
- **Sesión cerrada en otra pestaña con el detalle abierto:** no aplica, solo se abren sesiones `completed`, que no cambian (RN-TRN-07).

## 8. Preguntas abiertas

Ninguna que bloquee. Decisiones cerradas el 19-nov-2026 (conversación con el dueño del producto):

1. **Entrada:** pestaña "Historial" entre "Hoy" y "Progreso".
2. **Agrupación:** por semana del programa, con el bloque y el rango de fechas.
3. **Dolor:** chip en la lista, nivel y señales en el detalle; `health.getPainForWorkouts` entra en la API (RN-HLT-20).
4. **Ejercicios sin series hechas:** se muestran en gris con "Sin series".
5. **"Hoy":** la tarjeta de un día hecho y las filas "hecha ✓" enlazan al detalle; "Ya entrenaste hoy (…)" y la vista previa no.
6. **Día del plan distinto:** "Full body A del viernes" en la lista y "sesión del viernes" en el detalle.

Propuestas al escribir la spec, aprobadas con ella (19-nov):

7. **Sin consejos en el detalle:** se muestra el nivel y las señales marcadas, pero no los mensajes de banda ni de las señales (§6.2). Reemplaza el "mensaje" de la propuesta inicial.
8. **Bloque por número de semana** (RN-PLN-28) y no por fecha: el historial no cambia si se ajusta la fecha de inicio.
9. **API:** los nombres (`listWorkoutHistory`/`useWorkoutHistory` en `training`, `historyDetail` en el dominio, la consulta del bloque en `plan`) los fija el plan técnico; esta spec fija las reglas.

Decisiones durante la implementación (19-nov, antes de T14):

10. **Detalle:** sin "Ejercicio desconocido", porque RN-TRN-17 hace lanzar la consulta si falta un ejercicio (el contrato manda sobre esta spec, `docs/README.md`); una sesión sin `programWeek` dice "· Fuera del programa" en lugar de "· Semana N" (AC-14), como el grupo de la lista; el `<title>` es "Historial · Gym" mientras carga y cuando la sesión no está en el historial; "Volver" es un enlace con `aria-label`, porque navega (§6.2 decía botón).
11. **La serie extra de los ejemplos pasa de L16 a L23** (Fondos en paralelas, la 3.ª): con ella en L16, AC-7 y AC-16 habrían sido "11 series", porque las extra hechas cuentan (RN-TRN-25). Va en Fondos porque es el ítem de Full body B con margen (`[2, 3]`, RN-TRN-10); Press inclinado ya empieza con su máximo en la semana 2.

## 9. Checklist de la constitución

- [x] **P-1:** el historial solo muestra lo registrado; no sugiere ejercicios ni cargas. Los consejos de salud siguen saliendo solo en "Hoy" y el Cierre.
- [x] **P-2:** solo lectura; sin cambios de esquema ni migración (AC-39); nada se borra.
- [x] **P-3:** reglas nuevas y cambios de contrato en §5; sin `[POR DEFINIR]` ni `[PROPUESTO]`.
- [x] **P-4:** `app` compone `training`, `health` y `plan`; cada módulo lee sus tablas; `health` no conoce los workouts más que por id.
- [x] **P-5:** RN-HLT-20 con pruebas primero; RN-TRN-28, 29 y RN-PLN-28 en el dominio, puros.
- [x] **P-6:** ≥ 44 px, axe y 320 px (AC-36); bundle (AC-38).
- [x] **P-7:** sin paginación, filtros ni gráficas; una consulta para la lista.
- [x] **P-8:** sin entradas externas nuevas; textos en español.
