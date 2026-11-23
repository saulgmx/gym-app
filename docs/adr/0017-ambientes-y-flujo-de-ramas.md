# ADR-0017: Trunk-based con ambiente de desarrollo y producción por versión

- **Estado:** Aceptado
- **Fecha:** 23-nov-2026
- **Relacionado:** P-2, P-7, RNF-09, ADR-0002, ADR-0011 (modifica su regla 4), ADR-0016; `CHANGELOG.md`; tag `v0.1.0` (PR #86)

## Contexto

- Con el MVP (specs 000 a 008) la app ya se usa para entrenar: la PWA instalada en `gym.<dominio>` guarda en IndexedDB datos reales que solo existen en el celular (ADR-0002).
- Hoy Vercel despliega producción en cada merge a `main` (ADR-0011, regla 4). Cualquier PR, también un checkpoint intermedio de una spec o un PR de Dependabot, llega directo a esa PWA. Una migración de Dexie (RNF-09) o un import defectuoso se prueba por primera vez sobre los datos reales.
- Las previews por PR viven en `*.vercel.app`, cambian de URL en cada despliegue y no sirven para usar la app varios días ni para instalarla (ADR-0011, regla 1).
- IndexedDB, el service worker y la PWA instalada están ligados al origen: un subdominio distinto tiene datos y app propios.
- El flujo actual ya es de rama corta: una rama y un PR por checkpoint, `main` protegida con CI obligatorio, merge commits, Dependabot sobre `main`.
- Desde el 23-nov-2026 hay versiones: `package.json` en `0.1.0`, `CHANGELOG.md` y el tag anotado `v0.1.0`.
- Un solo desarrollador y un solo usuario; nunca se mantienen dos versiones en paralelo. Plan Hobby de Vercel (sin *custom environments*).
- Puede haber una migración futura a AWS (ADR-0011).

## Opciones

Modelo de ramas:

1. **GitFlow** (`develop`, `release/*`, `hotfix/*`, `main`): pensado para mantener varias versiones a la vez. (−) Cada cambio se integra dos veces; dos ramas largas que proteger, escanear y sincronizar; Dependabot, CI y reglas por duplicado. Su beneficio no aplica aquí.
2. **Trunk-based** (`main` como única rama de integración, ramas cortas, releases por tag): es el flujo que ya se usa. (−) Lo que está en `main` al publicar entra en la versión; obliga a publicar al cerrar cada spec, no a mitad.

Cómo llega una versión a producción:

- **A. Rama `production` como puntero:** Vercel despliega producción desde `production`, y publicar es mover esa rama al commit del tag. (+) Sin secretos en GitHub; integración nativa de Vercel; el historial de `production` es el historial de producción. (−) Un paso manual más; una rama larga que proteger; producción se reconstruye desde el código fuente.
- **B. GitHub Action al empujar el tag:** el workflow ejecuta `vercel deploy --prebuilt --prod`. (+) Un solo gesto; puede correr la suite completa y pedir aprobación antes de desplegar. (−) En Hobby el token de Vercel tiene alcance de cuenta completa y viviría como secreto del repo; más superficie de cadena de suministro (contra ADR-0016); más configuración que mantener.

## Decisión

**Trunk-based development con dos ambientes: `main` se despliega solo en un ambiente de desarrollo, y producción cambia únicamente al publicar una versión, moviendo la rama `production` al tag (opción A).**

Reglas:

1. **Ramas:** `main` es la única rama de integración. El trabajo se hace en ramas cortas con PR (una por checkpoint) y merge commit, como hasta ahora. No hay `develop` ni `release/*` permanentes.
2. **Ambientes:**

   | Ambiente | Se despliega desde | Dominio | Datos |
   |---|---|---|---|
   | Preview | cada PR | `*.vercel.app` | solo para revisar |
   | Desarrollo | `main`, en cada merge | `dev.gym.<dominio>` | de prueba |
   | Producción | rama `production` | `gym.<dominio>` (ADR-0011) | reales |

   El ambiente de desarrollo usa el dominio propio para tener una URL fija e instalable. Es otro origen, así que no comparte IndexedDB, service worker ni PWA con producción. El registro DNS apunta a Vercel sin proxy intermedio (por ejemplo, *DNS only* en Cloudflare, cuyo certificado gratuito no cubre dos niveles de subdominio). Ahí se prueban las migraciones, los imports y las specs nuevas durante varios días. Nunca se guardan datos reales en él.
3. **Versiones:** SemVer con tags anotados `vX.Y.Z` sobre un merge commit de `main` que pasó CI. Mientras la versión sea `0.x`: *minor* por spec cerrada, *patch* por corrección. Cada versión tiene su PR `chore/release-vX.Y.Z`, que sube `package.json` y mueve la sección `[Sin publicar]` de `CHANGELOG.md` a la versión nueva. El tag se crea después de integrar ese PR.
4. **Publicar en producción:** mover `production` al commit del tag (`git push origin vX.Y.Z^{}:production`). Solo se publican tags; nunca se hace commit directo en `production`.
5. **Protección:**
   - La rama `production` solo admite *fast-forward* (sin *force push* ni borrado) y solo la actualiza el dueño del repo.
   - Los tags `v*` no se pueden mover ni borrar.
6. **Rollback:** de inmediato, con el *Instant Rollback* de Vercel (no reconstruye). Después, la corrección se hace en `main` y se publica como versión de *patch*; `production` sigue avanzando solo hacia delante.
7. **Hotfix con trabajo sin publicar en `main`:**
   1. Se corrige primero en `main` por PR.
   2. Se crea una rama corta desde el último tag, se aplica la corrección con *cherry-pick*, se crea el tag de *patch* en esa rama y se publica.
   3. Esa rama se integra de vuelta en `main` (merge commit), para que la siguiente versión siga siendo *fast-forward* de `production`.
8. **Independencia del proveedor:** la decisión es "producción = la rama `production`, movida a un tag". Vercel es la implementación actual: rama de producción configurada en `production` y dominio de desarrollo asignado a la rama `main`.

## Consecuencias

- (+) Los datos reales solo los toca una versión que ya corrió en el ambiente de desarrollo.
- (+) `main` puede tener checkpoints a medias sin llegar al celular; no hacen falta *feature flags*.
- (+) Siempre se sabe qué corre en producción: el último tag publicado, descrito en `CHANGELOG.md`.
- (+) Sin secretos nuevos en GitHub.
- (+) El modelo se lleva a AWS sin cambios: Amplify Hosting despliega por rama de forma nativa; en S3 + CloudFront, CodePipeline puede vigilar `production`.
- (−) Publicar es un paso manual (tag + mover `production`). Se mitiga con un checklist de release en la documentación.
- (−) Una rama larga más que proteger.
- (−) Producción se construye otra vez desde el código fuente. El riesgo es bajo con `npm ci` y el lockfile.
- (−) El ambiente de desarrollo es un despliegue de *preview* para Vercel. Si la *Deployment Protection* del plan Hobby exige iniciar sesión en Vercel, la PWA de desarrollo en el celular puede quedar detrás de ese login. Se verifica al implementar.
- Pendientes de implementación: configurar Vercel (rama de producción, dominio de desarrollo, protección), los DNS, los rulesets de GitHub para `production` y `v*`, actualizar architecture §8 y escribir el checklist de release.
- Revisar esta decisión si se migra a S3 + CloudFront: con GitHub Actions y OIDC (credenciales temporales, rol limitado al bucket y a la distribución, confianza restringida a `refs/tags/v*`) la opción B deja de tener su principal contra y probablemente conviene más.
