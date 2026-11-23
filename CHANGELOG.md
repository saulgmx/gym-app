# Changelog

Cambios notables de la app, por versión. Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones según [SemVer](https://semver.org/lang/es/). Mientras la versión empiece con `0`, la app y su formato de datos pueden cambiar sin aviso.

Cada feature cita su spec en `docs/specs/NNN-<feature>/`.

## [Sin publicar]

## [0.1.0] - 2026-11-23

Primer release: el MVP. Agrupa las specs 000 a 008.

### Añadido

- **Esqueleto instalable** (spec 000): PWA con app shell offline, monolito modular con fronteras verificadas por dependency-cruiser, presupuesto de bundle y headers de seguridad.
- **Plan cargado y "Hoy"** (spec 001): seed del plan de 3 bloques en IndexedDB; "Hoy" muestra la sesión que toca, con factores de bloque y deload aplicados.
- **Sesión activa** (spec 002): registro de series con la columna "anterior", guardado inmediato en Dexie y recuperación de la sesión en curso.
- **Rediseño de "Hoy"** (spec 003) y **de la sesión activa** (spec 004).
- **Cierre de sesión** (spec 005): resumen, registro de dolor lumbar y alertas orientativas.
- **Una sola sesión cerrada por día** (spec 005b).
- **Historial de sesiones** (spec 006).
- **Respaldo** (spec 007): exportar e importar todos los datos en JSON, validado con Zod.
- **Exportar las series a CSV** (spec 008).

[Sin publicar]: https://github.com/saulgmx/gym-app/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/saulgmx/gym-app/releases/tag/v0.1.0
