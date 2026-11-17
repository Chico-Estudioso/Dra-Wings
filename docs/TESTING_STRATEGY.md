# Estrategia de pruebas

| Nivel | Herramienta | Qué cubre |
|---|---|---|
| Unitarias (Node) | Vitest | Modelo, esquemas zod, migraciones, ticks/timecode, `evaluate`, comandos y undo/redo, empaquetado ZIP |
| Renderizado (navegador real) | Vitest en modo navegador + Playwright Chromium | `renderFrame` con hashes de píxeles de referencia, trazos progresivos y determinismo |
| Integración (proceso principal) | Vitest (Node) | Guardado atómico, `.bak`, recuperación, validación de archivos corruptos o malformados y límites de ZIP |
| E2E | Playwright `_electron` | Arrancar la app, crear, guardar, cerrar y reabrir, cambiar de modo y exportar un vídeo corto |
| Exportación | Prueba E2E + mediabunny (y ffprobe en CI) | Duración, FPS, resolución, pistas y desfase A/V con marcas de imagen y sonido (método del prototipo M0) |
| Rendimiento | Escenas de estrés generadas | Tiempo por fotograma con N trazos, apertura de proyectos grandes y exportación de 10 min |
| Manual | Lista en cada PR | Tableta con presión, reproductores de Windows, monitores HiDPI |

## CI

- `validate.yml` (Windows): instalar, lint, typecheck, pruebas unitarias y de renderizado, build y E2E.
- Ubuntu ejecuta las mismas pruebas para detectar diferencias de plataforma (el renderizado con Xvfb).
- Workflow de prototipos o capacidades bajo demanda cuando cambie la versión de Electron.

## E2E: condiciones fijas

- La ventana se fija a 1024×700 en todas las plataformas: es la geometría que tienen los runners de Windows (pantallas de 1024×768) y así Linux prueba lo mismo. Una prueba específica comprueba que, con la ventana al tamaño mínimo, el lienzo no invade la línea de tiempo.
- Los medios de prueba (PNG y WAV) se generan en la propia prueba: no hay binarios en el repositorio.
- Las pruebas de audio no dependen de que haya dispositivo de salida: la reproducción pasa al reloj de pared si el del audio no avanza.
- La exportación se verifica demultiplexando el MP4 con mediabunny en Node (códecs, tamaño, fotogramas, duración y audio), sin depender de ffmpeg en CI. ffmpeg y ffprobe se usan a mano para revisar fotogramas, niveles de audio y la alineación de las pistas.

## Reglas

- Cada error corregido añade una prueba de regresión.
- No se desactivan pruebas para conseguir verde. Si una prueba es inestable, se arregla o se documenta con una incidencia.
- Las imágenes de referencia de renderizado se regeneran solo con un cambio visual intencionado y explicado en la PR.
- El informe de cada PR separa lo automatizado de lo comprobado a mano.
