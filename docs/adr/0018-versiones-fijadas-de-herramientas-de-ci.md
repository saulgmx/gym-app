# ADR-0018: Versiones fijadas de las herramientas de CI, revisadas contra avisos de seguridad

- **Estado:** Aceptado
- **Fecha:** 24-nov-2026
- **Relacionado:** RNF-10, P-7, ADR-0016 (complementa; modifica su regla de TruffleHog); workflow `.github/workflows/security.yml`

## Contexto

ADR-0016 fija las actions por SHA y deja que Dependabot las actualice. Dependabot (alertas y actualizaciones) solo conoce la versión de la action, no lo que la action descarga al correr:

- `aquasecurity/trivy-action@v0.36.0` instala el binario de Trivy indicado en su input `version`, que por defecto es `v0.70.0`. Esa versión está afectada por GHSA-mcj4-mphf-j9ff (alta: path traversal con una base de vulnerabilidades manipulada, y el workflow descarga esa base en cada corrida), GHSA-q3fv-x8vg-qqm4 y GHSA-8rc5-4fr6-64pw. No hay una versión más nueva de la action que cambie ese valor por defecto.
- `trufflesecurity/trufflehog` corre la imagen Docker indicada en su input `version`.

Ningún aviso de estas versiones llega a las alertas de Dependabot. Los avisos de junio de 2026 se encontraron por casualidad, y depender de suscripciones por correo no es viable para este proyecto.

El compromiso de la cadena de suministro de Trivy de marzo de 2026 (GHSA-69fq-xp46-6x23, `trivy-action < 0.35.0`) no afectó al repositorio: el workflow se creó en noviembre, ya fijado a un SHA posterior.

## Opciones

1. **Suscribirse a los avisos de seguridad de cada repositorio (Watch → Security alerts):** cero mantenimiento en el código, pero depende de leer el correo a tiempo.
2. **Fijar las versiones de los binarios y revisarlas en CI contra la base de avisos de GitHub:** la alerta aparece como un check rojo en el PR y en la corrida semanal; requiere listar cada herramienta descargada.
3. **Manifiesto ficticio (por ejemplo, un `Dockerfile` o `go.mod` sin uso) para que Dependabot vea los binarios:** reutiliza Dependabot, pero agrega archivos que no se construyen y confunden.

## Decisión

Se elige la opción 2, con estas reglas:

- **Versiones explícitas:** toda herramienta que una action descargue al correr se fija en el bloque `env` del workflow (`TRIVY_VERSION`, `TRUFFLEHOG_VERSION`), y los pasos la leen de ahí. Nunca se usa el valor por defecto de la action.
- **Revisión automática:** el job `tool-advisories` consulta la API de avisos de GitHub (`/advisories?ecosystem=go&affects=<módulo>@<versión>`) para cada herramienta y falla si hay algún aviso, de cualquier severidad. Corre en los mismos eventos que el resto del workflow: PR, push a `main` y cada semana.
- **Al fallar:** se sube la versión en `env` a una corregida en el mismo PR. Si no hay corrección, el riesgo se evalúa como en ADR-0016 (primero en el plan) antes de excluir el aviso.
- **Herramienta nueva:** si un workflow empieza a descargar otro binario o imagen, se agrega a `env` y al job en el mismo PR.
- **TruffleHog (modifica ADR-0016):** la versión pasa del input del paso a `TRUFFLEHOG_VERSION`. Se sigue actualizando a mano cuando Dependabot sube el SHA.

## Consecuencias

- (+) Un aviso nuevo sobre una herramienta de CI bloquea el siguiente PR sin depender de notificaciones.
- (+) Las versiones que corren en CI quedan visibles en un solo lugar del workflow.
- (−) Las versiones de Trivy y TruffleHog se actualizan a mano; Dependabot no las toca.
- (−) El job puede fallar sin cambios en el código, solo porque se publicó un aviso; el arreglo suele ser subir una versión.
- (−) Solo cubre herramientas con un paquete en la base de avisos de GitHub (hoy, módulos Go). Una herramienta sin paquete ahí necesita otra vía.
- **Revisar** si se agrega una herramienta que no esté en la base de avisos, o si Dependabot llega a cubrir lo que descargan las actions.
