# Plan técnico: <nombre de la feature>

**Spec:** `specs/NNN-<feature>/spec.md` · **Estado:** Borrador | Aprobado

## 1. Resumen de la solución

Dos o tres frases.

## 2. Módulos afectados

| Módulo | Cambio | ¿Cambia el contrato? |
|---|---|---|
| `training` | … | Sí: `modules/training.md` §4 |

## 3. Cambios de contrato

API, eventos, puertos o tablas que cambian. **Actualizar `modules/*.md` antes de escribir código.**

## 4. Datos

- Tablas o índices nuevos y versión de Dexie.
- Migración (`upgrade`) y cambio en el formato de exportación (versión del `DataPort`).

## 5. Flujo

Diagrama de secuencia (Mermaid) si involucra más de un módulo.

## 6. Decisiones

Alternativas consideradas. Si es estructural → ADR-nnnn.

## 7. Casos de borde por regla

Cada regla nueva o cambiada (`RN-<MOD>-nn`) con sus casos de borde y el resultado esperado. Parte de los casos límite de la spec (§7) y agrega los técnicos: vacíos, límites del rango, empates en el orden, datos borrados o de otra versión, zona horaria y medianoche. Se cierran antes de aprobar el plan y se copian al contrato junto con la regla. Un caso que aparezca al escribir la prueba es un hueco del plan: se agrega aquí y en el contrato antes del código.

| Regla | Caso | Resultado esperado |
|---|---|---|
| RN-XXX-nn | (a) … | … |

## 8. Estrategia de pruebas

| Criterio | Tipo de prueba | Archivo |
|---|---|---|
| AC-1 | Unitaria (dominio) | `modules/x/__tests__/…` |

## 9. Riesgos

- …

## 10. Checklist de la constitución

- [ ] P-1 · [ ] P-2 · [ ] P-3 · [ ] P-4 · [ ] P-5 · [ ] P-6 · [ ] P-7 · [ ] P-8
