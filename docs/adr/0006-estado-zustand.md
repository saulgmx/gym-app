# ADR-0006: Estado de UI con Zustand

- **Estado:** Aceptado
- **Fecha:** 16-nov-2026
- **Relacionado:** spec §10.1, architecture §7.8, RF-15, RF-19

## Contexto

Hay estado que no es persistente o que es una vista de lo persistente: ejercicio actual de la sesión, serie enfocada, temporizador de descanso. Debe compartirse entre componentes de la sesión sin *re-renders* masivos.

## Opciones

1. **Context + `useReducer`:** sin dependencias; cada cambio re-renderiza a todos los consumidores.
2. **Zustand:** ~1 KB, selectores finos, sin providers.

## Decisión

Zustand para estado efímero de UI. **Dexie es siempre la fuente de verdad de los datos**: Zustand nunca guarda series, sesiones ni dolor. Los stores viven en `app` (por ejemplo `useSessionStore`) o en la `ui` de un módulo si son exclusivos de él.

## Consecuencias

- (+) Selectores finos: actualizar el temporizador no re-renderiza la tabla de series.
- (+) Se rehidrata desde Dexie al recargar (RF-19).
- (−) Riesgo de duplicar estado: regla de revisión "si se puede derivar de Dexie, no va en Zustand".
- El temporizador guarda `endsAt` (instante), no segundos restantes.
