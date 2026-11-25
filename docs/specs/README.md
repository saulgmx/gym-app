# Índice de specs

Todas las specs, hechas y por hacer, con su estado. La hoja de ruta por fases está en [`spec.md` §13](../spec.md#13-hoja-de-ruta-sugerida); el detalle de cada spec, en su carpeta (spec, plan y tareas), y la lectura de conjunto del MVP, en la [retrospectiva](../retros/mvp-fases-0-3.md).

Al empezar o cerrar una spec se actualiza su fila: estado, PRs y versión publicada.

| Fase | Spec | Qué entrega | RF | Depende de | Estado | PRs |
|---|---|---|---|---|---|---|
| 0 | [`000-fase-0`](000-fase-0/) | Herramientas, fronteras en CI, kernel, PWA, Vercel y dominio | — | — | Hecha | #3 a #6 |
| 1 | [`001-fase-1`](001-fase-1/) | Módulo `plan`, seed, "Hoy" | — | — | Hecha | #7 a #10 |
| 2 | [`002-fase-2`](002-fase-2/) | Módulo `training`, sesión activa, base v2 | — | — | Hecha | #12 a #17 |
| 2.5 | [`003-rediseno-hoy`](003-rediseno-hoy/), [`004-rediseno-sesion`](004-rediseno-sesion/) | Rediseño de "Hoy" y de la sesión activa | — | — | Hecha | #20 a #30 |
| 3 | [`005-cierre`](005-cierre/) | Módulo `health`, Cierre con dolor lumbar, base v3 | — | — | Hecha | #37 a #45 |
| 3 | [`005b-una-sesion-por-dia`](005b-una-sesion-por-dia/) | Una sola sesión cerrada por día (RN-TRN-27) | — | — | Hecha | #46 a #50 |
| 3 | [`006-historial`](006-historial/) | Pestaña "Historial", lista y detalle | — | — | Hecha | #51 a #57 |
| 3 | [`007-respaldo`](007-respaldo/) | Módulo `data`, pestaña "Ajustes", respaldo JSON | — | — | Hecha | #58 a #65 |
| 3 | [`008-csv`](008-csv/) | "Exportar series (CSV)" en Ajustes; cierra la fase 3 (publicada como `v0.1.0`, #86) | — | — | Hecha | #66 a #68, #70, #73, #75 y el de cierre |
| 4 | [`009-temporizador`](009-temporizador/) | Temporizador de descanso al completar una serie; calibración de UI de Qwen (ADR-0014) | RF-15 | — | En curso | #79, #80 (spec, plan y tareas) |
| 4 | `010-progresion` | Dominio RN-PRG-00 a 14 (pruebas primero), tabla `suggestions` (base v4), prellenado del peso, `SuggestionBanner`, "Para la próxima sesión" en el Cierre, "Hoy subes" | RF-12, 24, 30 | — | Pendiente | — |
| 4 | `011-deload` | RN-PRG-20 y 21, aviso en "Hoy", deload manual, 50% de series | RF-36, RF-05 | 010 | Pendiente | — |
| 4 | `012-progreso` | Pestaña "Progreso": gráfica por ejercicio y de dolor; `shared/ui/Chart` con uPlot cargado aparte (el bundle inicial está cerca de su límite de 200 kB) | RF-31, RF-33 | — | Pendiente | — |
| 4 | `013-peso-corporal` | Tabla `bodyMetrics` (base v5), registro y gráfica con meta semanal, respaldo | RF-34 | 012 | Pendiente | — |
| 4 | `014-ajustes` | Incrementos por equipo y paso de asistencia, umbral de dolor, recordatorio de respaldo, borrar datos | RF-50, 51, 42, 43 | 010 | Pendiente | — |

Notas de la fase 4 (acordada el 20-nov-2026):

- Al cerrar cada spec se publica un *minor*: la 009 será `v0.2.0` ([`release.md`](../release.md)).
- Hasta la 014, los incrementos, el paso de asistencia y el umbral de dolor son constantes del dominio.
- El plan editable (RF-04) queda en la fase 5 (v1.1). Las alertas de dolor ya llegaron con la spec 005.
- Pendientes de la [retrospectiva del MVP](../retros/mvp-fases-0-3.md) por decidir: S-3, S-4, S-6, S-7, S-8, X-2, X-4, F-3 y las preguntas abiertas de su §5. S-4 (Stryker) se decide al planear la 010; S-3, con la aceptación de ADR-0014. Cuándo toca cada uno, en la tabla de la retrospectiva.

La versión narrativa del historial (hasta el 21-nov-2026) está en git: `git show 752b848:docs/handoff-history.md`.
