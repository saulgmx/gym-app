# ADR-0008: Fronteras verificadas con eslint-plugin-boundaries y dependency-cruiser

- **Estado:** Aceptado
- **Fecha:** 16-nov-2026
- **Relacionado:** spec §8.6, §8.10, P-4, QS-07

## Contexto

Las reglas del monolito modular (solo `index.ts`, sin ciclos, grafo permitido, capas internas) se rompen fácilmente si dependen solo de disciplina, sobre todo cuando un asistente de código genera imports automáticos.

## Decisión

- **`eslint-plugin-boundaries`:** feedback inmediato en el editor. Reglas: elementos `app`, `module` (captura `name`), `shared`; entrada única `index.ts` por módulo; capas `domain/application/infrastructure/ui` dentro de cada módulo; grafo de `architecture.md` §5.1.
- **`dependency-cruiser`:** en CI, `no-circular`, `shared-no-modules`, `domain-is-pure` (sin `react`, `dexie`, `zustand` en `**/domain/**`) y el grafo permitido.
- Ambos corren en `npm run lint` y en CI; el pipeline falla si hay violaciones.
- Alias `@/` → `src/` para que los imports sean legibles y las reglas los resuelvan.

## Consecuencias

- (+) QS-07 automatizado.
- (+) `dependency-cruiser` puede generar el grafo real para comparar con el documentado.
- (−) Configuración inicial y mantenimiento al añadir módulos.
- Cambiar el grafo permitido requiere actualizar `architecture.md` §5.1 y este ADR (o uno nuevo).
