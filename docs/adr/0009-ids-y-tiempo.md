# ADR-0009: IDs ULID, fechas locales y reloj inyectado

- **Estado:** Propuesto
- **Fecha:** 16-nov-2026
- **Relacionado:** spec §9.1 ("ULID o UUID"), P-5, architecture §7.5

## Contexto

La spec deja abierto ULID vs UUID. Además, "qué toca hoy" depende del día local (México, UTC-6), y las reglas de dominio deben ser deterministas para probarlas.

## Decisión propuesta

- **IDs:** ULID (librería `ulid` o implementación propia de ~30 líneas). Ordenables por tiempo, útiles para ordenar series y para fusionar datos en una sincronización futura.
- **Fechas:**
  - `LocalDate` = `'YYYY-MM-DD'` en la zona horaria del dispositivo, para el día de entrenamiento, el calendario del plan y el peso corporal.
  - `Instant` = ISO 8601 con offset (`2026-11-16T22:30:00-06:00`), para `startedAt`, `completedAt`, `recordedAt`.
  - Tipos *branded* en `shared/kernel` para que no se mezclen.
- **Puertos:** `Clock { now(): Instant; today(): LocalDate }` e `IdGenerator { next(): ID }` en `shared/kernel`, inyectados en los casos de uso. El dominio nunca llama a `Date.now()`.

## Consecuencias

- (+) Pruebas deterministas (reloj fijo, IDs secuenciales).
- (+) Un entrenamiento que cruza la medianoche se asigna al día en que empezó.
- (−) Hay que convertir con cuidado al graficar por semana (semana ISO, lunes como inicio).
