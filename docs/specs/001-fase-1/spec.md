# Spec: Fase 1, plan cargado y "Hoy" con la sesión correcta

**ID:** 001 · **Estado:** Aprobada (17-nov-2026) · **Fecha:** 17-nov-2026
**Requerimientos cubiertos:** RF-01, RF-02, RF-05 (parcial: aplica los factores y el deload del seed; marcar semanas a mano es v1.0), RNF-01 (datos locales sin conexión), RNF-09 (primera versión del esquema) · CA-2 · QS-06 (parcial) · **Fase:** 1 (spec §13)
**ADRs aplicados:** 0002, 0007, 0009, 0010

## 1. Problema y objetivo

La app está instalada pero vacía. Para entrenar con ella, primero tiene que saber qué toca cada día: cargar el plan de `docs/plan.md` en el dispositivo y mostrar en "Hoy" el bloque, la semana y la sesión que corresponden a la fecha, sin conexión.

## 2. Alcance

- **Incluye:**
  - Base Dexie (`app/db.ts`) con las tablas del módulo `plan` (`exercises`, `programs`, `blocks`, `templates`), versión 1 del esquema.
  - Seed JSON con el plan completo de `docs/plan.md`: catálogo de ejercicios, un programa de 15 semanas, 4 bloques (Full body, Torso/Pierna, PPL + Upper/Lower y Deload) y 11 plantillas. IDs UUIDv7 fijos, escritos en el JSON, para que sean los mismos en cualquier dispositivo.
  - Validación del seed con Zod e integridad referencial; carga con `ensureSeeded` al arrancar (architecture §6.1).
  - Dominio de calendario (`schedule.ts`): posición en el programa, sesión del día, series planificadas y RIR objetivo (RN-PLN-01 a 06, 10 y las reglas nuevas de §5).
  - API de `plan` usada en esta fase: `ensureSeeded`, `getPosition`, `getTodayPlan`, `getWeekPlan`, `getExercise`, `getExercises`, `listExercises` y los hooks `useTodayPlan` y `useWeekPlan`.
  - Página "Hoy" con bloque, semana, tira de la semana (`WeekStrip`) y lista de ejercicios (`PlanExerciseList`).
- **No incluye:**
  - Mover la fecha de inicio o saltar de semana (RF-03, v1.0): `setStartDate` y `jumpToWeek` llegan con la pantalla Plan.
  - Editar plantillas (RF-04, v1.0): `updateTemplate`.
  - "Iniciar sesión" y elegir una alternativa (fase 2), estado de la última molestia lumbar (fase 3), sugerencias de progresión (fase 4).
  - `dataPort` del módulo `plan`, exportar e importar (fase 3).
  - Actualizar un plan ya cargado si cambia el seed en una versión futura de la app: `ensureSeeded` solo actúa con la base vacía. Si hace falta, será una migración con su propia spec.
  - Tablas de los demás módulos: cada uno las añade en su fase con una nueva versión del esquema.

## 3. Historias de usuario

- Como usuario, quiero abrir la app y ver qué sesión me toca hoy, para no consultar el plan en otro lado.
- Como usuario, quiero ver en qué bloque y semana voy y qué me toca el resto de la semana, para organizar mis días.
- Como usuario, quiero ver las series, repeticiones, RIR y notas de cada ejercicio de hoy, ya ajustadas a la semana (70% en la primera semana del bloque, 50% en deload).
- Como usuario, quiero que todo esto funcione en el gym sin señal.

## 4. Criterios de aceptación

Las fechas de ejemplo suponen un programa que empieza el lunes 16-nov-2026: la semana 9 empieza el 11-ene-2027, la 15 el 22-feb-2027 y el programa termina el domingo 28-feb-2027.

### 4.1 Seed y carga

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-1 | Base vacía y hoy es miércoles 18-nov-2026 | Abro la app por primera vez | Se carga el seed con `startDate = 2026-11-16` (lunes de esa semana, RN-PLN-13) y "Hoy" muestra Bloque 1, semana 1 de 15, "Full body B" |
| AC-2 | El plan ya cargado | Cierro y vuelvo a abrir la app otro día | El seed no se vuelve a aplicar: `startDate` y las tablas no cambian (RN-PLN-14) |
| AC-3 | Base vacía | Se llama dos veces a la vez a `ensureSeeded` (por ejemplo, dos pestañas) | Queda un solo programa, sin duplicados (RN-PLN-14) |
| AC-4 | El seed real | Lo valido | Pasa: 15 semanas sin huecos ni solapes, 4 bloques, 11 plantillas, todas las referencias existen y ningún ejercicio `high` en plantillas (RN-PLN-02, 07, 15) |
| AC-5 | Un seed con un error de cada tipo de RN-PLN-15 (referencia inexistente, semanas con hueco o solape, día sin entrada o duplicado, paridad incompleta, alternativa con otra métrica o repetida) | Llamo a `ensureSeeded` | Devuelve `plan/invalid-seed` y la base queda vacía |
| AC-6 | Un seed con "Peso muerto rumano" (`high`) en una plantilla, como principal o como alternativa | Llamo a `ensureSeeded` | Devuelve `plan/high-risk-exercise` y la base queda vacía (RN-PLN-07) |
| AC-7 | La app ya abierta una vez con el plan cargado | Paso a modo avión y recargo | "Hoy" muestra la sesión del día (QS-06, parcial) |

### 4.2 Calendario (dominio, con reloj fijo)

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-8 | El programa del ejemplo | Pido la posición del 15-nov-2026, 16-nov-2026, 28-feb-2027 y 1-mar-2027 | `not_started`; semana 1; semana 15; `finished` (RN-PLN-01) |
| AC-9 | Semana 1 (impar) del bloque 1 | Pido la sesión de lunes a domingo | Full body A, cardio suave, Full body B, descanso, Full body A, cardio moderado, descanso (RN-PLN-03) |
| AC-10 | Semana 2 (par) del bloque 1 | Pido lunes, miércoles y viernes | Full body B, Full body A, Full body B (RN-PLN-03) |
| AC-11 | Un día de la semana 1 | Pido las series planificadas | Prensa (`sets: [3, 3]`) → 2; Curl femoral (`sets: [2, 3]`) → 1. En la semana 2: 3 y 2 (RN-PLN-04, 05) |
| AC-12 | Semanas 1, 2, 9, 10 y 15 | Pido el RIR objetivo | [3, 4], [2, 3], [3, 3], [1, 3] y [4, 4] (RN-PLN-06) |
| AC-13 | Lunes 22-feb-2027 (semana 15) | Pido la sesión | Push del bloque 3 con `isDeloadWeek: true`, factor 0.5 (Press de banca `sets: [3, 4]` → 2) y RIR [4, 4] (RN-PLN-04, 06, 12) |
| AC-14 | Un día cualquiera | Pido el plan de su semana | 7 entradas de lunes a domingo (RN-PLN-10) |

### 4.3 Pantalla "Hoy"

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-15 | Un día de pesas | Abro "Hoy" | Veo "Bloque 1 · Full body", "Semana 1 de 15", el nombre de la sesión y la lista de ejercicios en orden, cada uno con nombre, series × reps (por ejemplo "2 × 8-12", o "3 × 30-45 s" si la métrica es tiempo), RIR ("RIR 3-4") y la nota de la plantilla si la tiene |
| AC-16 | Un día de cardio o de descanso | Abro "Hoy" | Veo "Cardio" con su nota (por ejemplo "Cardio suave 30-40 min…") o "Descanso", sin lista de ejercicios |
| AC-17 | Cualquier día del programa | Miro la tira de la semana | 7 días de lunes a domingo con su inicial (L M X J V S D) y un indicador de pesas, cardio o descanso; el nombre accesible incluye el día y la sesión ("miércoles, Full body B"); hoy tiene `aria-current="date"` |
| AC-18 | Una semana de deload | Abro "Hoy" | Se indica "Semana de descarga" junto a la semana |
| AC-19 | Fecha anterior al inicio o posterior al final | Abro "Hoy" | "El plan empieza el lunes 16 de noviembre." o "Terminaste el plan de 15 semanas.", sin tira ni lista |
| AC-20 | La app abierta un día | Vuelve a primer plano otro día (por ejemplo, tras la medianoche) | "Hoy" muestra el día nuevo sin recargar |
| AC-21 | La base no abre o el seed falla la validación | Abro la app | Se ve el aviso de error genérico (ADR-0010), nunca el estado vacío ni una lista incompleta |
| AC-22 | "Hoy" con el plan cargado (día de pesas y de descanso) | Corre axe en Playwright | Sin violaciones WCAG 2.2 A/AA |
| AC-23 | El build de producción con Dexie y el seed | Corre `size-limit` | El JS inicial sigue < 200 KB gzip (QS-10) |

## 5. Reglas de negocio aplicables

Del contrato [`modules/plan.md`](../../modules/plan.md) v1.1: RN-PLN-01 a RN-PLN-07, RN-PLN-10 y RN-PLN-11.

Cambios y reglas nuevas, ya movidos al contrato (v1.2) al aprobar esta spec:

| ID | Regla | Origen |
|---|---|---|
| RN-PLN-06 (cambia) | `targetRir` = `[4, 4]` en deload; si no, `block.weekRir[week] ?? block.targetRir`. `Block` añade `weekRir?: Record<number, [number, number]>`, por semana del programa como `weekFactors`. | plan.md: semanas 1, 5 y 9 |
| RN-PLN-10 (confirma) | La semana empieza en lunes (ISO 8601). Se quita `[PROPUESTO]`. | Decisión 17-nov |
| RN-PLN-11 (amplía) | Las alternativas tienen la misma `metric` que el ejercicio principal. | "Plancha o pallof press" |
| RN-PLN-12 | Una entrada de `schedule` puede apuntar a una plantilla de cualquier bloque del mismo programa. El bloque Deload (semana 15) reutiliza el calendario y las plantillas del bloque 3. | Decisión 17-nov |
| RN-PLN-13 | El seed no trae fecha. `ensureSeeded` fija `startDate = startOfIsoWeek(clock.today())`. | Decisión 17-nov |
| RN-PLN-14 | `ensureSeeded` es atómico e idempotente: valida todo antes de escribir y escribe en una sola transacción, solo si las tablas del plan están vacías. Con llamadas concurrentes, el seed se aplica una vez. | P-2 |
| RN-PLN-15 | Validación del seed, además del esquema Zod: (a) todo ID referenciado existe; (b) los bloques cubren las semanas 1..`totalWeeks` sin huecos ni solapes (RN-PLN-02); (c) cada día de cada bloque tiene una entrada sin `weekParity` o exactamente dos, una `odd` y una `even`; (d) RN-PLN-11. Un fallo devuelve `plan/invalid-seed`. | ADR-0007 |

Además se confirman en el modelo `Exercise.isPrimary` (lo usa el deload sugerido de la fase 4; se carga ya para no migrar después) y `metric: 'time'` (plancha), y se quitan sus `[PROPUESTO]`.

## 6. UX

- **Encabezado:** título "Hoy" y, debajo, "Bloque 1 · Full body" y "Semana 1 de 15" (en deload, "Semana 15 de 15 · Semana de descarga").
- **Tira de la semana:** fila de 7 días, de lunes a domingo, con la inicial y un indicador visual del tipo de día (pesas, cardio, descanso); hoy resaltado. No es interactiva en esta fase, así que no requiere objetivos de 44 px. El indicador no depende solo del color (WCAG 1.4.1).
- **Día de pesas:** nombre de la sesión como subtítulo (`h2`) y una lista ordenada de ejercicios: nombre, "2 × 8-12" o "3 × 30-45 s", "RIR 3-4" y la nota de la plantilla en texto secundario.
- **Cardio:** "Cardio" y la nota del calendario. **Descanso:** "Descanso" y "Recupera: dormir y comer bien también es entrenar."
- **Fuera del programa:** antes del inicio, "El plan empieza el lunes 16 de noviembre."; al terminar, "Terminaste el plan de 15 semanas." (repetir el bloque 3, como sugiere el plan, llega con RF-03).
- **Cargando:** mientras Dexie responde se muestra solo el título, sin estado vacío ni spinner, para que no parpadee.
- **Error:** aviso genérico de ADR-0010. El mensaje de `plan/invalid-seed` y `plan/high-risk-exercise` es el genérico: son errores del build, no del usuario.
- **Fechas:** en español y con la zona horaria del dispositivo (ADR-0009).
- Desaparece el texto "Aún no hay un plan cargado." de la fase 0.

## 7. Casos límite

- **Primer arranque en domingo:** `startDate` es el lunes anterior, así que el usuario empieza en el último día de la semana 1. Es lo esperado según la decisión del 17-nov; corregirlo es RF-03.
- **Medianoche con la app abierta:** "Hoy" recalcula la fecha al volver a primer plano (`visibilitychange`, AC-20); no hace falta un temporizador.
- **Reloj del dispositivo atrasado** (antes de `startDate`): estado `not_started` (AC-19), sin errores.
- **Cambio de zona horaria** (viaje): el día se calcula con la zona actual del dispositivo; una semana puede ganar o perder horas, nunca días.
- **Dos pestañas en el primer arranque:** RN-PLN-14 (AC-3).
- **Safari borra el almacenamiento** (ITP, sin `persist()`): al abrir, la base está vacía y se vuelve a cargar el seed con la semana actual como semana 1. Sin datos de entrenamiento todavía, no se pierde nada; la protección real llega con la exportación (fase 3).
- **Navegador sin IndexedDB** (modo privado antiguo): la base no abre y se muestra el aviso de error (AC-21).
- **Seed inválido en un build:** lo detectan las pruebas (AC-4) antes de llegar a producción; en tiempo de ejecución, AC-21.

## 8. Preguntas abiertas

Ninguna. Decisiones cerradas el 17-nov-2026:

- **Fecha de inicio al cargar el seed:** el lunes de la semana del primer arranque (RN-PLN-13).
- **RIR de la primera semana de cada bloque:** `Block.weekRir` (RN-PLN-06).
- **Deload (semana 15):** las 5 sesiones del bloque 3 al 50% y RIR 4 (RN-PLN-12).
- **Contenido de "Hoy" en la fase 1:** bloque, semana, tira de la semana y lista de ejercicios.
- **IDs del seed:** UUIDv7 fijos en el JSON.

La revisión del catálogo (nombre, `lumbarRisk`, `isPrimary`, `metric`, descansos de cada ejercicio) va en el plan técnico, como tabla para que el usuario la apruebe antes de escribir el JSON.

## 9. Checklist de la constitución

- [x] **P-1:** el seed se valida sin ejercicios `high` en plantillas ni alternativas (AC-4, AC-6); la fase no genera sugerencias.
- [x] **P-2:** carga atómica e idempotente (RN-PLN-14); primera versión del esquema; sin datos del usuario todavía.
- [x] **P-3:** cada cambio de contrato está en §5; sin `[POR DEFINIR]`.
- [x] **P-4:** solo `plan` toca sus tablas; "Hoy" usa la API y los componentes públicos de `plan`.
- [x] **P-5:** `schedule.ts` es dominio puro con `LocalDate` como parámetro; pruebas del calendario antes del código.
- [x] **P-6:** axe en "Hoy" y presupuesto de bundle (AC-22, AC-23).
- [x] **P-7:** sin `dataPort`, edición ni RF-03; la tira no es interactiva.
- [x] **P-8:** seed validado con Zod (ADR-0007); textos en español.
