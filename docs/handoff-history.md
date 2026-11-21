# Historia del proyecto Gym app

Índice de lo que ya está hecho. El detalle de cada fase está en su spec, su plan y sus tareas (`docs/specs/`), y la lectura de conjunto, en la [retrospectiva del MVP](retros/mvp-fases-0-3.md). No hace falta leerlo para retomar el trabajo.

| Fase | Spec | Qué entregó | PR |
|---|---|---|---|
| 0 | [`000-fase-0`](specs/000-fase-0/) | Herramientas, fronteras en CI, kernel, PWA, Vercel y dominio | #3 a #6 |
| 1 | [`001-fase-1`](specs/001-fase-1/) | Módulo `plan`, seed, "Hoy" | #7 a #10 |
| 2 | [`002-fase-2`](specs/002-fase-2/) | Módulo `training`, sesión activa, base v2 | #12 a #17 |
| 2.5 | [`003-rediseno-hoy`](specs/003-rediseno-hoy/), [`004-rediseno-sesion`](specs/004-rediseno-sesion/) | Rediseño de "Hoy" y de la sesión activa | #20 a #30 |
| 3 | [`005-cierre`](specs/005-cierre/) | Módulo `health`, Cierre con dolor lumbar, base v3 | #37 a #45 |
| 3 | [`005b-una-sesion-por-dia`](specs/005b-una-sesion-por-dia/) | Una sola sesión cerrada por día (RN-TRN-27) | #46 a #50 |
| 3 | [`006-historial`](specs/006-historial/) | Pestaña "Historial", lista y detalle | #51 a #57 |
| 3 | [`007-respaldo`](specs/007-respaldo/) | Módulo `data`, pestaña "Ajustes", respaldo JSON | #58 a #65 |
| 3 | [`008-csv`](specs/008-csv/) | "Exportar series (CSV)" en Ajustes; cierra la fase 3 | #66 a #68, #70, #73, #75 y el de cierre |

Al cerrar una spec se agrega su fila. La versión narrativa anterior (hasta el 21-nov-2026) está en git: `git show 752b848:docs/handoff-history.md`.
