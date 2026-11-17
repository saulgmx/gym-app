# ADR-0010: Errores esperados con `Result<T, E>`

- **Estado:** Propuesto
- **Fecha:** 16-nov-2026
- **Relacionado:** spec §8.5 (`shared/kernel` incluye `Result`), architecture §7.7

## Contexto

Los casos de uso tienen fallos esperados (serie inexistente, dolor fuera de rango, sesión ya cerrada, import inválido) que la UI debe mostrar con un mensaje concreto. Las excepciones no aparecen en la firma y se olvidan.

## Decisión propuesta

- `shared/kernel/result.ts`:

```ts
export type Result<T, E extends DomainError = DomainError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export interface DomainError { code: string; message: string; details?: unknown }
```

- Los casos de uso públicos devuelven `Promise<Result<T>>`. Los `code` son estables y tipados por módulo (`'training/workout-not-found'`, `'health/pain-out-of-range'`).
- Las excepciones quedan para errores no esperados (IndexedDB, cuota, bugs), capturados por un *error boundary* en `app`.
- Las consultas reactivas (`useX`) devuelven el dato o `undefined`; no usan `Result`.

## Consecuencias

- (+) Los errores esperados forman parte del contrato y se prueban.
- (+) Mensajes de UI mapeados por `code`, en español, en un solo lugar.
- (−) Algo más de código en los llamadores (`if (!r.ok)`).
