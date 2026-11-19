# Diseño de la pantalla "Hoy" (para evaluar contra la spec)

Estado: **implementado** (spec 003, 18-nov-2026; `docs/specs/003-rediseno-hoy/spec.md`). Los tableros muestran por defecto lo que la app tiene hoy; las piezas de las fases 3 y 4 se activan con el ajuste `fases` y llevan su etiqueta (siguen pendientes de implementar). Fuente visual: lienzo de diseño "App de seguimiento de entrenamiento: diseño" (https://claude.ai/artifact/4n7JmYVCDFjgH558Foi2Zk). Tableros: **"Hoy D"** (sin sesión en curso), **"Hoy D2"** (con sesión en curso), **"Vista previa del día"** (`/dia/:date`) y **"Hoja: cambiar la sesión de hoy"** (futuro). Las demás versiones (A, B, C) están descartadas.

Documento hermano: `docs/design-sesion-activa.md` (pantalla de sesión activa). Flujo del prototipo: Hoy (D) → "Empezar sesión" → Sesión activa → flecha de salir → "Salir y continuar después" → Hoy con sesión en curso (D2) → "Continuar sesión" → Sesión activa.

---

## Decisión
Combinación de A (foco) y B (check-in previo; el chequeo de espalda se quitó, ver "Ideas aplazadas"). Lo que importa de un vistazo es **qué sesión toca hoy** ("Full Body A", "Pull", etc.). Hoy tiene dos estados: sin sesión en curso (D) y con sesión en curso (D2).

## Estado 1: sin sesión en curso (D)

### Estructura (de arriba abajo)
1. **Fila superior:** día ("Miércoles 18 nov") y chip de semana ("Semana 2 de 15").
2. **Aviso de dolor lumbar (condicional, fase 3; aún no existe en la app):** recuadro ámbar (`SafetyNote`) entre la fila superior y la tarjeta. Ver "Dolor y molestia lumbar".
3. **Tarjeta grande "Tu sesión de hoy":**
   - Eyebrow "Tu sesión de hoy". **Sin botón de cambiar sesión en v1** (queda para el futuro; ver "Cambiar la sesión del día").
   - Nombre de la sesión como título (44 px, `overflow-wrap: anywhere`).
   - Resumen: "N ejercicios · ~M min". El tiempo sigue una regla (spec 003): 10 min de calentamiento + Σ por ejercicio (series planificadas × (45 s + descanso medio de `restSeconds`) + 90 s), redondeado a 5 min (Full body A, semana 1 ≈ 50 min).
   - Chips: **nombre completo del bloque** (`block.name`, ej. "Bloque 1 · Full body"; el seed no tiene número de bloque y obtenerlo cambiaría el contrato de `plan`) y RIR (ej. "RIR 2-3"); si hay lectura, además **"Espalda N/10"** (fase 3, ver abajo). En semana de deload, un chip **"Descarga"** (implementado, no dibujado en el tablero). Si el RIR mínimo y el máximo coinciden: "RIR 4". Sin chips de músculos.
   - Recuadro "Hoy subes": ejercicios con sugerencia de subida y su valor. Se oculta si no hay subidas. **Se construye en la fase 4 (`progression`)**: antes de eso no aparece (en el tablero solo con `fases` = "Con fases 3 y 4", con etiqueta).
   - CTA "Empezar sesión".
4. **Menú desplegable "Ver los N ejercicios"** (cerrado por defecto): ejercicios con **solo series × repeticiones, sin cargas** (decidido). Las cargas sugeridas aparecen en "Hoy subes" y en la sesión activa; §7.2 de la spec se corrige en ese sentido.
5. **Esta semana (tira de días, decidido; se oculta fuera del programa, antes de empezar o después de terminar):** encabezado "Esta semana" + "N de M sesiones" (N = 0 hasta la fase 3) y siete columnas L M X J V S D (lunes a domingo) según el plan. Ver "Tira de días" abajo.
6. **Barra inferior:** Hoy y Progreso.

### Fuera del programa (implementado)
Antes de empezar o después de terminar el plan: la fila superior solo lleva la fecha (sin chip de semana) y la tarjeta conserva el eyebrow "Tu sesión de hoy" con **solo el mensaje**: "El plan empieza el lunes 16 de noviembre." o "Terminaste el plan de 15 semanas." Sin título, chips, CTA, tira ni "Otra sesión de esta semana". Tablero D: ajuste `session` = "Fuera: antes del plan" / "Fuera: plan terminado".

### Días de descanso y de cardio (decidido)
La tarjeta ocupa el mismo lugar y cambia su contenido (misma posición, sin reorganizar la pantalla):
- **Eyebrow "Tu sesión de hoy"** (el mismo que en los días de pesas; cambio acordado con la spec 003, que antes aprobaba "Hoy") y título en 44 px: **"Cardio"** o **"Descanso"**.
- **Texto:** la **nota del seed tal cual** (spec 003). Cardio: "Cardio suave 30-40 min (bici, elíptica o caminata inclinada)". Descanso: "Recupera: dormir y comer bien también es entrenar."
- **Idea futura:** título "Cardio suave" y un texto "30-40 min · ritmo suave" por separado. Exige campos nuevos en el seed (título y duración), que hoy no existen.
- **Chips:** el nombre del bloque (sin RIR). El chip de espalda sigue aplicando si hay lectura.
- **Sin CTA principal, sin "Hoy subes" y sin desplegable de ejercicios.**
- **Sin línea de "próxima sesión":** la tira ya muestra lo que viene (la próxima podría caer en la semana siguiente; se puede añadir después).
- Debajo: la tira "Esta semana" y la sección **"Otra sesión de esta semana"**.
- **El cardio no se registra en v1** (futuro): es solo informativo, y la tira nunca lo marca como hecho. Se muestra como "C" punteada (programado), también en días pasados.

#### "Otra sesión de esta semana"
Lista de las sesiones de entrenamiento de la semana, **sin incluir la de hoy**:
- **Pendiente:** botón de 48 px con borde neutro (#2A3630, no de acento, para no competir con un CTA principal) y texto "Vie 20 · Full body B". **El toque abre la vista previa del día (`/dia/:date`, spec 002 AC-8)**, con los ejercicios y "Empezar sesión". **No inicia el workout directamente**: un toque accidental crearía una sesión que luego habría que descartar. En el prototipo el botón abre el tablero "Vista previa del día".
- **Hecha (fase 3):** fila gris, no pulsable, "Lun 16 · Full body B · hecha ✓". **Depende de workouts terminados; hoy no existe** (en la app esa sesión sigue como pendiente). En el tablero solo con `fases` = "Con fases 3 y 4".
- Solo se ofrecen **días de la semana ISO actual** (RN-TRN-14). **Una sesión pendiente de una semana pasada no se ofrece.**
- **Aparece en todos los estados de D** (día de entrenamiento, descanso y cardio), al final de la pantalla, debajo de la tira. **No aparece en D2** (sesión en curso).
- Hoy no se incluye en la lista.
- Es la versión mínima de "cambiar sesión" para v1: solo lee el plan de la semana (y los workouts hechos en la fase 3).

### Dolor y molestia lumbar (decidido; **fase 3**, aún no implementado)
- **Aviso de dolor:** recuadro ámbar (borde y icono #FFB547, fondo tenue) **arriba de la tarjeta**, lo primero que se ve. Solo aparece con la última lectura de **3/10 o más**. Informativo, sin botones. Texto del diseño: "Espalda baja 4/10 en la última sesión. Hoy prioriza la técnica y no añadas carga."
- **Última molestia:** chip "Espalda N/10" **dentro de la tarjeta**, junto a Bloque y RIR, con cualquier lectura registrada.
- **Sin dato:** no se muestra ni el aviso ni el chip.
- **D2 (sesión en curso):** no se muestra nada de esto.
- Alternativas descartadas: chip en la fila superior (se aprieta con día y semana) y aviso dentro de la tarjeta (la hace crecer y baja el CTA).
- Prototipo: ajuste `espalda` del tablero D (Sin dato / Molestia leve / Dolor); solo se ve con `fases` = "Con fases 3 y 4", con etiqueta "Fase 3".
- A definir en la spec (`health`): umbral exacto, qué ajusta la app con dolor y el texto definitivo. El registro del dolor sigue siendo al cerrar la sesión.

### Tira de días (WeekStrip) — decisión: entra
Es una lista de 7 días (`<ol>` con un `<li>` por día). Cada día es una letra sobre un círculo de 32 px:
- **✓ con relleno de acento:** sesión de pesas hecha (**fase 3**; hoy ningún día se marca así).
- **Anillo vacío (#2A3630):** sesión de pesas pendiente. **Una sesión pasada sin hacer se ve igual que una pendiente** (en la app, hasta la fase 3, también las de días ya entrenados).
- **C punteada:** cardio programado (informativo; **nunca se marca como hecho**, porque el cardio no se registra en v1).
- **–:** descanso.
- **Hoy = anillo de acento (2 px) que se suma a la marca del día, no la reemplaza:** ● si es de pesas pendiente, (–) si es descanso, (C) si es cardio, (✓) si ya está hecha (fase 3).
- El anillo vacío (#2A3630, ~1.5:1 de contraste) **no puede ser la única señal de un estado**. Vale como "pendiente" porque un día de pesas pendiente es el único sin marca dentro.

**Accesibilidad (spec 003):** el `role="img"` va en un elemento dentro de cada `<li>`, para que la tira siga siendo una lista de 7 días. El `aria-label` lleva el nombre de la sesión y el estado, con el formato `<día>, [hoy,] <sesión>, <estado>`. Ejemplos: "miércoles, hoy, Full body B, pendiente"; "lunes, Full body A, no hecha"; "martes, cardio"; "jueves, descanso". El estado solo en días de pesas: "pendiente" (hoy y futuro), "no hecha" (pasado), "hecha" (fase 3). El texto "N de M sesiones" cuenta solo sesiones de pesas.

Datos necesarios (a definir en la spec): qué toca cada día de la semana según el bloque activo (`block.schedule`, módulo `plan`) y si cada día ya tiene un workout terminado (`training`). Cuando exista "Cambiar sesión" (futuro, con `ScheduleOverride`), un día movido o cambiado deberá reflejarse en la tira. La tira es de solo lectura (no es botón); navegar a un día sería una función nueva.

Alternativa descartada: barra de segmentos (una por sesión programada, sin días). Se quitó del tablero.

### Cambios respecto a las alternativas
- Día de la semana fuera del título (no cabía) y chips de músculos fuera.
- Lista de ejercicios como menú desplegable.
- El RIR del chip es el objetivo del bloque/semana (plan.md: sem. 2-4 → 2-3; sem. 10-14 → 1-3; deload → 4), **no** un valor por ejercicio. La única excepción por ejercicio es una nota de técnica ("última serie cerca del fallo" en algunos aislamientos).
- Se quitó el chequeo "¿Cómo está tu espalda hoy?" para que la primera versión siga la spec (el dolor se registra al cerrar la sesión).

## Estado 2: sesión en curso (D2, implementado)
La app ya tenía una tarjeta de "Sesión en curso" con "Continuar sesión" y "Descartar sesión" (captura del usuario, 18-nov-2026). D2 la mantiene y la enriquece.

**Estructura (de arriba abajo):**
1. **Fila superior:** igual que en D (día y semana).
2. **Tarjeta "Sesión en curso"**, con borde de acento (sustituye a "Tu sesión de hoy"; no hay botón de cambiar sesión):
   - Eyebrow "Sesión en curso" con punto de estado y **tiempo transcurrido** (ej. 18:42).
   - Nombre de la sesión como título (44 px).
   - Avance: "1 de 7 ejercicios hechos", estimación "Faltan ~35 min" y barra de siete segmentos (hecho, actual, pendientes).
   - Recuadro **"Vas en"**: ejercicio actual y serie (ej. "Press de banca · serie 3").
   - Botón principal **"Continuar sesión"** → vuelve a la sesión activa.
   - Botón secundario en ámbar con borde **"Descartar sesión"** → confirmación inferior "¿Descartar la sesión?" (RN-TRN-15: **no borra las series**, solo marca el workout como descartado. Texto: "Las N series que registraste en M ejercicios no contarán en tu historial. No se puede deshacer."; con 1 serie: "La serie que registraste en 1 ejercicio no contará en tu historial. No se puede deshacer."; con 0: "No registraste ninguna serie. No se puede deshacer." Sin "hoy": la sesión puede ser de otro día), con "Sí, descartar" (vuelve a Hoy sin sesión) y "Cancelar".
3. **Esta semana** (misma tira de días que en D; hoy aparece como ● mientras la sesión está en curso) y barra inferior. El ✓ de los días hechos y "1 de 3 sesiones" son fase 3 (D2: ajuste `fases` = "Con fase 3").

**Reglas (spec 003):**
- Un ejercicio está "hecho" cuando todas sus series lo están, también las extra.
- "Vas en" es el primer ejercicio con una serie pendiente y su primera serie pendiente.
- Con todo hecho se ocultan "Faltan" y "Vas en".
- "Faltan ~N min": la misma fórmula que el tiempo planificado, sin calentamiento y solo con las series no hechas; se oculta cuando no queda ninguna.
- **Sesión de otro día** (variante en el tablero D2, ajuste `sesion`): el botón dice "Continuar sesión del lunes 16 de noviembre" y no se muestra el tiempo transcurrido.

**Decisiones:**
- No se muestra "Cambiar sesión" con una sesión ya empezada (decisión de diseño; no está definida en la spec).
- La confirmación de descartar es la misma que la del aviso de salida de la sesión activa.
- "Tu sesión de hoy" y "Sesión en curso" son **la misma posición de la pantalla en dos estados**, no dos tarjetas a la vez.
- No se muestran "Hoy subes" ni la lista de ejercicios mientras hay sesión en curso (se ven en la sesión activa).

## Vista previa del día (`/dia/:date`, implementada)
Se abre desde "Otra sesión de esta semana". Enlace **"Volver a Hoy"** (44 px, acento); `h1` con la fecha larga ("Viernes 20 de noviembre"); tarjeta con el nombre de la sesión (`h2`), el RIR una sola vez ("RIR 3-4"), la lista de ejercicios (nombre, series × reps o × s y la nota de la plantilla debajo) y **"Empezar sesión"** (crea el workout con `plannedFor` = ese día). Sin cargas ni RIR por fila. Solo días de pesas de la semana ISO actual; otra fecha, hoy mismo o una sesión en curso redirigen a Hoy. Tablero: "Vista previa del día".

## Cambiar la sesión del día (hoja "Cambiar") — FUTURO, fuera de v1
Se pospone por ser un cambio mayor. En v1 solo existe "Otra sesión de esta semana" (en todos los estados de D, no en D2). El tablero "Hoja: cambiar la sesión de hoy" y el icono ⇄ se conservan solo como referencia.

Opciones: alternativa directa (ej. Full Body B, con aviso si se hizo hace pocos días), mover a mañana, descansar hoy, cardio suave 30-40 min, sesión libre. Alcance: "Solo hoy" o "Mover el resto de la semana".

Propuesta de modelo en `plan`: `ScheduleOverride { date, templateId | 'rest' | 'free' }`. La sesión del día resuelve primero el override y luego `block.schedule`.

## Ideas aplazadas
- **Chequeo previo de espalda** (Bien / Molestia / Dolor) en la tarjeta de Hoy. Era una función nueva, no está en la spec. Reglas que habría que definir: si se registra (modelo `health`) o solo ajusta la sesión; qué hace "Molestia" (el prototipo proponía "1 serie menos por ejercicio y RIR 3"; con "Dolor": considerar descansar o cardio suave); cómo se relaciona con el selector 0-10 del cierre.

---

## Puntos para evaluar contra la spec
1. Spec §7.2 describe Hoy con "lista de ejercicios de hoy con sugerencias" y botón "Iniciar sesión": D usa un menú desplegable cerrado (solo series × repeticiones) y "Empezar sesión". **Decidido:** las cargas no van en el desplegable; se corrige §7.2.
2. RF-06 (sesión libre) ya no sube a P1 por el cambio de sesión (que pasa a futuro).
3. `ScheduleOverride` y "Mover el resto de la semana" quedan fuera de v1 (futuro).
4. **Sesión en curso (D2):** la app actual ya resuelve el estado con `getActiveWorkout()` (RF-19). Los datos nuevos de D2 (tiempo transcurrido, "1 de 7 hechos", tiempo restante estimado, "Vas en: ejercicio y serie") hay que poder derivarlos del workout; el tiempo restante usa la misma fórmula que el tiempo planificado (ver "Estructura").
5. Cambiar sesión queda fuera de v1; D2 ya no lo muestra de todos modos.
6. **Resuelto:** "Hoy subes" se construye en la fase 4 (`progression`) y se muestra solo cuando hay sugerencia de subida; descanso/cardio, ver "Días de descanso y de cardio".
7. **Tira de días (WeekStrip):** decidido que entra. Falta definir en la spec el contrato que alimenta la tira (día → sesión/cardio/descanso/override + si ya está hecha). Los módulos no se importan entre sí salvo por `index.ts`: `plan` aporta lo programado y `training` lo hecho; la composición de ambos debe vivir donde ya se componen otros módulos (ver architecture.md), sin ciclos. Cardio y descanso no cuentan para "N de M sesiones".
8. **Aviso y chip de espalda (fase 3):** definir el contrato de lectura (última lectura de dolor lumbar con fecha y valor 0-10) que `health` expone por su `index.ts`, el umbral del aviso (diseño: 3 o más) y su texto.
9. ~~Descanso y cardio~~ **Resuelto en la spec 003.** Cardio no se registra en v1; "Otra sesión de esta semana": solo semana ISO actual (RN-TRN-14); las filas "hecha" son fase 3.
10. ~~Texto de descartar~~ **Resuelto** (RN-TRN-15; ver `docs/design-sesion-activa.md`).
