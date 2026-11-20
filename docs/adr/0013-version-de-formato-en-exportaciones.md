# ADR-0013: Versión de formato en todas las exportaciones

- **Estado:** Aceptado
- **Fecha:** 20-nov-2026
- **Relacionado:** enmienda P-2 de la constitución (v1.1); RNF-09, RF-40, spec 008 (decisión 12), modules/data.md (RN-DAT-01, RN-DAT-14)

## Contexto

P-2 dice "Toda exportación incluye `schemaVersion`". La regla se escribió pensando en el respaldo JSON (spec 007), que la app vuelve a importar y que necesita la versión para migrar o rechazar un archivo más nuevo (RN-DAT-02).

La spec 008 añade una segunda exportación: las series en CSV para una hoja de cálculo. El CSV no se importa, y una hoja de cálculo no tiene dónde guardar `schemaVersion` sin estorbar: una línea extra antes de los encabezados rompe la lectura en Numbers, Excel y Sheets, y una columna repetiría el mismo valor en cada fila. Además, el formato del CSV (columnas, orden, significado) puede cambiar sin que cambie el esquema de la base, y al revés, así que `schemaVersion` tampoco sería el número correcto.

El dueño del producto quiere poder distinguir a simple vista un archivo de otra versión del formato.

## Opciones

1. **No enmendar:** la spec 008 contradice la constitución, y la jerarquía de documentos no lo permite.
2. **Exigir `schemaVersion` solo en las exportaciones que la app importa:** resuelve el CSV, pero debilita la regla, porque cualquier exportación futura que no se importe (un PDF para el fisioterapeuta) quedaría sin versión.
3. **Una columna `schemaVersion` en el CSV:** cumple la letra, pero ensucia la hoja y usa un número que no describe el formato del CSV.
4. **Toda exportación lleva la versión de su propio formato, en el sitio que ese formato admite:** el JSON dentro del archivo y el CSV en el nombre.

## Decisión

Se elige la opción 4. P-2 pasa a decir:

> Toda exportación lleva la versión de su formato: el respaldo JSON, `schemaVersion` y la versión de cada módulo; los formatos para otras apps (CSV), en el nombre del archivo. Todo cambio de esquema tiene migración y prueba de ida y vuelta (RNF-09).

- El CSV de series se llama `gym-series-v<versión>-<AAAA-MM-DD>.csv`. La versión es una constante de `data`, independiente de `schemaVersion`, que empieza en `1` y sube cuando cambian las columnas, su orden o su significado (RN-DAT-14).
- Un formato nuevo para otras apps sigue la misma regla: versión propia en el nombre del archivo, salvo que el formato tenga un sitio natural para ella.
- RNF-09 se ajusta al mismo texto en `spec.md` v0.14.

## Consecuencias

- (+) La regla sigue valiendo para todas las exportaciones; ninguna queda sin versión.
- (+) El CSV se abre limpio en cualquier hoja de cálculo y la versión se ve en el nombre.
- (−) Si el usuario renombra el archivo, la versión se pierde. Se acepta: el CSV no se importa, así que la app nunca depende de ella.
- (−) Hay que recordar subir la versión del CSV al cambiar sus columnas; lo vigila la prueba que fija los encabezados de RN-DAT-14.
