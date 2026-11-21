# Spec: Temporizador de descanso

**ID:** 009 · **Estado:** Aprobada (20-nov-2026) · **Fecha:** 20-nov-2026
**Requerimientos cubiertos:** RF-15, RF-18 (solo durante el descanso), RNF-01, RNF-05, RNF-06 · **Fase:** 4 (spec §13), primera de seis specs (009 a 014)
**Fuente de diseño:** [`docs/design-sesion-activa.md`](../../design-sesion-activa.md), tablero "Sesión activa A3" (`SesionA3.dc.html`): la tarjeta de descanso marcada "Fase 4". Esta spec la ajusta (decisión 4)
**ADRs aplicados:** 0005, 0006, 0009; 0014 (propuesto) en `tasks.md`: esta spec es la calibración de UI de Qwen

## 1. Problema y objetivo

Entre series, hoy el usuario mide el descanso con el reloj del teléfono o a ojo, fuera de la app. Descansar menos de lo que pide el ejercicio baja las repeticiones de la serie siguiente, y descansar de más alarga la sesión más allá de los 60 minutos del plan. Cada ejercicio ya trae su rango de descanso en el plan (`restSeconds`: 2-3 min en los compuestos, 60-90 s en los de aislamiento; spec §4.2). Esta spec arranca un temporizador al marcar una serie como hecha. Indica cuándo ya se puede hacer la siguiente (el mínimo del rango) y cuándo ya no conviene esperar más (el máximo), sin salir de la sesión.

## 2. Alcance

La fase 4 (v1.0) se reparte en 009 (temporizador), 010 (progresión), 011 (deload), 012 (gráficas de progreso), 013 (peso corporal) y 014 (ajustes). Esta spec no depende de ninguna de las otras.

- **Incluye:**
  - **Arranque:** al marcar una serie como hecha en la sesión activa, empieza el descanso con el rango `restSeconds` del ejercicio de esa serie (el elegido en el ítem, RN-TRN-13).
  - **Dos fases** (decisión 1): una cuenta regresiva hasta el mínimo del rango y, después, una indicación de que ya se puede hacer la serie siguiente mientras el tiempo sigue hasta el máximo.
  - **Aviso** (decisión 2): un cambio visual en la tarjeta y un tono corto generado con Web Audio dentro de la app.
  - **Controles** (decisión 4): "−15 s", "+15 s" y "Saltar".
  - **Recarga** (decisión 3): el descanso se calcula con el `completedAt` de la última serie hecha y el `restSeconds` de su ejercicio. Si se recarga la app, o se cierra y se vuelve a abrir durante el descanso, el temporizador sigue donde iba. Los ajustes manuales se pierden.
  - **Segundo plano:** el temporizador guarda instantes (`endsAt`, ADR-0006), no un contador, así que al volver a la app muestra el tiempo correcto.
  - **Pantalla encendida durante el descanso** (decisión 5, parte de RF-18): Wake Lock desde que se marca la serie hasta que termina el descanso. Así el tono puede sonar aunque el bloqueo automático del iPhone sea más corto que el descanso.
  - El componente `RestTimer` en `training/ui` (spec §7.5, `shared.md`).
- **No incluye:**
  - Notificaciones del sistema y vibración: Safari de iOS no tiene vibración web, y una PWA no avisa de forma fiable en segundo plano (decisión 2).
  - Pantalla encendida durante toda la sesión (el resto de RF-18): consume batería y deja la pantalla a la vista (decisión 5).
  - Editar el rango de descanso de un ejercicio (plan editable, RF-04, fase 5) o un ajuste global de descanso (spec 014).
  - Guardar el temporizador o sus ajustes en la base: no hay tablas ni migración, y la base sigue en v3 (decisión 3).
  - Registrar el descanso real en el historial, el respaldo o el CSV.
  - Elegir el sonido, el volumen o apagarlo desde Ajustes.

## 3. Historias de usuario

- Como usuario en el gym, quiero que el descanso empiece solo al marcar la serie, para no tener que tocar nada más con el teléfono en una mano.
- Como usuario que entrena para hipertrofia, quiero saber cuándo ya descansé lo mínimo y cuándo me estoy pasando, para respetar el rango de cada ejercicio sin hacer cuentas.
- Como usuario con los audífonos puestos o el teléfono en la banca, quiero un aviso que oiga o vea de reojo cuando termine el descanso.
- Como usuario, quiero alargar o acortar un descanso, o saltármelo, cuando el día lo pide (máquina ocupada, serie fácil).
- Como usuario, quiero que el temporizador siga bien si la app se va a segundo plano o se recarga mientras cambio de música o contesto un mensaje.

## 4. Criterios de aceptación

**Datos de ejemplo:** hoy es el lunes 23-nov-2026, en la zona del dispositivo (UTC−6). Hay una sesión en curso de Full body B (seed real), empezada a las 18:00, sin series hechas. Los ejercicios del ejemplo son:

| Ejercicio | Tipo | `restSeconds` |
|---|---|---|
| Hack squat (ítem 1) | compuesto | `[120, 180]` |
| Patada de glúteo en polea (ítem 4) | aislamiento | `[60, 90]` |

"El descanso de las 18:10" es el que arranca al marcar como hecha la serie 1 de Hack squat a las 18:10:00. Su mínimo es a las 18:12:00 y su máximo a las 18:13:00.

### 4.1 Arranque

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-1 | La sesión de ejemplo, sin descanso en curso | Marco como hecha la serie 1 de Hack squat a las 18:10:00 | Aparece la tarjeta de descanso con el título "Descanso", el tiempo "2:00" y la línea "Rango 2:00–3:00" |
| AC-2 | El descanso de las 18:10 | Son las 18:11:24 | La tarjeta muestra "0:36": el tiempo baja cada segundo hasta el mínimo |
| AC-3 | La sesión de ejemplo | Marco como hecha la serie 1 de Patada de glúteo en polea a las 18:30:00 | La tarjeta muestra "1:00" y "Rango 1:00–1:30" |
| AC-4 | Un ítem en el que elegí una alternativa (RN-TRN-13) | Marco una de sus series como hecha | El rango es el `restSeconds` del ejercicio elegido, no el del original |
| AC-5 | El descanso de las 18:10 | A las 18:11:00 marco como hecha la serie 1 de Patada de glúteo | El descanso vuelve a empezar con el de Patada ("1:00", "Rango 1:00–1:30"). El de Hack squat ya no suena |
| AC-6 | Solo queda una serie sin hacer en toda la sesión | La marco como hecha | No aparece el temporizador: no hay una serie siguiente |
| AC-7 | AC-6, 30 s después | Añado una serie extra (RF-16) | Aparece el descanso de la serie que acabo de hacer, con 30 s ya contados |
| AC-8 | Las series 1 (18:10:00) y 2 (18:13:30) de Hack squat hechas | A las 18:14:00 desmarco la serie 2 | El descanso se calcula con la serie 1. Como su máximo (18:13:00) ya pasó, la tarjeta desaparece |
| AC-9 | Las series 1 (18:10:00) y 2 (18:13:30) de Hack squat hechas | A las 18:14:00 desmarco la serie 1 | Nada cambia: el descanso sigue siendo el de la serie 2, que es la hecha más recientemente |
| AC-10 | El descanso de las 18:10 | Toco "Siguiente" y paso a Press inclinado con mancuernas | La tarjeta sigue ahí, con el mismo tiempo |
| AC-11 | El descanso de las 18:10 | Salgo a "Hoy" o abro el Cierre | Ni "Hoy" ni el Cierre muestran el temporizador. Si vuelvo a la sesión antes de las 18:13:00, la tarjeta sigue con el tiempo correcto |

### 4.2 Fases y aviso

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-12 | El descanso de las 18:10 | Llegan las 18:12:00 (el mínimo) | El título cambia a "Ya puedes" y el tiempo pasa a contar hasta el máximo ("1:00"). Suena un tono. La región de estado anuncia "Ya puedes hacer la siguiente serie." |
| AC-13 | AC-12 | Son las 18:12:40 | La tarjeta muestra "0:20" |
| AC-14 | AC-12 | Llegan las 18:13:00 (el máximo) | Suenan dos tonos, la tarjeta desaparece y la región de estado anuncia "Descanso terminado." |
| AC-15 | El descanso de las 18:10 | Pasa cada segundo | El número no se anuncia con un lector de pantalla: solo se anuncian los cambios de fase (AC-12 y AC-14) |
| AC-16 | Un iPhone en modo silencio (verificación manual) | Llega el mínimo | No se oye el tono, pero el cambio visual de AC-12 ocurre igual |

### 4.3 Controles

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-17 | El descanso de las 18:10, a las 18:11:00 ("1:00") | Toco "+15 s" | La tarjeta muestra "1:15". El rango completo se desplaza 15 s: el mínimo pasa a las 18:12:15 y el máximo a las 18:13:15 |
| AC-18 | El descanso de las 18:10, a las 18:11:00 | Toco "−15 s" | La tarjeta muestra "0:45". El mínimo pasa a las 18:11:45 y el máximo a las 18:12:45 |
| AC-19 | El descanso de las 18:10, a las 18:11:50 ("0:10") | Toco "−15 s" | Pasa a "Ya puedes" (el máximo queda a las 18:12:45: "0:55") sin tono, y se anuncia "Ya puedes hacer la siguiente serie." |
| AC-20 | "Ya puedes", a 0:10 del máximo | Toco "−15 s" | El descanso termina sin tonos, como con "Saltar" |
| AC-21 | "Ya puedes", a las 18:12:05 | Toco "+15 s" | El mínimo pasa a las 18:12:15, que todavía no llega: la tarjeta vuelve a "Descanso" con "0:10" |
| AC-22 | El descanso de las 18:10, en cualquier fase | Toco "Saltar" | La tarjeta desaparece sin tonos y el foco no se pierde (§6) |
| AC-23 | AC-22 | Marco como hecha la serie siguiente | Empieza un descanso nuevo (AC-1) |

### 4.4 Recarga y segundo plano

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-24 | El descanso de las 18:10 | Recargo la app a las 18:11:00 | La sesión vuelve con la tarjeta en "1:00" |
| AC-25 | El descanso de las 18:10 con "+15 s" o con "Saltar" | Recargo la app a las 18:11:00 | La tarjeta vuelve sin el ajuste ("1:00"): los ajustes no se guardan (decisión 3) |
| AC-26 | El descanso de las 18:10 | La app pasa a segundo plano de las 18:10:30 a las 18:12:20 | Al volver, la tarjeta muestra "Ya puedes" y "0:40". No suena un tono tarde |
| AC-27 | El descanso de las 18:10 | La app pasa a segundo plano de las 18:10:30 a las 18:14:00 | Al volver no hay tarjeta ni tonos |
| AC-28 | El descanso de las 18:10, y el reloj del dispositivo retrocede 1 min | Miro la tarjeta | El tiempo no pasa de "2:00": nunca muestra más que el mínimo del rango (más los ajustes) |

### 4.5 Transversales

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-29 | La sesión con la tarjeta de descanso | Corre axe en Playwright | Sin violaciones WCAG 2.2 A/AA. "−15 s", "+15 s" y "Saltar" miden ≥ 44 × 44 px y su nombre accesible es su texto visible. Nada desborda a 320 px |
| AC-30 | Sin conexión, con la app ya abierta una vez | Marco una serie | El temporizador funciona igual (RNF-01) |
| AC-31 | El build de producción | Corre `size-limit` | El JS inicial sigue < 200 KB gzip (QS-10) |
| AC-32 | La CSP de producción (`vercel.json`) | Corre un descanso completo con sus tonos en `vite preview` | Sin violaciones de CSP en la consola |
| AC-33 | Sin cambios de esquema | Abro la versión nueva con una base v3 | La base sigue en v3, sin migración. El respaldo y el CSV no cambian (P-2) |
| AC-34 | El descanso de las 18:10 | Pasa un segundo | Solo se vuelve a dibujar la tarjeta, no la tabla de series (ADR-0006). Marcar una serie sigue respondiendo en < 100 ms (RNF-02) |

### 4.6 Pantalla encendida

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-35 | Un navegador con Wake Lock | Empieza el descanso de las 18:10 | Se pide `wakeLock.request('screen')` |
| AC-36 | AC-35 | El descanso termina (por tiempo, por "Saltar" o por "−15 s"), salgo de la sesión activa o la sesión se cierra | Se suelta el Wake Lock |
| AC-37 | AC-35 | La app pasa a segundo plano y vuelve antes de las 18:13:00 | Se pide el Wake Lock otra vez. Si vuelve después, no |
| AC-38 | Un navegador sin Wake Lock, o que lo rechaza | Empieza un descanso | El temporizador funciona igual, sin mensajes de error ni errores sin capturar |
| AC-39 | Sin descanso en curso, en la sesión activa | Pasa el tiempo | No hay Wake Lock: la pantalla se bloquea según el ajuste del iPhone (verificación manual) |

## 5. Reglas de negocio aplicables

Del contrato [`modules/training.md`](../../modules/training.md): RN-TRN-05 (`completedAt` al marcar, se borra al desmarcar), RN-TRN-10 (series extra) y RN-TRN-13 (ejercicio elegido del ítem). De [`modules/plan.md`](../../modules/plan.md): `Exercise.restSeconds` (`[min, max]`, enteros ≥ 1, RN-PLN-24). ADR-0009: `Instant` con offset, comparado con `compareInstants` y nunca como texto.

Reglas nuevas (en el contrato `training` v1.35 desde la aprobación):

| ID | Regla |
|---|---|
| RN-TRN-32 | **Descanso derivado:** en un workout `in_progress`, la serie de referencia es la serie hecha (`done`) con el `completedAt` más reciente (`compareInstants`). Si dos coinciden, gana la del ítem con mayor `order` y luego la de mayor `setNumber`. El rango es el `restSeconds` del `exerciseId` de su ítem. Con `offset` = la suma de los ajustes (RN-TRN-34), `minAt = completedAt + min + offset` y `maxAt = completedAt + max + offset`. **No hay descanso** si no hay series hechas, si no queda ninguna serie sin hacer en el workout (planificadas o extra), si `now ≥ maxAt` o si se saltó el descanso de esa serie. Si el reloj retrocedió (`now < completedAt`), se usa `now = completedAt`. Es una función pura del dominio: `now` y los ajustes entran como parámetros (P-5), y no guarda nada. |
| RN-TRN-33 | **Fases:** `resting` mientras `now < minAt`, con el tiempo restante hasta `minAt`; `ready` mientras `minAt ≤ now < maxAt`, con el tiempo restante hasta `maxAt`. El tiempo se muestra en segundos enteros redondeados hacia arriba (al marcar se ve "2:00", no "1:59"), con formato `m:ss`. El rango se muestra como `m:ss–m:ss` del `restSeconds` sin ajustes ("Rango 2:00–3:00"). |
| RN-TRN-34 | **Ajustes:** "+15 s" y "−15 s" suman o restan 15 s al `offset`, que mueve los dos extremos a la vez. Un ajuste vale solo para la serie de referencia en la que se hizo: si esta cambia (se marca otra serie o se desmarca la de referencia), el `offset` vuelve a 0 y el descanso saltado se olvida. Un "−15 s" que deja `maxAt ≤ now` termina el descanso. "Saltar" termina el descanso de esa serie. Los ajustes viven solo en memoria (Zustand) y se pierden al recargar. |
| RN-TRN-35 | **Aviso:** un tono al pasar de `resting` a `ready` y dos tonos al llegar a `maxAt`, solo cuando el cruce ocurre con el paso del tiempo **y** la app estuvo en primer plano desde la fase anterior. Un cambio de fase causado por un control, al cargar la página o al volver a primer plano no suena; en esos casos se toma la fase actual en silencio. Los cambios a `ready` y el fin por tiempo se anuncian en una región `role="status"` ("Ya puedes hacer la siguiente serie.", "Descanso terminado."); el número que cambia cada segundo no se anuncia. El tono se genera con Web Audio (sin archivos de audio), y el contexto se activa con el toque que marca la serie (requisito de iOS). |

Quién calcula qué (la función de dominio, el store de `app` y el puerto o módulo del sonido) lo fija el plan técnico.

Cambios de documentos hechos al aprobar (20-nov):

| Documento | Cambio |
|---|---|
| `spec.md` (v0.16) | §7.2, fila "Sesión activa": "Fase 4: banner de sugerencia y temporizador" pasa a "temporizador de descanso con pantalla encendida mientras dura (spec 009); fase 4: banner de sugerencia". RF-18 sigue abierto para la sesión completa |
| `modules/training.md` (v1.35) | RN-TRN-32 a 35 y la decisión de la spec. La firma de la función de dominio y la exportación de `RestTimer` las fija el plan |
| `architecture.md` | §7.8 (estado de UI): el temporizador ya no guarda `endsAt` en Zustand; lo calcula a partir de Dexie (`completedAt` + `restSeconds`), y Zustand solo guarda los ajustes. En el diagrama de §6.2, "el temporizador arranca (Zustand)" pasa a "el descanso se calcula de la serie" |
| `design-sesion-activa.md` | §1 y las notas: "+30 s" pasa a "−15 s, +15 s y Saltar (spec 009)"; Wake Lock solo durante el descanso (decisión 5) |
| ADR-0006 | Sin cambios: el temporizador sigue sin usar un contador, y `endsAt` (`maxAt`) sigue siendo un instante, ahora calculado. Si en la revisión se considera una contradicción, se escribe un ADR nuevo |

## 6. UX

### 6.1 Tarjeta de descanso (sesión activa)

- **Dónde:** dentro del pie fijo de la sesión (spec 004 §6.6), encima de la línea "Siguiente: …", al alcance del pulgar. Mientras se ve, el contenido de la página reserva su altura para que la última fila de la tabla no quede tapada.
- **Contenido**, en dos filas:
  1. A la izquierda, el título ("Descanso" o "Ya puedes") y debajo el tiempo grande (`m:ss`, Space Grotesk 700, cifras tabulares para que no salte). A la derecha, "Rango 2:00–3:00" en `--text-muted`.
  2. Tres botones secundarios del mismo ancho: "−15 s", "+15 s" y "Saltar", de ≥ 44 px de alto. El nombre accesible de cada uno es su texto visible, sin `aria-label` (WCAG 2.5.3). El signo de "−15 s" es U+2212.
- **Fases:** en "Descanso", el título va en `--text-muted` y la tarjeta en `--surface`. En "Ya puedes", el título va en `--accent` y la tarjeta lleva un borde de 1 px en `--accent`. El cambio no depende solo del color, porque el título también cambia. Sin barra de progreso ni animaciones (P-7).
- **Región de estado:** un `role="status"` siempre montado en el pie, fuera de la tarjeta, para que los anuncios de RN-TRN-35 se oigan aunque la tarjeta desaparezca. El tiempo no es región viva.
- **Foco:** si la tarjeta desaparece mientras el foco está dentro de ella (por "Saltar", por un "−15 s" que termina el descanso o porque llegó el máximo), el foco pasa al primer campo de la siguiente serie sin hacer del ejercicio actual. Si el ejercicio actual no tiene series pendientes, pasa al primer enlace del pie ("Anterior" o "Siguiente"). Si el foco estaba en otra parte, no se mueve.
- **Textos:** "Descanso", "Ya puedes", "Rango m:ss–m:ss", "−15 s", "+15 s", "Saltar", "Ya puedes hacer la siguiente serie." y "Descanso terminado.".

### 6.2 Sonido

- Tono corto (unos 150 ms, un seno de unos 880 Hz, volumen moderado). El doble tono son dos de esos con unos 100 ms de separación. El plan técnico fija los valores.
- Sin archivos de audio: generado con Web Audio, sin peso extra en el bundle ni en el precache.
- El `AudioContext` se crea o se reanuda en el toque que marca la serie. Después de una recarga queda suspendido hasta el siguiente toque, y mientras tanto el aviso es solo visual (§7).

### 6.3 Pantalla encendida (decisión 5)

- Se pide `navigator.wakeLock.request('screen')` cuando empieza un descanso y se suelta cuando termina (por tiempo, por "Saltar" o por "−15 s"), al salir de la sesión activa o al cerrar la sesión.
- El navegador suelta el Wake Lock al pasar a segundo plano. Al volver, si el descanso sigue en curso, se pide otra vez.
- Si la API no existe o rechaza (sin permiso, batería baja, iOS anterior a 18.4 en la app instalada), no se muestra nada: el temporizador funciona igual y el fallo se ignora en silencio.

### 6.4 Estados

- **Sin conexión:** funciona igual (RNF-01). No usa red.
- **Error inesperado** al calcular el descanso (dato roto, como un ejercicio que no está en la vista): lo maneja el límite de errores de la sesión, igual que hoy (RN-TRN-17).
- **Textos** en español, contraste AA con los tokens existentes y sin colores nuevos.

## 7. Casos límite

- **Desmarcar** la serie de referencia: el descanso se calcula con la anterior hecha más reciente, que casi siempre ya terminó (AC-8). Desmarcar otra serie no cambia nada (AC-9).
- **Marcar otra serie durante el descanso:** empieza el descanso de esa serie, con su rango. Los ajustes se reinician (AC-5, RN-TRN-34).
- **Quitar una serie** (RN-TRN-10, solo las no hechas): si era la única pendiente, el descanso desaparece, porque no queda nada que esperar (RN-TRN-32).
- **Elegir una alternativa** (RN-TRN-13): solo se puede en un ítem sin series hechas, así que no cambia la serie de referencia.
- **Ejercicios por tiempo** (Plancha, `metric: 'time'`): el descanso es igual. Contar la duración de la plancha queda fuera de esta spec.
- **Sesión de otro día** (`plannedFor ≠ date`) o que cruza la medianoche: el descanso solo usa instantes, así que nada cambia (ADR-0009).
- **Reloj que retrocede** o un `completedAt` en el futuro: el tiempo no pasa del mínimo más los ajustes (AC-28).
- **Dos pestañas con la misma sesión:** cada una calcula el descanso de Dexie. Los ajustes son de cada pestaña y los tonos pueden sonar en las dos. Se tolera (un solo usuario).
- **`AudioContext` suspendido** después de recargar, o el iPhone en modo silencio: no suena, pero el cambio visual y el anuncio ocurren igual (AC-16).
- **Música de fondo en el iPhone:** el tono no debe pausar la música de otra app. Se verifica en el iPhone. Si la pausa, el plan técnico usa `navigator.audioSession.type = 'ambient'` (Safari 16.4+).
- **Pantalla bloqueada a pesar del Wake Lock** (API no disponible o rechazada): la PWA se suspende y no hay tono. Al desbloquear, la tarjeta muestra el estado correcto, sin tonos atrasados (AC-26, AC-27).
- **Terminar o descartar la sesión durante el descanso:** el workout deja de estar `in_progress`, no hay descanso y se suelta el Wake Lock.

## 8. Preguntas abiertas

Ninguna que bloquee. Decisiones cerradas el 20-nov-2026 (conversación con el dueño del producto):

1. **Cuenta en dos fases:** regresiva hasta el mínimo de `restSeconds` ("Ya puedes"); después sigue hasta el máximo.
2. **Aviso visual y sonoro dentro de la app:** un tono corto con Web Audio. Sin notificaciones del sistema ni vibración.
3. **Se deriva de la última serie hecha:** `completedAt` + `restSeconds`, sin almacenamiento nuevo. Sobrevive a la recarga; los ajustes manuales (−15 s, +15 s, Saltar) no.
4. **Controles −15 s, +15 s y Saltar.** Reemplaza el "+30 s" del tablero "Sesión activa A3".
5. **Pantalla encendida solo durante el descanso** (parte de RF-18): por la batería y para no dejar la pantalla a la vista. Toda la sesión con la pantalla encendida queda fuera.
6. **Comportamientos de los criterios** (paso 3): el descanso termina en el máximo, sin una fase de "te pasaste"; un tono al mínimo y dos al máximo; manda la última serie hecha de toda la sesión; sin descanso si no queda ninguna serie pendiente; los ajustes mueven los dos extremos; no hay tonos atrasados; solo se anuncian los cambios de fase; la tarjeta solo aparece en la sesión activa.
7. **ADR-0006 sin ADR nuevo:** el temporizador sigue sin contador y `maxAt` es un instante, ahora calculado en lugar de guardado. Eso cumple lo que busca el ADR.
8. **UX** (paso 5): la tarjeta va en el pie fijo; el foco sigue las reglas del §6.1; tono de Web Audio sin archivos.

## 9. Checklist de la constitución

- [x] **P-1:** el temporizador no sugiere ejercicios ni cargas; solo mide tiempo. No toca la progresión ni las banderas rojas.
- [x] **P-2:** no hay datos nuevos: el descanso se calcula de series que ya se guardan al instante. Sin cambio de esquema (la base sigue en v3), sin migración y sin cambios en el respaldo ni en el CSV (AC-33).
- [x] **P-3:** cada comportamiento tiene un criterio (§4) o una regla (§5). No quedan `[POR DEFINIR]`. Los cambios de documentos están listados en el §5.
- [x] **P-4:** la regla vive en `training` (dominio) y la tarjeta en `training/ui`; la sesión (`app`) la compone. No hay tablas nuevas ni acceso a tablas ajenas.
- [x] **P-5:** RN-TRN-32 a 34 son funciones puras con `now` como parámetro, sin `Date.now()`. `training` no exige pruebas primero, pero el plan las pone primero en el dominio del descanso.
- [x] **P-6:** marcar una serie sigue en < 100 ms y el contador no vuelve a dibujar la tabla (AC-34). Controles ≥ 44 px, contraste AA, nada desborda a 320 px y el tono no añade peso al bundle (AC-29, AC-31).
- [x] **P-7:** sin almacenamiento, sin barra de progreso, sin notificaciones, sin ajustes de sonido y sin dependencias nuevas. Wake Lock solo durante el descanso.
- [x] **P-8:** textos en español, código en inglés. No entra ningún dato externo nuevo.
