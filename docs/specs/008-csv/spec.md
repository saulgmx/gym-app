# Spec: Exportar las series a CSV

**ID:** 008 · **Estado:** Aprobada · **Fecha:** 20-nov-2026
**Requerimientos cubiertos:** RF-40 (parte CSV), RNF-01, RNF-04, RNF-05, RNF-09 · **Fase:** 3 (spec §13), cuarta y última parte
**Fuente de diseño:** sin tablero propio; un botón más en la sección "Respaldo" de Ajustes (spec 007)
**ADRs aplicados:** 0002, 0005, 0009, 0010, 0013

## 1. Problema y objetivo

El respaldo JSON (spec 007) protege los datos, pero está pensado para que lo lea la app, no una persona. Hasta que llegue "Progreso" (fase 4), la única forma de analizar la evolución de un ejercicio, contar el volumen o enseñarle las series a un entrenador o fisioterapeuta es abrirlas en una hoja de cálculo. Esta spec exporta las series hechas a un CSV que se abre directo en Numbers, Excel o Google Sheets.

## 2. Alcance

La fase 3 se reparte en 005 (Cierre), 005b (una sesión cerrada por día), 006 (historial), 007 (respaldo JSON) y esta (CSV), que la cierra.

- **Incluye:**
  - **"Exportar series (CSV)"** en la sección "Respaldo" de Ajustes, debajo de "Descargar respaldo" y "Restaurar respaldo", con una línea de texto que explica para qué sirve (§6.1).
  - **Contenido:** una fila por serie **hecha** (`done: true`) de cada sesión **`completed`**, con las columnas de §4.2 (RN-DAT-14).
  - **Formato:** UTF-8 con BOM, separador coma, punto decimal, encabezados en inglés, comillas según RFC 4180 y fin de línea CRLF.
  - **Entrega:** la misma del respaldo, con la hoja de compartir o la descarga (`deliverFile`, spec 007 decisión 15). El archivo se llama `gym-series-v1-AAAA-MM-DD.csv` y es de tipo `text/csv`; `v1` es la versión del formato CSV (decisión 12).
- **No incluye:**
  - Importar CSV: para restaurar está el respaldo JSON.
  - Series no hechas, sesiones `discarded` o `in_progress`, dolor lumbar, notas y plan.
  - Elegir un rango de fechas, un ejercicio o las columnas.
  - Otros separadores o la coma decimal según el idioma del dispositivo.
  - El recordatorio de respaldo (RF-42) y borrar todo (RF-43).
  - Cambios de base o de migración (la base sigue en la v3).

## 3. Historias de usuario

- Como usuario, quiero abrir mis series en una hoja de cálculo para ver cómo subo de peso en cada ejercicio mientras la app no tiene gráficas.
- Como usuario con espondilolistesis, quiero mandarle mis series a mi fisioterapeuta en un formato que pueda abrir sin instalar nada.
- Como usuario, quiero que mis datos estén también en un formato abierto que cualquier programa lea, para no depender de esta app.

## 4. Criterios de aceptación

Las fechas suponen un programa que empieza el lunes 16-nov-2026 y que hoy es el miércoles 25-nov-2026 a las 21:00 en la zona del dispositivo (UTC−6). El plan es el seed real.

**Datos de ejemplo** (de la spec 006, más una sesión descartada):

| Sesión | Estado | `date` | Semana | Series hechas | Detalle |
|---|---|---|---|---|---|
| **L16**: Full body A | `completed` | lun 16-nov | 1 | las 10 | 2.ª de Prensa de piernas: 100 kg × 9, RIR 2, a las 18:06. Dominadas con la alternativa Jalón al pecho. Dead bug: 12 reps, RIR 1 |
| **M17**: Full body B | `discarded` | mar 17-nov | 1 | 2 | — |
| **M18**: Full body A del viernes | `completed` | mié 18-nov | 1 | 5 de 10 | Una de Dominadas con asistencia: −20 kg × 8, RIR 2 |
| **L23**: Full body B | `completed` | lun 23-nov | 2 | las planificadas y 1 extra | 3.ª de Fondos en paralelas extra: 0 kg × 8, RIR 1 |

"CSV de ejemplo" es el que produce "Exportar series (CSV)" con estos datos.

### 4.1 Ajustes y entrega

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-1 | `/ajustes` | Miro la sección "Respaldo" | Debajo de "Restaurar respaldo" está el texto "Para abrir tus series en una hoja de cálculo." y el botón secundario "Exportar series (CSV)", a lo ancho y de ≥ 44 px. La zona de mensajes sigue debajo de todos los botones |
| AC-2 | Los datos de ejemplo, en un navegador que puede compartir el archivo (`navigator.canShare({ files })`) | Toco "Exportar series (CSV)" | Se abre la hoja de compartir con `gym-series-v1-2026-11-25.csv`, de tipo `text/csv` |
| AC-3 | Un navegador que no puede compartir archivos | Toco "Exportar series (CSV)" | El mismo archivo se descarga con un enlace `download` |
| AC-4 | AC-2 | Cierro la hoja sin elegir destino | No pasa nada: ni error ni aviso |
| AC-5 | Toco "Exportar series (CSV)" | Se prepara el archivo | El botón dice "Preparando CSV…" y queda `disabled` hasta que se abre la hoja o empieza la descarga; mientras tanto, "Descargar respaldo" y "Restaurar respaldo" también quedan `disabled`, y al revés (como la spec 007 decisión 17 (a)) |
| AC-6 | Exportar falla de forma inesperada (la base lanza) | Toco "Exportar series (CSV)" | El botón vuelve a su estado normal y el texto genérico (ADR-0010) sale en la zona de mensajes con `role="alert"` (como la spec 007 decisión 16 (c)) |
| AC-7 | Un mensaje de la sección visible ("Respaldo restaurado." o un error) | Toco "Exportar series (CSV)" | El mensaje se borra |

### 4.2 Contenido del archivo

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-8 | El CSV de ejemplo | Leo sus bytes | Empieza con el BOM de UTF-8 (`EF BB BF`); cada línea termina en CRLF, también la última |
| AC-9 | AC-8 | Leo la primera línea | `date,week,session,exercise,metric,setNumber,weightKg,reps,rir,isExtra,completedAt` |
| AC-10 | AC-8 | Cuento las filas | Una por serie hecha de L16, M18 y L23, en ese orden; ninguna de M17 (`discarded`) ni de las series no hechas de M18 (RN-TRN-08) |
| AC-11 | AC-10 | Miro el orden dentro de una sesión | Por el `order` del ejercicio en la sesión y, dentro de cada ejercicio, por `setNumber` |
| AC-12 | L16 | Miro la 2.ª serie de Prensa de piernas | `2026-11-16,1,Full body A,Prensa de piernas,weight,2,100,9,2,false,2026-11-16T18:06:00-06:00` |
| AC-13 | L16 | Miro las series de Dominadas | La columna `exercise` dice "Jalón al pecho", el ejercicio que se usó (RN-PLN-11) |
| AC-14 | M18 | Miro la serie con asistencia | `weightKg` es `-20`; `session` es `Full body A` (el nombre de la sesión, sin "del viernes") y `date` es `2026-11-18` |
| AC-15 | L23 | Miro la 3.ª de Fondos en paralelas | `weightKg` es `0`, `isExtra` es `true` y `week` es `2` |
| AC-16 | L16 | Miro Dead bug (`metric: 'reps'`) | `metric` es `reps` y `weightKg` está vacío: `…,Dead bug,reps,1,,12,1,false,…` |
| AC-17 | Una serie hecha de Plancha (`metric: 'time'`) de 40 s y RIR 2 | Miro su fila | `metric` es `time`, `weightKg` está vacío y `reps` es `40` (segundos) |
| AC-18 | Una serie hecha de 62,5 kg | Miro su fila | `weightKg` es `62.5`, con punto decimal y sin ceros de más (`100`, no `100.0`) |
| AC-19 | Una serie hecha sin RIR (`rir: null`) | Miro su fila | `rir` está vacío |
| AC-20 | Una sesión fuera del programa (`programWeek: null`) | Miro su fila | `week` está vacío |
| AC-21 | Un plan restaurado con un ejercicio llamado `Remo "Pendlay", banco` | Miro su fila | El campo va entre comillas y la comilla interna se duplica: `"Remo ""Pendlay"", banco"` |
| AC-22 | AC-12 | Abro el archivo en Numbers, Excel (es-MX) o Google Sheets | Cada columna sale en su celda, los acentos se ven bien ("Jalón") y `weightKg` se reconoce como número |

### 4.3 Casos de datos

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-23 | Una base sin sesiones `completed` | Toco "Exportar series (CSV)" | Se entrega un archivo con el BOM y solo la línea de encabezados |
| AC-24 | Una sesión `in_progress` con series hechas | Toco "Exportar series (CSV)" | Se exporta: sus series no salen (solo las de `completed`), y la sesión sigue en curso |
| AC-25 | Dos sesiones `completed` con el mismo `date` (tolerado, RN-DAT-12) | Miro el CSV | Las dos salen, primero la que empezó antes (`startedAt`, comparado con `compareInstants`, ADR-0009) |
| AC-26 | Exportar el CSV | Miro la base | No cambia nada: solo lectura |

### 4.4 Transversales

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-27 | `/ajustes` con el botón nuevo | Corre axe en Playwright | Sin violaciones WCAG 2.2 A/AA; cada control ≥ 44 × 44 px; nada desborda a 320 px |
| AC-28 | Sin conexión, con la app ya abierta una vez | Exporto el CSV | Funciona igual (RNF-01) |
| AC-29 | El build de producción | Corre `size-limit` | El JS inicial sigue < 200 KB gzip (QS-10) |
| AC-30 | La CSP de producción (`vercel.json`) | Exporto el CSV en `vite preview` | Sin violaciones de CSP en la consola |
| AC-31 | Sin cambios de esquema | Abro la versión nueva con una base v3 | La base sigue en v3; no hay migración (P-2) |

## 5. Reglas de negocio aplicables

Del contrato [`modules/data.md`](../../modules/data.md): RN-DAT-12 (datos tolerados). De [`modules/training.md`](../../modules/training.md): RN-TRN-08 (series hechas) y 26 (solo `completed`). De [`modules/plan.md`](../../modules/plan.md): RN-PLN-11 (la serie registra el ejercicio usado). ADR-0009 (`Instant` con offset, nunca comparado como string).

Regla nueva (en el contrato `data` v1.6 desde la aprobación):

| ID | Regla |
|---|---|
| RN-DAT-14 | **CSV de series:** una fila por serie hecha (`done`) de cada workout `completed`, ordenadas por `date`, luego `startedAt` (`compareInstants`), luego el `order` del ítem y luego `setNumber`. Columnas `date,week,session,exercise,metric,setNumber,weightKg,reps,rir,isExtra,completedAt`: `date` (`LocalDate`), `week` (`programWeek`, vacío si es `null`), `session` (`Workout.name`), `exercise` (nombre actual del ejercicio de la serie en el plan) y `metric` (del ejercicio); `weightKg`, `reps` y `rir` como números con punto decimal sin ceros de más, vacíos si son `null`; `isExtra` `true`/`false`; `completedAt` tal como está guardado. UTF-8 con BOM, separador coma, CRLF al final de cada línea, campos de texto entre comillas solo si llevan coma, comilla, CR o LF (RFC 4180). Nombre `gym-series-v<versión del formato>-<LocalDate de hoy>.csv` (hoy `v1`), tipo `text/csv`. La versión del formato CSV es una constante de `data`, independiente de `schemaVersion`: sube cuando cambian las columnas, su orden o su significado. Solo lectura. |

Quién arma las filas lo fija el plan técnico: el `csv?()` del `DataPort` de `training`, que necesita el nombre y la `metric` de `plan`, o el cruce en `data` con `describe`. El borrador de `csv?()` en `shared.md` §2 y `data.md` §3 puede cambiar.

Cambios de documentos hechos al aprobar (20-nov):

| Documento | Cambio |
|---|---|
| `constitution.md` (v1.1) | P-2: toda exportación lleva la versión de su formato; el CSV, en el nombre del archivo. Pregunta nueva en el checklist de P-2 (decisión 12) |
| `adr/0013-version-de-formato-en-exportaciones.md` | ADR nuevo con la enmienda y las opciones descartadas |
| `spec.md` (v0.14) | RNF-09 con el texto de ADR-0013; §7.2, la fila "Ajustes" añade "Exportar series (CSV)" y quita "CSV" de v1.0; §7.3, el flujo del CSV |
| `modules/data.md` (v1.6) | §1 y §9: el CSV pasa de "más adelante" a la responsabilidad del módulo; §4 con el formato de RN-DAT-14 (reemplaza el borrador de columnas); RN-DAT-01 dice "respaldo JSON"; RN-DAT-14; decisión 6. La firma la fija el plan |
| `modules/shared.md` y `modules/training.md` | Ninguno todavía: según el plan, si cambia o se implementa `csv?()` |

## 6. UX

### 6.1 Ajustes (`/ajustes`)
- En la sección "Respaldo", después de "Restaurar respaldo", va un párrafo y luego el botón secundario:
  - Párrafo: "Para abrir tus series en una hoja de cálculo."
  - Botón: "Exportar series (CSV)", a lo ancho y de ≥ 44 px.
- La zona de mensajes (spec 007 §6.3) queda debajo de los tres botones y la comparten. El CSV no tiene mensaje de éxito: entregar el archivo basta, como en "Descargar respaldo" (spec 007 decisión 16 (b)).
- Mientras se prepara, el botón dice "Preparando CSV…" (AC-5).
- Como los otros dos botones, este espera a que la base esté lista (`ready`).

### 6.2 Estados
- **Error inesperado:** el texto genérico en la sección, con `role="alert"` (AC-6).
- **Sin conexión:** funciona igual (RNF-01).
- **Textos** en español, contraste AA con los tokens existentes y sin colores nuevos.

## 7. Casos límite

- **Un nombre de ejercicio o de sesión que empieza con `=`, `+`, `-` o `@`:** una hoja de cálculo lo interpretaría como fórmula. Ningún nombre del seed empieza así, y un plan restaurado pasa por las reglas del seed. Propuesta (decisión 7): no tocar el texto, porque los números negativos de la asistencia empiezan con `-` y anteponer `'` cambiaría los datos.
- **Un ejercicio que ya no está en el plan:** no puede pasar, porque el plan no se edita en v0.x y un respaldo con referencias rotas se rechaza (RN-DAT-11). Si llegara a pasar, es un error de datos y la promesa rechaza (aviso genérico).
- **Cambiar el nombre de un ejercicio** (plan editable, v1.0): el CSV usa el nombre actual, no el de cuando se hizo la serie.
- **Una serie hecha en otra zona horaria:** `completedAt` sale con su propio offset, tal como se guardó; `date` no cambia (ADR-0009).
- **Archivo grande:** unas 200 sesiones al año dan del orden de 2 000 filas, unos 200 KB. Se arma de una vez en memoria.
- **Cancelar la hoja de compartir:** igual que el respaldo (`AbortError` se ignora, spec 007 §7).

## 8. Preguntas abiertas

Ninguna que bloquee. Decisiones cerradas el 20-nov-2026 (conversación con el dueño del producto):

1. **Se hace ahora** (opción A) para cerrar la fase 3, y no se pasa a v1.0.
2. **Separador y decimal:** coma y punto, para Numbers, Sheets y Excel en es-MX.
3. **Columnas:** las de RN-DAT-14, con `exercise` como nombre en vez de ID, más `session`, `week` y `metric`. Sin `workoutId`, `exerciseId` ni `plannedFor`.
4. **Encabezados en inglés**, como en el contrato.
5. **Sin sesiones cerradas**, el botón sigue activo y el archivo trae solo los encabezados.
6. **`completedAt`** como `Instant` con offset, igual que el respaldo. **Ubicación:** dentro de "Respaldo", debajo de los dos botones.

Propuestas al escribir la spec, aprobadas con ella (20-nov):

7. **Sin protección contra fórmulas** (§7): los datos vienen del plan validado y la protección estropearía los números negativos.
8. **CRLF** como fin de línea (RFC 4180), también en la última línea; las hojas de cálculo leen las dos formas.
9. **Sin mensaje de éxito**, como "Descargar respaldo".
10. **Los tres botones se bloquean entre sí** mientras uno trabaja (AC-5), como en la spec 007 decisión 17 (a).
11. **`session` es `Workout.name`** sin "del viernes": la columna `date` ya dice cuándo se hizo.

Decidida al revisar la spec (20-nov):

12. **Versión en el nombre del archivo** (`gym-series-v1-AAAA-MM-DD.csv`), sin una columna ni una línea que estorben en la hoja de cálculo, para que el dueño del producto distinga a simple vista un archivo de otro formato. Es la versión del formato CSV, no `schemaVersion`: las columnas pueden cambiar sin que cambie la base, y al revés. Como P-2 decía literalmente "incluye `schemaVersion`", se enmendó la constitución (v1.1, [ADR-0013](../../adr/0013-version-de-formato-en-exportaciones.md)): toda exportación lleva la versión de su formato, el JSON dentro del archivo y el CSV en el nombre. Se descartaron eximir de la versión a las exportaciones que no se importan (debilitaría la regla para un futuro PDF u otro formato) y una columna `schemaVersion` repetida en cada fila.

## 9. Checklist de la constitución

- [x] **P-1:** solo exporta lo que ya está guardado; ninguna salida sugiere ejercicios.
- [x] **P-2:** solo lectura (AC-26); la exportación la hace el usuario (RNF-04). La versión del formato va en el nombre del archivo (decisión 12, RNF-09, P-2 enmendado en la constitución v1.1, ADR-0013).
- [x] **P-3:** RN-DAT-14 y los cambios de contrato en §5; sin `[POR DEFINIR]`.
- [x] **P-4:** `data` sigue sin importar módulos; el reparto entre `training`, `plan` y `data` lo fija el plan.
- [x] **P-5:** la construcción del CSV (filas, orden, escapado) es una función pura con pruebas.
- [x] **P-6:** ≥ 44 px, axe y 320 px (AC-27); bundle (AC-29).
- [x] **P-7:** un botón, un formato y sin opciones.
- [x] **P-8:** no entran datos de fuera; textos en español.
