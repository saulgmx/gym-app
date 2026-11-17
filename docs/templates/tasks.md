# Tareas: <nombre de la feature>

**Plan:** `specs/NNN-<feature>/plan.md`

Cada tarea es pequeña (≤ 1-2 h), deja el CI verde y tiene una verificación concreta. En `progression` y `health`, la tarea de pruebas va antes que la de implementación.

| # | Tarea | Módulo / capa | Verificación | Cubre | Estado |
|---|---|---|---|---|---|
| T1 | Escribir pruebas de RN-xxx-01 | `x/domain` | Pruebas fallan (rojo) | AC-1 | ☐ |
| T2 | Implementar RN-xxx-01 | `x/domain` | T1 en verde | AC-1 | ☐ |
| T3 | Caso de uso `…` con repositorio en memoria | `x/application` | Prueba de contrato | AC-2 | ☐ |
| T4 | Repositorio Dexie + esquema | `x/infrastructure` | Prueba con `fake-indexeddb` | — | ☐ |
| T5 | Componente / página | `x/ui` o `app/pages` | Testing Library + revisión visual | AC-3 | ☐ |
| T6 | E2E del flujo | `tests/e2e` | Playwright móvil | AC-* | ☐ |
| T7 | Actualizar `handoff.md` | docs | — | — | ☐ |

## Notas

- …
