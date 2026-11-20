# Spec: Respaldo (exportar e importar JSON)

**ID:** 007 · **Estado:** Aprobada · **Fecha:** 19-nov-2026
**Requerimientos cubiertos:** RF-40 (parte JSON), RF-41, RNF-01, RNF-04, RNF-05, RNF-09, RNF-10, CA-6 · **Fase:** 3 (spec §13), tercera parte
**Fuente de diseño:** sin tablero propio; reutiliza `Dialog`/`ConfirmDialog` de `shared` y los estilos de tarjeta de "Hoy"
**ADRs aplicados:** 0002, 0005, 0009, 0010, 0012

## 1. Problema y objetivo

Todos los datos viven solo en el IndexedDB del iPhone (RNF-04). Si Safari limpia el almacenamiento, se cambia de teléfono o se borra la app, se pierden el plan, las sesiones y el registro del dolor lumbar. El respaldo permite descargar todos los datos en un archivo JSON, guardarlo donde el usuario quiera (Archivos, iCloud, correo) y restaurarlo después en este u otro dispositivo, con validación y una vista previa antes de reemplazar nada (P-2).

## 2. Alcance

La fase 3 se reparte en 005 (Cierre), 005b (una sesión cerrada por día), 006 (historial) y esta (respaldo, módulo `data`).

- **Incluye:**
  - **Pantalla "Ajustes"** en `/ajustes`, como cuarta pestaña de la barra inferior (§8, decisión 1), con dos secciones: "Respaldo" y el aviso "la app no es un dispositivo médico" que P-1 exige en Ajustes.
  - **Descargar respaldo** (RF-40, parte JSON): un archivo con todos los datos, `schemaVersion`, `exportedAt` y la versión de cada módulo (RN-DAT-01). Se entrega con la hoja de compartir del sistema si existe; si no, como descarga (decisión 7).
  - **Restaurar respaldo** (RF-41): elegir un archivo, validarlo entero (forma con Zod y reglas de cada módulo, también las referencias entre módulos), ver una vista previa y confirmar. La importación **reemplaza todo** en una sola transacción (decisiones 3 y 6; RN-DAT-02 a 05).
  - **`dataPort`** de `plan` (catálogo, programa con `startDate`, bloques y plantillas; decisión 5), `training` (workouts y series) y `health` (entradas de dolor).
  - **Módulo `data`**: `exportAll`, `previewImport` y `commitImport` sobre los puertos registrados en `compose`.
  - **Ida y vuelta exacta** (RN-DAT-08, QS-04, CA-6).
- **No incluye:**
  - CSV de series (la otra mitad de RF-40): spec propia, corta, antes de cerrar el MVP (decisión 2).
  - Recordatorio de respaldo (RF-42), `dataMeta` y `getBackupStatus`: sin tabla nueva ni base v4.
  - Borrar todos los datos (RF-43).
  - Unidades, incrementos, umbral de dolor y tema (RF-50 a 52): Ajustes solo tiene "Respaldo" y el aviso.
  - Fusionar un respaldo con los datos actuales: restaurar reemplaza todo.
  - Respaldo automático, en la nube o programado (RNF-04: el respaldo lo hace el usuario).
  - Migraciones reales: no hay un formato anterior a la versión 1. Queda el camino (`fromVersion`) y el rechazo de versiones más nuevas.
  - Datos de `progression` (sugerencias, ajustes) y `app` (preferencias): no existen todavía; entran en el archivo cuando existan, con su propia versión.

## 3. Historias de usuario

- Como usuario, quiero descargar un respaldo de todo lo que he registrado y guardarlo en iCloud, para no perder meses de entrenamiento si Safari borra los datos.
- Como usuario que cambia de teléfono, quiero restaurar el respaldo en el teléfono nuevo y que "Hoy" siga en la misma semana del programa, con mi historial y mi dolor lumbar.
- Como usuario, antes de restaurar quiero ver qué trae el archivo y qué voy a perder, para no sobrescribir mis datos por error.
- Como usuario con espondilolistesis, quiero que la app no acepte un respaldo que meta un ejercicio prohibido en mi plan (P-1).

## 4. Criterios de aceptación

Las fechas suponen un programa que empieza el lunes 16-nov-2026 y que hoy es el jueves 19-nov-2026 a las 22:30 en la zona del dispositivo (UTC−6). El plan es el seed real: 36 ejercicios, 1 programa, 4 bloques y 11 plantillas.

**Datos de ejemplo** (de la spec 006):

| Sesión | Estado | `date` | `plannedFor` | Series hechas | Dolor |
|---|---|---|---|---|---|
| **L16**: Full body A | `completed` | lun 16-nov | lun 16-nov | las 10 de 10 | 2, sin señales |
| **M18**: Full body A del viernes | `completed` | mié 18-nov | vie 20-nov | 5 de 10 (en 3 de 7 ejercicios) | 5, "Hormigueo o adormecimiento" |

Más una sesión `discarded` del martes 17-nov con 2 series hechas, que no se cuenta en la vista previa pero viaja en el archivo.

"Archivo de ejemplo" es el que produce "Descargar respaldo" con estos datos.

### 4.1 Ajustes y navegación

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-1 | Cualquier pantalla con barra inferior | Miro la barra | Cuatro pestañas en este orden: "Hoy", "Historial", "Progreso" y "Ajustes", cada una con icono decorativo y ≥ 44 px; a 320 px caben sin desbordar |
| AC-2 | AC-1 | Toco "Ajustes" | Voy a `/ajustes`; la pestaña tiene `aria-current="page"`. `h1` "Ajustes", `<title>` "Ajustes · Gym" |
| AC-3 | `/ajustes` | Miro la pantalla | Sección `h2` "Respaldo" con el texto de §6.1 y los botones "Descargar respaldo" y "Restaurar respaldo"; después, la sección `h2` "Aviso" con el texto de §6.1 (P-1) |

### 4.2 Descargar respaldo

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-4 | Los datos de ejemplo; el navegador puede compartir archivos (`navigator.canShare({ files })`) | Toco "Descargar respaldo" | Se abre la hoja de compartir del sistema con un archivo `gym-respaldo-2026-11-19.json` de tipo `application/json` |
| AC-5 | El navegador no puede compartir archivos | Toco "Descargar respaldo" | El mismo archivo se descarga (enlace con `download`) |
| AC-6 | AC-4 | Cierro la hoja sin elegir destino | No pasa nada: sin error ni aviso |
| AC-7 | Los datos de ejemplo | Leo el archivo | `app` es `"gym-app"`, `schemaVersion` es `1`, `exportedAt` es `"2026-11-19T22:30:00-06:00"` y `modules` tiene exactamente `plan`, `training` y `health`, cada uno con `version: 1` y su `data` (formato de §5, RN-DAT-01) |
| AC-8 | AC-7 | Miro `modules.plan.data` | `exercises` (36), `programs` (1, con `startDate: "2026-11-16"`), `blocks` (4) y `templates` (11), iguales a lo guardado |
| AC-9 | AC-7 | Miro `modules.training.data` y `modules.health.data` | `workouts` con las 3 sesiones (también la `discarded`) y `sets` con todas sus filas, hechas o no; `painEntries` con las 2 entradas. Todos los campos tal como están guardados |
| AC-10 | Una sesión `in_progress` | Toco "Descargar respaldo" | Se descarga; el workout sale con `status: "in_progress"` y sus series (decisión 4) |
| AC-11 | Una base recién sembrada, sin sesiones | Toco "Descargar respaldo" | Se descarga con el plan y `workouts`, `sets` y `painEntries` vacíos |
| AC-12 | AC-7 | Abro el archivo en un editor | Es JSON con sangría de 2 espacios, legible a mano |

### 4.3 Restaurar: vista previa

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-13 | `/ajustes` | Toco "Restaurar respaldo" | Se abre el selector de archivos del sistema (`<input type="file">` que acepta `.json`) |
| AC-14 | Elijo el archivo de ejemplo en un dispositivo con 3 sesiones guardadas | Termina la revisión | Se abre un diálogo `h2` "¿Restaurar este respaldo?" con: "Respaldo del 19 de noviembre de 2026, 22:30", "2 sesiones · 15 series · 2 registros de dolor", "Del 16 al 18 de noviembre de 2026", "Plan: empieza el lunes 16 de noviembre de 2026" y, destacado, "Se reemplazarán todos los datos de este dispositivo: 3 sesiones guardadas, el plan y el dolor lumbar. No se puede deshacer." Botones "Reemplazar mis datos" y "Cancelar" |
| AC-15 | AC-14 | Miro las cifras | "sesiones" cuenta solo las `completed`; "series", las hechas de esas sesiones; la `discarded` no cuenta. El rango va de la `date` más antigua a la más reciente de las `completed` |
| AC-16 | Un archivo sin sesiones `completed` | Termina la revisión | En lugar de las cifras y el rango: "Sin sesiones guardadas" |
| AC-17 | Un archivo con una sesión `in_progress` | Termina la revisión | Además de las cifras: "Incluye una sesión en curso." |
| AC-18 | Un dispositivo sin sesiones `completed` | Termina la revisión | El texto destacado dice "Se reemplazarán el plan y los datos de este dispositivo. No se puede deshacer." |
| AC-19 | AC-14 | Toco "Cancelar" (o Escape) | El diálogo se cierra y nada cambia en la base |
| AC-20 | Elijo un archivo | La revisión tarda | El botón "Restaurar respaldo" muestra "Revisando…" y no se puede volver a tocar hasta que termine |
| AC-21 | Elijo el mismo archivo dos veces seguidas (cancelando entre medias) | Termina la segunda selección | Se revisa otra vez y se abre el diálogo |

### 4.4 Restaurar: confirmar

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-22 | AC-14 | Toco "Reemplazar mis datos" | La base queda exactamente con lo del archivo: el plan, las 3 sesiones y sus series, las 2 entradas de dolor; nada de lo anterior. El diálogo se cierra y la sección "Respaldo" muestra "Respaldo restaurado." (`role="status"`) |
| AC-23 | AC-22 | Voy a "Hoy" e "Historial" | "Hoy" muestra la semana 1 con L16 y la del viernes hechas; "Historial" lista M18 y L16, sin recargar (vistas en vivo) |
| AC-24 | AC-22 | Recargo la app | Los datos restaurados siguen; el seed no se vuelve a cargar (RN-PLN-14) |
| AC-25 | Un dispositivo recién instalado (solo el seed) | Restauro el archivo de ejemplo | "Hoy" queda en la semana del programa del archivo (`startDate` del archivo, decisión 5) |
| AC-26 | Base A con los datos de ejemplo | Exporto, restauro el archivo en una base B vacía y exporto B | Las dos bases son iguales tabla por tabla (comparación profunda), y los dos archivos tienen el mismo contenido salvo `exportedAt`; el orden de las claves de una fila puede cambiar (§8, decisión 13; RN-DAT-08, QS-04, CA-6) |
| AC-27 | AC-14, con la base que falla a mitad de la escritura (un puerto lanza) | Toco "Reemplazar mis datos" | No cambia nada en ninguna tabla, tampoco las del plan (RN-DAT-03); sale el aviso genérico (ADR-0010) |
| AC-28 | AC-14 | Entre la vista previa y la confirmación empiezo una sesión en otra pestaña, y confirmo | No se importa nada; sale el error de AC-33 (se comprueba otra vez dentro de la transacción) |

### 4.5 Restaurar: archivos rechazados

En todos los casos no se abre el diálogo, no cambia nada en la base y el mensaje sale en la sección "Respaldo" con `role="alert"`. Los textos están en §6.3.

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-29 | Un archivo de más de 10 MB | Lo elijo | "El archivo es demasiado grande para ser un respaldo de Gym." No se lee su contenido (RN-DAT-02) |
| AC-30 | Un archivo que no es JSON, o un JSON sin `app: "gym-app"` | Lo elijo | "Este archivo no es un respaldo de Gym." |
| AC-31 | `schemaVersion: 2`, o un módulo con `version: 2` | Lo elijo | "Este respaldo es de una versión más nueva de la app. Actualízala e inténtalo de nuevo." |
| AC-32 | Un respaldo con un dato que no pasa el esquema (por ejemplo, un `level` de 11, una clave desconocida, un módulo que falta o uno que sobra) | Lo elijo | "El respaldo está dañado o incompleto. No se cambió nada." |
| AC-33 | Una sesión `in_progress` en este dispositivo | Elijo el archivo de ejemplo | "Tienes una sesión en curso. Termínala o descártala antes de restaurar un respaldo." (RN-DAT-05) |
| AC-34 | Un respaldo cuyo plan incluye un ejercicio `lumbarRisk: 'high'` (en el catálogo o en una plantilla) | Lo elijo | "Este respaldo incluye un ejercicio que la app no permite por tu espalda. No se cambió nada." (P-1, RN-PLN-07) |
| AC-35 | Un respaldo cuyo plan no cumple las reglas del seed (por ejemplo, bloques con huecos, RN-PLN-15 (b)) | Lo elijo | El mensaje de AC-32 |
| AC-36 | Referencias rotas entre módulos: una serie de un workout que no está, un workout con un ejercicio que no está en el plan, o una entrada de dolor de un workout que no está | Lo elijo | El mensaje de AC-32 (decisión 6) |
| AC-37 | Un respaldo con dos workouts `in_progress` o dos entradas de dolor para el mismo workout | Lo elijo | El mensaje de AC-32 (RN-TRN-01, RN-HLT-09) |

### 4.6 Datos tolerados

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-38 | Un respaldo con dos sesiones `completed` el mismo `date` (dato anterior a RN-TRN-27) | Lo restauro | Se acepta y se restaura igual; el historial muestra las dos (spec 006 AC-11) |
| AC-39 | Un respaldo con una sesión `completed` sin entrada de dolor (dato roto que la spec 006 AC-32 tolera) | Lo restauro | Se acepta; el historial muestra "Sin registro" |

### 4.7 Transversales

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-40 | `/ajustes` y el diálogo de vista previa | Corre axe en Playwright | Sin violaciones WCAG 2.2 A/AA; cada control ≥ 44 × 44 px; nada desborda a 320 px |
| AC-41 | Sin conexión, con la app ya abierta una vez | Descargo y restauro un respaldo | Todo funciona igual (RNF-01) |
| AC-42 | El build de producción | Corre `size-limit` | El JS inicial sigue < 200 KB gzip (QS-10) |
| AC-43 | Sin cambios de esquema | Abro la versión nueva con una base v3 | La base sigue en v3; no hay migración (P-2) |
| AC-44 | La CSP de producción (`vercel.json`) | Descargo un respaldo en `vite preview` | Sin violaciones de CSP en la consola |

## 5. Reglas de negocio aplicables

Del contrato [`modules/data.md`](../../modules/data.md) v1.0: RN-DAT-01 a 04 y 08. Del contrato [`modules/plan.md`](../../modules/plan.md): RN-PLN-07, 14, 15, 24 y 25. De [`modules/training.md`](../../modules/training.md): RN-TRN-01 y 27. De [`modules/health.md`](../../modules/health.md): RN-HLT-09.

Cambios a reglas existentes y reglas nuevas (pasan al contrato `data` v1.1 al aprobar):

| ID | Regla |
|---|---|
| RN-DAT-02 | (sin `[PROPUESTO]`) **Revisar un archivo**, en este orden, y el primer fallo gana: tamaño ≤ 10 MB sin leerlo (`data/file-too-large`); JSON válido con `app === 'gym-app'` (`data/not-gym-app-file`); `schemaVersion` y la versión de cada módulo ≤ las actuales (`data/unsupported-version`); el sobre con exactamente los módulos registrados; cada parte se migra desde su versión y se valida con su puerto, en orden de `order` (`data/invalid-module-data` con `details.module` y la causa); sin sesión en curso local (`data/workout-in-progress`). Nada se escribe al revisar. |
| RN-DAT-05 | (sin `[PROPUESTO]`) Restaurar no se permite si en el dispositivo hay un workout `in_progress`: se comprueba al revisar y otra vez dentro de la transacción de `commitImport` (AC-28). Exportar siempre se permite. |
| RN-DAT-09 | **Exportar** escribe todas las filas de cada tabla de cada puerto, tal como están guardadas (los objetos del dominio), en un JSON con sangría de 2 espacios. `exportedAt` es `clock.now()`; el nombre es `gym-respaldo-<LocalDate de hoy>.json`. |
| RN-DAT-10 | **Restaurar reemplaza todo:** dentro de una transacción `rw` sobre las tablas de todos los puertos, cada puerto vacía sus tablas y escribe las del archivo, en orden de `order`. Las tablas quedan exactamente con el contenido del archivo. |
| RN-DAT-11 | **Referencias entre módulos:** un respaldo se rechaza si una serie apunta a un workout que no está, si un ítem de un workout o una serie usa un ejercicio que no está en el plan del archivo, o si una entrada de dolor apunta a un workout que no está. Se valida contra el contenido del archivo, no contra la base local. |
| RN-DAT-12 | **Datos tolerados:** al validar no se comprueban RN-TRN-27 (una sesión cerrada por día) ni RN-TRN-06 (cerrar exige dolor): dos `completed` con el mismo `date` y un `completed` sin entrada de dolor se aceptan, como ya los muestra el historial (spec 006 AC-11 y AC-32). Lo que la app nunca tolera (dos `in_progress`, dos entradas de dolor por workout, ejercicios `high`) se rechaza. |
| RN-DAT-13 | **Vista previa** (`ImportPreview`): `exportedAt`, `schemaVersion`, sesiones `completed` y sus series hechas, entradas de dolor, rango de `date` de las `completed` (`null` sin ninguna), si trae un workout `in_progress`, `startDate` del programa, y las sesiones `completed` que hay hoy en el dispositivo. |

Cada puerto, además de su esquema Zod (RN-PLN-24 para el plan, y esquemas nuevos para `training` y `health`), aplica sus reglas de dominio al validar: `plan` las del seed (RN-PLN-07, 15 y 19) y un solo programa (RN-PLN-25); `training`, RN-TRN-01 sobre el archivo e IDs únicos; `health`, RN-HLT-09. El mecanismo de RN-DAT-11 (cómo un puerto ve las partes ya validadas de otros sin romper las fronteras) lo fija el plan técnico.

Cambios de documentos hechos al aprobar (19-nov):

| Documento | Cambio |
|---|---|
| `spec.md` §7.1 y §7.2 (v0.13) | Barra con Hoy, Historial, Progreso y Ajustes (v1.0 añade Plan). La fila "Ajustes (v1.0)" pasa a "Ajustes": en la fase 3, respaldo (descargar y restaurar) y el aviso médico; unidades, incrementos, umbral y borrar datos en v1.0 (spec 007) |
| `modules/data.md` (v1.1) | §2 sin `dataMeta` hasta RF-42; §4 con el formato de esta spec (sin `progression` ni `app`, `health` solo `painEntries`); §5 solo `registerDataPort`, `exportAll`, `previewImport` y `commitImport`, y `ImportPreview` según RN-DAT-13; RN-DAT-02 y 05 sin `[PROPUESTO]`; RN-DAT-09 a 13; códigos de §7 sin `wrong-confirmation` hasta RF-43. La firma exacta la fija el plan |
| `modules/plan.md`, `training.md` y `health.md` | `dataPort` pasa de "más adelante" a la API (la forma de sus datos, en el plan) |
| `architecture.md` §6.5 | Sin cambios de fondo; `onImported` no hace nada hasta la fase 4 (`progression.rebuild`) |

## 6. UX

### 6.1 Ajustes (`/ajustes`)
- Con barra inferior; pestaña "Ajustes" con icono de engranaje decorativo. `h1` "Ajustes".
- **Respaldo** (`h2`): "Tus datos solo están en este teléfono. Descarga un respaldo de vez en cuando y guárdalo en Archivos, iCloud o tu correo." Debajo, "Descargar respaldo" (botón principal) y "Restaurar respaldo" (botón secundario), cada uno ≥ 44 px y a lo ancho. Debajo de los botones, la zona de mensajes (§6.3).
- **Aviso** (`h2`): "Esta app no es un dispositivo médico. Los avisos sobre el dolor lumbar son orientativos y no sustituyen la valoración de tu traumatólogo o fisioterapeuta." `[PROPUESTO]` como los demás textos de salud, hasta T24 de la spec 005.

### 6.2 Restaurar
- "Restaurar respaldo" abre un `<input type="file" accept="application/json,.json">` oculto (el botón visible es el control con etiqueta). Al elegir, se revisa; el botón dice "Revisando…" y queda `disabled` mientras tanto (AC-20). Al terminar, el valor del input se limpia para poder elegir el mismo archivo otra vez (AC-21).
- **Vista previa** en el `Dialog` de `shared`, anclado abajo como `ConfirmDialog`: título, las líneas de AC-14 y el texto destacado en ámbar (`--warn`), y los botones "Reemplazar mis datos" (peligroso, como "Descartar sesión") y "Cancelar". El foco entra en "Cancelar". Escape y el fondo cierran sin hacer nada.
- **Al confirmar:** "Reemplazar mis datos" muestra "Restaurando…" y se desactiva; al terminar, el diálogo se cierra y sale "Respaldo restaurado." en la sección. La pantalla no navega.
- Fechas con los formatos existentes (`format-date.ts`), coma decimal donde aplique; "1 sesión", "1 serie" y "1 registro de dolor" en singular.

### 6.3 Mensajes

| Causa | Texto | Rol |
|---|---|---|
| Restaurado | "Respaldo restaurado." | `status` |
| `data/file-too-large` | "El archivo es demasiado grande para ser un respaldo de Gym." | `alert` |
| `data/not-gym-app-file` | "Este archivo no es un respaldo de Gym." | `alert` |
| `data/unsupported-version` | "Este respaldo es de una versión más nueva de la app. Actualízala e inténtalo de nuevo." | `alert` |
| `data/invalid-module-data` | "El respaldo está dañado o incompleto. No se cambió nada." | `alert` |
| `data/invalid-module-data` por `plan/high-risk-exercise` | "Este respaldo incluye un ejercicio que la app no permite por tu espalda. No se cambió nada." | `alert` |
| `data/workout-in-progress` | "Tienes una sesión en curso. Termínala o descártala antes de restaurar un respaldo." | `alert` |

Un mensaje nuevo reemplaza al anterior; elegir otro archivo o descargar un respaldo los borra. Los textos viven en el mapa de `app/errors/messages.ts` (ADR-0010).

### 6.4 Estados generales
- **Errores inesperados** (la base lanza al leer o escribir): aviso genérico (ADR-0010); al restaurar, la transacción garantiza que nada cambió.
- **Sin conexión:** igual (RNF-01). La hoja de compartir puede ofrecer destinos que necesiten red; eso es del sistema.
- **Textos** en español; objetivos ≥ 44 px; contraste AA con los tokens existentes; sin colores nuevos.

## 7. Casos límite

- **Cancelar la hoja de compartir:** `navigator.share` rechaza con `AbortError`; se ignora (AC-6). Cualquier otro rechazo intenta la descarga normal.
- **Respaldo con un plan distinto del seed actual** (por ejemplo, de una versión futura que cambió un ejercicio): se restaura el plan del archivo; el seed no se vuelve a aplicar porque la base no está vacía (RN-PLN-14).
- **`startDate` del archivo en el futuro o muy atrás:** se acepta; "Hoy" dice "fuera del programa" como con cualquier fecha (RN-PLN-01).
- **Respaldo exportado durante una sesión y restaurado otro día:** la sesión `in_progress` entra y "Hoy" ofrece "Continuar" con su fecha (spec 002).
- **Archivo exportado en otra zona horaria:** `exportedAt` se muestra en la hora local del dispositivo (ADR-0009); las `LocalDate` no cambian.
- **Dos pestañas restaurando a la vez:** las transacciones se serializan; gana la última. Las vistas en vivo de las otras pestañas se actualizan.
- **Archivo grande pero válido (< 10 MB):** unas 200 sesiones al año ocupan del orden de 1 MB; la revisión lee todo de una vez.
- **La app se cierra a mitad de restaurar:** IndexedDB aborta la transacción; queda la base anterior (RN-DAT-03).
- **Almacenamiento lleno al restaurar** (`QuotaExceededError`): la transacción falla y nada cambia; aviso genérico. El aviso específico de almacenamiento lleno (architecture §7.7) no entra aquí.

## 8. Preguntas abiertas

Ninguna que bloquee. Decisiones cerradas el 19-nov-2026 (conversación con el dueño del producto):

1. **Entrada:** cuarta pestaña "Ajustes" (`/ajustes`), con "Respaldo" y el aviso médico de P-1.
2. **CSV fuera:** spec propia antes de cerrar el MVP (RF-40 es P0).
3. **Restaurar reemplaza todo:** sin fusionar.
4. **Sesión en curso:** exportar siempre; restaurar bloqueado con una sesión en curso local (RN-DAT-05); si el archivo trae una, entra.
5. **El plan va completo** en el respaldo y se valida con las reglas del seed, incluido RN-PLN-07.
6. **Referencias rotas entre módulos:** se rechaza el archivo entero (RN-DAT-11); el mecanismo lo fija el plan.
7. **Entrega:** hoja de compartir si el navegador comparte archivos; si no, descarga. Nombre `gym-respaldo-AAAA-MM-DD.json`.
8. **Vista previa y límites:** fecha, cifras, rango, inicio del plan y lo que se reemplaza, con confirmación; 10 MB; versiones más nuevas se rechazan.

Propuestas al escribir la spec, aprobadas con ella (19-nov):

9. **Datos tolerados** (RN-DAT-12): dos `completed` el mismo día y un `completed` sin dolor se aceptan. Rechazarlos exigiría comprobar dos reglas más al importar (P-7), contradiría lo que el historial ya muestra y dejaría sin arreglo un respaldo así, porque borrar sesiones no existe todavía. Las sesiones de prueba de la semana del 16-nov en el iPhone no cuentan como motivo: el dueño del producto las limpiará borrando los datos del sitio (RF-43 sigue en v1.0).
10. **Las `discarded` viajan en el archivo** (AC-9), para que la ida y vuelta sea exacta (RN-DAT-08), aunque no se cuenten en la vista previa.
11. **Texto del aviso médico** de §6.1, `[PROPUESTO]` hasta T24 de la spec 005.
12. **Después de restaurar no se navega:** se queda en Ajustes con "Respaldo restaurado.".

Decisiones durante la implementación (19-nov):

13. **AC-26 compara el contenido, no el texto** (T13): al importar, cada fila se guarda con las claves en el orden del esquema, así que el segundo archivo puede ordenar las claves de otra forma (por ejemplo, `finishedAt` junto a `startedAt`). Los datos son los mismos; RN-DAT-08 se reformuló en el contrato `data` v1.5 (decisión 5).
14. **Formatos de la vista previa** (T14): (a) la fecha y hora del respaldo se arman en dos partes (la fecha con `Intl`, la hora a mano) para que salga "19 de noviembre de 2026, 22:30" en todos los navegadores (`Intl` escribe "a las 22:30" en Node, y otros motores difieren), con la hora en 24 h sin cero inicial ("8:05"); (b) `exportedAt` se muestra en la hora del dispositivo y las `LocalDate` a medianoche UTC, como el resto de la app; (c) un rango de un solo día es "El 16 de noviembre de 2026"; (d) el año va solo al final si es el mismo ("Del 30 de noviembre al 6 de diciembre de 2026") y en las dos partes si cambia ("Del 28 de diciembre de 2026 al 3 de enero de 2027"); (e) cifras en singular con 1 y en plural con 0, y con 0 sesiones guardadas solo "Sin sesiones guardadas" (AC-16); (f) el aviso de reemplazo con "1 sesión guardada" en singular, y el texto de AC-18 con 0.
15. **Entrega del archivo** (T15): (a) la hoja de compartir solo si existe `canShare` y acepta el archivo; con `share` pero sin `canShare`, descarga; (b) `deliverFile` devuelve `'shared'`, `'cancelled'` o `'downloaded'` (la página no muestra mensajes); (c) el enlace de descarga se añade al documento, se pulsa y se quita; (d) la URL del archivo se libera a los 60 s, no de inmediato (liberarla enseguida puede cortar la descarga en Safari). Riesgo para T20: Safari solo abre la hoja dentro del gesto del usuario y `exportAll` es asíncrono; un `NotAllowedError` pasa a la descarga, que en iOS abre una vista previa con botón de compartir.
16. **Página de Ajustes** (T16): (a) el `h1`, el texto de "Respaldo" y la sección "Aviso" salen enseguida; los dos botones esperan a que la base esté lista (`ready`, como las demás páginas); (b) mientras se prepara el archivo, "Descargar respaldo" dice "Preparando respaldo…" y queda `disabled` hasta que se cierra la hoja de compartir o empieza la descarga; después no se muestra nada (AC-6); (c) si exportar falla, el botón vuelve a su estado normal y el texto genérico (ADR-0010) sale en la zona de mensajes de la sección con `role="alert"`, como en el Cierre (spec 005 AC-25): se captura ahí para que el aviso global no lo repita; (d) "Restaurar respaldo" se pinta en T16 y T17 lo conecta en el mismo PR.
17. **Restaurar** (T17): (a) mientras se revisa un archivo o se restaura, "Descargar respaldo" también queda `disabled`, y mientras se prepara una descarga, "Restaurar respaldo" también, para que no se crucen una exportación y una importación; (b) cerrar el selector sin elegir archivo no hace nada; (c) si la revisión falla de forma inesperada, el botón vuelve y sale el texto genérico en la sección, como en la decisión 16 (c); (d) al confirmar, un error con código (la sesión en curso de AC-28) cierra el diálogo y su texto sale en la sección; un fallo inesperado (AC-27) también lo cierra y sale el texto genérico, sin cambios en la base; (e) el texto de P-1 solo cuando la causa es `plan/high-risk-exercise`; cualquier otra causa de `data/invalid-module-data` da el de AC-32; (f) al cancelar o al terminar de restaurar, el foco vuelve a "Restaurar respaldo".

## 9. Checklist de la constitución

- [x] **P-1:** un respaldo con un ejercicio `high` se rechaza (AC-34, RN-PLN-07); el aviso médico entra en Ajustes.
- [x] **P-2:** vista previa y confirmación antes de reemplazar; todo o nada en una transacción (AC-27); `schemaVersion` y versión por módulo (AC-7); ida y vuelta exacta (AC-26); sin cambio de esquema (AC-43).
- [x] **P-3:** reglas nuevas y cambios de contrato en §5; sin `[POR DEFINIR]`; un `[PROPUESTO]` de texto de salud ligado a T24.
- [x] **P-4:** `data` no importa módulos: trabaja con los `DataPort` que registra `compose`; cada puerto escribe solo sus tablas.
- [x] **P-5:** validación y vista previa como funciones puras en `domain` de cada módulo y de `data`, con pruebas.
- [x] **P-6:** ≥ 44 px, axe y 320 px (AC-40); bundle (AC-42).
- [x] **P-7:** sin CSV, recordatorio, borrar todo, fusión ni `dataMeta`.
- [x] **P-8:** todo el archivo se valida con Zod y las reglas del dominio antes de escribir (RNF-10); textos en español.
