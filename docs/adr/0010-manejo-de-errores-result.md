# ADR-0010: Errores esperados con `Result<T, E>`

- **Estado:** Aceptado
- **Fecha:** 16-nov-2026
- **Relacionado:** spec §8.5 (`shared/kernel` incluye `Result`), architecture §7.7, P-2, P-8, modules/shared.md §2

## Contexto

Los casos de uso tienen fallos esperados (serie inexistente, dolor fuera de rango, sesión ya cerrada, import inválido) que la UI debe mostrar con un mensaje concreto. Las excepciones no aparecen en la firma y se olvidan.

## Decisión

- `shared/kernel/result.ts`:

```ts
export type Result<T, E extends DomainError = DomainError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export interface DomainError<C extends string = string> {
  code: C;          // estable, '<módulo>/<kebab-case>'
  message: string;  // técnico, en inglés, solo para logs; nunca se muestra al usuario
  details?: unknown;
}
```

- Los casos de uso públicos devuelven `Promise<Result<T>>`.
- **Códigos tipados por módulo:** cada módulo exporta en su `index.ts` una unión literal de sus códigos (`type TrainingErrorCode = 'training/workout-not-found' | 'training/workout-closed'`) y la documenta en su contrato (`modules/<m>.md`).
- **Mensajes al usuario:** solo desde un mapa `code → texto en español` en `app` (`Record<ErrorCode, string>` sobre la unión de todos los códigos). Agregar un código sin su mensaje rompe `tsc`.
- **Errores inesperados** (bugs, fallos de IndexedDB no previstos) son excepciones:
  - Un *error boundary* en `app` captura los errores de render.
  - Un handler global de `error` y `unhandledrejection` captura lo que el boundary no ve (handlers y promesas, incluida casi toda la escritura en Dexie) y muestra un aviso con la opción de exportar un respaldo.
- **Almacenamiento lleno es un error esperado:** la infraestructura convierte `QuotaExceededError` en `'data/storage-full'`, con aviso persistente "Almacenamiento lleno, exporta un respaldo" (P-2).
- Las consultas reactivas (`useX`) devuelven el dato o `undefined`; no usan `Result`.

## Alternativas consideradas

- **Solo excepciones:** menos código en los llamadores, pero los fallos esperados no aparecen en la firma ni en el contrato.
- **Librería (`neverthrow`, `ts-results`):** más combinadores de los que necesitamos; el tipo cabe en pocas líneas (P-7).

## Consecuencias

- (+) Los errores esperados forman parte del contrato y se prueban.
- (+) Mensajes de UI mapeados por `code`, en español, en un solo lugar y verificados por el tipo.
- (+) Ningún error async se pierde en silencio.
- (−) Algo más de código en los llamadores (`if (!r.ok)`).
- (−) Cada código nuevo requiere tocar el contrato del módulo y el mapa de mensajes.
