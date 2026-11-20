# Constitución del proyecto

**Versión:** 1.1 · **Fecha:** 20-nov-2026

Principios no negociables. Cada spec, plan, ADR y PR se revisa contra esta lista. Una excepción requiere enmendar este documento (ver al final), no un comentario en el código.

---

## P-1. Seguridad lumbar primero

El usuario tiene espondilolistesis L5-S1 grado I.

- La app **nunca sugiere, propone ni incluye en el seed** ejercicios con `lumbarRisk: 'high'`: peso muerto (cualquier variante), buenos días, remo con barra inclinado, sentadilla con barra pesada, ejercicios de impacto o saltos.
- Ningún algoritmo (progresión, deload, sustituciones, volumen) puede producir como salida un ejercicio `high`. Esto se verifica con pruebas en el dominio.
- Ante una bandera roja o dolor en nivel de alerta, la app **no sugiere progresión** y remite a un profesional.
- Los mensajes de salud son orientativos y cautelosos. La app no diagnostica ni prescribe. El aviso "la app no es un dispositivo médico" está siempre visible en Ajustes.

## P-2. Los datos del usuario son suyos y no se pierden

- Offline-first: toda la funcionalidad del MVP funciona sin red (RNF-01).
- Cada serie se guarda en cuanto se completa; cerrar la app no pierde datos (RF-13, RF-19).
- Sin cuentas, analítica ni terceros en v1. Los datos de salud no salen del dispositivo salvo por una exportación que hace el usuario (RNF-04).
- Toda exportación lleva la versión de su formato: el respaldo JSON, `schemaVersion` y la versión de cada módulo; los formatos para otras apps (CSV), en el nombre del archivo ([ADR-0013](adr/0013-version-de-formato-en-exportaciones.md)). Todo cambio de esquema tiene migración y prueba de ida y vuelta (RNF-09).
- Borrar o sobrescribir datos siempre pide confirmación y muestra una vista previa.

## P-3. La spec manda

- No se escribe código sin una spec o contrato que lo justifique (ver [`README.md`](README.md)).
- Si algo no está definido, se propone y se pregunta; no se inventa en silencio.
- El código que contradice la spec es un bug, aunque "funcione".

## P-4. Fronteras de módulo verificadas por máquina

- Monolito modular: `plan`, `training`, `progression`, `health`, `data`, más `shared` y `app` ([ADR-0001](adr/0001-monolito-modular.md)).
- De otro módulo solo se importa su `index.ts`. Sin dependencias circulares. `shared` no depende de ningún módulo.
- Cada módulo es el único dueño de sus tablas; los demás usan su API pública.
- El CI falla si se rompe una frontera ([ADR-0008](adr/0008-verificacion-de-fronteras.md)). No se desactivan las reglas con comentarios `eslint-disable` para fronteras.

## P-5. Dominio puro y probado primero

- La capa `domain` es TypeScript puro: sin React, Dexie, `Date.now()` ni `Math.random()` directos. El tiempo y los IDs entran como parámetros o puertos (`Clock`, `IdGenerator`).
- Las reglas de `progression` y `health` se escriben **prueba primero**, citando su ID (`RN-PRG-nn`, `RN-HLT-nn`).
- Cobertura del dominio > 80% (RNF-08).

## P-6. Rápido de usar en el gym

- Registrar una serie: < 5 s, una mano, < 100 ms de respuesta (objetivos 1 y RNF-02).
- Objetivos táctiles ≥ 44 px, contraste WCAG 2.2 AA, controles HTML reales con etiqueta (RNF-05).
- Presupuesto de rendimiento: bundle inicial < 200 KB gzip, primera carga < 2 s en 4G. El CI mide el bundle.

## P-7. Simplicidad sobre previsión

- Empezar con 5 módulos; dividir solo ante fricción real.
- Eventos solo cuando evitan un ciclo o desacoplan un efecto secundario; si basta una llamada a una API pública, se usa la llamada.
- Una dependencia nueva requiere justificación (tamaño, mantenimiento, alternativa nativa). Si es estructural, requiere ADR.

## P-8. Idioma y estilo

- UI y documentación en español. Código, identificadores, nombres técnicos y commits en inglés.
- TypeScript estricto (`strict: true`, `noUncheckedIndexedAccess: true`). Sin `any` en APIs públicas.
- Todo dato que entra desde fuera (import JSON, seed) se valida con Zod ([ADR-0007](adr/0007-zod-en-fronteras.md)).

---

## Checklist de revisión (copiar en cada plan y PR)

- [ ] P-1: ¿alguna salida del sistema puede incluir un ejercicio `high`? ¿Banderas rojas bloquean la progresión?
- [ ] P-2: ¿se guarda cada cambio al instante? ¿Hay migración y prueba de ida y vuelta si cambió el esquema? ¿Cada exportación lleva la versión de su formato?
- [ ] P-3: ¿cada cambio tiene spec o contrato? ¿Quedan `[POR DEFINIR]`?
- [ ] P-4: ¿solo se importan `index.ts` de otros módulos? ¿Sin ciclos? ¿Nadie toca tablas ajenas?
- [ ] P-5: ¿el dominio es puro? ¿Las pruebas de progression/health se escribieron antes?
- [ ] P-6: ¿objetivos ≥ 44 px, contraste AA, bundle dentro del presupuesto?
- [ ] P-7: ¿hay algo que se pueda quitar?
- [ ] P-8: ¿entradas externas validadas con Zod? ¿Sin `any` público?

## Enmiendas

1. Abrir un ADR que explique el cambio, el motivo y el impacto.
2. El dueño del producto lo aprueba.
3. Subir la versión de este documento y registrar el cambio abajo.

| Versión | Fecha | Cambio |
|---|---|---|
| 1.0 | 16-nov-2026 | Versión inicial |
| 1.1 | 20-nov-2026 | P-2: toda exportación lleva la versión de su formato; el CSV, en el nombre del archivo (ADR-0013, spec 008) |
