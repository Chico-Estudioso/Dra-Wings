# Roadmap — Dra-Wings

Estado: M0 completado. Siguiente: M1.

## M0 — Investigación y diseño ✅
- Stack decidido: Electron + React/TS, renderizador Canvas 2D propio, ZIP `.dwings`, exportación WebCodecs (ADR-001 a ADR-006).
- Prototipo `prototypes/m0` ejecutado en Linux y Windows (y macOS en CI): render determinista, trazos progresivos, exportación MP4 con audio sincronizado.
- **Salida:** arquitectura y decisiones documentadas en `docs/`.

## M1 — Fundación de la aplicación ✅
- Crear proyecto de escritorio y estructura base.
- Navegación principal y gestión de proyectos.
- Guardado, apertura, autosave y recuperación básica.
- Modelo de proyecto versionado (`.dwings` v1, esquemas zod, migraciones).
- CI en Windows con lint, typecheck, pruebas y build.
- **Salida:** crear, guardar, cerrar y reabrir un proyecto sin pérdida de datos.

## M2 — Lienzo y dibujo libre
- Lienzo, zoom y desplazamiento.
- Lápiz, goma, selección, formas y texto básico.
- Capas, orden, visibilidad y bloqueo.
- Deshacer/rehacer.
- **Salida:** crear y editar una escena dibujada manteniendo sus elementos editables.

## M3 — Modo guiado y biblioteca
- Biblioteca de personajes, objetos y recursos originales.
- Insertar, editar, recolorear, redimensionar y reutilizar elementos.
- Ayudas opcionales y plantillas de composición.
- **Salida:** crear una escena sin dibujar a mano y cambiar a modo mixto/libre.

## M4 — Animación y línea de tiempo
- Escenas, pistas y clips.
- Aparición progresiva de trazos.
- Transformaciones animadas de objetos.
- Fotogramas y referencias onion skin según alcance aprobado.
- Reproducción determinista.
- **Salida:** previsualizar una secuencia animada con tiempos controlables.

## M5 — Audio y narración
- Importar audio local.
- Pistas de narración, música y efectos.
- Forma de onda, recorte, volumen y fundidos básicos.
- Marcadores para sincronización.
- **Salida:** narración sincronizada con escenas y elementos visuales.

## M6 — Renderizado y exportación
- Renderizar fotogramas a partir del modelo de línea de tiempo.
- Mezclar audio y vídeo.
- Exportar MP4 y perfiles de resolución/FPS aprobados.
- Progreso, cancelación y gestión de temporales.
- **Salida:** vídeo reproducible y sincronizado fuera de la aplicación.

## M7 — Calidad y experiencia de usuario
- Rendimiento con proyectos grandes.
- Accesibilidad y navegación por teclado.
- Recuperación ante fallos y mensajes claros.
- Tutorial inicial y mejoras de usabilidad.
- **Salida:** MVP estable y validado con usuarios de distintos niveles.

## M8 — Preparación de lanzamiento
- Empaquetado para Windows.
- Instalador, documentación y licencias de dependencias.
- Pruebas de instalación limpia y actualización.
- Release candidato y publicación aprobada.

## Evolución posterior (no incluida en el MVP)
- Transcripción automática y sincronización asistida.
- Herramientas opcionales de IA.
- Más bibliotecas de recursos.
- Soporte ampliado para macOS/Linux.
- Colaboración o sincronización online.
