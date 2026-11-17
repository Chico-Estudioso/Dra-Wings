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

## Trazos progresivos

- Cada punto guarda `x`, `y`, la presión y `tMs` (milisegundos desde el inicio del trazo, capturados al dibujar).
- `reveal.mode = 'length'`: el progreso `p = (t - start) / duration` se aplica sobre la longitud de arco, así que la velocidad es constante, que es el estilo habitual de los vídeos Draw My Life.
- `reveal.mode = 'recorded'`: el progreso sigue los tiempos reales de dibujo, escalados a `duration`.
- El último punto visible se interpola entre dos puntos guardados, así que el resultado no depende del número de eventos del ratón.
- `getStroke(…, { last: p >= 1 })` de perfect-freehand cierra el extremo solo cuando el trazo está completo.

Validado en el prototipo M0: el revelado por longitud de arco es determinista y 150 de 150 fotogramas fueron idénticos entre el worker y la previsualización.

## Objetos y cámara

- Propiedades animables: `x`, `y`, `scaleX`, `scaleY`, `rotation` y `opacity` (además del ancla).
- `Animated<T>`: valor fijo o keyframes `{ t, v, ease }`. Antes del primer keyframe se mantiene el primer valor y después del último, el último.
- Curvas: `linear`, `easeIn`, `easeOut`, `easeInOut` (cúbicas) y `hold` (escalón).
- `in` y `out` del item: fuera de ese intervalo, el item no aparece en la `RenderList`.
- La cámara es una `AnimatedTransform` por escena que se aplica como matriz inversa. Las coordenadas del proyecto no dependen del zoom del editor.

## Fotograma a fotograma

- Una capa `kind: 'frames'` contiene `cels` con `start` y `duration` en ticks, alineados a la rejilla de FPS (exposición de 1, 2 o 3 fotogramas…).
- En un tick dado se muestra el cel cuyo intervalo lo contiene, o ninguno.
- Los items de un cel son items normales: se pueden editar con las mismas herramientas y también admiten el revelado de trazos.
- Onion skin: solo en el editor. Los cels anterior y siguiente se dibujan con un tinte y opacidad configurables.
- Convive con capas vectoriales animadas en la misma escena sin aplanar nada.

## Pruebas obligatorias

- Límites: tick 0, último tick de la escena, `in`/`out` exactos y clips solapados.
- Cambio de FPS: los ticks no cambian y los fotogramas exportados se recalculan.
- Determinismo: hashes de píxeles idénticos entre evaluaciones repetidas, en distinto orden y en el worker frente a la previsualización.
