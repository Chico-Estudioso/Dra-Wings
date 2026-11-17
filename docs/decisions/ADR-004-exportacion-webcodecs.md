# ADR-004 — Exportación con WebCodecs y mediabunny, sin FFmpeg empaquetado

- **Estado:** Aprobada
- **Fecha:** 2026-11-17

## Contexto

Hay que exportar MP4 reproducible con audio sincronizado, sin bloquear la interfaz y sin asumir obligaciones de licencia o de patentes difíciles de cumplir al redistribuir binarios.

## Opciones

1. **FFmpeg empaquetado:** los fotogramas RGBA se envían por stdin a `ffmpeg` (libx264 + AAC).
   - El binario con libx264 es GPL. Una compilación LGPL no incluye x264.
   - Redistribuir codificadores H.264/AAC propios plantea cuestiones de patentes.
   - Añade entre 50 y 100 MB al instalador.
2. **WebCodecs (Chromium de Electron) + muxer en JavaScript:** usa los codificadores que trae el propio Chromium (OpenH264, libvpx, libaom y Opus) y los del sistema operativo (Media Foundation en Windows y VideoToolbox en macOS, incluido AAC).

## Decisión

**WebCodecs en un worker + [mediabunny](https://mediabunny.dev) (MPL-2.0) para multiplexar MP4.** Selección de códecs por orden de preferencia:

- Vídeo: H.264 (`avc`) → VP9 → AV1.
- Audio: AAC → Opus.

FFmpeg no se empaqueta. Se usa solo como herramienta de desarrollo y QA para verificar archivos exportados.

MPL-2.0 es copyleft por archivo: usar mediabunny sin modificarlo no impone obligaciones al resto del código. Si se modifica, se publican esos archivos.

## Consecuencias

- Positivas: no hay binarios externos que distribuir ni licencias GPL que gestionar, el instalador es más pequeño, todo el proceso ocurre en el renderer (worker) con el mismo `renderFrame` de la previsualización, y la exportación es rápida.
- Negativas: los códecs disponibles dependen de la plataforma. En Linux no hay codificador AAC, así que se usa MP4 con Opus. En Windows N sin Media Feature Pack podría pasar lo mismo. La app debe mostrar qué códecs usará antes de exportar.
- La ruta FFmpeg queda documentada como alternativa si aparece un requisito que WebCodecs no cubra (por ejemplo, ProRes o GIF de alta calidad).

## Evidencia

Exportación de referencia: 5 s, 1280×720, 30 fps, música + narración con pitidos de sincronía. Linux, Electron 45, CPU de 4 núcleos sin GPU.

| Ruta | Tiempo | Resultado (ffprobe) | Desfase A/V medido con ffmpeg |
|---|---|---|---|
| WebCodecs + mediabunny | 0,7 s | H.264 High 1280×720, 150 fotogramas, 30/1 + Opus 48 kHz | 0,0 ms en las 4 marcas |
| Worker → IPC → FFmpeg (x264 medium + AAC) | 4,7 s | H.264 High + AAC 48 kHz | entre −1,2 y −0,2 ms |

- Hueco máximo del hilo de interfaz durante la exportación con WebCodecs: 17 ms (no se bloquea).
- Detalle: OpenH264 marca el vídeo como rango completo (`yuvj420p`). Hay que revisar en M6 que los colores se vean igual en los reproductores de Windows.
- Capacidades en Windows y macOS: ver `docs/AUDIO_EXPORT.md`.

## Implementación (M6)

Implementada tal como se decidió: `src/renderer/src/export/` (worker, mezcla y diálogo) y `src/main/export.ts` (destino `.part`). La app muestra los códecs antes de exportar. Detalle en `docs/AUDIO_EXPORT.md`.
