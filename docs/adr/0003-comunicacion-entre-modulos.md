# ADR-0003: Comunicación entre módulos: API pública, puertos y eventos

- **Estado:** Aceptado
- **Fecha:** 16-nov-2026
- **Relacionado:** spec §8.7-8.8, architecture §7.1-7.2, P-4, P-7

## Contexto

Los módulos necesitan colaborar: `training` muestra sugerencias de `progression`; `progression` reacciona a sesiones cerradas y al dolor registrado. Sin reglas, esto produce ciclos (`training ↔ progression`) e imports a archivos internos.

## Decisión

Tres mecanismos, en este orden de preferencia:

1. **Llamada a la API pública** (`index.ts`) cuando el grafo de dependencias lo permite (por ejemplo, `progression` → `training.getExerciseHistory`).
2. **Puerto** cuando el que necesita algo está "abajo" en el grafo: el módulo define la interfaz en `application/ports.ts` y `app/compose.ts` inyecta la implementación (por ejemplo, `training.SuggestionProvider`).
3. **Evento de dominio** por el bus de `shared/events` cuando es un efecto secundario que el publicador no necesita esperar (por ejemplo, `training/WorkoutCompleted` → `progression` recalcula).

Reglas de eventos: nombre `<módulo>/<HechoEnPasado>`, payload con IDs (no entidades), publicación después de confirmar la escritura, handlers idempotentes y aislados (su fallo no afecta al publicador).

## Consecuencias

- (+) Grafo acíclico y verificable.
- (+) `progression` se puede reconstruir desde cero (`rebuild()`), lo que tolera eventos perdidos.
- (−) La indirección de puertos y eventos dificulta seguir el flujo: se documenta en los diagramas de secuencia de `architecture.md` §6.
- (−) El bus en memoria no persiste eventos: aceptable porque los handlers recalculan a partir del estado.
