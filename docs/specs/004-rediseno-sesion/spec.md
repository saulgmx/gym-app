# Spec: Rediseño de la sesión activa

**ID:** 004 · **Estado:** Aprobada (18-nov-2026) · **Fecha:** 18-nov-2026
**Requerimientos cubiertos:** RF-11, RF-14, RF-17, RF-19, RNF-02, RNF-05 · **Fase:** entre la 2 y la 3 (no está en spec §13; ver §2)
**Fuente de diseño:** [`docs/design-sesion-activa.md`](../../design-sesion-activa.md), tablero "Sesión activa A3" (`SesionA3.dc.html`) del lienzo de diseño
**ADRs aplicados:** 0005, 0006, 0010

## 1. Problema y objetivo

La sesión activa (spec 002) funciona, pero no tiene salida: para volver a "Hoy" sin descartar hay que escribir la URL. Además, la lista de ejercicios empuja la tabla hacia abajo y la información del ejercicio ocupa espacio que necesitan las series. El rediseño pone en una fila la salida, el menú de ejercicios y el tiempo; añade un aviso de salida que permite dejar la sesión para después; hace compacta la tarjeta del ejercicio; y da pistas en la tabla. Solo usa datos y reglas que ya existen.

## 2. Alcance

Feature de interfaz, sin cambios en la base de datos ni reglas de negocio nuevas. Va antes de la fase 3, cuya spec pasa a ser la 005.

- **Incluye:**
  - **Encabezado en una fila:** flecha de salir, botón "Ejercicio N de M ▾" y tiempo transcurrido.
  - **Aviso de salida** con "Seguir entrenando", "Salir y continuar después" y "Descartar sesión", y la confirmación de descarte que ya existe.
  - **Menú flotante de ejercicios**, que reemplaza a "Ver ejercicios" (lista en línea) y deja de contener "Descartar sesión".
  - **Tarjeta del ejercicio compacta o completa** con "Ver detalles" / "Ocultar detalles".
  - **Tabla de series:** encabezado "Seg" en ejercicios por tiempo, pistas de reps y RIR en los campos vacíos y serie actual resaltada.
  - **Línea del pie:** "Siguiente: …" o "Último ejercicio de hoy".
  - Contrato `training` §4 (`SessionHeader`, `SetTable`) y spec §7.2 actualizados al aprobar (§5).
  - Pruebas E2E de la sesión que usan "Ver ejercicios" adaptadas al menú nuevo.
- **Ya implementado, no cambia** (spec 002): "Con asistencia", el error por fila (`aria-live="polite"`, borde y texto en `--warn`), "Añadir serie" / "Quitar serie" con "extra" y "Máximo N series", "Cambiar a …" deshabilitado con su ayuda, la columna "Anterior" y "Anterior" / "Siguiente" en el pie (AC-25 de spec 002).
- **No incluye:**
  - **"Terminar y guardar lo hecho"**, "Terminar sesión", el Cierre y `PainGate` (spec 005, fase 3). No se muestran, ni deshabilitados.
  - **Descanso**, "+30 s" y Wake Lock (fase 4, RF-15 y RF-18).
  - **Sugerencia de peso** y "Última vez" en la tarjeta (fase 4, RF-30).
  - El icono y `role="alert"` del error por fila que dibuja el tablero.
  - Restilizar el interruptor "Con asistencia" y el check: siguen siendo los controles nativos.
  - "No hacer hoy", "Sustituir ejercicio" libre, fila "Opcional" y reordenar ejercicios.

## 3. Historias de usuario

- Como usuario a mitad de sesión, quiero salir a "Hoy" sin perder nada y retomar después, sin tener que descartar.
- Como usuario, quiero ver qué ejercicios llevo hechos y saltar a cualquiera sin que la lista me tape las series.
- Como usuario, quiero que la tarjeta del ejercicio ocupe poco y mostrar el consejo y la alternativa solo cuando los busco.
- Como usuario, quiero ver en los campos vacíos el rango que toca y saber qué serie sigue, para registrar más rápido.
- Como usuario, quiero saber cuál es el siguiente ejercicio antes de tocar "Siguiente".

## 4. Criterios de aceptación

Las fechas suponen un programa que empieza el lunes 16-nov-2026. En la semana 1 (factor 0.7, RIR 3-4), Full body A tiene 7 ejercicios: Prensa de piernas (2 × 8-12), Press de banca con barra (2 × 6-10, alternativa: Press de banca con mancuernas), Dominadas (2 × 6-10, alternativa), Curl femoral (1 × 10-12), Elevaciones laterales (1 × 12-15), Curl con barra Z (1 × 10-12) y Dead bug (1 × 8-10, `metric: 'reps'`). La Plancha (`metric: 'time'`, 30-45) está en las plantillas Pierna A y Lower.

**Ejemplo:** sesión de Full body A iniciada el lunes 16-nov a las 18:00, con las 2 series de Prensa y la 1.ª de Press de banca hechas.

### 4.1 Encabezado

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-1 | El ejemplo, a las 18:18:42, en `/sesion/<id>/2` | Abro la página | Una fila con el botón "Salir de la sesión" (flecha), el botón "Ejercicio 2 de 7" con `aria-expanded="false"` y el tiempo "18:42". El nombre de la sesión no está en el encabezado. El `h1` sigue siendo el nombre del ejercicio |
| AC-2 | AC-1 | Pasa un segundo | El tiempo pasa a "18:43"; con más de una hora, "1:05:12" (mismo formato que "Hoy", spec 003 AC-17). Un lector de pantalla lo lee como "Tiempo de sesión 18:43" y no se anuncia cada segundo |
| AC-3 | Una sesión iniciada el lunes 16-nov | Abro la sesión el martes 17-nov | El encabezado no muestra el tiempo (como "Hoy", spec 003 AC-19) |

### 4.2 Menú de ejercicios

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-4 | AC-1 | Toco "Ejercicio 2 de 7" | Se abre un diálogo modal sobre fondo oscurecido, con nombre "Full body A" y el título visible "Full body A". La tarjeta y la tabla no se mueven. El botón queda con `aria-expanded="true"` |
| AC-5 | AC-4 | Miro el menú | El resumen "1 de 7 hechos · 1 en curso" y los 7 ejercicios en orden. Prensa: ✓ y "2 de 2 series". Press de banca con barra: anillo de acento y "En curso · serie 2". Los demás: su número y "series × rango" ("2 × 6-10", "1 × 10-12"). En una plantilla con Plancha, su fila pendiente dice "2 × 30-45 s". Un pendiente con alguna serie hecha dice "1 de 2 series", sin ✓ (RN-TRN-21) |
| AC-6 | AC-4, viendo el ejercicio 4 (Curl femoral) | Miro el menú | Curl femoral lleva `aria-current="step"` y su resaltado; Press de banca sigue siendo el "en curso". Las dos marcas se distinguen |
| AC-7 | AC-4 | Toco "Dominadas" | El menú se cierra y voy a `/sesion/<id>/3`, con el foco en el nombre del ejercicio (spec 002) |
| AC-8 | AC-4 | Toco el fondo o pulso Escape | El menú se cierra sin navegar y el foco vuelve a "Ejercicio 2 de 7" |
| AC-9 | Todas las series de la sesión hechas | Abro el menú | "7 de 7 hechos", sin "· 1 en curso"; todas las filas con ✓ |
| AC-10 | Press de banca cambiado a su alternativa (RN-TRN-13) | Abro el menú | La fila 2 dice "Press de banca con mancuernas" |
| AC-11 | La página de la sesión | Busco "Ver ejercicios" o "Descartar sesión" fuera del aviso de salida | No existen: el descarte solo está en el aviso de salida (§4.3) |

### 4.3 Salir de la sesión

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-12 | AC-1 | Toco la flecha | Aviso modal anclado abajo: título "¿Salir de la sesión?", texto "Llevas 1 de 7 ejercicios y 18:42 de entrenamiento." y tres opciones, en este orden: "Seguir entrenando" (principal), "Salir y continuar después" con el subtítulo "Hoy mostrará 'Continuar sesión'" y "Descartar sesión" (`--warn`) con el subtítulo "Las series no contarán en tu historial". No aparece "Terminar y guardar lo hecho" |
| AC-13 | AC-12 | Toco "Seguir entrenando", el fondo o pulso Escape | El aviso se cierra, sigo en el ejercicio 2 y el foco vuelve a la flecha |
| AC-14 | AC-12 | Toco "Salir y continuar después" | Voy a "Hoy", que muestra la tarjeta "Sesión en curso" (spec 003 AC-16). El workout sigue `in_progress` y sus series no cambian |
| AC-15 | AC-12 | Toco "Descartar sesión" | Se abre la confirmación de descarte con los textos de spec 003: "¿Descartar la sesión?", "Las 3 series que registraste en 2 ejercicios no contarán en tu historial. No se puede deshacer.", "Sí, descartar" y "Cancelar" (también los textos con 1 y 0 series, spec 003 AC-24) |
| AC-16 | AC-15 | Toco "Cancelar", el fondo o pulso Escape | Vuelvo al aviso de salida (no a la pantalla); nada cambia |
| AC-17 | AC-15 | Toco "Sí, descartar" | El workout queda `discarded` y conserva sus series (RN-TRN-15); vuelvo a "Hoy" en el estado D con `replace` |
| AC-18 | Una sesión de otro día (AC-3) | Toco la flecha | El texto es "Llevas 1 de 7 ejercicios." sin el tiempo |
| AC-19 | Un campo con un valor escrito y sin confirmar | Toco la flecha | El campo se confirma al perder el foco, como cualquier cambio (spec 002 §6); al salir y volver, el valor está guardado |

### 4.4 Tarjeta del ejercicio

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-20 | `/sesion/<id>/2` recién abierta | Miro la tarjeta | Compacta: el nombre ("Press de banca con barra", `h1`), la línea "2 × 6-10 · RIR 3-4" y el botón "Ver detalles" con `aria-expanded="false"`. Ni la nota ni "Cambiar a …" están visibles |
| AC-21 | AC-20 | Toco "Ver detalles" | Completa: chips "2 series", "6-10 reps" y "RIR 3-4"; la nota "Costillas abajo, sin arco" como texto secundario sin etiqueta; "Cambiar a Press de banca con mancuernas". El botón dice "Ocultar detalles" con `aria-expanded="true"` |
| AC-22 | La tarjeta completa en el ejercicio 2 | Voy al ejercicio 3 (por "Siguiente" o por el menú) | La tarjeta del ejercicio 3 también está completa. Si la oculto y voy a otro, sigue compacta. Al recargar la página vuelve a compacta (no se guarda) |
| AC-23 | Plancha, en la tarjeta compacta y en la completa | La miro | "2 × 30-45 s · RIR 3-4"; chips "2 series", "30-45 s" y "RIR 3-4" |
| AC-24 | Un RIR objetivo con mínimo y máximo iguales (deload, RIR 4) | Miro la tarjeta | "RIR 4", no "RIR 4-4", en la línea y en el chip (como "Hoy", spec 003 §6.2) |
| AC-25 | La tarjeta completa del ejercicio 2 con una serie hecha | La miro | "Cambiar a …" deshabilitado con "Para cambiar de ejercicio, desmarca las series hechas" (spec 002 AC-24). En un ejercicio sin alternativa no hay botón de cambio |

### 4.5 Tabla de series

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-26 | Una serie de Plancha | Miro la tabla | La columna dice "Seg" (antes "s"); el campo sigue llamándose "Serie 1, segundos" |
| AC-27 | Las series vacías de Press de banca | Miro los campos | El de reps muestra la pista "6-10" y el de RIR "3-4" (o "4" con RIR 4-4), como `placeholder`; el de kg no tiene pista. Al escribir, la pista desaparece; no se guarda nada |
| AC-28 | El ejemplo, en el ejercicio 2 | Miro la tabla | La serie 2 (la primera sin hacer) tiene el número y el borde de sus campos en color de acento; la serie 1 (hecha) mantiene su estilo de hecha |
| AC-29 | AC-28 | Marco la serie 2 | El resaltado desaparece (no quedan series sin hacer). Si añado una serie extra, la 3 pasa a ser la resaltada |
| AC-30 | El ejercicio 4 visto mientras el "en curso" es el 2 | Miro la tabla | Se resalta la serie 1 del ejercicio 4: la serie actual es la del ejercicio que se ve |

### 4.6 Pie

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-31 | El ejercicio 1 | Miro el pie | "Siguiente: Press de banca con barra · 2 × 6-10" sobre los botones; solo "Siguiente" (sin "Anterior", spec 002 AC-25) |
| AC-32 | El ejercicio 2 | Miro el pie | "Siguiente: Dominadas · 2 × 6-10"; "Anterior" (secundario) y "Siguiente" (principal) |
| AC-33 | El ejercicio 7 (Dead bug) | Miro el pie | "Último ejercicio de hoy"; solo "Anterior". No hay "Terminar sesión" |
| AC-34 | El ejercicio siguiente es Plancha, o fue cambiado a su alternativa | Miro el pie | "Siguiente: Plancha · 2 × 30-45 s", o el nombre del ejercicio elegido |

### 4.7 Transversales

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-35 | La sesión con la tarjeta compacta y completa, el menú abierto, el aviso de salida y la confirmación de descarte | Corre axe en Playwright | Sin violaciones WCAG 2.2 A/AA; cada control mide ≥ 44 × 44 px; nada desborda a 320 px de ancho. El nombre accesible de "Ejercicio N de M" contiene su texto visible (WCAG 2.5.3) |
| AC-36 | El build de producción | Marco una serie (traza de Playwright) | El cambio visible sigue llegando en < 100 ms (QS-05): el reloj de 1 s no vuelve a renderizar la tabla (P-6) |
| AC-37 | El build de producción | Corre `size-limit` | El JS inicial sigue < 200 KB gzip (QS-10) |
| AC-38 | Sin conexión, con la app ya abierta una vez | Uso el menú, la tarjeta y salgo con "Salir y continuar después" | Todo funciona igual (RNF-01) |

## 5. Reglas de negocio aplicables

Del contrato [`modules/training.md`](../../modules/training.md) v1.17: RN-TRN-03 (cada cambio se guarda), RN-TRN-13 (alternativa), RN-TRN-15 (descartar conserva las series) y RN-TRN-21 (ejercicio hecho, en curso y serie actual). Del contrato [`modules/plan.md`](../../modules/plan.md): RN-PLN-04 y 05 (series planificadas).

No hay reglas nuevas. Cambios de documentos que se hacen al aprobar esta spec:

| Documento | Cambio |
|---|---|
| `modules/training.md` §4, `SessionHeader` (v1.18) | Una fila con flecha, "Ejercicio N de M ▾" y tiempo; menú flotante con resumen, estado y subtítulo por fila; sin "Descartar sesión". `onDiscard` pasa a ser `onExit`; el tiempo lo pone `app`, porque usa `Clock`. La forma exacta de las props la fija el plan técnico |
| `modules/training.md` §4, `SetTable` (v1.18) | "Seg" en lugar de "s"; pistas de reps y RIR; serie actual resaltada |
| `spec.md` §7.2 (v0.8) | Fila "Sesión activa": encabezado con salida, menú y tiempo; tarjeta compacta o completa; tabla de series; pie con "Siguiente: …". El temporizador, la sugerencia y "Terminar sesión" quedan como fases futuras |
| Spec 002 | AC-17 ("s" → "Seg"), AC-22 (la nota se ve en la tarjeta completa), AC-26 (menú flotante) y §6 (encabezado y descarte desde el aviso de salida) quedan reemplazados por esta spec |
| Spec 003 | AC-26 (descartar desde "Ver ejercicios") pasa a ser AC-15 de esta spec |

## 6. UX

### 6.1 Encabezado
- Una fila de 44 px de alto: flecha (botón de 44 × 44 con nombre "Salir de la sesión"), botón "Ejercicio N de M" con chevron decorativo (`aria-expanded`, `aria-haspopup="dialog"`, sin `aria-label`: su nombre es el texto visible) y tiempo.
- El tiempo usa `m:ss` o `h:mm:ss` desde `startedAt`, con "Tiempo de sesión" como texto oculto a la vista (`visually-hidden`). No es región viva. Es el mismo componente de "Hoy" (`Elapsed`): el único reloj de 1 s, que solo vuelve a renderizar su texto.
- En una sesión de otro día no se muestra el tiempo.

### 6.2 Menú de ejercicios
- `<dialog>` modal con `showModal()`, fondo `--backdrop`, anclado bajo el encabezado y con desplazamiento propio si no cabe. Su nombre es el de la sesión (`workout.name`), que es también su título visible (`h2`).
- Resumen: "N de M hechos" y, si hay ítem en curso, "· 1 en curso" (RN-TRN-21).
- Una fila por ítem, en orden, como botón de ≥ 44 px: marca de estado (decorativa, `aria-hidden`), nombre del ejercicio elegido y subtítulo. Pendiente: "series planificadas × rango" ("× s" en tiempo), o "N de M series" si ya tiene alguna hecha; en curso: "En curso · serie N"; hecho: "N de N series", contando las extra. El nombre accesible de la fila incluye el estado con un texto oculto, sin `aria-label` ("Prensa de piernas, hecho, 2 de 2 series"; "Dominadas, pendiente, 2 × 6-10"); en curso, el subtítulo ya lo dice. Al abrir, el foco va a la fila del ejercicio que se ve, y el resumen es la descripción del diálogo.
- El ejercicio que se ve lleva `aria-current="step"` y un resaltado de fondo, distinto del anillo del "en curso".
- Elegir una fila cierra el menú y navega; el foco va al `h1` del ejercicio nuevo. Cerrar sin elegir (fondo, Escape) devuelve el foco al botón.

### 6.3 Aviso de salida y descarte
- `<dialog>` modal anclado abajo con la zona segura, como `ConfirmDialog` (spec 003).
- Texto: "Llevas N de M ejercicios y m:ss de entrenamiento." (N = ítems hechos, RN-TRN-21); sin tiempo en una sesión de otro día. "ejercicio" concuerda con el total, como en "Hoy" ("Llevas 0 de 1 ejercicio.").
- Opciones como botones de ≥ 56 px: "Seguir entrenando" (relleno de acento), "Salir y continuar después" (superficie, con subtítulo) y "Descartar sesión" (borde y texto `--warn`, con subtítulo). El foco inicial va a "Seguir entrenando".
- "Descartar sesión" cierra el aviso y abre `ConfirmDialog` con `discardDialogText`, `destructive`. "Cancelar", el fondo y Escape vuelven al aviso de salida. Si `discardWorkout` falla, el mensaje de ADR-0010 aparece en la página.
- Fondo y Escape en el aviso de salida = "Seguir entrenando".

### 6.4 Tarjeta del ejercicio
- Superficie con radio `--radius-card`. El `h1` con el nombre; más pequeño en compacta que en completa.
- **Compacta:** la línea "series × rango · RIR" ("2 × 6-10 · RIR 3-4"; "× 30-45 s" en tiempo; "RIR 4" si mínimo = máximo).
- **Completa:** chips de series ("2 series"; "1 serie"), rango ("6-10 reps" o "30-45 s") y RIR; `cue` del ejercicio y nota de la plantilla, como texto secundario sin etiqueta; "Cambiar a <alternativa>" con su regla y su ayuda (spec 002 AC-23 y AC-24).
- Botón "Ver detalles" / "Ocultar detalles" de 44 px, con `aria-expanded` y `aria-controls`. Empieza compacta; la elección vive en el estado de la página mientras está montada y se conserva al cambiar de ejercicio, sin guardarse en Dexie ni en `localStorage`.
- El mensaje de error de "Cambiar a …" sigue en la tarjeta, visible en los dos modos.

### 6.5 Tabla de series
- Solo cambia lo de AC-26 a AC-30. La pista es el `placeholder` del campo (no un valor): rango de reps y de RIR del ítem, con el contraste de `--text-muted`. La serie actual usa `--accent` en el número y en el borde de sus campos; la señal es visual y redundante (el lector de pantalla ya sabe qué series están hechas).

### 6.6 Pie
- Fijo abajo, como hoy. Encima de los botones, una línea en `--text-muted`: "Siguiente: <ejercicio> · series × rango" o, en el último, "Último ejercicio de hoy", también en una sesión de otro día (habla de la sesión en curso).
- "Anterior" (secundario, borde) y "Siguiente" (principal, relleno de acento, más ancho), como enlaces. Sin "Terminar sesión".

### 6.7 Estados generales
- **Cargando, errores, sesión no disponible:** sin cambios (spec 002 §6 y AC-28).
- **Textos** en español; objetivos táctiles ≥ 44 px; contraste AA con los tokens existentes (ADR-0005).

## 7. Casos límite

- **La sesión se descarta en otra pestaña** con el menú o el aviso abiertos: la página pasa a "Esta sesión ya no está disponible." (spec 002 AC-28) y los diálogos desaparecen con ella.
- **Quitar una serie o añadir una extra** con el menú abierto: el resumen y las filas se recalculan en vivo (`useLiveQuery`).
- **Medianoche** con la página abierta: la sesión sigue siendo del día en que empezó (RN-TRN-09). El tiempo deja de mostrarse al volver a abrir la página otro día, no a medianoche en vivo.
- **Reloj del sistema hacia atrás:** el tiempo muestra "0:00" (como "Hoy").
- **Todas las series hechas:** el menú muestra "M de M hechos"; el pie no cambia; no hay botón de terminar hasta la spec 005.
- **Un ejercicio de 1 serie:** chip "1 serie" y subtítulo "1 de 1 serie" (singular).
- **Ítem sin series** (no puede pasar, RN-TRN-10): cuenta como hecho, como en "Hoy".

## 8. Preguntas abiertas

Ninguna.

Decisiones cerradas el 18-nov-2026 (conversación con el dueño del producto y revisión del diseño):

1. **Numeración:** esta es la spec 004; la fase 3 pasa a la 005.
2. **Pie:** se mantiene "Anterior" / "Siguiente" (spec 002 AC-25); en el último ejercicio, solo "Anterior", sin "Terminar sesión".
3. **Nombre de la sesión:** título y nombre accesible del menú flotante, no del encabezado.
4. **Tarjeta:** empieza compacta y recuerda la elección durante la sesión, sin guardarla.
5. **Confirmación de descarte:** "Cancelar", el fondo y Escape vuelven al aviso de salida.
6. **"Terminar y guardar lo hecho":** no se muestra hasta la spec 005.
7. **Nota de la plantilla:** texto secundario sin etiqueta.
8. **Error por fila, "Con asistencia" y el check:** sin cambios; no se añaden icono ni `role="alert"`.
9. **Tiempo en una sesión de otro día:** no se muestra, ni en el encabezado ni en el aviso de salida, como en "Hoy" (spec 003 AC-19); mostrarlo daría horas absurdas ("24:15:03"). Se comprueba al abrir la página, no en vivo a medianoche.

## 9. Checklist de la constitución

- [x] **P-1:** no se sugiere ningún ejercicio; "Cambiar a …" usa las alternativas del seed validado (RN-PLN-07, spec 002 AC-41).
- [x] **P-2:** sin cambios de esquema; "Salir y continuar después" no toca datos; descartar sigue pidiendo confirmación y no borra nada (RN-TRN-15); salir confirma el campo abierto (AC-19).
- [x] **P-3:** cambios de contrato y de spec en §5; sin `[POR DEFINIR]` ni `[PROPUESTO]`.
- [x] **P-4:** la página sigue en `app/pages`; `SessionHeader` y `SetTable` siguen en `training/ui` sin conocer rutas ni el reloj del sistema.
- [x] **P-5:** sin dominio nuevo; el avance sale de RN-TRN-21, ya probado.
- [x] **P-6:** ≥ 44 px, axe y 320 px (AC-35); < 100 ms por serie con el reloj aislado (AC-36); bundle (AC-37).
- [x] **P-7:** descanso, sugerencia, "Última vez" y "Terminar y guardar" no se construyen hasta tener datos o spec.
- [x] **P-8:** sin entradas externas nuevas; textos en español.
