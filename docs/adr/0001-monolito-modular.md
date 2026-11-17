# ADR-0001: Monolito modular con 5 módulos

- **Estado:** Aceptado
- **Fecha:** 16-nov-2026
- **Relacionado:** spec §8.2, P-4, P-7

## Contexto

La app es una PWA de un solo usuario, sin servidor en v1, mantenida por una persona. Tiene áreas de negocio claras (plan, entrenamiento, progresión, salud, datos) con reglas que conviene aislar y probar por separado, sobre todo progresión y dolor lumbar. En v2 podría sincronizar algunos datos con un backend.

## Opciones

1. **Estructura por capas técnicas** (`components/`, `hooks/`, `services/`): simple al inicio, pero mezcla áreas de negocio y facilita el acoplamiento.
2. **Monolito modular:** un solo despliegue organizado por módulos de negocio con API pública y fronteras verificadas.
3. **Paquetes separados (monorepo con workspaces):** fronteras fuertes, pero con mucha ceremonia de build para un solo desarrollador.

## Decisión

Opción 2. Cinco módulos (`plan`, `training`, `progression`, `health`, `data`), más `shared` (kernel pequeño, sin lógica de negocio) y `app` (composition root y páginas multimódulo). Cada módulo tiene capas `domain`, `application`, `infrastructure` y `ui`, y es dueño de sus tablas.

## Consecuencias

- (+) Reglas de negocio aisladas y probables sin React ni Dexie.
- (+) Un módulo se puede llevar a un backend cambiando solo su `infrastructure`.
- (+) Un solo build y despliegue.
- (−) Más archivos y algo de ceremonia (puertos, `index.ts`, fábricas) que en una app plana.
- (−) Requiere herramientas para hacer cumplir las fronteras (ADR-0008).
- Revisión: si un módulo queda con < 3 archivos útiles al terminar la fase 4, se considera fusionarlo.
