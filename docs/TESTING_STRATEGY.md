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

## Reglas

- Cada error corregido añade una prueba de regresión.
- No se desactivan pruebas para conseguir verde. Si una prueba es inestable, se arregla o se documenta con una incidencia.
- Las imágenes de referencia de renderizado se regeneran solo con un cambio visual intencionado y explicado en la PR.
- El informe de cada PR separa lo automatizado de lo comprobado a mano.
