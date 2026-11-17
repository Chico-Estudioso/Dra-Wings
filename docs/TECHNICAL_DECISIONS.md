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

## Pendientes (se deciden en su fase)

- Fuentes tipográficas empaquetadas para el texto (deben ser OFL y cargarse igual en el worker de exportación) → M2.
- Estrategia de caché de capas rasterizadas → M2, con mediciones en hardware real.
- Formato de los recursos de biblioteca (personajes modulares) → M3.
- Conversión de rango de color en la exportación → M6.
- Firma de código del instalador Windows → M8.
