# Tareas: Exportar las series a CSV

**Plan:** `specs/008-csv/plan.md`

Cada tarea es pequeña (≤ 1-2 h), deja el CI verde y tiene una verificación concreta.

- **Prueba primero:** en RN-TRN-31 (dominio y lectura de `training`), RN-DAT-14 (dominio de `data`) y `exportSeriesCsv`, la tarea de pruebas va antes que la de implementación. El commit en rojo se queda local y se sube con la tarea que lo pone en verde. En el kernel y en `app`, las pruebas se escriben primero dentro de la misma tarea.
- **Antes de escribir pruebas:** revisar si el contrato deja comportamientos sin definir. Si los deja, proponerlos y, con tu aprobación, escribirlos en los docs antes del código.
- **Mutaciones:** tras cada prueba en verde, romper el código a propósito y ver que falla la prueba correcta.

**Responsable:** C = Claude Code · U = usuario (requiere tu cuenta, tu dispositivo o una decisión tuya).

## A. Kernel y dominio

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T1 | `SeriesRow` en `kernel/data-port.ts` y `DataPort.seriesRows?()` en lugar de `csv?()`; exportar `SeriesRow` por el `index.ts` del kernel (`shared.md` §2) | `shared/kernel` | Pruebas de tipos primero (`data-port.test-d.ts`): `seriesRows` es opcional y devuelve `Promise<SeriesRow[]>`; `csv` ya no existe; un puerto sin `seriesRows` compila. `npm run typecheck`; mutaciones de tipos detectadas. **Hecho:** también `SeriesRow` con exactamente las 11 columnas y sus tipos (`toEqualTypeOf`); 10/10 mutaciones de tipos detectadas (también por `tsc -b`) | — | C | ☑ |
| T2 | Pruebas de RN-TRN-31 (`training/__tests__/series.test.ts`, `seriesRows(states, exercises)` con las sesiones de la spec §4): solo `completed` y `done` (M17 y las no hechas de M18 no salen); orden por `date`, `startedAt`, `order` del ítem y `setNumber`; la extra de Fondos con el `order` de su ítem; Jalón al pecho en lugar de Dominadas; asistencia `-20`; Dead bug y Plancha con su `metric`; `week: null` fuera del programa; `completedAt: null` si falta; mismo `date` y `startedAt` → por `id`; sin sesiones → `[]`; una serie sin ítem o con un ejercicio que falta lanza citando RN-TRN-31. **Hecho:** antes, los casos (f) a (h) en `training.md` v1.33 (forma de `exercises`, solo se comprueban las filas que salen, no modifica la entrada); 15 pruebas, con `startedAt` de distinto offset y el mismo instante escrito de dos formas | `training/domain` | Pruebas en rojo | RN-TRN-31; AC-10, AC-11, AC-13 a AC-17, AC-19, AC-20, AC-23 a AC-25 | C | ☑ |
| T3 | Implementar `seriesRows` en `training/domain/series.ts` | `training/domain` | T2 en verde; `npm run lint`; mutaciones detectadas (sin filtrar `done`, `startedAt` comparado como texto, `plannedFor` en vez de `date`, `order` del primer ítem para todas). **Hecho:** `SeriesExercise` en `domain/types.ts`; 17/17 mutaciones detectadas (también sin desempate por `id`, sin ordenar por `setNumber`, nombre del principal, tolerar datos rotos, comprobar todas las series, modificar la entrada, rellenar `completedAt`, `week` o el signo); cobertura 100 % | Ídem | C | ☑ |
| T4 | Pruebas de RN-DAT-14 (`data/__tests__/csv.test.ts`): BOM al principio; línea de encabezados exacta; CRLF en cada línea, también la última; la fila de AC-12; `62.5`, `100`, `-20`, `0` y `-0` → `0`; `null` → vacío; `true`/`false`; comillas solo con `,`, `"`, CR o LF, y `"` duplicada (AC-21); sin filas → BOM y encabezados; `csvFilename('2026-11-25')` → `gym-series-v1-2026-11-25.csv`. Prueba de tipos (`csv.test-d.ts`): `CSV_COLUMNS` tiene exactamente las claves de `SeriesRow`. **Hecho:** 17 pruebas y 2 de tipos | `data/domain` | Pruebas en rojo | RN-DAT-14; AC-8, AC-9, AC-12, AC-18, AC-21, AC-23 | C | ☑ |
| T5 | Implementar `CSV_VERSION`, `CSV_COLUMNS`, `seriesCsv` y `csvFilename` en `data/domain/csv.ts` | `data/domain` | T4 en verde; `npm run lint`; mutaciones detectadas (LF en vez de CRLF, sin BOM, comillas siempre o nunca, sin duplicar `"`, `toFixed`). **Hecho:** 7/7 mutaciones detectadas (también sin el CRLF de la última línea) | Ídem | C | ☑ |

**Punto de control A:** PR "csv: kernel and domain". No cambia nada visible.

## B. Puerto, servicio y composición

Necesita A.

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T6 | Pruebas de la lectura (`training/__tests__/series-port.test.ts`, `fake-indexeddb` y un `PlanReader` falso que cuenta sus llamadas): `dataPort.seriesRows()` da las filas de los datos guardados; `getExercises` se llama una vez con los IDs sin repetidos y no se llama sin series; la base no cambia. **Hecho:** antes, los casos (i) y (j) en `training.md` v1.34 (orden de los IDs libre; un rechazo de la base o de `plan` llega tal cual); 7 pruebas, también sin series que salgan (descartada, en curso, `completed` sin hechas) y Dominadas en las `options` sin pedirse | `training/application`, `infrastructure` | Pruebas en rojo | RN-TRN-31 (c), (i), (j); AC-23, AC-26 | C | ☑ |
| T7 | Implementar `application/series.ts` (lee con `findCompletedStates` y `getExercises`, llama a `seriesRows`) y conectarla al puerto desde `index.ts` (`createTrainingDataPort(db, seriesRows)`) | `training` | T6 en verde; las pruebas del respaldo (RN-TRN-30) siguen en verde; `npm run lint`; mutaciones detectadas (una llamada por serie, llamada sin series). **Hecho:** `createSeriesReader` en `application/series.ts`; el repositorio se crea una vez y lo comparten el servicio y el puerto; 8/8 mutaciones detectadas (también con repetidos, pedir las no hechas, tragar o envolver el error de `plan`, tragar el de Dexie y el puerto sin `seriesRows`); el filtro de `completed` se quitó por redundante (`findCompletedStates` ya filtra; su mutación era equivalente) | Ídem | C | ☑ |
| T8 | Pruebas de `exportSeriesCsv` (`data/__tests__/data-service.test.ts`, puertos falsos): ningún puerto con `seriesRows` o dos → lanza; un puerto que rechaza → rechaza; nombre `gym-series-v1-<hoy>.csv`, `Blob` `text/csv` con el texto de `seriesCsv` y el BOM en sus bytes (`EF BB BF`); no abre transacción. **Hecho:** 10 pruebas, también sin puertos, el único puerto con `seriesRows` aunque no sea el primero por `order`, dos puertos sin leer ninguno, sin filas (AC-23) y la base sin cambios (AC-26); los bytes se comparan con `arrayBuffer`, porque `blob.text()` quita el BOM | `data/application` | Pruebas en rojo | RN-DAT-14; AC-2, AC-8, AC-23, AC-26 | C | ☑ |
| T9 | Implementar `exportSeriesCsv` en el servicio y en `DataApi` | `data` | T8 en verde; `npm run lint`; mutaciones detectadas (usa el primer puerto aunque haya dos, nombre con `exportedAt`, tipo `application/json`). **Hecho:** implementada por Qwen en modo no interactivo (ADR-0014), intento 2/3: el 1 falló en lint (`unbound-method` en una línea que sugería el brief); 8/8 mutaciones detectadas (también el primero por `order`, abrir transacción, envolver el rechazo, sin BOM y leer los dos puertos antes de lanzar). En T8 se corrigió la comparación de bytes (`Uint8Array` de jsdom y de Node no son `toEqual`) | Ídem | C | ☑ |
| T10 | Prueba con los módulos reales (`app/__tests__/series-csv.test.ts`, `compose` sobre `fake-indexeddb`): los datos de la spec §4 escritos por la API dan el CSV esperado línea a línea, con los nombres del seed real; exportar no cambia ninguna tabla | `app` | Pruebas primero; `npm run lint`; una mutación de `compose` (puerto de `training` sin `seriesRows`) detectada. **Hecho** en el PR #73 | AC-10 a AC-16, AC-26 | C | ☑ |

**Punto de control B:** PR "csv: port and service". No cambia nada visible; el CSV funciona desde las pruebas.

## C. Ajustes

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T11 | `BackupSection` (plan §6.6): párrafo "Para abrir tus series en una hoja de cálculo.", botón "Exportar series (CSV)" y estado `exporting` ("Preparando CSV…"); los tres botones se bloquean entre sí; `deliverFile` con `File` `text/csv`; error inesperado en la sección; textos en `settings/texts.ts`. Correr los E2E en local antes del PR (la página es compartida) | `app/pages/settings` | Pruebas primero (`settings-page.test.tsx`, `deliverFile` simulado): AC-1 (orden y zona de mensajes al final), AC-5 en los dos sentidos, AC-6, AC-7, el `File` con nombre y tipo; stylelint; mutaciones detectadas (sin bloquear "Restaurar respaldo", tipo `application/json`, mensaje sin borrar). **Hecho:** 8 pruebas en `settings-page.test.tsx` y 2 en `settings-restore.test.tsx` ("Revisando…" bloquea el CSV; el CSV borra "Respaldo restaurado."); la de AC-3 de la 007 ahora espera tres botones. El párrafo y el botón van en un segundo grupo (`.csvText`, 1 rem arriba), con la clase `.secondary`. 11/11 mutaciones detectadas (también sin bloquear "Descargar respaldo" ni el propio CSV, sin volver a `idle` tras un error, sin "Preparando CSV…", volver a `idle` antes de entregar, sin el aviso, `exportAll` en vez de `exportSeriesCsv` y clase `.primary`). La prueba "mientras se prepara un respaldo" espera a `deliverFile`: si no, el `exportAll` tardío llegaba al `deliverFile` de la prueba siguiente con la suite completa. E2E en local: 146/146 | AC-1 a AC-7 | C | ☑ |
| T12 | Medir el bundle (`npm run build` y `npm run size`) | raíz | `npm run size` < 200 kB; la medición se anota en el plan §6.7. **Hecho:** 177.49 kB gzip (+0.83 kB) | AC-29 | C | ☑ |

**Punto de control C:** PR "csv: settings button". Tras C, el CSV funciona en la app.

## D. Verificación y cierre

| # | Tarea | Módulo / capa | Verificación | Cubre | Resp. | Estado |
|---|---|---|---|---|---|---|
| T13 | E2E en `tests/e2e/backup.spec.ts` (`describe('spec 008 …')`, con `withoutShare`): cerrar una sesión, "Exportar series (CSV)", `waitForEvent('download')` y leer el archivo (nombre, BOM, encabezados y la fila de una serie); lo mismo sin conexión (AC-28); sin violaciones de CSP (AC-30). En `a11y.spec.ts`, `/ajustes` ya incluye el botón: comprobar que sigue sin violaciones a tamaño normal y a 320 px | `tests/e2e` | `npm run test:e2e` en local y en CI, Chromium y WebKit; las nuevas, estables con `--grep "spec 008" --repeat-each=5`. **Hecho:** 2 pruebas (con red y sin conexión) que comprueban el nombre, el BOM, el CRLF final y el archivo completo (encabezados y la serie del lunes 16); en `a11y.spec.ts`, la prueba de Ajustes de la 007 ahora exige que el botón se vea, para que axe y el ancho lo incluyan. 20/20 con `--repeat-each=5`; 5/5 mutaciones E2E detectadas (sin BOM, nombre sin versión, sin el CRLF final, `exportAll` en vez de `exportSeriesCsv`, botón oculto). E2E: 150 | AC-3, AC-27, AC-28, AC-30 | C | ☑ |
| T14 | Tras el despliegue: en el iPhone (PWA instalada), con al menos una sesión cerrada, "Exportar series (CSV)" → la hoja de compartir → "Guardar en Archivos"; abrir el archivo en Numbers. En el Mac, abrirlo en Numbers y en Google Sheets. También en modo avión | producción | La hoja de compartir sale (o, si iOS no comparte `text/csv`, la vista previa con botón de compartir); cada columna en su celda, acentos bien y `weightKg` como número. **Hecho (20-nov):** en el iPhone, en Numbers del Mac y en Google Sheets, también en modo avión, sin problemas. Los acentos se comprobaron con otra rutina (aún no había series de Jalón al pecho) | AC-2, AC-4, AC-22, AC-28 (manual) | U + C | ☑ |
| T15 | Actualizar `handoff.md` (fase 3 cerrada) y marcar la spec y el plan como implementados | docs | Revisión. **Hecho** en el PR de cierre | — | C | ☑ |

**Punto de control D:** PR "csv: e2e and handoff".

## Modelo recomendado por tarea

Guía para elegir el modelo de Claude Code en cada tarea. Si el costo o los límites de uso no importan, Opus en todas es lo más simple y reduce el retrabajo.

| Punto | Modelo | Por qué |
|---|---|---|
| A (T1-T5) | Sonnet en T1, T4 y T5; Opus en T2 y T3 | El orden de las filas y los casos de borde de RN-TRN-31 |
| B (T6-T10) | Sonnet en T8 y T9; Opus en T6, T7 y T10 | La conexión del puerto con `plan` y la prueba con los módulos reales |
| C (T11-T12) | Opus en T11; Sonnet en T12 | La máquina de estados compartida con el respaldo |
| D (T13-T15) | Opus en T13; Sonnet en T15 | Leer la descarga en WebKit; T14 es tuya |

## Notas

- **Orden:** A va primero; dentro de A, `training` (T2-T3) y `data` (T4-T5) son independientes, pero los dos necesitan T1. B necesita A; C necesita B; D necesita C.
- **Usabilidad entre PR:** tras A y B no cambia nada visible. Tras C, el botón funciona.
- **T1 cambia una prueba de la spec 007:** `data-port.test-d.ts` comprobaba que `csv` era opcional; ahora comprueba `seriesRows`.
- **T14:** si iOS no ofrece la hoja de compartir para el `.csv`, no es un error de la app (plan §8): la descarga abre la vista previa, que también se puede compartir. Se anota en la spec §8.
