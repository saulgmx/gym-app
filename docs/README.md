# Documentación: cómo trabajamos (Spec-Driven Development)

Este proyecto sigue **Spec-Driven Development (SDD)**: primero se escribe la especificación, luego el diseño técnico, luego las tareas, y el código se deriva de ellas. Ningún código entra sin una spec o un contrato que lo justifique.

## Mapa de documentos

| Documento | Responde a | Cambia |
|---|---|---|
| [`constitution.md`](constitution.md) | ¿Qué reglas no se negocian nunca? | Casi nunca (enmienda explícita) |
| [`spec.md`](spec.md) | ¿Qué hace la app y por qué? (requerimientos, reglas de negocio, UX, criterios de aceptación) | Cuando cambia un requerimiento o una regla |
| [`architecture.md`](architecture.md) | ¿Cómo está construida? (módulos, capas, flujos, datos, calidad) | Cuando cambia una decisión estructural |
| [`adr/`](adr/README.md) | ¿Por qué elegimos X y no Y? | Un ADR nuevo por decisión; los aceptados no se editan, se reemplazan |
| [`modules/`](modules/) | ¿Qué contrato expone cada módulo? (API, tablas, eventos, puertos, invariantes) | Antes de cambiar la API de un módulo |
| [`specs/`](specs/README.md) | ¿Qué specs hay, en qué estado y con qué PRs? (índice); spec, plan y tareas de cada feature en `specs/NNN-<feature>/` | El índice, al empezar o cerrar una spec; cada carpeta, por feature |
| [`templates/`](templates/) | Plantillas para specs de feature, planes, tareas y ADRs | Rara vez |
| [`plan.md`](plan.md) | Plan de entrenamiento (fuente del seed) | Cuando cambia la rutina |
| `design-*.md` | ¿Cómo se ve cada pantalla? (diseño elegido y sus tableros) | Antes de la spec que construye o cambia la pantalla |
| [`release.md`](release.md) | ¿Cómo se publica una versión? (checklist de release, rollback, hotfix) | Cuando cambia el flujo de ambientes (ADR-0017) |
| [`guia-de-desarrollo.md`](guia-de-desarrollo.md) | ¿Qué trampas conocidas hay al probar, depurar o configurar? (lecciones por tema) | Cuando algo costó tiempo y puede volver a pasar; se borra lo que el código ya impide |
| [`handoff.md`](handoff.md) | ¿Qué necesito para empezar la siguiente tarea? (estado vigente, siguiente tarea y avisos) | Al final de cada sesión (ver "El handoff") |

## Jerarquía de autoridad

Si dos documentos se contradicen, gana el de arriba:

1. `constitution.md`
2. `spec.md` (qué)
3. ADRs aceptados
4. `architecture.md` y `modules/*.md` (cómo)
5. `specs/NNN-*/` (detalle de una feature)
6. Código

Una contradicción es un bug de documentación: se corrige el documento de menor rango o se propone un cambio al de mayor rango. No se resuelve en el código. Por ejemplo, si una spec contradice un contrato, gana el contrato y se corrige la spec antes del código (spec 006 decisión 10, RN-TRN-17).

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
- **Plan → Tareas:** el plan respeta la constitución y el grafo de dependencias; cada regla nueva o cambiada tiene sus casos de borde cerrados (plan §7); los contratos afectados están actualizados, con esos casos incluidos.
- **Tareas → Código:** todo comportamiento con ID tiene su prueba antes que el código (P-5); las excepciones están declaradas en `tasks.md`.
- **Código → Hecho:** CI verde (tsc, lint, fronteras, pruebas, build) y criterios de aceptación cubiertos por pruebas, o por la verificación manual que declara `tasks.md` (P-5).

### Vía ligera

Una feature puede ir en un solo archivo y un solo PR de docs si cumple **todo** esto:

- Agrega o cambia como mucho dos reglas `RN-*`, de un solo módulo.
- No cambia el esquema de Dexie ni el formato de exportación (`DataPort.version`, CSV).
- No necesita ADR ni dependencia nueva.
- No tiene pantalla nueva: su fuente de diseño es un diseño ya elegido o piezas existentes.
- No toca `progression` ni `health`.

El archivo `specs/NNN-<feature>/spec.md` lleva tres partes con las secciones que apliquen de cada plantilla: **Spec** (problema, criterios de aceptación, reglas), **Plan** (módulos, cambios de contrato, casos de borde por regla) y **Tareas** (la tabla de `tasks.md`, con las excepciones de P-5 declaradas). Las tres puertas se revisan juntas en ese PR, y el contrato se actualiza en el mismo PR. Si al escribirla deja de cumplir alguna condición, se separa en los tres documentos de siempre.

### Al implementar una tarea

- **Antes de escribir pruebas:** revisar si el contrato deja comportamientos sin definir. Si los deja, proponerlos y, con la aprobación del dueño del producto, escribirlos en los docs antes del código.
- **Pruebas primero:** el commit en rojo se hace en local, **sin push**, y se sube junto con la tarea que lo pone en verde, para que el CI del PR nunca quede en rojo. Las tareas de herramientas o solo de pruebas van en un solo commit.
- **Al cerrar cada tarea:** `npx tsc -b --force`. El `tsc -b` incremental de `npm run typecheck` dejó pasar una vez un error de tipos que el CI sí vio.
- **Antes de abrir un PR que toca algo compartido** (barra de pestañas, rutas, "Hoy", componentes de varias páginas): correr los E2E en local, no solo en la tarea de E2E. Una pestaña nueva rompió una prueba que contaba las pestañas y el CI falló (PR #55).
- Las trampas conocidas al probar y depurar están en [`guia-de-desarrollo.md`](guia-de-desarrollo.md).

### Ramas, commits y PRs

- Una rama y un PR por punto de control (A, B, C… de `tasks.md`); un commit por tarea.
- El PR se abre como borrador mientras el punto de control está en curso, y se marca listo cuando su última tarea está en verde.
- Al fusionar: *Create a merge commit*, no *squash*, para que las ramas que siguen conserven diffs limpios.

### El handoff

`handoff.md` responde una sola pregunta: ¿qué necesito para empezar la siguiente tarea? Lleva el estado vigente (versión, spec en curso, lo que está a medias), la siguiente tarea con sus enlaces, los avisos que la afectan y el prompt para un chat nuevo.

Al final de cada sesión se agrega lo que la siguiente tarea necesita y se borra lo que ya no aplica. Lo permanente va a su documento, no al handoff:

| Si es… | Va a… |
|---|---|
| Una decisión | Un ADR |
| Una regla o API de un módulo | `modules/<m>.md` |
| Una trampa técnica o lección | `guia-de-desarrollo.md` |
| Configuración fuera del repo | `architecture.md` §8.1 |
| El estado de una spec | `specs/README.md` |
| Un pendiente sin fecha | `ideas/` |
| Historia | git y la spec de su fase |

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

## Versiones y registro de cambios

- `spec.md`, `architecture.md` y `modules/*.md` no llevan número de versión ni fecha en la cabecera: su historial es git. Para citar un estado concreto se usa la fecha o el commit.
- Cada contrato conserva su sección "Decisiones" como registro de cambios: una entrada por cambio de API, tablas, eventos, puertos o reglas, con la fecha y la spec que lo origina (`**Plan de la spec 010 (21-nov-2026):** …`). Las erratas y aclaraciones no llevan entrada.
- La app lleva versión SemVer: `version` en `package.json`, tag anotado `vX.Y.Z` y una entrada en [`CHANGELOG.md`](../CHANGELOG.md) por versión publicada. Proceso en [`release.md`](release.md).
- Solo llevan versión la constitución (por enmienda, con su tabla) y los formatos que la app vuelve a leer: `schemaVersion` de Dexie, `DataPort.version` de cada módulo y la versión del CSV (P-2, ADR-0013). Esas versiones no cambian con esta regla.
- Hasta el 21-nov-2026 los documentos llevaban versión (por ejemplo, `training.md` v1.36). Esas citas, en las decisiones de los contratos y en las specs 000 a 009, se quedan como registro histórico. El commit de una versión se encuentra con `git log -S 'contrato:** 1.36' -- docs/modules/training.md`.
