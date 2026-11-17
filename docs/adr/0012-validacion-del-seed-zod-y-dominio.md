# ADR-0012: Validación en las fronteras con Zod (forma) y el dominio (reglas)

- **Estado:** Aceptado
- **Fecha:** 17-nov-2026
- **Relacionado:** reemplaza a ADR-0007; P-1, P-8, RF-01, RF-41, RNF-10, ADR-0010, modules/plan.md (RN-PLN-07, 15, 19, 20, 24)

## Contexto

ADR-0007 fijó Zod en las fronteras de entrada (seed e importación). Al implementar la spec 001 aparecieron dos puntos en los que el ADR y el contrato de `plan` se contradicen:

1. ADR-0007 dice que "el esquema del seed rechaza ejercicios `lumbarRisk: 'high'` en plantillas". El contrato los rechaza en `validateSeed` (dominio puro), con su propio código `plan/high-risk-exercise` y antes que cualquier otro error (RN-PLN-07, 19). Si Zod los rechazara, el error saldría como `plan/invalid-seed`.
2. ADR-0007 dice que "el seed se valida en el arranque solo cuando la base está vacía", para que Zod pudiera cargarse en diferido. RN-PLN-20 valida el seed en cada arranque. El plan de la spec 001 ya importa el seed y Zod de forma estática (plan §5, §6.2), y `size-limit` vigila el tamaño.

## Opciones

1. **Zod rechaza `high` y solo se valida con la base vacía (ADR-0007 al pie de la letra):** permite cargar Zod en diferido, pero duplica la regla de seguridad en dos capas, cambia su código de error y requiere una lectura fuera de la transacción antes de validar.
2. **Zod valida la forma y el dominio las reglas; se valida siempre:** una regla vive en un solo sitio y conserva su código; el mismo seed da siempre el mismo resultado y un build roto se detecta aunque haya datos. Zod entra en el bundle inicial.

## Decisión

Se elige la opción 2. Reemplaza a ADR-0007, que se mantiene en todo lo demás:

- Cada módulo define en `infrastructure/` los esquemas Zod de su seed y de su parte de la exportación. Se valida **solo en las fronteras** (seed, importación, migración de exportaciones antiguas); dentro del sistema se confía en los tipos.
- **Zod valida la forma:** tipos, enums, claves desconocidas, formato de IDs, enteros y rangos de cada valor. Un fallo es `<módulo>/invalid-seed` (o el código de importación del módulo), con las rutas de los problemas en `details`.
- **El dominio valida las reglas** que cruzan registros (referencias, cobertura de semanas, calendario) y las de seguridad. `lumbarRisk: 'high'` es un valor válido para el esquema; lo rechaza la regla de dominio con `plan/high-risk-exercise` (P-1, RN-PLN-07).
- **El seed se valida en cada arranque**, también con la base cargada (RN-PLN-20).
- Se usa Zod 4 clásico; `zod/mini` si el tamaño importa (plan de la spec 001, §6.2).

## Consecuencias

- (+) La regla de seguridad tiene un solo dueño (el dominio, probado con mutaciones) y un código propio.
- (+) Errores de forma claros, con la ruta del campo; el esquema no repite reglas del dominio.
- (−) Zod y el seed están en el bundle inicial; se mide con `size-limit` (AC-23).
- (−) Un seed roto en un build bloquea el arranque aunque haya datos; lo evitan las pruebas del seed real (AC-4) antes de llegar a producción.
- Revisar si el bundle se acerca al presupuesto: cargar el seed y Zod en diferido exigiría volver a validar solo con la base vacía.
