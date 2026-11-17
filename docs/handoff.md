# Handoff: estado del proyecto Gym app

**Fecha:** 16-nov-2026 · **Lee primero:** `docs/README.md` (cómo trabajamos), `docs/constitution.md` y este archivo.

## Qué existe

- **Documentación SDD completa (16-nov):**
  - `docs/README.md`: mapa de documentos, jerarquía de autoridad, flujo spec → plan → tareas → código, convenciones de IDs.
  - `docs/constitution.md` v1.0: principios P-1 a P-8 y checklist de revisión.
  - `docs/spec.md` v0.3: spec de producto (qué y por qué). Las secciones 8-10 ahora remiten a la arquitectura y los contratos.
  - `docs/architecture.md` v1.0: módulos, capas, diagramas de secuencia, persistencia, conceptos transversales, escenarios de calidad QS-01 a QS-10.
  - `docs/adr/`: ADR-0001 a 0011 aceptados (0009 UUIDv7 y fechas, 0010 `Result`, 0011 hosting en Vercel con dominio propio).
  - `docs/modules/`: contratos de `plan`, `training`, `progression`, `health`, `data` y `shared`, con reglas RN-* y pruebas de contrato.
  - `docs/templates/`: plantillas de spec de feature, plan, tareas y ADR.
- `docs/plan.md`: plan de entrenamiento de 3 bloques (fuente del seed).
- Prototipo visual (4 pantallas): https://claude.ai/artifact/4n7JmYVCDFjgH558Foi2Zk
- Carpeta local `~/dev/personal/side-projects/gym-app`: `CLAUDE.md` (actualizado), `docs/`, `src/` vacía, `.gitignore`. Repo git con remoto público `saulgmx/gym-app`. **Aún no hay** `package.json` ni código.

## Decisiones tomadas

- PWA offline-first con Dexie; sin cuentas en v1 (ADR-0002).
- Monolito modular de 5 módulos + `shared` + `app` (ADR-0001); fronteras en CI (ADR-0008).
- Gráficas con uPlot (ADR-0004), estilos con CSS Modules + variables CSS (ADR-0005), estado efímero con Zustand (ADR-0006), Zod en fronteras (ADR-0007).
- La app nunca sugiere ejercicios `lumbarRisk: 'high'` (P-1, RN-PLN-07, RN-PRG-00).
- IDs UUIDv7 propios y monótonos; `Instant` nunca se compara como string (ADR-0009).
- Errores esperados con `Result` y códigos tipados por módulo; mensajes al usuario solo desde el mapa en `app` (ADR-0010).
- Hosting en Vercel servido desde un dominio propio; `main` protegida con CI obligatorio; sin funciones exclusivas de Vercel (ADR-0011). Dominio: pendiente de compra (`.com` en Cloudflare Registrar o Porkbun); se conecta en la tarea de despliegue.
- Forma de trabajo: el usuario quiere ser guiado paso a paso; ejecuta con Claude Code o su terminal.

## Pendiente de confirmar (bloquea las fases indicadas)

| # | Pregunta | Propuesta | Dónde | Fase |
|---|---|---|---|---|
| 1 | ¿Ejercicios `high`: bloqueo total o advertencia con confirmación? | Bloqueo total | plan.md §10 | 1 |
| 2 | Alternancia A/B del bloque 1 | `Block.schedule` con `weekParity` | plan.md RN-PLN-03 | 1 |
| 3 | Ejercicios con alternativa ("dominadas o jalón") | `alternatives: ID[]` | plan.md §10 | 1 |
| 4 | Series planificadas: ¿mínimo del rango? | Mínimo; extras hasta el máximo | plan.md RN-PLN-05 | 1 |
| 6 | Workouts cerrados inmutables en v1 | Sí, salvo notas | training.md RN-TRN-07 | 2 |
| 7 | Porcentajes de bajada (5% rendimiento, 10% dolor) y ejercicios `isPrimary` | Ver contrato | progression.md §9 | 4 |
| 8 | Bandas de dolor fijas aunque cambie el umbral; definición de "sube 3 sesiones" | Fijas; 3 entradas estrictamente crecientes | health.md §10 | 3 |

## Siguiente paso: fase 0, bloque B (kernel y eventos)

1. ~~Confirmar ADR-0009, ADR-0010 y hosting~~ (hecho, 16-nov).
2. ~~Spec, plan y tareas en `docs/specs/000-fase-0/`~~ (aprobados y fusionados, PR #1 y #2).
3. ~~Bloque A, T1–T7: herramientas y fronteras~~ (fusionado, PR #3, 17-nov). CI verde con el job `ci`.
4. **Siguiente: T8** (pruebas del kernel en rojo) en la rama local `feat/000-phase-0-b`, creada desde `main`. Luego T9–T13. PR del punto de control B al terminar T13.
5. Pendiente del usuario, sin bloquear hasta el bloque D: comprar el dominio (T24).

Notas para retomar:
- Entorno: Node `24.22.3` con Volta (el de Homebrew ya se desinstaló). `npm ci --strict-allow-scripts` en CI; `fsevents` denegado en `allowScripts`.
- Pruebas primero: en T8, T10 y T12 se hace commit local en rojo **sin push**; se sube junto con la tarea que lo pone en verde.
- Verificar con `set -o pipefail` cuando se encadenan comandos con `|`: un `| tail` oculta el código de salida.
- `eslint-plugin-boundaries` v7: el descriptor `layer` va primero con `exclusive: true`; el grafo de módulos vive en `config/module-graph.json`.
- Al fusionar PR: "Create a merge commit". Rama remota pendiente de borrar: `origin/feat/000-phase-0`.

## Prompt sugerido para un chat nuevo

"Vamos a seguir con la fase 0 en docs/specs/000-fase-0/tasks.md, desde la siguiente tarea pendiente (T8). Lee primero docs/README.md, docs/constitution.md y docs/handoff.md. Guíame paso a paso y muéstrame los comandos que uses para que vaya aprendiendo."
