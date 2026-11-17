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

## Accesibilidad

`tests/e2e/a11y.spec.ts` audita con axe (`@axe-core/playwright`, WCAG 2.1 A y AA) el inicio, el diálogo de nuevo proyecto, el editor en Guiado y Libre, con un elemento seleccionado, el diálogo de exportación y la hoja de atajos, en tema claro y oscuro. Falla con cualquier problema grave o crítico. Otra prueba recorre el lienzo con Tab y comprueba los anuncios para lectores de pantalla. Queda pendiente probar con un lector de pantalla real (NVDA).

## Rendimiento

`tests/e2e/perf.spec.ts` (solo con `DW_PERF=1`) abre proyectos generados con 300 y 2000 trazos y mide la apertura, la reproducción y el redibujado. Resultados en el contenedor Linux de desarrollo (Xvfb, sin GPU), M7:

| Trazos | Abrir | Reproducir: p50 / p95 / máx. por fotograma | Desplazar la vista con todo visible (p95) | Tareas largas |
|---|---|---|---|---|
| 300 | 0,42 s | 16,6 / 17,4 / 21,3 ms | 17,5 ms | 0 |
| 2000 | 1,0 s | 16,6 / 17,9 / 22,3 ms | 17,3 ms | 0 |

Antes de aislar el cabezal de la línea de tiempo, con 2000 trazos la reproducción daba un p95 de 23,9 ms (máximo 33 ms). Falta repetirlo en hardware real con Windows.

## Reglas

- Cada error corregido añade una prueba de regresión.
- No se desactivan pruebas para conseguir verde. Si una prueba es inestable, se arregla o se documenta con una incidencia.
- Las imágenes de referencia de renderizado se regeneran solo con un cambio visual intencionado y explicado en la PR.
- El informe de cada PR separa lo automatizado de lo comprobado a mano.
