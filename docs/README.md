# Documentación: cómo trabajamos (Spec-Driven Development)

Este proyecto sigue **Spec-Driven Development (SDD)**: primero se escribe la especificación, luego el diseño técnico, luego las tareas, y el código se deriva de ellas. Ningún código entra sin una spec o un contrato que lo justifique.

## Mapa de documentos

| Documento | Responde a | Cambia |
|---|---|---|
| [`constitution.md`](constitution.md) | ¿Qué reglas no se negocian nunca? | Casi nunca (enmienda explícita) |
| [`spec.md`](spec.md) | ¿Qué hace la app y por qué? (requerimientos, reglas de negocio, UX, criterios de aceptación) | Por versión de producto |
| [`architecture.md`](architecture.md) | ¿Cómo está construida? (módulos, capas, flujos, datos, calidad) | Cuando cambia una decisión estructural |
| [`adr/`](adr/README.md) | ¿Por qué elegimos X y no Y? | Un ADR nuevo por decisión; los aceptados no se editan, se reemplazan |
| [`modules/`](modules/) | ¿Qué contrato expone cada módulo? (API, tablas, eventos, puertos, invariantes) | Antes de cambiar la API de un módulo |
| `specs/NNN-<feature>/` | Spec, plan y tareas de una feature o fase concreta | Por feature |
| [`templates/`](templates/) | Plantillas para specs de feature, planes, tareas y ADRs | Rara vez |
| [`plan.md`](plan.md) | Plan de entrenamiento (fuente del seed) | Cuando cambia la rutina |
| `design-*.md` | ¿Cómo se ve cada pantalla? (diseño elegido y sus tableros) | Antes de la spec que construye o cambia la pantalla |
| [`handoff.md`](handoff.md) | Estado actual y siguiente paso | Al final de cada sesión de trabajo |
| [`handoff-history.md`](handoff-history.md) | ¿Qué se hizo en cada fase ya terminada? (consulta, no hace falta para retomar) | Al cerrar una fase, se mueve aquí su detalle |

## Jerarquía de autoridad

Si dos documentos se contradicen, gana el de arriba:

1. `constitution.md`
2. `spec.md` (qué)
3. ADRs aceptados
4. `architecture.md` y `modules/*.md` (cómo)
5. `specs/NNN-*/` (detalle de una feature)
6. Código

Una contradicción es un bug de documentación: se corrige el documento de menor rango o se propone un cambio al de mayor rango. No se resuelve en el código.

## Flujo de trabajo por feature

```
1. Spec de feature   specs/NNN-<feature>/spec.md    qué y criterios de aceptación (Dado/Cuando/Entonces)
       │              ↳ trazabilidad a RF/RNF de spec.md
2. Plan técnico      specs/NNN-<feature>/plan.md    módulos tocados, cambios de contrato, esquema, riesgos
       │              ↳ si cambia un contrato → actualizar modules/<m>.md primero
       │              ↳ si hay una decisión nueva → ADR
3. Tareas            specs/NNN-<feature>/tasks.md   pasos pequeños, cada uno verificable, pruebas primero
4. Implementación    código + pruebas que citan los IDs (RF-11, RN-PRG-01…)
5. Verificación      criterios de aceptación pasan; CI verde; handoff.md actualizado
```

Puertas de control (no se avanza si fallan):

- **Spec → Plan:** cada requerimiento tiene criterio de aceptación verificable; no hay "[POR DEFINIR]" sin resolver; si la spec tiene interfaz, su **Fuente de diseño** nombra un diseño ya elegido (`design-*.md` y tablero) o las piezas existentes que reutiliza. Sin diseño elegido no se escribe el plan.
- **Plan → Tareas:** el plan respeta la constitución y el grafo de dependencias; los contratos afectados están actualizados.
- **Tareas → Código:** todo comportamiento con ID tiene su prueba antes que el código (P-5); las excepciones están declaradas en `tasks.md`.
- **Código → Hecho:** CI verde (tsc, lint, fronteras, pruebas, build) y criterios de aceptación cubiertos por pruebas, o por la verificación manual que declara `tasks.md` (P-5).

## Convenciones de IDs

| Prefijo | Significado | Dónde se define |
|---|---|---|
| `P-n` | Principio de la constitución | `constitution.md` |
| `RF-nn` | Requerimiento funcional | `spec.md` §4 |
| `RNF-nn` | Requerimiento no funcional | `spec.md` §5 |
| `RN-<MOD>-nn` | Regla de negocio (invariante verificable) | `modules/<m>.md` (derivadas de `spec.md` §6) |
| `ADR-nnnn` | Decisión de arquitectura | `adr/` |
| `QS-nn` | Escenario de calidad | `architecture.md` §9 |
| `CA-n` | Criterio de aceptación del MVP | `spec.md` §15 |

Las pruebas citan el ID en su nombre, por ejemplo `it('RN-PRG-01: sube peso al tope del rango con RIR ≥ 1')`, para que la trazabilidad se pueda buscar con `grep`.

## Marcadores

- `[POR DEFINIR]`: falta una decisión; bloquea la puerta Spec → Plan.
- `[PROPUESTO]`: propuesta de diseño pendiente de confirmación del dueño del producto.
