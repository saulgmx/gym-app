# ADR-0011: Hosting en Vercel con origen estable en dominio propio

- **Estado:** Aceptado
- **Fecha:** 16-nov-2026
- **Relacionado:** spec §12, RNF-10, P-2, P-7, ADR-0002, architecture §7 (seguridad) y §8

## Contexto

- La app es una SPA estática (`dist/` de Vite) con service worker; no hay backend en v1 (ADR-0002).
- Se necesita: headers propios (CSP de RNF-10, `Cache-Control: no-cache` en `index.html` y `sw.js`), fallback de SPA para React Router, HTTPS y despliegue automático desde `main` solo con CI verde.
- **IndexedDB, el service worker y la PWA instalada están ligados al origen** (esquema + host). Cambiar de origen deja la app vacía en el celular y obliga a exportar e importar a mano, lo que choca con P-2.
- Es posible un backend futuro en AWS. La cuenta de AWS actual es de plan gratuito, que no permite registrar dominios en Route 53.
- El repositorio `saulgmx/gym-app` es público: la protección de rama de GitHub está disponible sin costo.

## Opciones

1. **Vercel (Hobby):** headers y rewrites en `vercel.json`, preview por PR, integración de Git sin configuración. Uso no comercial (es el caso). (−) Plataforma ajena a un posible backend en AWS.
2. **Netlify (Free):** equivalente en funciones. (−) El plan gratuito es por créditos y cada deploy de producción los consume; con CD en cada push a `main` el límite se nota.
3. **AWS S3 + CloudFront (CDK):** control total, costo ~0, despliegue desde GitHub Actions con OIDC tras CI verde, misma plataforma que un backend futuro. (−) Más alcance en la fase 0 (stack CDK, rol OIDC, Response Headers Policy, CloudFront Function); sin preview por PR.
4. **AWS Amplify Hosting:** experiencia similar a Vercel dentro de AWS. (−) Menos control y menos transparencia que S3 + CloudFront.

Y para el origen:

- **a) Dominio propio desde el primer despliegue:** el origen sobrevive a cualquier cambio de proveedor (solo cambia el DNS). (−) ~10–11 USD/año por un `.com`.
- **b) Subdominio del proveedor (`*.vercel.app`):** gratis. (−) Migrar de proveedor cambia el origen y obliga a exportar e importar.

## Decisión

**Vercel (Hobby) en v1, servido desde un subdominio de un dominio propio** (por ejemplo, `gym.<dominio>.com`). El registrador queda a elección (Cloudflare Registrar o Porkbun recomendados; Route 53 si la cuenta de AWS pasa a plan de pago).

Reglas:

1. **Origen estable:** la app nunca se publica para uso real en `*.vercel.app`; el primer despliegue de producción ya usa el dominio propio. Las URLs de preview de Vercel son solo para revisar, no para instalar la PWA.
2. **Portabilidad:** prohibido usar funciones exclusivas de Vercel (Edge/Serverless Functions, Image Optimization, Vercel Analytics, variables resueltas en el edge). El artefacto desplegado es solo `dist/`.
3. **Headers en un solo lugar:** la fuente de verdad es architecture §7 (seguridad) y §8; `vercel.json` solo los aplica:
   - CSP de architecture §7.
   - `Cache-Control: no-cache` para `index.html`, `sw.js` y `manifest.webmanifest`.
   - `Cache-Control: public, max-age=31536000, immutable` para `/assets/*` (nombres con hash).
   - Fallback de SPA: rutas sin extensión → `/index.html`.
4. **CI antes de producción:** Vercel despliega producción desde `main`; `main` está protegida en GitHub (cambios por PR y check de CI obligatorio), así que a producción solo llega lo que pasó CI.

## Consecuencias

- (+) Configuración mínima en la fase 0 (P-7): un `vercel.json` y conectar el repo.
- (+) Preview por PR sin costo.
- (+) Migrar a otro proveedor (por ejemplo, S3 + CloudFront) es cambiar el DNS y traducir los headers; los datos del usuario no se tocan.
- (−) Costo anual del dominio.
- (−) Trabajar con PR incluso siendo un solo desarrollador (lo exige la protección de rama).
- Revisar esta decisión cuando exista un backend (probablemente en AWS) o si cambian los términos del plan Hobby. Migrar requiere un ADR nuevo que reemplace a este.
