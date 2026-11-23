# Registro de decisiones de arquitectura (ADR)

Un ADR registra una decisión estructural, su contexto y sus consecuencias. Formato: [`../templates/adr.md`](../templates/adr.md).

Reglas:

- Un archivo por decisión: `NNNN-titulo-corto.md`, numeración consecutiva.
- Estados: `Propuesto` → `Aceptado` → (`Reemplazado por ADR-xxxx` | `Obsoleto`).
- Un ADR aceptado no se edita (salvo erratas). Para cambiar una decisión se escribe uno nuevo que lo reemplaza.
- Si un plan de feature introduce una dependencia estructural, un patrón nuevo o cambia una frontera, necesita ADR.

| ADR | Título | Estado |
|---|---|---|
| [0001](0001-monolito-modular.md) | Monolito modular con 5 módulos | Aceptado |
| [0002](0002-pwa-offline-first-dexie.md) | PWA offline-first con Dexie (IndexedDB) | Aceptado |
| [0003](0003-comunicacion-entre-modulos.md) | Comunicación entre módulos: API pública, puertos y eventos | Aceptado |
| [0004](0004-graficas-uplot.md) | Gráficas con uPlot | Aceptado |
| [0005](0005-css-modules-variables.md) | Estilos con CSS Modules y variables CSS | Aceptado |
| [0006](0006-estado-zustand.md) | Estado de UI con Zustand | Aceptado |
| [0007](0007-zod-en-fronteras.md) | Validación con Zod en las fronteras de entrada | Reemplazado por ADR-0012 |
| [0008](0008-verificacion-de-fronteras.md) | Fronteras verificadas con eslint-plugin-boundaries y dependency-cruiser | Aceptado |
| [0009](0009-ids-y-tiempo.md) | IDs UUIDv7, fechas locales y reloj inyectado | Aceptado |
| [0010](0010-manejo-de-errores-result.md) | Errores esperados con `Result<T, E>` | Aceptado |
| [0011](0011-hosting-vercel-origen-estable.md) | Hosting en Vercel con origen estable en dominio propio | Aceptado (reglas 1 y 4 modificadas por ADR-0017) |
| [0012](0012-validacion-del-seed-zod-y-dominio.md) | Validación en las fronteras con Zod (forma) y el dominio (reglas) | Aceptado |
| [0013](0013-version-de-formato-en-exportaciones.md) | Versión de formato en todas las exportaciones | Aceptado |
| [0014](0014-ejecucion-delegada-modelo-local.md) | Ejecución de tareas delegada a un modelo local | Propuesto |
| [0015](0015-pruebas-primero.md) | Pruebas primero para todo comportamiento con ID | Aceptado |
| [0016](0016-analisis-de-seguridad-en-ci.md) | Análisis de seguridad en CI con Trivy y TruffleHog | Aceptado |
| [0017](0017-ambientes-y-flujo-de-ramas.md) | Trunk-based con ambiente de desarrollo y producción por versión | Aceptado |
