# Publicar una versión

Checklist para llevar `main` a producción, según [ADR-0017](adr/0017-ambientes-y-flujo-de-ramas.md). Ambientes y ramas: [architecture §8](architecture.md#8-despliegue).

> **Transición:** hasta configurar la rama `production` y el alias `gym-dev.vercel.app` en Vercel (pendientes de ADR-0017), Vercel sigue desplegando producción desde `main`. Mientras tanto, los pasos 1 y 2 (PR de release y tag) ya aplican; el 3 todavía no.

## Cuándo

- Al cerrar una spec: sube el *minor* (`0.1.0` → `0.2.0`).
- Por una corrección sin funciones nuevas: sube el *patch* (`0.2.0` → `0.2.1`).
- Mientras la versión empiece con `0`, la app y sus formatos pueden cambiar sin aviso. `v1.0.0` se publica cuando se decida que la app es estable.

Lo que esté en `main` al crear el tag entra en la versión. No se publica con un checkpoint a medias.

## Antes de empezar

- [ ] La spec está cerrada: todos sus checkpoints integrados en `main` y `handoff.md` actualizado.
- [ ] El último commit de `main` tiene el check `ci` en verde.
- [ ] La versión se usó en `gym-dev.vercel.app`: el flujo principal funciona y, si cambió `schemaVersion` o un formato de exportación, se probó la migración con datos de prueba y un respaldo importado.

## 1. PR de release

```bash
git switch main && git pull
git switch -c chore/release-vX.Y.Z
npm version X.Y.Z --no-git-tag-version   # actualiza package.json y package-lock.json
```

En `CHANGELOG.md`:

- [ ] Las entradas de `[Sin publicar]` pasan a una sección nueva `## [X.Y.Z] - AAAA-MM-DD`, agrupadas en *Añadido*, *Cambiado*, *Corregido* o *Eliminado*, citando la spec. `[Sin publicar]` queda vacía.
- [ ] Al final del archivo, el enlace `[Sin publicar]` compara desde `vX.Y.Z`, y hay un enlace nuevo `[X.Y.Z]` al tag.

Commit `chore: release vX.Y.Z`, PR, CI verde y merge con *Create a merge commit*.

## 2. Tag

```bash
git switch main && git pull
git log --oneline -1                     # debe ser el merge del PR de release
git tag -a vX.Y.Z -m "vX.Y.Z: <resumen>"
git push origin vX.Y.Z
```

## 3. Publicar en producción

```bash
git push origin vX.Y.Z^{}:production     # avanza production al commit del tag
```

`^{}` entrega el commit al que apunta el tag anotado. El push solo funciona como *fast-forward*: si GitHub lo rechaza, `production` tiene algo que `main` no tiene (ver [Hotfix](#hotfix)). Nunca se usa `--force`.

## 4. Verificar

- [ ] En Vercel, el despliegue de producción de `production` terminó y apunta al commit del tag.
- [ ] En el celular, la PWA de `gym.<dominio>` muestra el aviso de versión nueva. Al aceptarlo, o al cerrar la app, carga la versión nueva. El aviso se pospone durante una sesión activa.
- [ ] Los datos siguen ahí y lo que cambió en la versión funciona.

## Rollback

1. De inmediato: en Vercel, *Instant Rollback* al despliegue de producción anterior. No reconstruye ni mueve `production`.
2. La corrección se hace en `main` con su PR y se publica como versión de *patch* (pasos 1 a 4). `production` siempre avanza; nunca se retrocede con `--force`.

**Ojo con el esquema:** si la versión mala subió `schemaVersion` y ya abrió la base en el celular, el rollback no sirve. IndexedDB no deja abrir una base con una versión menor que la guardada, así que la versión anterior no podría leer los datos. En ese caso no se hace rollback: se exporta un respaldo desde la app y se corrige hacia delante con una versión de *patch*. Por eso las migraciones se prueban en `gym-dev.vercel.app` antes de publicar.

## Hotfix

Si el fallo está en producción y `main` ya tiene trabajo sin publicar:

1. Se corrige primero en `main` con su PR, como cualquier cambio.
2. Se crea una rama desde el último tag publicado y se aplica la corrección. Por ejemplo, si producción está en `v0.2.0`:

   ```bash
   git switch -c hotfix/v0.2.1 v0.2.0
   git cherry-pick -m 1 <merge-commit-del-fix-en-main>
   ```

3. En esa rama se sube la versión a `0.2.1` y se actualiza `CHANGELOG.md` (como en el paso 1). El CI no corre sobre esta rama por sí solo, así que antes del tag se verifica en local: `npm run typecheck && npm run lint && npm test && npm run build && npm run size && npm run test:e2e`.
4. Se crea el tag `v0.2.1` sobre el último commit de la rama y se publica (pasos 2 a 4, creando el tag desde la rama `hotfix/v0.2.1` en vez de `main`).
5. La rama `hotfix/v0.2.1` se integra en `main` con un PR y merge commit, para que la siguiente versión siga siendo *fast-forward* de `production`.
