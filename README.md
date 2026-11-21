# Dra-Wings

**Dra-Wings** es una aplicación de escritorio para crear historias visuales narradas, vídeos estilo Draw My Life y animaciones sencillas sin exigir conocimientos de dibujo.

También ofrece herramientas de dibujo y animación libres para usuarios que prefieren trabajar sin ayudas.

![Editor de Dra-Wings con imagen, narración, música y marcas en la línea de tiempo](docs/img/editor-m5.png)

## Modos de creación

- **Guiado:** personajes, objetos, composiciones y ayudas editables.
- **Mixto:** biblioteca y dibujo libre en un mismo proyecto.
- **Libre:** lienzo y herramientas sin ayudas obligatorias.

Los modos comparten el mismo formato de proyecto.

## Estado

M0 a M7 completados: arquitectura, proyectos con guardado y recuperación, lienzo y dibujo, biblioteca con modo guiado, animación con línea de tiempo, audio con narración e imágenes importadas, exportación a MP4, y una fase de calidad (rendimiento, accesibilidad y robustez). M8 (empaquetado para Windows) está preparado; publicar una versión requiere aprobación. Ver `docs/PACKAGING.md`.

Después del MVP se han añadido herramientas para que todo quede vivo y se haga rápido: trazo vivo y mano que dibuja, ayudas al dibujar (estabilizador, tinta, formas rápidas y espejo), bote de pintura, pinceles de lápiz y tiza, animaciones de un clic, animar arrastrando, copiar y pegar animación (también en ola), vida automática, elasticidad, transiciones, cámara que sigue, fondos por escena (lisos o en degradado), personajes que cambian de expresión y hablan con la narración, textos que se escriben al ritmo con contorno y sombra, guion rápido, efectos de sonido, detección del ritmo de la música y escenas que se ajustan a las marcas para videoclips.

Ver `ROADMAP.md`, `docs/EDITOR.md`, `docs/ANIMATION_ENGINE.md`, `docs/LIBRARY.md` y `docs/AUDIO_EXPORT.md`. Para instalar una versión de prueba y saber qué probar: `docs/PROBAR.md`.

## Principios

- Aplicación de escritorio, inicialmente para Windows.
- Proyectos locales y editables.
- Edición no destructiva siempre que sea viable.
- Línea de tiempo visual para dibujo, animación y audio.
- Exportación de vídeo con audio sincronizado.
- Sin generación de imágenes por IA ni servicios en la nube como requisito del MVP.

## Desarrollo

Requisitos: Node.js 22 o superior.

```bash
npm ci             # instalar dependencias
npm run dev        # app en modo desarrollo con recarga en caliente
npm run check      # lint, formato, typecheck y pruebas unitarias
npm run build      # compilar
npm run test:e2e   # pruebas E2E con Electron (requiere build; en Linux sin pantalla: xvfb-run -a)
npm run dist:win   # instalador de Windows en dist/ (no publica nada)
```

Estructura: `src/main` (proceso principal), `src/preload` (puente seguro), `src/renderer` (interfaz React), `src/core` (modelo, tiempo, animación, render y audio; TypeScript puro), `src/shared` (contrato IPC) y `tests/` (unitarias y E2E).

Arquitectura y decisiones: `docs/ARCHITECTURE.md` y `docs/decisions/`. Normas de trabajo: `CLAUDE.md`, `AGENTS.md` y `prompts/README.md`.

Toda contribución debe seguir el flujo de ramas y Pull Requests descrito en `CONTRIBUTING.md`.
