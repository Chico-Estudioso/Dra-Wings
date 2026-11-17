# Audio y exportación

Decisión de base: ADR-004 (WebCodecs + mediabunny, sin FFmpeg empaquetado).

## Audio en el editor

- Importación con diálogo nativo. El archivo se copia a la caché de medios con su SHA-256 como nombre y se añade al proyecto al guardar.
- Formatos admitidos en el MVP: los que decodifica el Chromium de Electron (WAV, MP3, AAC/M4A, OGG/Opus, FLAC). Se comprueba al importar con `decodeAudioData`, y si falla se muestra un error claro.
- Picos de la forma de onda calculados en un worker al importar y guardados en `cache/peaks/`.
- Pistas `narration`, `music` y `sfx`, cada una con volumen y silencio. Clips con posición, recorte (`sourceOffset` y `duration`), ganancia y fundidos lineales.
- Un mismo `buildAudioGraph(ctx, project, desde)` alimenta la reproducción (`AudioContext`) y la exportación (`OfflineAudioContext`). La mezcla exportada es la misma que se escucha.
- Marcadores en la línea de tiempo global para sincronizar frases y escenas.
- Nada de audio sale del equipo. Los registros no incluyen nombres de archivo ni contenido.

## Exportación

1. Diálogo de exportación: destino (diálogo nativo, con confirmación si el archivo existe), preajuste (720p, 1080p, cuadrado 1080×1080 o vertical 1080×1920), FPS y calidad (Normal, Alta o Máxima). Muestra qué códecs se van a usar.
2. El proceso principal reserva el destino y el renderer arranca el **worker de exportación** con el documento serializado.
3. El worker renderiza cada fotograma con `evaluate` + `renderFrame` sobre `OffscreenCanvas` y lo codifica con WebCodecs a través de mediabunny.
4. El audio se mezcla con `OfflineAudioContext` en el hilo de interfaz (la mezcla en sí corre en el hilo de audio) y se envía por tramos de 1 s intercalados con el vídeo.
5. El archivo se escribe en trozos hacia el proceso principal (`StreamTarget`), sin cargar el vídeo entero en memoria. Se usa un temporal `.part` que se renombra al terminar.
6. Progreso por fotogramas, cancelación que borra el `.part`, y el proyecto nunca se modifica.
7. Verificación final con mediabunny: se demultiplexa el archivo y se comprueban duración, resolución, FPS y presencia de audio.

## Códecs por plataforma (medido con Electron 45.3.3 / Chromium 156)

| Plataforma | Vídeo (H.264) | Audio AAC | Opus | VP9 / AV1 | HEVC | Resultado de exportación |
|---|---|---|---|---|---|---|
| Windows (GitHub Actions, sin GPU) | Sí (software) | **Sí** | Sí | Sí / Sí | No | H.264 + AAC, 0,53 s para 5 s de 720p, desfase A/V 0,0 ms |
| macOS arm64 (GitHub Actions) | Sí (software) | **Sí** | Sí | Sí / Sí | Solo decodificación | H.264 + AAC, 1,3 s para 5 s de 720p, desfase A/V 0,0 ms |
| Linux (contenedor, sin GPU) | Sí (OpenH264) | **No** | Sí | Sí / Sí | No | H.264 + Opus en MP4, 0,7 s, desfase A/V 0,0 ms |

Preferencia: H.264 + AAC. Si no hay codificador AAC (Linux, Windows N), se exporta H.264 + Opus en MP4 y se avisa de que algunos reproductores antiguos podrían no reproducir el audio.

## Riesgos abiertos

- **Rango de color:** OpenH264 marca `yuvj420p` (rango completo). En M6 hay que comparar colores en el reproductor de Windows y, si hace falta, convertir a rango limitado.
- **Codificación por hardware:** en los runners sin GPU solo se ha visto la ruta por software. En equipos reales, `prefer-hardware` podría acelerar, pero también introducir diferencias. Por ahora se usa `no-preference`.
- **Vídeos largos:** probar 10 minutos a 1080p (memoria y tiempo) en M6.
