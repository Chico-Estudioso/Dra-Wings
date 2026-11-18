# Motor de animación

## Contrato

```ts
evaluate(project: Project, globalTick: Ticks, opts?: { editorOverlays?: boolean }): RenderList
renderFrame(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, list: RenderList): void
```

- `evaluate` es pura: depende solo del documento y del tick. No lee el estado de la interfaz, no usa `Date.now()` ni aleatoriedad sin semilla.
- `RenderList` es una lista plana y ordenada de primitivas ya resueltas (trazo con puntos visibles, forma, texto, imagen) con su matriz y opacidad finales, más la transformación de cámara.
- La previsualización, la miniatura y la exportación usan las mismas dos funciones. Las capas de edición (selección, guías, onion skin) se dibujan aparte y nunca entran en la exportación.

## Tiempo

- Ticks enteros (ADR-006). El tiempo global se resuelve en `(escena, tickLocal)` acumulando las duraciones de las escenas.
- El fotograma `f` se exporta en `tick = f · 705600000 / fps`.
- Reproducción: el reloj maestro es `AudioContext.currentTime` cuando hay audio. El fotograma visible es el correspondiente a ese instante. Si la interfaz va lenta, se saltan fotogramas, pero nunca se desincroniza el audio.

## Apariciones y desapariciones (implementado en M4)

Cada elemento tiene `in` (cuándo empieza a aparecer), `out` opcional (cuándo termina de desaparecer), `enter` y `exit`:

| `enter.kind` | Efecto |
|---|---|
| `draw` | **Trazos:** se revelan por longitud de arco (`mode: 'length'`) o con los tiempos grabados (`'recorded'`). **Formas:** el contorno avanza con `lineDash` durante el 75 % de la duración y el relleno aparece en el 25 % final. **Textos:** se escriben letra a letra. **Imágenes:** aparecen con un fundido. **Grupos:** ver abajo. |
| `fade` | Opacidad de 0 a 1. |
| `pop` | Escala desde 0 con rebote suave, alrededor del ancla. |
| `none` | Aparece de golpe en `in`. |

`exit` (`fade` o `pop`) ocupa los últimos `duration` ticks antes de `out`.

**Grupos que se dibujan** (recursos de biblioteca y personajes): sus piezas se aplanan y, durante el 75 % inicial (`OUTLINE_SHARE`), los trazos y textos se dibujan **uno tras otro** con un tiempo proporcional a su longitud. En el 25 % final aparecen los rellenos y las imágenes («primero la línea, luego el color», como en un Draw My Life).

El último punto visible de un trazo se interpola entre dos puntos guardados, así que el resultado no depende del número de eventos del ratón.

## Tiempo automático

Al crear o insertar algo en una capa vectorial (`src/core/anim/timing.ts`):

- `in` = final de la última aparición de la escena (`contentEnd`), así que los elementos se dibujan en el orden en que se crearon.
- `enter = draw` con duración proporcional: trazos a ~1000 unidades/s (0,25–4 s), formas por perímetro, textos a 0,06 s por letra y grupos a 2,5 s. Las imágenes importadas entran con `fade` de 1 s.
- La escena se alarga si hace falta (`fitSceneDuration`: final del contenido + 1 s).

Todo se puede ajustar después en la línea de tiempo o en el panel «Animación».

## Keyframes

- `setValueAt(valor, t, v, grabar, desde)`: si la propiedad ya tiene keyframes, crea o actualiza el de `t`. Si es constante y «Grabar movimiento» está activo con `t > in`, crea la animación `[in → t]`. En otro caso cambia el valor constante.
- Mover, escalar, rotar, desplazar con flechas, centrar y la opacidad usan esta regla en el instante del cabezal.
- Mover un elemento en la línea de tiempo desplaza a la vez `in`, `out` y sus keyframes (`shiftItemTime`).

## Cámara

`scene.camera` es el **encuadre**: `x` e `y` son la esquina superior izquierda en la hoja y `scaleX` el zoom (1 = hoja completa). `cameraMatrix = S(zoom) · T(−x, −y)` se aplica en la vista previa y en el vídeo, nunca al editar. La herramienta **Encuadre** (C) mueve el marco o hace zoom desde su esquina, con keyframes si «Grabar movimiento» está activo.

## Fotograma a fotograma

- Una capa `kind: 'frames'` tiene `cels` con `start` y `duration` (al crear: 2 fotogramas del proyecto). Al dibujar en ella, el elemento va al fotograma del cabezal o crea uno.
- En cualquier modo se ve solo el fotograma que contiene el instante. Los elementos de un fotograma no usan `in` ni el tiempo automático.
- **Papel cebolla** (solo en el editor): anterior al 28 % y siguiente al 14 % de opacidad.
- Botones «Fotograma» (vacío) y «Duplicar» (copia el actual) crean el siguiente fotograma justo después y desplazan los posteriores.

## Reproducción

`usePlayback` avanza el cabezal con `requestAnimationFrame` y recorre las escenas en orden con el tiempo global (`locateTime`). En M5 el reloj maestro pasará a ser `AudioContext.currentTime`.

## Trazo vivo

En la animación dibujada a mano el mismo dibujo se calca varias veces y las copias se alternan, así que las líneas «hierven» aunque nada se mueva (*line boil*). Dra-Wings lo imita en el renderizador común (`src/core/render/boil.ts`), así que la vista previa y el vídeo exportado coinciden fotograma a fotograma:

- Cada elemento tiene **3 variantes** que se alternan unas **8 veces por segundo**, siempre en un número entero de fotogramas (cada 3 a 24 fps, cada 4 a 30 fps) para que el ritmo sea regular.
- **Trazos:** sus puntos se desplazan con un ruido suave a lo largo de la línea (ondulan sin romperse), con una amplitud que crece con el grosor y tiene tope. La semilla sale del id del elemento y de la variante: el resultado es determinista. Un trazo a medio dibujar tiembla igual que el completo en la parte ya dibujada. Los contornos de cada variante se guardan en la caché de trazados.
- **Formas y textos:** un pequeño desplazamiento y giro que mueve sus bordes unas pocas unidades. Las imágenes no tiemblan.
- Niveles: Quieto, Suave, Normal y Marcado (`settings.boil`). Los proyectos nuevos empiezan en Normal; los anteriores, sin el campo, quedan quietos.
- Solo se aplica al reproducir, en la vista previa y al exportar. Al editar, el dibujo se ve quieto para trabajar con precisión.

## Pruebas obligatorias

- Límites: tick 0, último tick de la escena, `in`/`out` exactos y clips solapados.
- Cambio de FPS: los ticks no cambian y los fotogramas exportados se recalculan.
- Determinismo: hashes de píxeles idénticos entre evaluaciones repetidas, en distinto orden y en el worker frente a la previsualización.

## Suavizado y animaciones rápidas

Cada keyframe guarda el suavizado del tramo que empieza en él (`src/core/anim/animated.ts`):

| Valor | En la interfaz | Efecto |
|---|---|---|
| `easeInOut` | Suave | Arranca y frena con suavidad (predeterminado) |
| `linear` | Constante | Velocidad uniforme |
| `easeIn` | Acelerar | Arranca despacio |
| `easeOut` | Frenar | Llega despacio |
| `back` | Con impulso | Se pasa un poco y vuelve, muy de dibujos animados |
| `bounce` | Rebote | Rebota al llegar |
| `hold` | A saltos | Mantiene el valor y salta al siguiente |

El selector «Suavizado» del panel «Animación» cambia todos los tramos del elemento.

**Animaciones rápidas** (`src/core/anim/presets.ts`, panel «Animación»): entrar o salir por un lado de la hoja, saltar (con un pequeño aplastamiento al aterrizar), balancearse, latir, flotar, girar, temblar y crecer. Crean keyframes normales a partir del cabezal (o de cuando aparece el elemento, si el cabezal está antes), relativos a cómo está el elemento en ese instante, y respetan los keyframes de fuera de su tramo. «Salir» además hace desaparecer el elemento al acabar. Si la animación termina después del final, la escena se alarga.

## Animar arrastrando y trayectorias

**Animar arrastrando** (botón del panel «Animación»; con él activo, la herramienta de selección agarra en vez de mover): al arrastrar un elemento, la escena se reproduce desde el cabezal (con su audio) y el elemento sigue al puntero. Se recoge su posición en cada fotograma de la reproducción y, al soltar, el recorrido se convierte en keyframes de posición:

- La conversión (`src/core/anim/record.ts`) simplifica las muestras con Ramer–Douglas–Peucker en tres dimensiones (x, y y tiempo, con 1 s = 300 unidades de la hoja) y una tolerancia de 2 unidades. Así se conservan las esquinas, las pausas y los cambios de velocidad con pocos keyframes, todos lineales, que siguen siendo editables como cualquier otro.
- Lo grabado sustituye los keyframes de posición de ese tramo y conserva los de fuera (`mergeKeys`). Rotación, escala y opacidad no se tocan. Se deshace de una vez.
- El movimiento es relativo al puntero y pasa por la cámara del instante: si la cámara se mueve y el puntero se queda quieto, el elemento se queda quieto en pantalla.
- Termina al soltar, al acabar la escena o al detener la reproducción. Esc cancela sin guardar y devuelve el cabezal al inicio. Si no se ha movido el puntero no se guarda nada (un clic solo selecciona). Tras guardar, el cabezal queda al final de lo grabado para seguir desde ahí.
- Mientras se graba se dibuja el rastro sobre la vista previa.

**Cambios de dibujo** (`src/core/anim/swaps.ts`): un grupo puede cambiar de hijos desde ciertos instantes (`swaps`); el render, la selección y el toque usan `childrenAt(grupo, t)`. Lo usan los personajes para cambiar de expresión o de postura (ver `docs/LIBRARY.md`). Los cambios se desplazan con el elemento al moverlo en el tiempo.

**Trayectoria:** con un único elemento seleccionado cuya posición está animada, el lienzo dibuja el recorrido de su centro entre el primer y el último keyframe de posición, con un punto en cada keyframe (`src/core/anim/motion-path.ts`).

