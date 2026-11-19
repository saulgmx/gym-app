# Diseño del Cierre de sesión (para evaluar contra la spec 005)

Estado: **diseño elegido**; quedan abiertas las decisiones de la sección 7. Fuente visual: lienzo "App de seguimiento de entrenamiento: diseño", tablero **Cierre** (`Cierre.dc.html`). Ruta existente: `/sesion/:workoutId/cierre` (spec.md §7.2); hoy es una pantalla vacía. **No es una pantalla nueva**: la spec 005 la llena.

Documentos hermanos: `docs/design-sesion-activa.md`, `docs/design-hoy.md`, `docs/modules/health.md`.

Restricción de producto: la app nunca sugiere peso muerto ni impacto. Los mensajes de dolor son orientativos, no diagnóstico (P-1).

## 1. Estructura (de arriba a abajo)
1. **Título** "Sesión terminada" con marca de check, y debajo fecha y nombre de la sesión ("Miércoles 18 de noviembre · Full body A").
2. **Resumen** en tres cifras: minutos, series hechas y ejercicios. En una sesión parcial, ejercicios se muestra como "3 de 7".
3. **Dolor lumbar** (obligatorio): selector 0-10 y mensaje según la banda (sección 2).
4. **Banderas rojas** (opcional): cuatro casillas y aviso destacado (sección 3).
5. **Notas de la sesión** (opcional): campo de texto.
6. **Pie fijo:** "Guardar sesión" (principal, 56 px) y "Volver a la sesión" (secundario, 48 px). El contenido hace scroll; el pie no.

## 2. Dolor lumbar
- Empieza **sin nivel elegido**. "Guardar sesión" está deshabilitado hasta elegir uno, con el texto "Elige el nivel de dolor para poder guardar" (CA-4, `PainGate`).
- Botones 0-10 de 44 px con `aria-pressed`; el mensaje es región `aria-live="polite"`.
- Bandas fijas (RN-HLT-02) con el texto literal de spec §6.2:
  - 0-3: "Molestia leve, dentro de lo normal. Sigue con el plan."
  - 4-6: "Molestia alta. Baja la carga la próxima sesión y evita los ejercicios que la provocaron."
  - 7-10: "Dolor alto. Detén el entrenamiento de esta zona y consulta a tu traumatólogo o fisioterapeuta." (con barra ámbar)
- El color del botón elegido pasa a ámbar desde 4.
- Se usa `health.assessPain()` para la vista previa y `recordPain()` al guardar.

## 3. Banderas rojas
- Casillas (`role="checkbox"`): "Dolor que baja por la pierna", "Hormigueo o adormecimiento", "Debilidad en el pie", "Problemas de control de vejiga o intestino" (`radiating`, `numbness`, `weakness`, `bladder_bowel`).
- Con cualquiera: aviso ámbar "Consulta a un médico antes de seguir entrenando. No se sugerirá subir carga."
- Con `bladder_bowel`: "Acude a urgencias. No sigas entrenando hasta que te revise un médico."
- El texto exacto de estos dos avisos es propuesta de diseño; la spec solo define la idea (RN-HLT-06). Validar con el traumatólogo (spec §14).

## 4. Salidas y flujo
- **Guardar sesión:** registra el dolor y las banderas, marca el workout como terminado y lleva a Hoy.
- **Volver a la sesión** (decidido): regresa al último ejercicio visto. Si el usuario sale por otra vía sin guardar, la sesión sigue "en curso" y Hoy muestra "Continuar sesión".
- **Puertas de entrada:**
  - último ejercicio: el botón **"Terminar sesión"** (ya previsto en `spec.md` §7.2 y §7.3; en la spec 004 solo aparece "Anterior"). Su ubicación exacta en el pie (en lugar de "Siguiente") es decisión de diseño;
  - aviso de salida: "Terminar y guardar lo hecho", visible desde la spec 005.
- **Sesión parcial** (decidido): "Terminar y guardar lo hecho" lleva al **mismo Cierre**.
  - El dolor sigue siendo obligatorio.
  - El título no cambia ("Sesión terminada"); solo el resumen muestra "N de M" en ejercicios (ej. "3 de 7"). Minutos y series son las reales.
  - Si **no hay ninguna serie hecha**, "Terminar y guardar lo hecho" **no se muestra** en el aviso de salida (no hay nada que guardar); quedan Seguir entrenando, Salir y continuar después y Descartar.
  - Tras guardar, la sesión cuenta **como hecha** en la tira "Esta semana" de Hoy (✓ igual que una completa). No hay marca propia para parcial; el detalle se verá en el historial.

## 5. Fuera de alcance de la spec 005
- "Para la próxima sesión" (sugerencias de progresión): depende de `progression` (fase 4). Se quitó del tablero.
- Alerta persistente en Hoy y bloqueo de progresión: fase 4.
- Historial y exportar: fases posteriores.

## 6. Accesibilidad
Todo control ≥ 44 px, `aria-live` en el mensaje de dolor, casillas con rol y estado, contraste AA, funciona a 320 px.

## 7. Decisiones abiertas
1. ~~Flujo de sesión parcial~~ **Resuelto** (sección 4).
2. Si el workout guarda `notes`: revisar `training.md` antes de la spec.
3. Texto de los avisos de banderas rojas (validar con el traumatólogo).
4. ~~Con umbral configurable, ¿las bandas de mensajes se mueven con el umbral?~~ **Resuelto** (pregunta 8, 18-nov): son fijas; el umbral solo decide la alerta persistente (`health.md` v1.1 §10, RN-HLT-02).
