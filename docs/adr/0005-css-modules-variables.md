# ADR-0005: Estilos con CSS Modules y variables CSS

- **Estado:** Aceptado
- **Fecha:** 16-nov-2026
- **Relacionado:** spec §7.4, RNF-05, RNF-06, P-7

## Contexto

La spec define tokens visuales (colores, tipografías, radios, objetivo táctil). El tema es oscuro por defecto y el acento puede cambiar (RF-52).

## Opciones

1. **CSS Modules + variables CSS:** nativo en Vite, sin dependencias; tokens como `--accent`.
2. **Tailwind:** rápido para prototipar; añade configuración y clases largas en JSX.
3. **CSS-in-JS:** coste en tiempo de ejecución y bundle.

## Decisión

CSS Modules (`*.module.css`) por componente y un único `shared/ui/tokens.css` con las variables de la spec §7.4, cargado en `app/main.tsx`. El cambio de acento se hace cambiando `--accent` en `:root` (atributo `data-accent`).

## Consecuencias

- (+) Cero dependencias; estilos aislados por componente.
- (+) Tokens editables en un solo lugar.
- (−) Sin utilidades: se crean unas pocas clases compartidas en `shared/ui` (por ejemplo `.stack`, `.srOnly`).
- Regla: ningún color, radio o tamaño de fuente literal fuera de `tokens.css` (stylelint, [PROPUESTO]).
- Fuentes Space Grotesk e Inter autoalojadas (`woff2`, subconjunto latino) por CSP y offline.
