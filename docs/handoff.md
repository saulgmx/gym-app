# Handoff: estado del proyecto Gym app

**Fecha:** 16-nov-2026 · **Lee primero:** `docs/README.md` (cómo trabajamos), `docs/constitution.md` y este archivo.

## Qué existe

- **Documentación SDD completa (16-nov):**
  - `docs/README.md`: mapa de documentos, jerarquía de autoridad, flujo spec → plan → tareas → código, convenciones de IDs.
  - `docs/constitution.md` v1.0: principios P-1 a P-8 y checklist de revisión.
  - `docs/spec.md` v0.3: spec de producto (qué y por qué). Las secciones 8-10 ahora remiten a la arquitectura y los contratos.
  - `docs/architecture.md` v1.0: módulos, capas, diagramas de secuencia, persistencia, conceptos transversales, escenarios de calidad QS-01 a QS-10.
  - `docs/adr/`: ADR-0001 a 0008 aceptados; 0009 (ULID y fechas) y 0010 (`Result`) propuestos.
  - `docs/modules/`: contratos de `plan`, `training`, `progression`, `health`, `data` y `shared`, con reglas RN-* y pruebas de contrato.
  - `docs/templates/`: plantillas de spec de feature, plan, tareas y ADR.
- `docs/plan.md`: plan de entrenamiento de 3 bloques (fuente del seed).
- Prototipo visual (4 pantallas): https://claude.ai/artifact/4n7JmYVCDFjgH558Foi2Zk
- Carpeta local `~/dev/personal/side-projects/gym-app`: `CLAUDE.md` (actualizado), `docs/`, `src/` vacía, `.gitignore`. **Aún no hay** `git init`, `package.json` ni código.

## Decisiones tomadas

- PWA offline-first con Dexie; sin cuentas en v1 (ADR-0002).
- Monolito modular de 5 módulos + `shared` + `app` (ADR-0001); fronteras en CI (ADR-0008).
- Gráficas con uPlot (ADR-0004), estilos con CSS Modules + variables CSS (ADR-0005), estado efímero con Zustand (ADR-0006), Zod en fronteras (ADR-0007).
- La app nunca sugiere ejercicios `lumbarRisk: 'high'` (P-1, RN-PLN-07, RN-PRG-00).
- Forma de trabajo: el usuario quiere ser guiado paso a paso; ejecuta con Claude Code o su terminal.

## Pendiente de confirmar (bloquea las fases indicadas)

| # | Pregunta | Propuesta | Dónde | Fase |
|---|---|---|---|---|
| 1 | ¿Ejercicios `high`: bloqueo total o advertencia con confirmación? | Bloqueo total | plan.md §10 | 1 |
| 2 | Alternancia A/B del bloque 1 | `Block.schedule` con `weekParity` | plan.md RN-PLN-03 | 1 |
| 3 | Ejercicios con alternativa ("dominadas o jalón") | `alternatives: ID[]` | plan.md §10 | 1 |
| 4 | Series planificadas: ¿mínimo del rango? | Mínimo; extras hasta el máximo | plan.md RN-PLN-05 | 1 |
| 5 | ADR-0009 (ULID, `LocalDate`/`Instant`) y ADR-0010 (`Result`) | Aceptar | adr/ | 0 |
| 6 | Workouts cerrados inmutables en v1 | Sí, salvo notas | training.md RN-TRN-07 | 2 |
| 7 | Porcentajes de bajada (5% rendimiento, 10% dolor) y ejercicios `isPrimary` | Ver contrato | progression.md §9 | 4 |
| 8 | Bandas de dolor fijas aunque cambie el umbral; definición de "sube 3 sesiones" | Fijas; 3 entradas estrictamente crecientes | health.md §10 | 3 |
| 9 | Hosting (Vercel o Netlify) | — | architecture.md §8 | 0 |

## Siguiente paso: fase 0 (spec §13)

1. Confirmar las preguntas 5 y 9.
2. Crear `docs/specs/000-fase-0/{spec,plan,tasks}.md` con las plantillas.
3. Implementar siguiendo `tasks.md`: `git init`, Vite + React + TS estricto, ESLint/Prettier, alias `@/`, estructura de carpetas (architecture.md §5), `shared/kernel` y bus de eventos con pruebas, reglas de fronteras, `tokens.css`, router con páginas vacías y TabBar, PWA vacía, CI.

## Prompt sugerido para un chat nuevo

"Vamos a escribir la spec, el plan y las tareas de la fase 0 en docs/specs/000-fase-0/ usando las plantillas de docs/templates. Empieza leyendo docs/README.md y docs/handoff.md."
