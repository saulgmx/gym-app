# App de seguimiento de entrenamiento: especificación de diseño y arquitectura

**Versión:** 0.14 (borrador) · **Fecha:** 20-nov-2026 · **Stack:** React + TypeScript (PWA, offline-first) · **Estilo:** monolito modular

Este documento define **qué** hace la app y **por qué**. El **cómo** está en [`architecture.md`](architecture.md), los contratos por módulo en [`modules/`](modules/), las decisiones en [`adr/`](adr/README.md) y las reglas no negociables en [`constitution.md`](constitution.md). Flujo de trabajo: [`README.md`](README.md).

Prototipo visual de referencia: https://claude.ai/artifact/4n7JmYVCDFjgH558Foi2Zk (4 pantallas con datos de ejemplo).

---

## 1. Resumen

App personal para registrar entrenamientos de hipertrofia siguiendo un plan por bloques (Full body → Torso/Pierna → PPL + Upper/Lower), con:

- Registro rápido de series (peso, repeticiones, RIR) durante la sesión.
- Sugerencia automática de progresión de carga.
- Seguimiento de dolor lumbar (espondilolistesis L5-S1 grado I) con alertas.
- Gráficas de progreso por ejercicio y peso corporal.
- Funcionamiento sin conexión y datos 100% locales por defecto.

### Objetivos

1. Registrar una serie en menos de 5 segundos, con una mano, entre series.
2. Que cada sesión muestre lo que se hizo la vez anterior y qué cargar hoy.
3. Detectar a tiempo tendencias de dolor lumbar.
4. Tener los datos bajo control del usuario (exportables, sin cuenta obligatoria).

### No objetivos (v1)

- Red social, retos o rankings.
- Recomendaciones médicas o diagnóstico. La app avisa y sugiere consultar a un profesional; no sustituye a uno.
- Planes generados por IA dentro de la app.
- Seguimiento detallado de comidas (solo peso corporal y calorías/proteína opcionales en v2).

---

## 2. Usuario y contexto de uso

- **Usuario principal:** un solo usuario (el propio desarrollador), 39 años, intermedio, entrena 5 días/semana.
- **Dispositivo:** celular, de pie en el gym, a veces con manos sudadas y mala señal.
- **Restricción clínica:** espondilolistesis L5-S1 grado I. Evita peso muerto, sentadilla con barra pesada e impacto; usa faja solo en ejercicios pesados. Dolor lumbar actual: ninguno.
- **Implicaciones de diseño:** botones grandes (≥44 px), poco texto, uso offline, mínimo número de toques para registrar.

---

## 3. Alcance por versiones

| Versión | Contenido |
|---|---|
| **MVP (v0.x)** | Plan cargado desde seed, pantalla Hoy, sesión activa, cierre con dolor lumbar, historial, gráfica por ejercicio, exportar/importar JSON, PWA instalable y offline |
| **v1.0** | Sugerencia de progresión, alertas de dolor, temporizador de descanso, peso corporal, plan editable (ejercicios y rangos), deload sugerido |
| **v1.1** | Notas por ejercicio, sustituciones de ejercicio, volumen semanal por músculo, recordatorios (notificaciones) |
| **v2** | Sincronización entre dispositivos (cuenta opcional), calorías y proteína, importar rutinas de otros formatos, widgets |

---

## 4. Requerimientos funcionales

Prioridad: **P0** imprescindible · **P1** importante · **P2** deseable.

### 4.1 Plan y bloques

| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-01 | La app carga el plan desde un archivo seed JSON (bloques, semanas, plantillas por día, ejercicios, series y rangos de repeticiones) | P0 |
| RF-02 | Mostrar bloque actual, semana (n de total) y la sesión que corresponde hoy según el día de la semana | P0 |
| RF-03 | Permitir mover la fecha de inicio del plan y saltar a una semana concreta | P1 |
| RF-04 | Editar plantillas: añadir, quitar, reordenar y sustituir ejercicios, series y rangos | P1 |
| RF-05 | Marcar semanas de deload y aplicar el 50% de series automáticamente en la plantilla | P1 |
| RF-06 | Permitir sesiones fuera de plan (sesión libre) | P2 |

### 4.2 Sesión activa

| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-10 | Iniciar sesión desde Hoy; se crea un `Workout` con los ejercicios de la plantilla | P0 |
| RF-11 | Por serie: peso (kg), repeticiones, RIR y marca de completada | P0 |
| RF-12 | Prellenar el peso con la sugerencia; mostrar al lado la serie anterior (peso × reps) | P0 |
| RF-13 | Guardar cada serie en cuanto se completa (sin botón "guardar" global), para no perder datos si se cierra la app | P0 |
| RF-14 | Navegar entre ejercicios (siguiente/anterior) y ver cuáles faltan | P0 |
| RF-15 | Temporizador de descanso que arranca al completar una serie, con el rango recomendado (2-3 min compuestos, 60-90 s aislamiento) | P1 |
| RF-16 | Agregar o quitar series extra por ejercicio | P1 |
| RF-17 | Mostrar el consejo técnico del ejercicio (por ejemplo, "sin arco lumbar") | P1 |
| RF-18 | Pantalla encendida durante la sesión (Wake Lock API) | P2 |
| RF-19 | Recuperar la sesión en curso si se cierra o recarga la app | P0 |

### 4.3 Cierre de sesión

| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-20 | Resumen: duración, series completadas, ejercicios | P0 |
| RF-21 | Registrar dolor lumbar de 0 a 10 (obligatorio al cerrar) | P0 |
| RF-22 | Mostrar mensaje según el nivel de dolor (ver reglas en sección 6.2) | P0 |
| RF-23 | Notas libres de la sesión | P1 |
| RF-24 | Resumen "para la próxima sesión" con la progresión calculada por ejercicio | P1 |

### 4.4 Progresión y análisis

| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-30 | Calcular la sugerencia de peso para cada ejercicio según las reglas de la sección 6.1 | P1 |
| RF-31 | Gráfica por ejercicio: mejor serie (peso o repeticiones) por semana | P0 |
| RF-32 | Historial de sesiones con detalle por serie | P0 |
| RF-33 | Gráfica y lista del dolor lumbar por sesión | P0 |
| RF-34 | Registro de peso corporal (fecha, kg) y gráfica con la meta semanal | P1 |
| RF-35 | Volumen semanal (series efectivas) por grupo muscular | P2 |
| RF-36 | Sugerir deload cuando se cumplan las condiciones de la sección 6.3 | P1 |

### 4.5 Datos

| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-40 | Exportar todos los datos a JSON (con `schemaVersion`) y las series a CSV | P0 |
| RF-41 | Importar JSON con validación y vista previa antes de sobrescribir | P0 |
| RF-42 | Respaldo manual rápido (botón "Descargar respaldo") y recordatorio mensual | P1 |
| RF-43 | Borrar todos los datos locales con confirmación | P1 |

### 4.6 Ajustes

| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-50 | Unidad de peso (kg por defecto) e incrementos mínimos por tipo de equipo (barra 2.5, mancuernas 2, máquina 5) | P1 |
| RF-51 | Umbral de dolor lumbar configurable (por defecto 3) | P1 |
| RF-52 | Tema de color de acento (3 opciones) | P2 |

---

## 5. Requerimientos no funcionales

| ID | Categoría | Requerimiento |
|---|---|---|
| RNF-01 | Offline | Toda la funcionalidad del MVP funciona sin conexión (service worker + IndexedDB) |
| RNF-02 | Rendimiento | Primera carga <2 s en 4G; registrar una serie <100 ms de respuesta; bundle inicial <200 KB gzip |
| RNF-03 | Persistencia | Pedir almacenamiento persistente (`navigator.storage.persist()`) para evitar que el navegador borre los datos |
| RNF-04 | Privacidad | Datos de salud solo en el dispositivo en v1; sin analítica ni terceros; el respaldo lo hace el usuario |
| RNF-05 | Accesibilidad | WCAG 2.2 AA: contraste ≥4.5:1, objetivos táctiles ≥44 px, `button` y `input` reales con etiqueta, navegación por teclado |
| RNF-06 | Usabilidad | Uso con una mano; tamaño de texto del sistema respetado; modo oscuro por defecto |
| RNF-07 | Compatibilidad | Safari iOS 16+, Chrome Android actual, Chrome/Edge/Firefox de escritorio |
| RNF-08 | Mantenibilidad | TypeScript estricto, lógica de dominio pura y sin dependencias de React, cobertura >80% en dominio |
| RNF-09 | Integridad | Migraciones de esquema versionadas; toda exportación lleva la versión de su formato: el JSON dentro del archivo (`schemaVersion`), el CSV en el nombre (ADR-0013) |
| RNF-10 | Seguridad | CSP estricta, sin `dangerouslySetInnerHTML`, validación con Zod al importar |

---

## 6. Reglas de negocio

### 6.1 Progresión de carga (por ejercicio)

Entrada: las últimas sesiones del ejercicio y el rango de repeticiones objetivo `[min, max]`.

1. **Subir peso** si en la última sesión se completaron todas las series objetivo con `reps >= max` y `RIR >= 1`.
   - Incremento: `+2.5%` redondeado al incremento mínimo del equipo (barra 2.5 kg, mancuerna 2 kg, máquina 5 kg), nunca menos que un paso.
   - Mensaje: "Sube a X kg. La última vez hiciste N × M con Y kg, el tope del rango."
2. **Mantener peso** si no se llegó al tope en todas las series: "Mantén X kg hasta llegar a N × M".
3. **Bajar peso (5-10%)** si `reps < min` en 2 sesiones seguidas con el mismo peso, o si el dolor lumbar superó el umbral en una sesión que incluyó ese ejercicio.
4. **Sin historial:** primera sesión con RIR 3-4 y sin sugerencia numérica.
5. En ejercicios medidos en repeticiones (dominadas), la sugerencia es subir 1 repetición por serie hasta el tope; al llegar al tope en todas las series, añadir lastre de 1-2.5 kg.

### 6.2 Dolor lumbar

| Nivel | Estado | Mensaje y acción |
|---|---|---|
| 0-3 | Normal | "Molestia leve, dentro de lo normal. Sigue con el plan." |
| 4-6 | Atención | "Molestia alta. Baja la carga la próxima sesión y evita los ejercicios que la provocaron." Marca los ejercicios de la sesión para revisión |
| 7-10 | Alerta | "Dolor alto. Detén el entrenamiento de esta zona y consulta a tu traumatólogo o fisioterapeuta." |

Reglas adicionales:

- Las bandas 0-3 / 4-6 / 7-10 y sus mensajes son **fijos**: no cambian con el umbral configurable (RF-51), que solo decide el aviso persistente.
- Si el dolor supera el umbral **2 sesiones seguidas**, o sube durante **3 sesiones seguidas** (3 últimas lecturas estrictamente crecientes, la última > 0), mostrar aviso persistente en Hoy.
- Hoy también muestra el aviso cuando la **última lectura** está en Atención o Alerta (≥ 4) o tiene banderas rojas, para recordar la acción de su mensaje en la sesión siguiente. Es un solo aviso; su texto depende de la causa.
- **Banderas rojas** (casilla opcional al cerrar): dolor que baja por la pierna, hormigueo o adormecimiento, debilidad en el pie, problemas de control de vejiga o intestino. Si se marca alguna, mostrar un mensaje destacado para consultar a un médico (urgencias si hay problema de vejiga o intestino) y no sugerir progresión.
- Aviso permanente en Ajustes: la app no es un dispositivo médico.

### 6.3 Deload

Sugerir deload (50% de series, mismo peso, RIR 4) cuando ocurra cualquiera de estas:

- La semana programada del plan es de deload (semana 15 del plan base).
- 3 semanas seguidas sin progreso en ninguno de los ejercicios principales.
- Dolor lumbar sobre el umbral en 2 sesiones seguidas.
- El usuario lo marca manualmente.

### 6.4 Plan por bloques (seed base)

| Semanas | Bloque | Días de pesas | RIR objetivo |
|---|---|---|---|
| 1-4 | Full body (A/B) | 3 | 2-4 |
| 5-8 | Torso/Pierna | 4 | 2-3 |
| 9-14 | PPL + Upper/Lower | 5 | 1-3 |
| 15 | Deload | 3-5 | 4 |

La primera semana de cada bloque aplica ~70% de las series. El volumen por semana se modela como un factor por semana (`volumeFactor`).

### 6.5 Ejercicios restringidos

El seed marca ejercicios con `lumbarRisk`:

- `high`: peso muerto (cualquier variante), buenos días, remo con barra inclinado, sentadilla con barra pesada, saltos. Bloqueo total, sin opción de anularlo: no están en el seed y no se pueden añadir a una plantilla ni importar en una (P-1, RN-PLN-07).
- `medium`: zancadas, búlgara, hip thrust con carga.
- `low`: máquinas guiadas, remos con apoyo de pecho, press con respaldo.

---

## 7. Diseño de producto (UX)

### 7.1 Navegación

Barra inferior con **Hoy**, **Historial**, **Progreso** y **Ajustes** (v1.0 añade **Plan**). Historial y Ajustes entran en la fase 3 (specs 006 y 007). La sesión activa es un flujo a pantalla completa sin barra inferior.

### 7.2 Pantallas

| Pantalla | Ruta | Contenido |
|---|---|---|
| Hoy | `/` | Fecha y semana; aviso persistente de dolor (§6.2); tarjeta "Tu sesión de hoy" con la sesión, duración estimada, bloque, RIR, estado de la última molestia lumbar, "Hoy subes" (ejercicios con sugerencia de subida) y "Empezar sesión"; desplegable con los ejercicios del día (series × repeticiones, sin cargas); tira "Esta semana" con el avance; "Otra sesión de esta semana". Un día real admite una sola sesión cerrada: si hoy ya hay una, "Hoy" y la vista previa no ofrecen "Empezar sesión" y lo dicen (spec 005b, RN-TRN-27). Con una sesión en curso, la tarjeta pasa a "Sesión en curso": tiempo, avance, tiempo restante, "Vas en", "Continuar sesión" y "Descartar sesión" (spec 003) |
| Otro día de la semana | `/dia/:date` | Vista previa de una sesión de pesas de la semana actual distinta de hoy y "Empezar sesión" (spec 002) |
| Sesión activa | `/sesion/:workoutId/:exerciseIndex` | Encabezado con salida, "Ejercicio N de M" (menú de ejercicios) y tiempo; aviso de salida (seguir, salir y continuar después, descartar); tarjeta del ejercicio compacta o completa (series, rango, RIR, consejo, alternativa); tabla de series (anterior, kg, reps, RIR, check); pie con "Siguiente: …", "Anterior" y "Siguiente" (spec 004); en el último ejercicio, "Terminar sesión", y en el aviso de salida, "Terminar y guardar lo hecho", ambos con al menos una serie hecha (spec 005). Fase 4: banner de sugerencia y temporizador |
| Continuar sesión | `/sesion/:workoutId` | Sin pantalla propia: redirige al primer ejercicio con series pendientes (o al último) (spec 002) |
| Cierre | `/sesion/:workoutId/cierre` | Resumen (minutos, series, ejercicios), selector de dolor 0-10 con mensaje, banderas rojas, notas, "Guardar sesión" y "Volver a la sesión" (spec 005). Fase 4: "Para la próxima sesión" |
| Progreso | `/progreso` | Selector de ejercicio, gráfica por semana, historial de dolor lumbar, peso corporal |
| Plan (v1.0) | `/plan` | Bloques, semanas y plantillas; edición |
| Historial | `/historial` | Sesiones guardadas, de la más reciente a la más antigua, agrupadas por semana del programa (número, bloque y fechas); cada fila con fecha, sesión, resumen y chip de dolor (spec 006) |
| Detalle de una sesión | `/historial/:workoutId` | Solo lectura: nombre, fecha, día del plan si es otro, resumen, dolor lumbar y señales de alarma (sin consejos), ejercicios con sus series hechas ("Sin series" si no tiene) y notas. Se llega desde la lista y desde los días hechos de "Hoy" (spec 006) |
| Ajustes | `/ajustes` | Respaldo ("Descargar respaldo" y "Restaurar respaldo" con vista previa y confirmación, spec 007; "Exportar series (CSV)", spec 008) y el aviso "la app no es un dispositivo médico" (spec 007). v1.0: unidades, incrementos, umbral de dolor, recordatorio y borrar datos |

### 7.3 Flujos principales

1. **Entrenar:** Hoy → Empezar sesión → registrar series (repetir por ejercicio) → Terminar sesión → Cierre (dolor, notas) → Guardar → Hoy.
2. **Ver progreso:** Progreso → elegir ejercicio → ver gráfica y detalle.
3. **Respaldo:** Ajustes → Descargar respaldo (JSON) → guardar en iCloud, Drive o correo. Restaurar: Ajustes → Restaurar respaldo → vista previa → Reemplazar mis datos (spec 007). Series para una hoja de cálculo: Ajustes → Exportar series (CSV) (spec 008).

### 7.4 Sistema visual (tokens del prototipo)

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#0E1411` | Fondo |
| `--surface` | `#161E1A` | Tarjetas |
| `--surface-2` | `#1E2823` | Inputs |
| `--border` | `#2A3630` | Separadores |
| `--text` | `#F1F5F2` | Texto principal |
| `--text-muted` | `#9FB0A6` | Texto secundario |
| `--accent` | `#B8F25C` | Acción principal, estados correctos |
| `--warn` | `#FFB547` | Alertas |
| Tipografía títulos | Space Grotesk (500, 700) | |
| Tipografía texto | Inter (400, 500, 600) | |
| Radios | 12 (inputs), 16 (botones), 20 (tarjetas) | |
| Objetivo táctil | ≥44 px | |

Sin emojis ni iconos decorativos innecesarios. Iconos SVG con `aria-hidden` cuando son decorativos y `aria-label` en botones solo con icono.

### 7.5 Componentes clave

`TabBar`, `WeekStrip`, `ExerciseRow`, `SuggestionBanner`, `SetRow` (inputs numéricos con `inputmode`), `RestTimer`, `PainSelector` (botones 0-10), `StatCard`, `BarChart`, `ChipSelect`, `SafetyNote`, `ConfirmDialog`.

---

## 8. Arquitectura

Movida a [`architecture.md`](architecture.md) (v1.0) y a los ADRs. Resumen:

- Monolito modular: `plan`, `training`, `progression`, `health`, `data`, más `shared` y `app` ([ADR-0001](adr/0001-monolito-modular.md)).
- PWA offline-first con Dexie ([ADR-0002](adr/0002-pwa-offline-first-dexie.md)); comunicación por API pública, puertos y eventos ([ADR-0003](adr/0003-comunicacion-entre-modulos.md)).
- uPlot ([ADR-0004](adr/0004-graficas-uplot.md)), CSS Modules + variables CSS ([ADR-0005](adr/0005-css-modules-variables.md)), Zustand ([ADR-0006](adr/0006-estado-zustand.md)), Zod ([ADR-0007](adr/0007-zod-en-fronteras.md)), fronteras en CI ([ADR-0008](adr/0008-verificacion-de-fronteras.md)).

## 9. Modelo de datos

Movido a los contratos de cada módulo ([`modules/`](modules/)); esquema Dexie compuesto en `architecture.md` §7.3. Cambios respecto a v0.2:

- El dolor lumbar y las banderas rojas salen de `Workout` y pasan a `health.PainEntry` (una entrada por sesión).
- `Workout.items` guarda una instantánea del plan al iniciar, para que editar una plantilla no altere el historial.
- La tabla `settings` se reparte por dueño: `progressionSettings`, `healthSettings`, `uiPreferences` (app).
- `Block.schedule` reemplaza a `SessionTemplate.weekday` para soportar la alternancia A/B del bloque 1 (RN-PLN-03).
- `TemplateItem.alternatives` para los ejercicios con alternativa del plan ("dominadas o jalón"); la serie registra el ejercicio usado (RN-PLN-11).
- `Exercise` añade `isPrimary`, `beltRecommended` y `metric: 'time'`; `Block` añade `weekRir` (spec 001).

El seed completo se genera a partir de [`plan.md`](plan.md).

## 10. Casos de uso

API pública de cada módulo: ver [`modules/`](modules/) (sección 4 de cada contrato). Estado de UI: `architecture.md` §7.8.

---

## 11. Pruebas

| Nivel | Qué cubre | Herramienta |
|---|---|---|
| Unitarias (dominio) | Progresión (subir, mantener, bajar), redondeo por equipo, alertas de dolor (umbral, 2 sesiones, tendencia), deload, cálculo de bloque/semana por fecha | Vitest |
| Componentes | `SetRow`, `PainSelector`, `SuggestionBanner` | Testing Library |
| Datos | Migraciones, import/export (ida y vuelta), validación Zod | Vitest + `fake-indexeddb` |
| E2E | Flujo completo: Hoy → sesión → cierre → progreso, en viewport móvil y sin conexión | Playwright |
| Accesibilidad | Contraste y roles | `axe` en CI |
| Arquitectura | Solo se importa el `index.ts` de otro módulo; sin ciclos; `shared` no depende de módulos | `eslint-plugin-boundaries`, `dependency-cruiser` en CI |
| Contratos de módulo | La API pública de cada módulo con repositorios en memoria; los eventos publicados y recibidos | Vitest |

Casos clave del dominio:

- 3 series al tope del rango con RIR ≥1 → sugiere subir y respeta el redondeo.
- Reps bajo el mínimo en 2 sesiones → sugiere bajar.
- Dolor 4 → aviso de atención; dolor 4 en 2 sesiones seguidas → aviso persistente.
- Bandera roja marcada → sin sugerencia de progresión.
- Cambio de fecha de inicio → semana y bloque correctos.

---

## 12. CI/CD y entrega

- **CI (GitHub Actions):** `tsc`, ESLint, Vitest, build, Playwright en cada PR.
- **CD:** despliegue automático a Vercel desde `main`, servido desde un dominio propio (ADR-0011).
- **Versionado:** SemVer; el `schemaVersion` de datos va aparte.
- **Instalación:** "Añadir a pantalla de inicio" en iOS y Android.

---

## 13. Hoja de ruta sugerida

| Fase | Contenido | Resultado |
|---|---|---|
| 0 | Repo, Vite + React + TS, lint, tokens CSS, router, PWA vacía, esqueleto de módulos (`plan`, `training`, `progression`, `health`, `data`), bus de eventos y reglas de fronteras en CI | Esqueleto instalable con fronteras verificadas |
| 1 | Dexie, seed y loader, `schedule.ts` | "Hoy" muestra la sesión correcta |
| 2 | Sesión activa: `SetRow`, guardado por serie, recuperación de sesión | Se puede entrenar y registrar |
| 2.5 | Rediseño de "Hoy" (spec 003): tarjeta de la sesión con duración, sesión en curso con avance y tira de la semana | "Hoy" dice de un vistazo qué toca y cómo vas |
| 3 | Cierre con dolor lumbar, historial, exportar/importar | MVP usable en el gym |
| 4 | Progresión, alertas, temporizador, peso corporal, gráficas | v1.0 |
| 5 | Edición de plan, volumen semanal, recordatorios | v1.1 |
| 6 | Sincronización opcional (por ejemplo, Supabase) | v2 |

Orden recomendado para el dominio: empieza por `progression.ts` y `pain.ts` con pruebas antes de construir la UI.

---

## 14. Riesgos y decisiones abiertas

| Tema | Riesgo o pregunta | Propuesta |
|---|---|---|
| Pérdida de datos | El navegador (sobre todo Safari iOS) puede limpiar el almacenamiento | `storage.persist()`, recordatorio mensual de respaldo, exportación fácil; sincronización en v2 |
| Reglas médicas | Las alertas podrían interpretarse como consejo médico | Mensajes cautelosos, aviso permanente y banderas rojas que remiten a un profesional; validar los umbrales con tu traumatólogo |
| Progresión | Reglas simples pueden no encajar con todos los ejercicios | Parámetros por ejercicio (incremento, rango) editables |
| Sincronización | ¿Se necesita más de un dispositivo? | Decidir antes de la fase 6; Supabase o Firebase |
| Gráficas | uPlot (ligero) vs Recharts (declarativo) | **Decidido:** uPlot ([ADR-0004](adr/0004-graficas-uplot.md)) |
| Estilos | Tailwind vs CSS Modules | **Decidido:** CSS Modules + variables CSS ([ADR-0005](adr/0005-css-modules-variables.md)) |
| Estado | Zustand vs Context + `useReducer` | **Decidido:** Zustand para estado efímero ([ADR-0006](adr/0006-estado-zustand.md)) |
| Sobreingeniería | Demasiados módulos y eventos para una app de un usuario | Empezar con 5 módulos; dividir solo cuando haya fricción real; los eventos solo donde evitan un ciclo |
| iOS PWA | Notificaciones y Wake Lock con soporte limitado según la versión | Verificar en el dispositivo real |

---

## 15. Criterios de aceptación del MVP

1. Instalable como PWA y 100% funcional sin conexión.
2. Hoy muestra la sesión correcta según la fecha y el plan cargado.
3. Una sesión completa de 7 ejercicios se registra sin pérdida de datos, incluso si se cierra la app a la mitad.
4. Cerrar una sesión exige registrar dolor lumbar y muestra el mensaje correcto.
5. La gráfica de progreso por ejercicio refleja las series guardadas.
6. Exportar a JSON e importarlo en otro navegador restaura todos los datos.
7. Contraste y objetivos táctiles cumplen WCAG 2.2 AA en las pantallas del MVP.
8. Pruebas del dominio pasan con >80% de cobertura.
9. El CI falla si un módulo importa archivos internos de otro o si hay dependencias circulares.
10. Cada módulo se puede probar de forma aislada con repositorios en memoria.

---

*Este documento es una especificación técnica de producto. Las reglas de dolor lumbar son orientativas y no sustituyen la valoración del traumatólogo o fisioterapeuta.*
