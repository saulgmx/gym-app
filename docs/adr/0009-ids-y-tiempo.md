# ADR-0009: IDs UUIDv7, fechas locales y reloj inyectado

- **Estado:** Aceptado
- **Fecha:** 16-nov-2026
- **Relacionado:** spec §9.1 ("ULID o UUID"), P-5, P-7, architecture §7.5, modules/shared.md §2

## Contexto

La spec deja abierto ULID vs UUID. Además, "qué toca hoy" depende del día local (México, UTC-6), y las reglas de dominio deben ser deterministas para probarlas. Es posible que en el futuro exista un backend de sincronización, así que el formato de ID debe ser fácil de almacenar y validar fuera de la app.

## Decisión

- **IDs:** UUIDv7 (RFC 9562), implementación propia en `shared/kernel` (~20 líneas, `crypto.getRandomValues`), sin dependencia externa.
  - Ordenables por tiempo (timestamp de 48 bits en ms al inicio); el orden lexicográfico del string coincide con el orden de creación.
  - **Monótonos por dispositivo:** dos IDs generados en el mismo milisegundo se ordenan por un contador en `rand_a` (RFC 9562 §6.2, método 1).
  - Formato canónico en minúsculas (`0193f1a2-7c4e-7xxx-yxxx-xxxxxxxxxxxx`).
  - Se generan siempre en el cliente (offline-first); un backend futuro los acepta tal cual, nunca los reasigna.
- **Fechas:**
  - `LocalDate` = `'YYYY-MM-DD'` en la zona horaria del dispositivo, para el día de entrenamiento, el calendario del plan y el peso corporal.
  - `Instant` = ISO 8601 con offset (`2026-11-16T22:30:00-06:00`), para `startedAt`, `completedAt`, `recordedAt`.
  - Tipos *branded* en `shared/kernel` para que no se mezclen.
  - **Un `Instant` nunca se ordena ni se compara como string**: dos offsets distintos (por ejemplo, al viajar) dan un orden incorrecto. Se usa `compareInstants` del kernel o se ordena por ID.
- **Puertos:** `Clock { now(): Instant; today(): LocalDate }` e `IdGenerator { next(): ID }` en `shared/kernel`, inyectados en los casos de uso. El dominio nunca llama a `Date.now()`.

## Alternativas consideradas

- **ULID:** mismas ventajas de orden y más compacto (26 caracteres), pero es una especificación comunitaria, sin soporte nativo en bases de datos; en un backend se guardaría como texto o habría que convertirlo a UUID.
- **UUIDv4:** estándar, pero no ordenable por tiempo.
- **Librería (`uuid`, `ulid`):** funciona, pero agrega una dependencia para algo pequeño y fácil de probar contra la especificación (P-7).

## Consecuencias

- (+) Pruebas deterministas (reloj fijo, IDs secuenciales).
- (+) Compatible con almacenamiento `uuid` nativo (Postgres, ORMs, servicios gestionados) si llega un backend.
- (+) Un entrenamiento que cruza la medianoche se asigna al día en que empezó.
- (−) La implementación propia exige pruebas contra la especificación: formato y versión/variante, timestamp decodificable, monotonía en el mismo milisegundo.
- (−) La monotonía es por dispositivo; el ID no sirve para resolver conflictos de sincronización entre dispositivos (eso será otra decisión).
- (−) Hay que convertir con cuidado al graficar por semana (semana ISO, lunes como inicio).
