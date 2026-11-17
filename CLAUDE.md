# Gym app: seguimiento de entrenamiento (PWA)

App a la medida para registrar entrenamientos de hipertrofia. Offline-first, datos locales.

## Fuente de verdad (Spec-Driven Development)
Lee `docs/README.md` primero: mapa de documentos, jerarquía de autoridad y flujo spec → plan → tareas → código.
- `docs/constitution.md`: principios no negociables (P-1 a P-8). Revisar su checklist en cada plan y PR.
- `docs/spec.md`: qué hace la app (requerimientos RF/RNF, reglas de negocio, UX, criterios de aceptación). **La spec manda.** Si algo no está definido, proponer y preguntar.
- `docs/architecture.md`: cómo está construida (módulos, capas, flujos, datos, escenarios de calidad QS).
- `docs/modules/<módulo>.md`: contrato de cada módulo (API, tablas, eventos, puertos, reglas RN-*). Actualizar el contrato **antes** de cambiar la API.
- `docs/adr/`: decisiones de arquitectura. No editar ADRs aceptados; escribir uno nuevo.
- `docs/specs/NNN-<feature>/`: spec, plan y tareas por feature (plantillas en `docs/templates/`).
- `docs/plan.md`: plan de entrenamiento de 3 bloques (origen del seed).
- No escribir código sin spec o contrato que lo justifique. Las pruebas citan el ID de la regla (`RN-PRG-01`, `RF-11`).

## Stack
React + TypeScript + Vite, React Router, Zustand, Dexie (IndexedDB), Zod, vite-plugin-pwa, Vitest + Testing Library + Playwright.

## Arquitectura: monolito modular (docs/architecture.md, ADR-0001)
Módulos en `src/modules/`: `plan`, `training`, `progression`, `health`, `data`. Piezas transversales: `src/shared`, `src/app` (composition root y páginas que combinan módulos).
- Solo se importa el `index.ts` de otro módulo, nunca sus archivos internos.
- Sin dependencias circulares. Dependencias permitidas: architecture.md §5.1 y §5.2.
- Estilos: CSS Modules + variables CSS (ADR-0005). Gráficas: uPlot vía `shared/ui/Chart` (ADR-0004). Estado efímero: Zustand; Dexie es la fuente de verdad (ADR-0006).
- Cada módulo es dueño de sus tablas Dexie; otros módulos usan su API pública.
- Comunicación entre módulos por API pública, puertos o eventos (`shared/events`).
- Capas dentro de cada módulo: `domain` (TS puro, sin React ni Dexie), `application`, `infrastructure`, `ui`.
- Las pantallas que usan varios módulos viven en `src/app/pages`.

## Reglas de trabajo
- Pruebas primero para `progression` y `health` (dolor lumbar): reglas RN-PRG-* y RN-HLT-* en `docs/modules/`.
- TypeScript estricto. Validar con Zod todo lo que entra por import.
- UI en español; objetivos táctiles >= 44 px; contraste WCAG 2.2 AA.
- Tokens visuales en variables CSS (spec 7.4).

## Restricciones de dominio (importante)
El usuario tiene espondilolistesis L5-S1 grado I. La app **nunca** sugiere peso muerto (ninguna variante), buenos días, sentadilla con barra pesada ni ejercicios de impacto. Los ejercicios llevan `lumbarRisk` (spec 6.5). Las alertas de dolor son orientativas, no diagnóstico médico.

## Comandos
- dev: `npm run dev` (sin CSP: Vite inyecta scripts inline para HMR)
- build: `npm run build` (`tsc -b` + `vite build`); `npm run preview` sirve `dist/` con los headers de `vercel.json`
- typecheck: `npm run typecheck`
- lint: `npm run lint` (ESLint + stylelint + dependency-cruiser, sin warnings)
- format: `npm run format` / `npm run format:check`
- test: `npm test` (Vitest); `npm run test:watch`; `npm run test:coverage`
- e2e: `npm run test:e2e` (construye y corre Playwright en Chromium y WebKit)
- size: `npm run size` (presupuesto del bundle inicial)
- icons: `npm run icons` (regenera los PNG desde `public/icon.svg`)
- Instalar: `npm ci --strict-allow-scripts` (igual que CI y Vercel)

## Idioma
Conversación en español; código, nombres técnicos y commits en inglés.
