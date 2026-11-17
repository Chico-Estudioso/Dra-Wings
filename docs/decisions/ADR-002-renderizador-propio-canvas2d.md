# ADR-002 — Renderizador propio sobre Canvas 2D y trazos con perfect-freehand

- **Estado:** Aprobada
- **Fecha:** 2026-11-17

## Contexto

El lienzo debe dibujar trazos con presión, revelarlos progresivamente, componer capas y objetos animados, y producir exactamente la misma imagen en la previsualización y en la exportación. La exportación debe correr en un worker para no bloquear la interfaz.

## Opciones

- **React Konva / Konva:** grafo de escena con eventos, *transformer* y caché. Pero el árbol de nodos de Konva acaba siendo una segunda fuente de verdad, necesita DOM para el *stage* y no está pensado para ejecutarse en un worker. La aparición progresiva de trazos exigiría `sceneFunc` personalizados, es decir, dibujar a mano igualmente.
- **Fabric.js:** su modelo de objetos y su serialización propios chocan con un formato de proyecto independiente, y tiene los mismos problemas en workers.
- **SVG/DOM:** cómodo para editar, pero muy lento con miles de trazos, y exportar requeriría rasterizar SVG fotograma a fotograma.
- **Canvas 2D propio:** una función pura `renderFrame(ctx, estadoEvaluado)` que funciona igual con `HTMLCanvasElement` y con `OffscreenCanvas` en un worker.

## Decisión

**Renderizador propio sobre Canvas 2D.** La geometría de los trazos se calcula con **perfect-freehand** (MIT): contorno variable según la presión, suavizado y `simulatePressure: false` cuando hay presión real. La interacción de edición (selección, tiradores y guías) va en una capa superpuesta propia que nunca se exporta.

## Consecuencias

- Positivas: un único código de dibujo para la previsualización y la exportación, ejecución en workers, control total del revelado de trazos y ninguna dependencia de un grafo de escena ajeno.
- Negativas: hay que implementar la selección, el *hit testing* y los tiradores de transformación.
- Rendimiento: hay que cachear `Path2D` por trazo y, en M2, rasterizar las capas estáticas a mapas de bits.

## Evidencia (prototipo ejecutado en Linux, Electron 45, CPU de 4 núcleos sin GPU)

- Mismo fotograma renderizado en distinto orden y con o sin caché: hashes SHA-256 idénticos.
- Lienzo acelerado frente a lienzo con `willReadFrequently`: 0 píxeles distintos.
- Worker (`OffscreenCanvas`) frente a previsualización (`HTMLCanvasElement`): **150 de 150 fotogramas idénticos** píxel a píxel.
- 2000 trazos de 60 puntos: contornos calculados en 45 ms, dibujo con `Path2D` cacheados en 57 ms por fotograma (raster por software). Recalcular el trazo parcial en curso cuesta 0,025 ms.
