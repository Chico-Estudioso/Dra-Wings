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
| `draw` | **Trazos:** se revelan por longitud de arco (`mode: 'length'`) o con los tiempos grabados (`'recorded'`). **Formas:** el contorno avanza con `lineDash` durante el 75 % de la duración y el relleno aparece en el 25 % final. **Textos:** se escriben letra a letra. **Grupos:** ver abajo. |
| `fade` | Opacidad de 0 a 1. |
| `pop` | Escala desde 0 con rebote suave, alrededor del ancla. |
| `none` | Aparece de golpe en `in`. |

`exit` (`fade` o `pop`) ocupa los últimos `duration` ticks antes de `out`.

**Grupos que se dibujan** (recursos de biblioteca y personajes): sus piezas se aplanan y, durante el 75 % inicial (`OUTLINE_SHARE`), los trazos y textos se dibujan **uno tras otro** con un tiempo proporcional a su longitud. En el 25 % final aparecen los rellenos («primero la línea, luego el color», como en un Draw My Life).

El último punto visible de un trazo se interpola entre dos puntos guardados, así que el resultado no depende del número de eventos del ratón.

## Tiempo automático

Al crear o insertar algo en una capa vectorial (`src/core/anim/timing.ts`):

- `in` = final de la última aparición de la escena (`contentEnd`), así que los elementos se dibujan en el orden en que se crearon.
- `enter = draw` con duración proporcional: trazos a ~1000 unidades/s (0,25–4 s), formas por perímetro, textos a 0,06 s por letra y grupos a 2,5 s.
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

## Pruebas obligatorias

- Límites: tick 0, último tick de la escena, `in`/`out` exactos y clips solapados.
- Cambio de FPS: los ticks no cambian y los fotogramas exportados se recalculan.
- Determinismo: hashes de píxeles idénticos entre evaluaciones repetidas, en distinto orden y en el worker frente a la previsualización.
