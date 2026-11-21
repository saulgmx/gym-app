# Retrospectiva del MVP (fases 0 a 3)

**Fecha:** 21-nov-2026 · **Periodo:** 16 al 20-nov-2026 · **Estado:** borrador para discutir

Las acciones marcadas `[PROPUESTO]` están pendientes de aprobación del dueño del producto. Una vez aprobadas, cada una se convierte en un cambio de documento, un ADR o una tarea de la fase 4, según corresponda.

**Fuentes:** historial de git (411 commits), `docs/handoff.md`, `docs/handoff-history.md`, `docs/constitution.md` v1.1, `docs/templates/`, specs 000 a 009 y ADR-0014.

## 1. Cifras

| Medida | Valor |
|---|---|
| Duración | 5 días (16 al 20-nov) |
| Commits | 411 (12, 118, 129, 92 y 60 por día) |
| Commits sin merge por tipo | `docs` 118, `feat` 103, `test` 86, `chore` 10, `fix` 3, `ci` 3, `refactor` 2, `perf` 1 |
| Líneas de documentación (`docs/**/*.md`) | ~9.5k |
| Líneas de código de producción (`src/`, sin pruebas) | ~8.1k |
| Líneas de pruebas (unitarias, componente y E2E) | ~23.3k (≈ 2.9 por línea de código) |
| E2E | 150, en Chromium y WebKit |
| Bundle inicial | 177.49 kB de 200 kB |
| Versiones de documentos | `training.md` v1.1 → v1.36; `spec.md` v0.3 → v0.16; `architecture.md` → v1.7 |
| Specs | 10 (000 a 008, con 005b); 2 de ellas de rediseño (003 y 004) |

El tiempo de reloj no está registrado: las cifras miden esfuerzo por commits y PRs, no por horas.

## 2. Línea de tiempo

**Fase 0 (16 y 17-nov, PR #3 a #6).** Herramientas, fronteras de módulo en CI, kernel, PWA, Vercel con dominio propio y `main` protegida. Sin retrabajo notable. La inversión en fronteras y CI se pagó en todas las fases siguientes.

**Fase 1 (17-nov, PR #7 a #10).** Módulo `plan`, seed real (36 ejercicios, 11 plantillas) y "Hoy". Las mutaciones mataron 43 mutantes en el dominio de `plan`. El seed se revisó contra una transcripción a mano de `plan.md`, sin errores.

**Fase 2 (17-nov, PR #12 a #17).** Módulo `training`, sesión activa y base v2. La verificación en el iPhone encontró el signo menos en reps y RIR bajo la asistencia (PR #17): se guardaba bien pero se mostraba mal, y ninguna prueba miraba lo que se veía.

**Fase 2.5 (18-nov, PR #18 a #30).** Rediseño de "Hoy" (spec 003) y de la sesión activa (spec 004), ambos construidos uno o dos días antes. Dos specs, dos planes, dos listas de tareas y 11 PRs de implementación. Causa principal: los diseños (`design-hoy.md`, `design-sesion-activa.md`) se eligieron después de construir las pantallas, así que las specs 001 y 002 no tuvieron una fuente de diseño cerrada.

**Fase 3 (18 al 20-nov, PR #37 a #76).** Cierre con dolor lumbar (005), una sesión por día (005b), historial (006), respaldo JSON (007) y CSV (008). La 005b salió del uso real: el 18-nov quedaron dos sesiones cerradas el mismo día en el iPhone, y la regla nueva cambió dos pruebas de la 005. El iPhone volvió a encontrar algo que ninguna prueba vio: el script de la hoja de compartir de Safari disparaba el aviso de error genérico (T20a). En la 008 empezó el piloto con Qwen.

## 3. Hallazgos

### 3.1 Flujo SDD

**Lo que funcionó:**

- **H-1. "Una contradicción es un bug de documentación".** Detectó choques antes del código. Por ejemplo, la spec 006 contradecía RN-TRN-17 y se corrigió la spec (decisión 10).
- **H-2. Dominio puro y puertos.** `DataPort.describe` permitió que `data` revise las referencias entre módulos sin conocer a ninguno, y el CSV se agregó como un método más del mismo puerto (`seriesRows`).
- **H-3. Puntos de control.** Dieron PRs chicos, cada uno con el CI en verde y fáciles de revisar.
- **H-4. Preguntas con propuesta.** La tabla "Pendiente de confirmar" convertía cada decisión en un sí o un no.
- **H-5. Handoff.** Permitió empezar cada chat nuevo sin perder el estado.

**Lo que se sintió como burocracia:**

- **H-6. Versiones de documentos que ya viven en git.** `training.md` llegó a v1.36 en 4 días. El número de versión y la frase "Contrato v1.xx" repiten lo que ya da `git log`, y obligan a tocar varios documentos por cada cambio.
- **H-7. Tres PRs de docs por spec** (spec, plan y tareas), incluso para la 005b, que era una sola regla.
- **H-8. Documentos que repiten lo mismo.** `handoff-history.md` copia lo que ya dicen las specs, y `spec.md` sube de versión con cada feature.
- **H-9. "Notas para retomar" tiene unas 70 viñetas.** Se carga en cada sesión y mezcla trucos de entorno (zsh, DNS, mise), trampas de pruebas y lecciones de mutaciones. Muchas deberían ser una regla de lint, un script o un ayudante de prueba, no prosa.
- **H-10. El checklist de la constitución** dice "copiar en cada plan y PR". Falta comprobar si de verdad se usó o si se volvió un ritual.

### 3.2 Esfuerzo y retrabajo

- **H-11. El diseño llegó después del código** (fase 2.5, ver §2). Fue el retrabajo más grande del MVP.
- **H-12. Los casos de borde se descubrían al escribir las pruebas.** Los commits "define the edge cases of RN-… before T…" se repiten en las specs 006, 007 y 008. El plan dejaba huecos que la tarea de pruebas acababa cerrando.
- **H-13. Inestabilidad de las pruebas.** La descarga que llegaba tarde a la prueba siguiente, las transiciones asíncronas de React Router 8, el reloj en CI y `apt` lento en CI. Gran parte de las notas del handoff es infraestructura de pruebas.
- **H-14. Proporción de 2.9 líneas de prueba por línea de código, con 150 E2E en dos navegadores.** Es razonable para el dominio y la salud lumbar. Falta revisar si hay E2E que repiten lo que ya cubren las pruebas de componente.
- **H-15. Reglas descubiertas en el uso real** (005b). Es lo esperado en un MVP, pero conviene un camino ligero para estas specs de una sola regla.

### 3.3 Mutaciones

- **H-16. Encontraron pruebas que pasaban sin probar nada:** el `replace` de la redirección (fase 0, T15), `showNotice` reemplazando el aviso (T16) y el rechazo de `persist()` sin capturar (T17), que Vitest ni siquiera marcó.
- **H-17. Los mutantes escritos a mano generan confianza falsa.** Hubo mutantes que no compilaban, mutantes con `sed …/g` que tocaron otra regex (008 T5), mutantes que "morían" por un `throw` incondicional, mutantes equivalentes, un script que en zsh pasaba `$T` como una sola ruta y dejaba "vivos" todos los mutantes (005b T4), y un `cp` de respaldo que restauró una copia vieja (T16). El método vale; la ejecución manual es frágil.
- **H-18. Ni las pruebas ni las mutaciones encontraron los dos fallos más visibles** (el signo de la asistencia y el aviso con la hoja de compartir de Safari). Los encontró el iPhone. La verificación en el dispositivo es una puerta tan valiosa como las mutaciones.

### 3.4 Piloto con Qwen

- **H-19. Hasta ahora fue calibración, no ahorro.** T5 y T9 de la 008 eran tareas de ~15 líneas con mucho contexto: el brief y la verificación de Opus costaron tanto como hacerlas directamente.
- **H-20. Los fallos fueron de configuración, no del modelo:** código de ejemplo del brief que no pasaba lint, memorias de otro proyecto que se colaban en los briefs, un bucle de razonamiento de ~10 min en LM Studio, Qwen Code mandando su propia temperatura, y el 27B que no formatea las llamadas a herramientas.
- **H-21. La disciplina SDD es lo que hace viable delegar.** Tareas chicas, IDs de reglas, archivos permitidos y pruebas de Opus que Qwen no puede tocar son justo el contrato que necesita un modelo local.
- **H-22. ADR-0014 no tiene una métrica de éxito numérica.** Dice cuándo se revisa (> 30 % de escalamientos), pero no qué resultado lo hace valer la pena.

### 3.5 Otros

- **H-23. P-8 cita ADR-0007**, que fue reemplazado por ADR-0012.
- **H-24. P-5 pide pruebas primero solo en `progression` y `health`**, pero en la práctica se hicieron en todos los módulos (commits "red" en `plan`, `training`, `data` y `app`).
- **H-25. Los docs del Project de claude.ai están desactualizados**: el handoff es del 16-nov y la constitución sigue en v1.0, mientras el repo va en la fase 4.
- **H-26. El bundle está en 177 de 200 kB** y la fase 4 trae uPlot y la pestaña "Progreso".

## 4. Start / Stop / Continue

### Start

| # | Acción | Hallazgo | Dónde | Cuándo |
|---|---|---|---|---|
| S-1 | Aprobado (21-nov). Sección "Fuente de diseño" obligatoria en toda spec con interfaz: sin diseño elegido, la spec no pasa la puerta Spec → Plan | H-11 | `templates/feature-spec.md`, `docs/README.md` (puertas) | Antes de la spec 010 |
| S-2 | Aprobado (21-nov). Sección "Casos de borde por regla" en el plan, cerrada antes de aprobarlo | H-12 | `templates/feature-plan.md` | Antes de la spec 010 |
| S-3 | `[PROPUESTO]` Columnas "Ejecutor (Q/C/U)", "Archivos permitidos" y "Mutaciones" en las tareas, y tareas fijas: bundle, iPhone y cierre de casos de borde | H-18, H-21 | `templates/tasks.md` | Con la aceptación de ADR-0014, o antes si se aprueba |
| S-4 | `[PROPUESTO]` Evaluar Stryker (mutaciones con Vitest) para `progression` y `health`, en lugar del script manual | H-17 | ADR nuevo si se adopta (P-7) | Spec 010 |
| S-5 | Aprobado (21-nov). Vía ligera para specs chicas (una regla, sin cambio de esquema): spec, plan y tareas en un archivo y un PR | H-7, H-15 | `docs/README.md` | Antes de la spec 011 |
| S-6 | `[PROPUESTO]` Métrica de éxito de ADR-0014: tokens de Claude por tarea `Q` frente a hacerla con Opus, tiempo de brief y revisión, % de escalamientos y mutantes vivos | H-19, H-22 | ADR-0014 (sigue propuesto, se puede editar) | T16 de la spec 009 |
| S-7 | `[PROPUESTO]` Regla de carga diferida para pantallas nuevas con dependencias pesadas, en lugar de decidirlo spec por spec | H-26 | `architecture.md`; constitución P-6 si se quiere como principio | Spec 012 |
| S-8 | `[PROPUESTO]` Regla en la constitución o el checklist: P-1, `progression`, `health` y las migraciones de Dexie nunca se delegan | H-21 | `constitution.md` (enmienda con ADR) o ADR-0014 | Con la aceptación de ADR-0014 |

### Stop

| # | Acción | Hallazgo | Dónde | Cuándo |
|---|---|---|---|---|
| X-1 | Aprobado (21-nov). Dejar de numerar las versiones de los contratos y de `spec.md`; el historial es git. Conservar solo un registro de cambios para decisiones de contrato | H-6, H-8 | `docs/README.md`, `docs/modules/*.md` | Antes de la spec 010 |
| X-2 | `[PROPUESTO]` Dejar de escribir lecciones como prosa cuando pueden ser código: ayudantes de prueba, script de mutaciones, reglas de lint | H-9, H-13 | Handoff → `tests/`, `scripts/`, `eslint.config.js` | Gradual, en cada spec |
| X-3 | `[PROPUESTO]` Dejar de mantener `handoff-history.md` como copia: un índice de enlaces a specs y PRs basta | H-8 | `docs/handoff-history.md` | Cuando convenga |
| X-4 | `[PROPUESTO]` Dejar de delegar a Qwen tareas de menos de ~50 líneas o con mucho contexto | H-19 | ADR-0014 | Ya (criterio del handoff) |

### Continue

| # | Práctica | Hallazgo |
|---|---|---|
| C-1 | Contradicciones resueltas en el documento de menor rango, nunca en el código | H-1 |
| C-2 | Dominio puro con puertos; un módulo no conoce a otro | H-2 |
| C-3 | Puntos de control con PRs chicos y CI obligatorio | H-3 |
| C-4 | Preguntas abiertas siempre con una propuesta | H-4 |
| C-5 | Mutaciones tras cada prueba en verde, revisando el diff del mutante antes de contarlo | H-16, H-17 |
| C-6 | Verificación en el iPhone, también en modo avión, como tarea de cada spec | H-18 |
| C-7 | Pruebas de Opus que Qwen no puede tocar; trailer `Implemented-by` | H-21 |

### Correcciones directas (sin decisión de diseño)

| # | Acción | Hallazgo |
|---|---|---|
| F-1 | Aprobado (21-nov). P-8 debe citar ADR-0012 en lugar de ADR-0007 | H-23 |
| F-2 | Aprobado (21-nov): opción 2, prueba primero para todo comportamiento con ID, con excepciones declaradas en `tasks.md` (ADR-0015) | H-24 |
| F-3 | Sincronizar los docs del Project de claude.ai con el repo, o declarar el repo como única fuente | H-25 |

## 5. Preguntas abiertas

1. ¿El prototipo visual del 16-nov no tenía suficiente detalle, o no se usó como fuente de las specs 001 y 002? (H-11)
2. ¿El checklist de la constitución se revisó de verdad en cada plan y PR? (H-10)
3. ¿Qué E2E se podrían quitar porque repiten pruebas de componente? (H-14)
4. ¿Vale la pena Stryker como dependencia de herramientas, o basta con un script de mutaciones más robusto en el repo? (S-4)
5. ¿Qué cifra de ahorro hace que ADR-0014 merezca pasar a `Aceptado`? (S-6)
