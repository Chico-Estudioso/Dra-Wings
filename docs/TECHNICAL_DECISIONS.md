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
| 9 | Rotación en grados y transformación T·R·S alrededor de un ancla (centro de la caja local) | Aprobada | `docs/PROJECT_FORMAT.md` |

## Pendientes (se deciden en su fase)

- Estrategia de caché de capas rasterizadas → cuando haya mediciones en hardware real (ver `docs/EDITOR.md`).
- Formato de los recursos de biblioteca (personajes modulares) → M3.
- Conversión de rango de color en la exportación → M6.
- Firma de código del instalador Windows → M8.
