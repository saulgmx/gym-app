# ADR-0019: Postura de seguridad del repositorio: checks requeridos, reporte privado y CodeQL, sin Scorecard

- **Estado:** Aceptado
- **Fecha:** 24-nov-2026
- **Relacionado:** RNF-10, P-7, ADR-0016, ADR-0017 (rulesets `production` y `release-tags`, sin cambios), ADR-0018

## Contexto

ADR-0016 y ADR-0018 definen qué revisa el workflow de seguridad y qué debe bloquear. Sin embargo, la protección de `main` solo requería el check `ci`: un job de seguridad en rojo se veía en el PR, pero no impedía el merge.

Además, se evaluó agregar OpenSSF Scorecard. Sus revisiones útiles para este repositorio detectaron tres huecos que se configuran fuera del código:

- **SAST:** nada analizaba el código propio; Trivy solo revisa dependencias.
- **Security-Policy:** el repositorio es público y con issues abiertos, pero sin un canal privado. Quien encontrara una vulnerabilidad solo podía abrir un issue público.
- **Branch-Protection:** los checks de seguridad no eran requeridos.

Otras revisiones de Scorecard no aplican a un proyecto de una sola persona que no se publica como paquete:

- Code-Review exige aprobación de otra persona.
- Contributors exige colaboradores de varias organizaciones.
- CII-Best-Practices y Fuzzing tienen un costo alto y no aportan beneficio aquí.
- Signed-Releases y Packaging no aplican porque no se publican paquetes ni binarios.

Las revisiones restantes (Dangerous-Workflow, Token-Permissions, Pinned-Dependencies, Vulnerabilities y Dependency-Update-Tool) ya las cubren ADR-0016 y ADR-0018.

La app es una PWA estática sin backend ni cuentas, y los datos viven en el dispositivo. Una vulnerabilidad afecta al único usuario.

## Opciones

1. **Scorecard como workflow semanal con SARIF a la pestaña Security:** da una medida continua. Varias revisiones quedarían en 0 para siempre y llenarían la pestaña de hallazgos que habría que ignorar.
2. **Scorecard como auditoría puntual y corregir directamente sus huecos útiles:** se obtiene el beneficio sin el ruido. No hay medida continua, pero lo que importa queda vigilado por los checks y por CodeQL.
3. **No hacer nada:** el workflow de seguridad seguiría sin bloquear y el código propio sin análisis.

## Decisión

Se elige la opción 2. Ni siquiera se corre la auditoría puntual: el análisis anterior ya identificó los huecos útiles y quedan cerrados con estas reglas:

- **Checks requeridos en `main`:** `ci`, `Trivy Dependency Scan`, `Secrets Detection` y `Pinned Tool Advisories`, todos de GitHub Actions. Se mantiene que la rama esté al día con `main` antes del merge.
  - Los checks se identifican por el `name:` del job. Renombrar un job obliga a actualizar la protección de `main` en el mismo cambio; si no, el PR espera un check que nunca llega.
  - `security.yml` no usa filtros `paths:`, para que sus jobs corran en todos los PR. Si se agrega un filtro, un check requerido puede quedarse pendiente.
- **Reporte privado de vulnerabilidades:** activo (*private vulnerability reporting*). No se escribe `SECURITY.md`, porque el botón "Report a vulnerability" de la pestaña Security ya cumple su función.
- **CodeQL:** *default setup* de GitHub para `javascript-typescript` y `actions`, con el conjunto de consultas `default`. Corre en PR, en push a `main` y cada semana. El primer análisis dio 0 hallazgos.
  - Por ahora no es requerido. Se vuelve requerido si, tras unas semanas, sus hallazgos resultan reales y no ruido.
  - Un hallazgo falso positivo se descarta en la pestaña Security con su razón.
- **Scorecard:** no se agrega. Si se reconsidera, se registran aquí las revisiones que no aplican.

Toda esta configuración vive en GitHub, no en el repositorio. Este ADR es el registro de lo que debe estar activo.

## Consecuencias

- (+) Una vulnerabilidad nueva, un secreto o una herramienta de CI con aviso bloquean el merge, como piden ADR-0016 y ADR-0018.
- (+) El código propio y los workflows tienen análisis estático sin mantener YAML.
- (+) Un reporte externo llega en privado.
- (−) Un aviso publicado sin cambios en el código bloquea cualquier PR, incluso uno de solo documentación, hasta subir la versión o aceptar el riesgo en `.trivyignore`.
- (−) La configuración no está versionada. Si se pierde (por ejemplo, al migrar o recrear el repositorio), hay que rehacerla desde este ADR.
- **Revisar** al renombrar o agregar jobs de seguridad, si CodeQL resulta ruidoso o útil, si el proyecto suma colaboradores o se empieza a publicar como paquete (Scorecard ganaría valor), o al migrar el hosting a AWS (handoff).
