# ADR-0016: Análisis de seguridad en CI con Trivy y TruffleHog

- **Estado:** Aceptado
- **Fecha:** 23-nov-2026
- **Relacionado:** RNF-10, P-7; workflow `.github/workflows/security.yml` (PR #82, PR #83); riesgos aceptados en `docs/specs/000-fase-0/plan.md`

## Contexto

Hasta la fase 3, la seguridad de las dependencias se revisaba a mano: versiones exactas, revisión de `allowScripts` (`npm ci --strict-allow-scripts`) y `npm audit` en cada instalación. Los riesgos aceptados quedaron en los planes de cada fase (`glob`/`minimatch` vía `workbox-build`, solo de build).

El PR #82 agregó un workflow de seguridad. Incluía un job de `npm audit` que fallaba por esos riesgos ya aceptados; se quitó para no bloquear el CI, y con eso dejó de avisar también de las vulnerabilidades nuevas. Trivy reportaba a la pestaña Security pero nunca bloqueaba, y las actions fijadas por SHA no tenían quién las actualizara.

El repositorio es público: un secreto que llegue al historial queda expuesto.

## Opciones

1. **`npm audit` en CI con `continue-on-error`:** simple, pero no distingue lo aceptado de lo nuevo; o bloquea siempre o nunca.
2. **`npm audit` con una lista de excepciones propia (script o herramienta extra):** usa los avisos GHSA que ya citan los planes, pero suma una pieza más que mantener.
3. **Trivy con `.trivyignore` para lo aceptado y TruffleHog para secretos:** las excepciones viven versionadas, con razón y fecha de vencimiento; Trivy además sube un reporte SARIF a la pestaña Security. Trivy identifica por CVE, no por GHSA.

## Decisión

Se elige la opción 3, con estas reglas:

- **Qué se revisa:** Trivy revisa vulnerabilidades de las dependencias (`scanners: vuln`); TruffleHog revisa secretos en el historial de git. Cada herramienta tiene un solo trabajo.
- **Cuándo:** en cada PR a `main`, en cada push a `main` y una vez por semana (domingo). TruffleHog revisa el rango de commits del evento; la corrida semanal revisa todo el historial.
- **Qué bloquea:** una vulnerabilidad nueva MEDIUM, HIGH o CRITICAL, o cualquier secreto. LOW y UNKNOWN solo se reportan en la pestaña Security.
- **Riesgos aceptados:** van en `.trivyignore`, cada uno con su razón, el documento donde se evaluó y una fecha de vencimiento (`exp:`) de unos 3 meses. Al vencer, el workflow vuelve a fallar y obliga a revisar. Aceptar un riesgo se decide primero en el plan de la fase o spec, nunca solo en el archivo.
- **Actions:** fijadas por SHA con el tag en comentario. Dependabot las actualiza cada semana (`github-actions`, agrupadas, 7 días de espera tras cada release). npm sigue siendo manual.
- **TruffleHog:** el input `version` es el tag de la imagen Docker y por defecto es `latest`; se fija y se actualiza a mano en el mismo PR en que Dependabot sube el SHA.
- **Endurecimiento:** cada job con `timeout-minutes` y `checkout` con `persist-credentials: false`; permisos mínimos (`security-events: write` solo para subir el SARIF).

## Consecuencias

- (+) Una vulnerabilidad nueva bloquea el PR; las aceptadas no, y quedan documentadas con fecha de revisión.
- (+) La pestaña Security muestra todo lo que no está aceptado, incluso lo que no bloquea.
- (+) Las actions se mantienen al día sin revisar versiones a mano.
- (−) Un aviso que solo tenga GHSA en `npm audit` puede no aparecer en Trivy, o al revés (las bases difieren). La revisión manual con `npm audit` en cada instalación se mantiene.
- (−) Cada PR de Dependabot que suba TruffleHog necesita un cambio a mano (`version`).
- (−) Una alerta puede aparecer sin cambios en el código, solo porque la base de vulnerabilidades se actualizó.
- **Revisar** al vencer las entradas de `.trivyignore`, si Trivy da falsos positivos frecuentes o si se agrega otro ecosistema (por ejemplo, una imagen Docker propia).
