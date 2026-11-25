# Handoff: estado del proyecto Gym app

**Fecha:** 23-nov-2026 (MVP publicado como `v0.1.0`; fase 4 en curso: spec 009, temporizador, con spec, plan y tareas aprobados; siguiente: T1) · **Lee primero:** `docs/README.md` (cómo trabajamos), `docs/constitution.md` y este archivo. El índice de specs (hechas y por hacer) está en [`specs/README.md`](specs/README.md); el detalle, en la spec de cada fase.

## Estado actual

- **App en producción:** https://gym.saulgmx.com (Vercel, desde la rama `production`), instalada en el iPhone. **Desarrollo:** https://gym-dev-saulgmx.vercel.app (Vercel, desde `main` en cada merge; solo datos de prueba). Ver "Versiones y ambientes". Repo `saulgmx/gym-app` (público). Prototipo visual: https://claude.ai/artifact/4n7JmYVCDFjgH558Foi2Zk
- **Documentos:** `constitution.md` v1.2 (P-2 enmendado, ADR-0013; P-5 enmendado, ADR-0015; P-8 enlaza a ADR-0012), ADR-0001 a 0019 (0014 propuesto) (0007 reemplazado por 0012). `spec.md`, `architecture.md` y los contratos ya no llevan número de versión: el historial es git (`docs/README.md`, "Versiones y registro de cambios"). `progression` sin preguntas abiertas, `health` con textos validados, `shared` §2 con `SeriesRow`. Diseños elegidos en `docs/design-hoy.md`, `design-sesion-activa.md` y `design-cierre.md`.
- **Base Dexie `gym-app` v3** (tablas de `plan`, `workouts`, `sets`, `painEntries`); seed real en `src/app/seed/plan-seed.json` (36 ejercicios, 4 bloques, 11 plantillas). En el iPhone el plan empezó el lunes 16-nov-2026.
- **Bundle inicial:** 177.49 kB de 200 kB. **E2E:** 150, en Chromium y WebKit.
- **Piloto de ejecución delegada** a Qwen 3.6 35B local (ADR-0014 propuesto, PR #72); ver "Piloto Opus → Qwen".
- **Fases hechas:** 0 a 3 (specs 000 a 008). Índice con enlaces, estado y PRs en [`specs/README.md`](specs/README.md).
- **Retrospectiva del MVP** ([`retros/mvp-fases-0-3.md`](retros/mvp-fases-0-3.md), 21-nov): aplicadas F-1, F-2, S-1, S-2, S-5, X-1 y X-3. Pendientes de decidir: S-3, S-4, S-6, S-7, S-8, X-2, X-4, F-3 y las preguntas abiertas de §5.

## Decisiones tomadas

- PWA offline-first con Dexie; sin cuentas en v1 (ADR-0002).
- Monolito modular de 5 módulos + `shared` + `app` (ADR-0001); fronteras en CI (ADR-0008).
- Gráficas con uPlot (ADR-0004), estilos con CSS Modules + variables CSS (ADR-0005), estado efímero con Zustand (ADR-0006), Zod valida la forma y el dominio las reglas (ADR-0012, que reemplaza a ADR-0007).
- La app nunca sugiere ejercicios `lumbarRisk: 'high'` (P-1, RN-PLN-07, RN-PRG-00).
- IDs UUIDv7 propios y monótonos; `Instant` nunca se compara como string (ADR-0009).
- Errores esperados con `Result` y códigos tipados por módulo; mensajes al usuario solo desde el mapa en `app` (ADR-0010).
- Hosting en Vercel servido desde un dominio propio; `main` protegida con CI obligatorio; sin funciones exclusivas de Vercel (ADR-0011). Dominio `saulgmx.com` (Bloque D).
- Bloque C (17-nov, aprobado durante la implementación; detalle en spec 000 §6–§7, plan §5, §6.3 y §6.10–§6.12, architecture §7.10 y modules/shared.md §4):
  - Nombres de tokens y tres hojas globales en `shared/ui` (`tokens.css`, `fonts.css`, `base.css`); `tokens.css` es el único archivo con colores literales. Clases de `*.module.css` en camelCase.
  - `cx()` en `shared/ui` para clases de CSS Modules (con `noUncheckedIndexedAccess` cada clase es `string | undefined`).
  - Errores de render: `errorElement` en la ruta raíz y `AppErrorBoundary` comparten `ErrorFallback` con "Recargar"; errores async: un solo `AppNotice` no bloqueante.
  - `compose()` sin bus de eventos hasta que un módulo publique (fase 2); `bootstrap(rootElement, { storage })`.
  - PWA: nombre "Gym", ícono de mancuerna (`public/icon.svg`), aviso de actualización con "Actualizar" y "Ahora no".
  - CSP con `frame-ancestors 'none'`, más `nosniff` y `no-referrer`; `no-cache` en toda ruta fuera de `/assets/`.
  - Aceptadas 4 vulnerabilidades moderadas de `glob`/`minimatch` vía `workbox-build` (solo build; plan §8).
- Bloque D (17-nov):
  - `main` protegida (protección de rama clásica, `gh api`): solo por PR, 0 aprobaciones (GitHub no deja aprobar tus propios PR), check `ci` obligatorio y solo si lo publica GitHub Actions (`app_id 15368`), rama al día con `main` (`strict`), `enforce_admins` (la regla también aplica al admin), sin force push ni borrado.
  - Vercel: la app de GitHub tiene acceso solo a `gym-app`; framework Vite, Node 24.x por `engines`. `installCommand` vive en `vercel.json` y una prueba exige que sea el mismo `npm ci` de CI (plan §6.3).
  - Dominio `saulgmx.com` en Cloudflare Registrar. `gym` es un CNAME al valor propio del proyecto (`….vercel-dns-017.com`) en modo **DNS only** (nube gris): con proxy, Cloudflare se pondría en medio del TLS y podría inyectar scripts que la CSP bloquea. Certificado de Let's Encrypt emitido y renovado por Vercel.
- Node con **mise** en lugar de Volta (20-nov, Volta dejó de mantenerse): `.tool-versions` es la única fuente de la versión, para mise en local y `setup-node` en CI; npm va con Node (24.22.3 trae 11.19.1). Sin ADR: es del entorno de desarrollo, no de la app (detalle en spec 000 plan §6 y §8).
- Versiones y ambientes (23-nov, ADR-0017; detalle en "Versiones y ambientes"): trunk-based, SemVer con tags anotados y `CHANGELOG.md`; producción solo cambia al mover la rama `production` a un tag. Opción A (rama como puntero, sin secretos) en vez de una Action con token de Vercel.
- Forma de trabajo: el usuario quiere ser guiado paso a paso; ejecuta con Claude Code o su terminal.

## Versiones y ambientes

- **Versión actual:** `v0.1.0` (MVP, specs 000 a 008), tag anotado en `4ae07d9` (PR #86). `package.json` en `0.1.0`; `CHANGELOG.md` con `[Sin publicar]` vacía.
- **Proceso:** [`release.md`](release.md) (checklist, rollback y hotfix); ambientes en `architecture.md` §8; decisión en ADR-0017 (PR #87 a #89). Al cerrar cada spec se publica un *minor*: la 009 será `v0.2.0`.
- **Ambientes:** preview por PR (`*.vercel.app`); desarrollo en `gym-dev-saulgmx.vercel.app` desde `main`; producción en `gym.saulgmx.com` desde `production`. *Deployment Protection* de Vercel desactivada (repo público, sin backend), para instalar la PWA de desarrollo sin login.
- **Vercel (23-nov):** rama de producción `production` (Settings → Environments → Production → Branch Tracking); alias `gym-dev-saulgmx.vercel.app` asignado a `main` (Settings → Domains). Probado con el merge de #89: salió como *Preview* y producción no cambió.
- **Producción hoy** sirve el último despliegue hecho desde `main` antes del cambio (`5f6c7ff`), con el mismo código de la app que `v0.1.0` (solo cambiaron docs). El primer despliegue desde `production` será `v0.2.0`.
- **GitHub:** rulesets `production` (sin borrado y solo *fast-forward*, también para el admin) y `release-tags` (tags `v*` sin borrado ni cambios). Verificados por API (`current_user_can_bypass: never`), no con un push real. Para corregir un tag mal creado hay que desactivar el ruleset un momento.
- **Sin hacer, a propósito:** exigir `ci` para actualizar `production` (bloquearía los hotfix, cuyas ramas no corren CI; requiere agregar `hotfix/**` a `ci.yml`).
- **Riesgo:** una versión que sube `schemaVersion` no admite rollback una vez abierta la base en el iPhone (IndexedDB no abre una versión menor): respaldo y corrección hacia delante. Probar las migraciones en desarrollo antes de publicar.

## Pendiente de confirmar (bloquea las fases indicadas)

Nada. La pregunta 7 (porcentajes de bajada e `isPrimary`) y las preguntas 3 y 4 de `progression.md` §9 (plancha y asistencia) se cerraron el 20-nov (contrato v1.1, §9).

## Piloto Opus → Qwen

- **Calibración T5 (spec 008):** 1 intento (~3 min), 1 ronda de revisión (~2 min), 0 violaciones, 19/19 pruebas, 7/7 mutaciones.
- **T9 (spec 008), sin supervisión:** Claude lanza `qwen` en modo no interactivo (prompt posicional; `-p` está obsoleto en la 0.28.0) con `--approval-mode auto-edit --exclude-tools run_shell_command --max-wall-time 20m --max-session-turns 40`; briefs, logs y script de mutaciones en `~/qwen-calib/008-T9/`. Intento 1 (119 s) falló en lint (`unbound-method`) por una línea de ejemplo del brief; intento 2 (962 s, con un `ETIMEDOUT` y reintento) pasó. 0 archivos fuera de lo permitido, 8/8 mutaciones; Claude solo retocó el orden de un import y un comentario. El `ETIMEDOUT` probablemente no fue de LM Studio: la petición de las 16:47:43 generó sin parar unos 10 min (la caché de LM Studio crecía cada minuto) y el cliente la cortó a los 600 s del timeout del SDK, como en un bucle de razonamiento. Por eso no se subió el timeout: se limitó `max_tokens`. En jsdom, comparar bytes como arrays (`Uint8Array` de jsdom y de Node no son `toEqual`).
- **Script para las próximas delegaciones:** `~/qwen-calib/run-qwen.sh <tarea> <intento>` (fuera del repo, aprobado el 20-nov; primer uso real en la fase 4). Lee `~/qwen-calib/<tarea>/brief-N.md` y `allowed.txt`; pasa el brief por stdin con los mismos límites que T9 más `--max-tool-calls 80` y `--output-format stream-json` (para contar los errores de herramienta); mide lo que cambió Qwen contra una foto del árbol y deja `attempt-N.log`, `.jsonl`, `.stderr`, `.patch` y `summary.tsv`. No carga modelos a mano (JIT). Lanzarlo en segundo plano: puede pasar de 10 min. En su primer uso, confirmar en el `.jsonl` los eventos `tool_use`, `tool_result.is_error` y `result` (vistos solo en el código de `qwen`). Los briefs y logs van en `~/qwen-calib/<tarea>/`, no en `/tmp` (se borra al reiniciar).
- **Entorno (20-nov):** LM Studio con JIT y un solo modelo en memoria (no cargar modelos a mano). El 35B con contexto 131072 y `samplingParams` en `~/.qwen/settings.json` (temperature 0.6, top_p 0.95, top_k 20, `max_tokens` 16384), porque Qwen Code manda su propia temperatura; `budget_tokens` sigue en 32000 y LM Studio no se queja, pero el tope efectivo es 16384. Sin servidores MCP. Memoria automática apagada en los tres subsistemas (auto-memory, auto-dream y auto-skill) y memorias guardadas borradas: había memorias de otro proyecto (Rust) que se inyectaban en los briefs. Costo fijo de Qwen Code: unos 13.8k tokens de contexto por ejecución antes del brief.
- **Pendiente:** el 27B falla al formatear llamadas a herramientas.
- **Lecciones para ADR-0014, antes de aceptarlo:**
  - El código de ejemplo del brief pasa lint y typecheck antes de enviarse.
  - El brief apunta a las pruebas en lugar de copiarlas: Qwen las lee.
  - La evidencia registra la causa de cada fallo: brief, prueba, modelo o infraestructura.
  - Delegar solo si la salida es grande frente al contexto: UI, estilos, código repetitivo (como referencia, más de unas 50 líneas o varios archivos parecidos). Una tarea de ~15 líneas con mucho contexto no ahorra nada: T5 y T9 sirvieron para calibrar, no para ahorrar.
  - Modo no interactivo con `--output-format stream-json` para contar los errores de herramienta.
- **Spec 009 (tareas escritas el 20-nov):** T10 (`RestTimer`, cuerpo y CSS) es la calibración de UI; en un worktree aparte (`--detach`) con calentamiento JIT previo, mientras Opus hace T11. Detalle en `docs/specs/009-temporizador/tasks.md`, notas. Criterio de ADR-0014 cambiado (aprobado el 20-nov): pasa a `Aceptado` después de la spec 012, con varias tareas `Q` en olas; se edita el ADR en T16 de la 009.
- **Al escribir las tareas de la fase 4:**
  - Asignar `Q` con el criterio anterior y dividir pensando en quién ejecuta: la "hoja" de UI para Qwen; los estados compartidos, las conexiones entre módulos y `compose` para Opus.
  - Cada tarea `Q` lleva su columna de archivos permitidos.
  - Trabajo en olas dentro de cada punto de control: primero todas las pruebas de Opus y después la ola de Qwen, para dejarla corriendo con `run-qwen.sh`.
  - Riesgo alto, con pruebas de Opus y revisión por tarea: todo lo de `progression` y `health` (sugerencia de progresión, alertas de dolor, deload) y cualquier cambio de esquema de Dexie (peso corporal, plan editable). La restricción lumbar (P-1, RN-PRG-00) nunca se delega.
  - Tercera calibración (la de UI, que ADR-0014 pide para aceptarse): el temporizador de descanso.
- La sección "Ejecución delegada" de `docs/README.md`, `QWEN.md` y la columna `Q` de `templates/tasks.md` se agregan cuando ADR-0014 pase a `Aceptado`.

## Siguiente paso

La fase 3 (MVP usable en el gym, spec §13) está cerrada: la spec 008 cerró con el PR de cierre (A en el #70, B en el #73, C en el #75; detalle en `docs/specs/008-csv/tasks.md`). En el iPhone ya están el Cierre con dolor lumbar, el historial, el respaldo JSON y el CSV de series.

**Fase 4, v1.0**, repartida en las specs 009 a 014 (acordado el 20-nov): tabla, dependencias y notas en [`specs/README.md`](specs/README.md).

**Siguiente:** T1 de la spec 009 (pruebas de `restOf` y `restTimer`, RN-TRN-32 a 34), en una rama nueva tras fusionar el PR de la spec, el plan y las tareas. Plan aprobado (20-nov): `restOf`/`restTimer` y `restSignal` puros en `training` (el ajuste lleva el `setId` de su serie), `useSessionStore` y tic de 250 ms en `app`, `RestSound` (Web Audio, `unlock` en `onClickCapture` de la sesión), `ScreenWake` solo durante el descanso, `RestTimer` de presentación en el pie fijo. Contrato `training` v1.36 (decisión 38) y `architecture.md` v1.7 (§7.2). Tareas en 4 puntos de control (A dominio, B servicios de `app`, C tarjeta, D verificación); pruebas primero en el dominio.

Además:

1. **Ya sin pendientes tuyos (20-nov):** T20a de la 007 verificada en el iPhone (el aviso ya no sale al tocar "Compartir" en Safari) y T24 de la 005 hecha (el traumatólogo validó sin cambios los textos de salud y el aviso médico de Ajustes; `health.md` v1.15).
2. **Node 26 (pospuesto por el usuario, 20-nov):** Node 26 es el LTS activo desde oct-2026; Node 24 está en mantenimiento hasta abr-2028. Vercel avisa que la configuración del proyecto cambió (probablemente "Node.js Version" a 26.x); no rompe nada, porque `engines.node: "24.x"` manda sobre esa configuración. Cuando toque: PR aparte con `.tool-versions` y `engines.node` a 26, `mise install`, verificación completa (con E2E y `size`), compatibilidad de Vite, Vitest, Playwright, ESLint y `size-limit`, Vercel en 26.x y notas del handoff y del plan de la fase 0.
3. **Planeado, sin fecha:** migrar el hosting de Vercel a AWS. Requiere un ADR nuevo que reemplace ADR-0011 y su propia spec; revisar también ADR-0017 (en S3 + CloudFront, una Action con OIDC en el tag probablemente conviene más que la rama `production`). El origen `https://gym.saulgmx.com` se mantiene, así que IndexedDB y la PWA instalada no se pierden: en Cloudflare solo cambia el CNAME. Hay que rehacer en AWS los headers y el `Cache-Control` por ruta, el rewrite de SPA (sin servir HTML para `/assets/falta.js`) y el comando de instalación, y cambiar `vite.config.ts` y `tests/architecture/headers.test.ts`, que hoy leen `vercel.json`.

## Notas para retomar

- Al cerrar cada tarea, `npx tsc -b --force`: el `tsc -b` incremental de `npm run typecheck` dejó pasar un error de tipos en T10 que el CI sí vio.
- Pruebas primero: el commit en rojo se hace local **sin push**; se sube junto con la tarea que lo pone en verde. Las tareas de herramientas o solo de pruebas (T20–T22) van en un solo commit.
- Antes de escribir pruebas, revisar si el contrato deja comportamientos sin definir; proponerlos, y con la aprobación escribirlos en los docs antes del código.
- Código implementado por otro modelo (spec 008 T5, Qwen): se verifica con las mutaciones de la tarea y el commit lleva el trailer `Implemented-by: <modelo> (attempt N/3)` además del `Co-Authored-By`.
- Al fusionar PR: "Create a merge commit".
- `main` protegida: ni un push directo ni un PR con `ci` en rojo entran, tampoco como admin. Para una emergencia, desactivar temporalmente en Settings → Branches.
- `production` y los tags `v*` tienen rulesets (Settings → Rules → Rulesets), no protección clásica. Publicar: `git push origin vX.Y.Z^{}:production`; nunca `--force` (`release.md`).
- **Correr los E2E en local antes de abrir un PR que toca algo compartido** (barra de pestañas, rutas, "Hoy", componentes de varias páginas), no solo en la tarea de E2E: la pestaña "Historial" rompió `shell.spec.ts` (contaba 2 pestañas) y el CI falló en el PR #55.
- Una spec puede contradecir un contrato de más rango: gana el contrato (`docs/README.md`) y se corrige la spec antes del código (spec 006 decisión 10, RN-TRN-17).

## Prompt sugerido para un chat nuevo

"Seguimos con la spec 009 (temporizador de descanso), punto de control A. Lee primero docs/README.md, docs/constitution.md y docs/handoff.md ("Siguiente paso"), y luego docs/specs/009-temporizador/plan.md (§6.1 y §6.3), docs/specs/009-temporizador/tasks.md (A y notas) y docs/modules/training.md (RN-TRN-32 a 35, decisión 38). Empezamos por T1. Guíame paso a paso, una tarea a la vez."
