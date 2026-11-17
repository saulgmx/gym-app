# ADR-0004: Gráficas con uPlot

- **Estado:** Aceptado
- **Fecha:** 16-nov-2026
- **Relacionado:** RF-31, RF-33, RF-34, RNF-02, QS-10

## Contexto

Se necesitan gráficas simples (barras o líneas por semana: mejor serie, dolor, peso corporal) con un bundle inicial < 200 KB gzip.

## Opciones

1. **uPlot:** ~45 KB min (~20 KB gzip), Canvas, muy rápido; API imperativa.
2. **Recharts:** declarativa en React, pero ~100 KB+ gzip con dependencias de d3.
3. **SVG propio:** mínimo peso, pero más código propio para ejes, escalas y tooltips.

## Decisión

uPlot, envuelto en un único componente `shared/ui/Chart` que recibe datos y una configuración declarativa. Ningún módulo importa `uplot` directamente. Las páginas con gráficas se cargan con `React.lazy` para que uPlot no entre en el bundle inicial.

## Consecuencias

- (+) Presupuesto de bundle holgado; buen rendimiento en celulares de gama media.
- (+) Sustituible: solo cambia `shared/ui/Chart`.
- (−) Canvas no es accesible por sí mismo: cada gráfica tiene una tabla de datos alternativa (visible o `sr-only`) y un resumen textual (RNF-05).
- (−) Los colores se leen de las variables CSS en tiempo de ejecución (`getComputedStyle`).
