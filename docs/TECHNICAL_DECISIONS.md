# Decisiones técnicas

Registro breve. El detalle de cada una está en su ADR (`docs/decisions/`).

| # | Decisión | Estado | ADR |
|---|---|---|---|
| 1 | Electron (Chromium empaquetado) como plataforma de escritorio | Aprobada | ADR-001 |
| 2 | Renderizador propio Canvas 2D + perfect-freehand; sin Konva/Fabric | Aprobada | ADR-002 |
| 3 | Proyecto como ZIP `.dwings` con medios por hash y guardado atómico | Aprobada | ADR-003 |
| 4 | Exportación con WebCodecs + mediabunny; FFmpeg no se empaqueta | Aprobada | ADR-004 |
| 5 | Stack: TS, electron-vite, React 19, Radix, Zustand+Immer, Zod, fflate, Vitest, Playwright, electron-builder | Aprobada | ADR-005 |
| 6 | Tiempo entero en ticks (1 s = 705 600 000) | Aprobada | ADR-006 |
| 7 | Fuentes del texto empaquetadas (OFL): Patrick Hand (manuscrita), Caveat (caligráfica) y Nunito (redondeada), vía @fontsource. Las licencias se incluirán en el instalador (M8). | Aprobada | — |
| 8 | Goma no destructiva: divide trazos y elimina formas y textos completos | Aprobada | `docs/EDITOR.md` |
| 10 | Biblioteca original generada por código (trazos + rellenos) e insertada como grupos autosuficientes con ranuras de color | Aprobada | `docs/LIBRARY.md` |
| 11 | Importación de imágenes junto con el canal de medios del audio (implementada en M5) | Aprobada | `docs/AUDIO_EXPORT.md` |
| 12 | Apariciones por elemento (`in`, `enter`, `out`, `exit`) con tiempo automático secuencial; los grupos se dibujan contorno a contorno y después colorean | Aprobada | `docs/ANIMATION_ENGINE.md` |
| 13 | Edición con todo visible en el instante del cabezal y vista previa separada (muestra el vídeo con cámara) | Aprobada | `docs/EDITOR.md` |
| 9 | Rotación en grados y transformación T·R·S alrededor de un ancla (centro de la caja local) | Aprobada | `docs/PROJECT_FORMAT.md` |
| 14 | Medios por contenido (SHA-256) en una caché local servida por `app://dra-wings/media/`. El renderer nunca maneja rutas; los medios se verifican contra su hash al abrir. | Aprobada | `docs/AUDIO_EXPORT.md` |
| 15 | Audio decodificado a 48 kHz con `OfflineAudioContext` y una sola función de mezcla (`scheduleProject`) para reproducción y exportación | Aprobada | `docs/AUDIO_EXPORT.md` |
| 16 | Reloj de reproducción = reloj del audio, con reloj de pared si el dispositivo no avanza | Aprobada | `docs/AUDIO_EXPORT.md` |
| 17 | Al guardar se omiten los medios sin usar (solo en el archivo; la caché los conserva para deshacer) | Aprobada | `docs/PROJECT_FORMAT.md` |
| 18 | La narración alarga la última escena si se sale del vídeo; música y efectos se cortan al final | Aprobada | `docs/AUDIO_EXPORT.md` |
| 19 | MP4 sin *fast start* (metadatos al final), escrito por trozos con confirmación a un `.part` que solo maneja el proceso principal | Aprobada | `docs/AUDIO_EXPORT.md` |
| 20 | La vista previa y la exportación dibujan con la misma función (`drawSceneFrame` / `drawProjectFrame`) | Aprobada | `docs/AUDIO_EXPORT.md` |
| 21 | Los ajustes de exportación no se guardan en el proyecto (exportar no lo modifica) | Aprobada | `docs/AUDIO_EXPORT.md` |
| 22 | Accesibilidad comprobada con axe en E2E (WCAG 2.1 AA, sin problemas graves ni críticos); acento `#c2521e` en el tema claro por contraste | Aprobada | `docs/UI_UX_GUIDELINES.md` |
| 23 | Fallos: *error boundary* que guarda la recuperación y recarga de la ventana si cae el renderer | Aprobada | `docs/ARCHITECTURE.md` |
| 25 | Instalador NSIS por usuario (sin administrador) con electron-builder; sin actualización automática en el MVP | Aprobada | `docs/PACKAGING.md` |
| 26 | Fuses de Electron: sin RunAsNode, NODE_OPTIONS ni --inspect; solo `app.asar` con integridad; sin privilegios de `file://` | Aprobada | `docs/PACKAGING.md` |
| 27 | El CI verifica el instalador (instalar, arrancar, desinstalar) pero no lo sube: publicar requiere aprobación | Aprobada | `docs/PACKAGING.md` |
| 28 | Grabación de narración en la app: permiso solo de micrófono y solo para la propia interfaz; se guarda como WAV a 48 kHz | Aprobada | `docs/AUDIO_EXPORT.md` |
| 29 | El tipo de cada medio se decide por su firma; el renderer puede enviar bytes (nunca rutas) por un canal validado | Aprobada | `docs/AUDIO_EXPORT.md` |
| 30 | «Animar arrastrando» guarda keyframes lineales simplificados (RDP en x, y, tiempo), no una curva nueva: el formato no cambia y el resultado se edita como cualquier animación | Aprobada | `docs/ANIMATION_ENGINE.md` |
| 31 | Los cambios de expresión o postura son cambios de dibujo dentro del mismo grupo (`swaps`), no elementos separados: el personaje se sigue moviendo y animando como uno solo | Aprobada | `docs/PROJECT_FORMAT.md`, `docs/LIBRARY.md` |
| 24 | Aviso de `npm audit` en `picomatch` (ReDoS) aceptado: solo lo usan Vite y Vitest al compilar y probar, con patrones propios; no se empaqueta y no hay versión corregida | Aceptada (revisar en M8) | — |

## Pendientes (se deciden en su fase)

- Estrategia de caché de capas rasterizadas → cuando haya mediciones en hardware real (ver `docs/EDITOR.md`).
- Rango de color del vídeo exportado (OpenH264 marca rango completo) → comprobar en reproductores de Windows (M7).
- Firma de código del instalador Windows → antes de publicar (requiere certificado y aprobación).
