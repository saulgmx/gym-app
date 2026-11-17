# ADR-0002: PWA offline-first con Dexie (IndexedDB)

- **Estado:** Aceptado
- **Fecha:** 16-nov-2026
- **Relacionado:** RNF-01, RNF-03, RNF-04, RNF-09, P-2

## Contexto

La app se usa en el gym, a veces sin señal. Los datos son de salud y deben quedarse en el dispositivo en v1. Se necesitan consultas por índice (historial por ejercicio), reactividad en la UI y migraciones de esquema.

## Opciones

1. **localStorage:** síncrono, ~5 MB, sin índices ni transacciones.
2. **IndexedDB directo o `idb`:** completo pero verboso; sin reactividad.
3. **Dexie + `dexie-react-hooks`:** IndexedDB con índices compuestos, transacciones, `version().upgrade()` y `useLiveQuery`.
4. **SQLite en WASM (OPFS):** potente, pero pesado (~1 MB) y con soporte irregular en Safari iOS 16.

## Decisión

Opción 3, con `vite-plugin-pwa` (Workbox) para precache de la app shell y `navigator.storage.persist()` al primer arranque.

## Consecuencias

- (+) Funciona offline sin servidor; consultas reactivas; migraciones declarativas.
- (+) ~25 KB gzip.
- (−) Safari puede borrar datos de sitios no instalados tras inactividad: se mitiga con instalación como PWA, `persist()` y respaldo manual (RF-42).
- (−) Sin sincronización: queda para v2 (ver QS-09).
- Las pruebas usan `fake-indexeddb`; el dominio no depende de Dexie.
