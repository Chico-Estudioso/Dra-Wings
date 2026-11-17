# Prototipo M0

Código desechable que se usó para validar las decisiones de M0 (ADR-002 y ADR-004). No forma parte de la aplicación.

## Qué comprueba

1. **Capacidades de Electron:** codificadores y decodificadores WebCodecs (H.264, HEVC, VP9, AV1, AAC, Opus y FLAC), Pointer Events y `OffscreenCanvas`.
2. **Determinismo:** el mismo fotograma renderizado en distinto orden y con o sin caché da el mismo hash, también entre lienzo acelerado y lienzo por software.
3. **Previsualización = exportación:** los 150 fotogramas renderizados en un worker con `OffscreenCanvas` se comparan con los de `HTMLCanvasElement`.
4. **Rendimiento:** 2000 trazos de 60 puntos con perfect-freehand.
5. **Exportación WebCodecs + mediabunny:** MP4 de 5 s a 1280×720 y 30 fps, con mezcla de audio de `OfflineAudioContext` (música más pitidos de sincronía).
6. **Exportación alternativa por FFmpeg** (si está instalado): los fotogramas RGBA se envían por stdin a libx264 + AAC.
7. **Verificación:** dentro de la app (mediabunny demultiplexa y decodifica para medir el desfase entre imagen y sonido) y fuera (`scripts/verify-ffmpeg.mjs` con ffprobe y ffmpeg).

## Ejecutar

```bash
cd prototypes/m0
npm ci
npm run build
npx electron .            # en Linux como root: añadir --no-sandbox; sin pantalla: xvfb-run -a
node scripts/verify-ffmpeg.mjs out
```

Los resultados se escriben en `out/results-<plataforma>.json` y los vídeos en `out/*.mp4`. El workflow `Prototipo M0` lo ejecuta en Windows y macOS.

Resultados resumidos en `docs/AUDIO_EXPORT.md` y en los ADR.
