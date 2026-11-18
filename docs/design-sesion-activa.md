# Diseño de la sesión activa (para evaluar contra la spec)

Estado: **diseño elegido**. La spec 002 (sesión activa) ya está implementada. Los cambios de este diseño van en la **spec 004**; el Cierre y "Terminar y guardar" pasan a la **spec 005** (fase 3). Fuente visual: lienzo "App de seguimiento de entrenamiento: diseño" (https://claude.ai/artifact/4n7JmYVCDFjgH558Foi2Zk), tablero **"Sesión activa A3"** (`SesionA3.dc.html`). A y A2 están descartadas.

Documento hermano: `docs/design-hoy.md`. Flujo del prototipo: Hoy → "Empezar sesión" → Sesión activa → Cierre (spec 005).

Restricción de producto: la app nunca sugiere peso muerto ni impacto (espondilolistesis L5-S1 grado I).

---

## 1. Alcance por fase

| Pieza | Alcance |
|---|---|
| Encabezado en una fila (flecha, "Ejercicio N de M ▾", tiempo) | spec 004 |
| Flecha y aviso de salida | spec 004 |
| Menú flotante de ejercicios | spec 004 |
| Tarjeta compacta / completa con "Ver detalles" | spec 004 |
| Encabezado "Seg" en ejercicios por tiempo | spec 004 |
| Pistas (placeholder) de reps y RIR en los campos | spec 004 |
| Serie actual resaltada | spec 004 |
| Línea del pie ("Siguiente: …" / "Último ejercicio de hoy") | spec 004 |
| "Con asistencia" | **Ya implementado** (no se rediseña) |
| Error por fila | **Ya implementado** |
| Añadir / Quitar serie, etiqueta "extra", "Máximo N series" | **Ya implementado** |
| "Cambiar a …" deshabilitado con su texto de ayuda | **Ya implementado** |
| Anterior / Siguiente | **Ya implementado** |
| "Terminar y guardar", Cierre, PainGate | spec 005 |
| Temporizador de descanso, "+30 s", Wake Lock | fase 4 |
| Recuadro de sugerencia y "Última vez" | fase 4 |

El tablero dibuja piezas de fases futuras (descanso, sugerencia, "Última vez", "Terminar y guardar"); están marcadas o fuera del alcance de la spec 004 y **no deben construirse ahora**.

## 2. Encabezado
Una fila:
- **Flecha de salir:** 44×44, nombre accesible "Salir de la sesión".
- **Botón "Ejercicio N de M ▾":** abre el menú; lleva `aria-expanded`. Su nombre accesible es el texto visible, sin `aria-label` aparte (WCAG 2.5.3).
- **Tiempo transcurrido:** mismo formato que ya existe en Hoy: `m:ss`, y `h:mm:ss` desde una hora. No es región viva. En el tablero, "Tiempo de sesión" va como texto oculto a la vista junto al valor (un `aria-label` en un elemento sin rol no se anuncia).

El nombre de la sesión ("Full body A") es el título del menú flotante.

## 3. Menú de ejercicios
- Panel flotante sobre fondo oscurecido, con `<dialog>` nativo. El diálogo se llama como la sesión ("Full body A"), no "Ejercicios de hoy", porque la sesión puede ser de otro día. Se cierra al tocar el fondo y con Escape. No empuja la tarjeta ni la tabla.
- **Resumen:** "N de M hechos · 1 en curso". "En curso" es el primer ejercicio con alguna serie sin hacer; hay como mucho uno. Si todo está hecho, se quita "· 1 en curso".
- **Estado de cada fila:**
  - ✓ si está hecho (todas sus series, también las extra);
  - anillo de acento si está en curso;
  - número si está pendiente.
- **Subtítulos:**
  - pendiente: "2 × 6-10" (series planificadas × rango);
  - en curso: "En curso · serie 3";
  - hecho: "2 de 2 series".
  
  Se quita el ejemplo "3 × 12 · 105 kg": no hay un peso único por ejercicio.
- El ejercicio que se está viendo lleva `aria-current="step"` y un resaltado propio. No siempre coincide con el "en curso".
- Tocar una fila va a ese ejercicio, sin importar el orden.
- **"Descartar sesión" ya no va en el menú**; solo en el aviso de salida.

## 4. Aviso de salida (flecha)
Título "¿Salir de la sesión?". Texto "Llevas N de M ejercicios y m:ss de entrenamiento.", donde N cuenta los ejercicios hechos.

Opciones en la spec 004:
1. **Seguir entrenando** (principal).
2. **Salir y continuar después**, subtítulo "Hoy mostrará 'Continuar sesión'".
3. **Descartar sesión** (ámbar), subtítulo "Las series no contarán en tu historial".

"Terminar y guardar lo hecho" **no se muestra hasta la spec 005**, ni siquiera deshabilitado. En el tablero aparece como recuadro punteado "Fase 3 · no se muestra" solo como referencia.

**Confirmación de descarte:**
- Texto de la spec 003: "Las N series que registraste en M ejercicios no contarán en tu historial. No se puede deshacer."; con 1 serie: "La serie que registraste en 1 ejercicio no contará en tu historial. No se puede deshacer."; con 0: "No registraste ninguna serie. No se puede deshacer."
- Botones "Sí, descartar" y "Cancelar". "Cancelar", tocar el fondo y Escape hacen lo mismo: vuelven al aviso de salida (no lo cierran todo).
- Descartar **no borra series** (RN-TRN-15).

## 5. Tarjeta del ejercicio
- El nombre del ejercicio es el **`h1`** de la página (en el tablero ya está corregido; antes era `h2`).
- Empieza **compacta**. La elección se recuerda al pasar de un ejercicio a otro durante la sesión, sin guardarla.
- **Compacta (spec 004):** nombre y la línea "2 × 6-10 · RIR 3-4", sin flecha ni sugerencia. "Cambiar a …" queda oculto dentro de "Ver detalles".
- **Completa (spec 004):**
  - chips de series ("2 series", las planificadas), reps ("6-10 reps", o "30-45 s" en ejercicios por tiempo) y RIR ("RIR 3-4"), todos tomados del ejercicio;
  - consejo del ejercicio y nota de la plantilla (texto secundario, sin etiqueta);
  - "Cambiar a <alternativa>" (deshabilitado si hay series hechas, con "Para cambiar de ejercicio, desmarca las series hechas"; si no hay alternativa, no se muestra).
- **Fase 4:** recuadro de sugerencia ("Sube a 52.5 kg") y "Última vez". En el tablero llevan la marca "Fase 4".
- Botón "Ver detalles" / "Ocultar detalles" con `aria-expanded`, 44 px de alto.
- Valores del tablero que son de ejemplo: el chip de RIR sale del ejercicio y "Máximo N series" depende del ejercicio.

## 6. Tabla de series (solo los cambios)
- En ejercicios por tiempo, el encabezado de la columna dice **"Seg"** (hoy "s").
- Los campos vacíos muestran como **pista** el rango de reps ("6-10" o "30-45") y de RIR ("3-4"). No es un valor guardado.
- La **serie actual** (la primera sin hacer del ejercicio que se ve) lleva el número y el borde de los campos en color de acento.
- **Error por fila:** se queda como está en la app: mensaje ámbar bajo la fila, borde ámbar y `aria-live="polite"`. (El tablero dibuja icono y `role="alert"`; no se implementan.)
- **"Con asistencia" y el check:** no se rediseñan. El tablero muestra su propio estilo; la app usa los controles nativos que ya existen.

## 7. Pie
- **Anterior** (secundario) y **Siguiente** (principal), como hoy (AC-25).
- En el **primer** ejercicio no hay "Anterior"; en el **último** solo aparece "Anterior", sin "Terminar sesión". El tablero lo muestra con el tweak `ejercicio` = Primero / Último.
- El último ejercicio de Full body A es **Dead bug** (`metric: 'reps'`): sin columna de kg, "Anterior" muestra solo las reps ("10") y la línea compacta es "2 × 8-10 · RIR 3-4".
- **Línea encima de los botones:**
  - "Siguiente: <ejercicio> · 3 × 6-10" (series planificadas × rango, o "s" en ejercicios por tiempo);
  - en el último ejercicio, "Último ejercicio de hoy".

## 8. Accesibilidad y estilo
- Todo control ≥ 44 × 44 px, contraste WCAG 2.2 AA y funciona a 320 px de ancho.
- Los colores del tablero son orientativos: la app usa sus tokens CSS. Revisar el contraste del texto secundario y de las pistas de los campos.
- Menú y avisos con `<dialog>` nativo; el foco vuelve al botón que los abrió.

## 9. Ejercicios no hechos
- No existe "No hacer hoy" ni estado por ejercicio (`skipped`/`substituted`): un ejercicio sin series hechas cuenta como no hecho.
- No existe "Sustituir ejercicio" abierto; solo "Cambiar a <alternativa>".
- No hay fila "Opcional"; la serie adicional es "Añadir serie".

---

## Decisiones abiertas
1. ~~Pie de navegación~~ **Resuelto:** se mantiene Anterior / Siguiente (AC-25).
2. ~~Último ejercicio sin Cierre~~ **Resuelto:** solo "Anterior" (ver sección 7).
3. **Fuera del programa / sesión libre:** fuera de alcance; solo está definido el estado D en `design-hoy.md`.
4. **Vista previa del día** (Otra sesión de esta semana): el tablero enlaza a A3 como marcador; falta diseñar.

## Notas de implementación (PWA)
- Cada serie se guarda en Dexie al marcarla (RN-TRN-03).
- Ciclo de vida (`training.md`): `getActiveWorkout()` (RF-19), `discardWorkout`, un solo `in_progress` (RN-TRN-01). `finishWorkout` es de la spec 005. El evento `WorkoutDiscarded` es diseño del contrato, aún no implementado: `training` no publica eventos hasta la fase 4 (spec 002 §5).
- Temporizador (fase 4): guardar `endsAt` (ADR-0006), no depender de `setInterval`; aviso visual y sonoro dentro de la app; Wake Lock con alternativa.
- Ejercicios por tiempo: **no** usan una métrica `seconds`; usan `metric: 'time'` y las reps cuentan segundos.
- Asistencia: peso negativo en el dominio (ya implementado).

## Puntos para evaluar contra la spec
1. ¿Qué pasa en "Terminar y guardar" con una sesión parcial y se registra el dolor lumbar (0-10) en el cierre aunque sea parcial? (spec 005)
2. ¿"+30 s" y el tiempo total son requisitos de v1.0? (fase 4)
3. ~~Último ejercicio en fase 2~~ **Resuelto** (sección 7).
