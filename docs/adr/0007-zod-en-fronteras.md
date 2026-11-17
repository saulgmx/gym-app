# ADR-0007: Validación con Zod en las fronteras de entrada

- **Estado:** Reemplazado por ADR-0012
- **Fecha:** 16-nov-2026
- **Relacionado:** RF-01, RF-41, RNF-10, P-8

## Contexto

Entran datos no confiables por dos vías: el seed del plan y la importación de respaldos. Un JSON mal formado podría corromper la base o introducir un ejercicio de riesgo alto.

## Decisión

- Cada módulo define en `infrastructure/` los esquemas Zod de su seed y de su parte de la exportación, y deriva los tipos con `z.infer` cuando coinciden con el dominio.
- Se valida **solo en las fronteras** (seed, importación, migración de exportaciones antiguas). Dentro del sistema se confía en los tipos de TypeScript.
- El esquema del seed rechaza ejercicios `lumbarRisk: 'high'` en plantillas (P-1).
- Se usa Zod 4 (o `zod/mini` si el tamaño importa).

## Consecuencias

- (+) Errores de importación claros, con ruta del campo.
- (+) Un solo lugar por módulo para el formato externo.
- (−) Zod no entra en el bundle inicial si la importación se carga con `import()` diferido; el seed se valida en el arranque solo cuando la base está vacía.
