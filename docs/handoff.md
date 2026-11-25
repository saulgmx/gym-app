# Handoff: siguiente tarea

**Fecha:** 24-nov-2026 · Este archivo solo lleva lo que necesita la siguiente tarea; lo demás está en su documento (`docs/README.md`, "El handoff"). Índice de specs y su estado: [`specs/README.md`](specs/README.md).

## Estado

- **Versión:** `v0.1.0` (MVP, specs 000 a 008); `CHANGELOG.md` con `[Sin publicar]` vacía.
- **Producción** (https://gym.saulgmx.com) sirve todavía el último despliegue hecho desde `main` antes de ADR-0017 (`5f6c7ff`), con el mismo código de la app que `v0.1.0`. El primer despliegue desde `production` será `v0.2.0`, al cerrar la spec 009. **Desarrollo:** https://gym-dev-saulgmx.vercel.app.
- **Spec en curso:** 009, temporizador de descanso. Spec, plan y tareas aprobados y fusionados (#79, #80); ningún punto de control empezado.

## Siguiente tarea

**T1 de la spec 009:** pruebas de `restOf` y `restTimer` (RN-TRN-32 a 34). Abre el punto de control A ("rest: domain"), en una rama nueva desde `main`. Pruebas primero: el commit en rojo se queda en local hasta T2.

Leer antes: `docs/specs/009-temporizador/plan.md` (§6.1 y §6.3), `docs/specs/009-temporizador/tasks.md` (A y notas) y `docs/modules/training.md` (RN-TRN-32 a 35, decisión 38).

## Avisos

- **Checks requeridos en `main`:** `ci`, `Trivy Dependency Scan`, `Secrets Detection` y `Pinned Tool Advisories` (ADR-0019). Si un check de seguridad se pone rojo sin relación con el código, es un aviso de seguridad nuevo, no un fallo de la tarea: se sube la versión en el `env` de `security.yml` o se acepta el riesgo en `.trivyignore` (ADR-0016 y ADR-0018), en un PR aparte. CodeQL aparece en los PR, pero no es requerido.
- **Qwen en esta spec:** T10 (punto de control C) es la calibración de UI de ADR-0014, en un worktree aparte; detalle en las notas de `tasks.md`. Entorno y script: `~/qwen-calib/README.md`.

## Prompt sugerido para un chat nuevo

"Seguimos con la spec 009 (temporizador de descanso), punto de control A. Lee primero docs/README.md, docs/constitution.md y docs/handoff.md, y luego docs/specs/009-temporizador/plan.md (§6.1 y §6.3), docs/specs/009-temporizador/tasks.md (A y notas) y docs/modules/training.md (RN-TRN-32 a 35, decisión 38). Empezamos por T1. Guíame paso a paso, una tarea a la vez."
