# ADR-0015: Pruebas primero para todo comportamiento con ID

- **Estado:** Aceptado
- **Fecha:** 21-nov-2026
- **Relacionado:** enmienda P-5 de la constitución (v1.2); RNF-08; [retrospectiva del MVP](../retros/mvp-fases-0-3.md) (H-16, H-18, H-24, F-2)

## Contexto

P-5 exigía pruebas primero solo en `progression` y `health`. En las fases 0 a 3 se hizo en todos los módulos: commits de prueba en rojo en `app` (32), `training` (16), `plan` (10), `health` (7) y `data` (4); `progression` aún no tiene código (H-24). Las mutaciones encontraron pruebas que pasaban sin probar nada fuera de esos dos módulos (H-16), y los dos fallos más visibles los encontró el iPhone, no las pruebas (H-18). La constitución pedía menos de lo que se hacía.

## Opciones

1. **Dejar P-5 como está:** flexible, pero la regla no describe la práctica y se puede abandonar sin incumplir nada.
2. **Prueba primero para todo comportamiento con ID, con excepciones declaradas:** fija la práctica y deja visible qué queda fuera.
3. **Prueba primero para todo cambio de código, sin excepciones:** obliga a pruebas artificiales en configuración, estilos o herramientas.

## Decisión

Se elige la opción 2. P-5 pasa a decir:

> Todo comportamiento con ID (regla `RN-<MOD>-nn` o criterio de aceptación verificable por prueba automática) se escribe **prueba primero**, en cualquier módulo y en `app`, citando su ID. Corregir un fallo empieza con una prueba que lo reproduce. En `progression` y `health` no hay excepciones. En el resto pueden ir sin prueba previa, si la tarea lo declara con su motivo: tareas sin comportamiento propio (herramientas, configuración, estilos), refactors cubiertos por pruebas existentes y criterios que se verifican a mano (iPhone o revisión visual).

## Consecuencias

- (+) La constitución describe la práctica que funcionó en el MVP, y los criterios manuales (H-18) quedan reconocidos en lugar de forzar pruebas artificiales.
- (−) Más pasos en tareas de UI de `app`.
- El orden se verifica en el `git log` del PR: el commit `test` en rojo va antes del `feat`, y se suben juntos.
- Las excepciones se revisan al aprobar las tareas, no después del código.
