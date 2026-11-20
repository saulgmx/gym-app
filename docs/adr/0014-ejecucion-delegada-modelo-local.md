# ADR-0014: Ejecución de tareas delegada a un modelo local

- **Estado:** Propuesto
- **Fecha:** 20-nov-2026
- **Relacionado:** docs/README.md (flujo SDD), templates/tasks.md, constitución (checklist), ADR-0008; spec 008 T5 (piloto)

## Contexto

Hasta la fase 3, Claude Code (Sonnet u Opus) escribió spec, plan, tareas y código. La v1.0 (fase 4) trae más trabajo: sugerencia de progresión, alertas de dolor, temporizador de descanso, peso corporal, plan editable y deload.

El dueño del producto tiene un modelo local, Qwen 3.6 35B-A3B (4 bits), en un MacBook de 48 GB, servido con LM Studio (contexto 131072) y usado con Qwen Code como agente. Escribir código con el modelo local no consume los límites de la suscripción de Claude ni crédito de API.

Las tareas del proyecto ya son pequeñas (≤ 1-2 h), citan los IDs de las reglas, listan los casos a probar y tienen verificación concreta, incluidas mutaciones. Pero dependen de contexto implícito ("ver plan §6.6", "las sesiones de la spec §4") que Opus resuelve solo y un modelo local probablemente no.

Riesgos: el modelo local se equivoca más en la lógica de dominio y en la integración entre módulos, puede debilitar una prueba para ponerla en verde y, sin supervisión, puede ejecutar comandos dañinos.

**Piloto (spec 008, T5, 20-nov):** Opus escribió las pruebas (T4) y un brief autocontenido; Qwen implementó `data/domain/csv.ts` en 1 intento (~3 min), incluida una trampa de tipos (`CSV_COLUMNS` como tupla `as const` de longitud 11), y aplicó en 1 ronda (~2 min) tres comentarios de revisión sin tocar nada más. 0 violaciones de reglas, 19/19 pruebas, 7/7 mutaciones detectadas. Commit `a75f659`.

## Opciones

1. **Todo con Claude Code:** máxima calidad; cada tarea consume límites de uso.
2. **Qwen ejecuta y el usuario revisa:** sin consumo de límites, pero el usuario revisa cada diff y no hay segunda opinión sobre el dominio.
3. **Orquestación por la API de Anthropic:** automatización total, con costo por token.
4. **Opus planea, delega, verifica y revisa desde Claude Code (suscripción); Qwen ejecuta las tareas asignadas.**

## Decisión

Se propone la opción 4, con estas reglas:

- **Responsables:** al escribir `tasks.md`, Opus asigna cada tarea a `Q` (Qwen), `C` (Claude Code) o `U` (usuario), y divide pensando en el ejecutor: la "hoja" (función pura, componente, sección de UI) puede ser `Q`; la conexión entre módulos, `compose` y los estados compartidos son `C`. No se divide una tarea solo para dar trabajo a Qwen.
- **Criterios para `Q`:** un solo objetivo; como máximo 3 archivos, listados en la tarea; sin conexiones entre módulos; verificación por comando.
- **Pruebas:** Opus escribe las de dominio (`progression`, `health`, `data`) y los E2E críticos. En UI, Opus define los criterios y Qwen escribe las pruebas.
- **Riesgo alto** (revisión por tarea): dominio de `progression` y `health`, esquemas o migraciones de Dexie y todo lo que lea o escriba datos guardados. **Riesgo bajo:** revisión al cerrar el punto de control.
- **Brief:** Opus lo arma justo antes de delegar, no al planear, porque depende de las pruebas y del código del momento. Es autocontenido: archivos permitidos, firmas y tipos, extractos de docs copiados, ejemplos de entrada y salida, errores comunes y comandos de verificación. Vive fuera del repo, con el log del intento.
- **Permisos de Qwen:** edita solo los archivos de la tarea y solo puede ejecutar `npx vitest run <ruta>`, `npm run typecheck`, `npm run lint` y `npx prettier --write <sus archivos>`. Nunca usa `git`, no instala dependencias, no borra y no edita `docs/` ni pruebas escritas por Opus. Durante el piloto, Qwen Code corre en modo interactivo y el usuario aprueba cada comando.
- **Verificación (Opus):** la de la tarea, más mutaciones y que el diff toque solo los archivos permitidos. Un diff fuera de la lista cuenta como intento fallido.
- **Intentos:** hasta 3. El 2 lleva la salida del error y el 3, además, una pista de Opus. Si falla el tercero, la tarea se escala a Opus y se marca ⚠ en `tasks.md` con el motivo. [PROPUESTO: un escalamiento intermedio a Qwen 3.8 27B, pendiente porque hoy falla al formatear llamadas a herramientas en LM Studio.]
- **Git:** solo Opus hace commits, uno por tarea, con el trailer `Implemented-by: <modelo> (attempt n/3)` o `Escalated-to: opus`. El PR de cada punto de control incluye una tabla de evidencia: tarea, responsable, intentos, revisión y mutaciones.
- **Avisos:** notificación al celular solo al escalar, al abrir un PR o si el flujo se detiene [PROPUESTO: mecanismo].
- **Entorno:** LM Studio con carga JIT y un solo modelo en memoria; parámetros de muestreo en la configuración de Qwen Code, porque Qwen Code envía su propia temperatura (35B: temperature 0.6, top_p 0.95, top_k 20). Sin servidores MCP ni memoria automática en las ejecuciones de tareas.

## Consecuencias

- (+) Menos consumo de límites de Claude: Opus planea, arma briefs, verifica y revisa; Qwen escribe el código.
- (+) Las reglas de dominio siguen protegidas por pruebas que Qwen no puede modificar, y las mutaciones detectan pruebas débiles.
- (+) La tabla de evidencia de cada PR mide qué tareas conviene delegar.
- (−) Más latencia por tarea y un paso extra: armar el brief.
- (−) Más piezas que mantener: `QWEN.md`, la configuración de Qwen Code y, más adelante, el comando de delegación.
- (−) Una sola calibración (T5) es poca evidencia: una función pura con pruebas exhaustivas es el mejor caso.
- **Pasa a `Aceptado`** tras al menos dos calibraciones más con distinto perfil: capa `application` (spec 008 T9) y UI (spec 008 T11a o fase 4). Al aceptarse se agregan la sección "Ejecución delegada" de `docs/README.md`, `QWEN.md` y la columna `Q` en `templates/tasks.md`.
- **Revisar** si más del 30 % de las tareas `Q` de una spec se escalan [PROPUESTO], al cambiar de modelo local o al pasar de LM Studio a MLX.
