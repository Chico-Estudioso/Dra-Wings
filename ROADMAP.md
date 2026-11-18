# Roadmap — Dra-Wings

Estado: M0 a M7 completados y M8 preparado: falta la aprobación para publicar.

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

## M2 — Lienzo y dibujo libre ✅
- Lienzo, zoom y desplazamiento.
- Lápiz, goma, selección, formas y texto básico.
- Capas, orden, visibilidad y bloqueo.
- Deshacer/rehacer.
- **Salida:** crear y editar una escena dibujada manteniendo sus elementos editables.

## M3 — Modo guiado y biblioteca ✅
- Biblioteca de personajes, objetos y recursos originales.
- Insertar, editar, recolorear, redimensionar y reutilizar elementos.
- Ayudas opcionales y plantillas de composición.
- **Salida:** crear una escena sin dibujar a mano y cambiar a modo mixto/libre.

## M4 — Animación y línea de tiempo ✅
- Escenas, pistas y clips.
- Aparición progresiva de trazos.
- Transformaciones animadas de objetos.
- Fotogramas y referencias onion skin según alcance aprobado.
- Reproducción determinista.
- **Salida:** previsualizar una secuencia animada con tiempos controlables.

## M5 — Audio y narración ✅
- Canal de medios del proyecto (caché por hash, guardado en el `.dwings`, servido por `app://dra-wings/media/`).
- Importar imágenes (movido desde M3: comparte canal con el audio).
- Importar audio local.
- Pistas de narración, música y efectos.
- Forma de onda, recorte, volumen y fundidos básicos.
- Marcadores para sincronización.
- Reproducción con el reloj del audio.
- **Salida:** narración sincronizada con escenas y elementos visuales.
- Después de M8 se añadieron grabar la voz desde el micrófono y arrastrar archivos desde el explorador. Sigue pendiente: GIF animados (ahora se usa el primer fotograma).

## M6 — Renderizado y exportación ✅
- Renderizar fotogramas a partir del modelo de línea de tiempo.
- Mezclar audio y vídeo.
- Exportar MP4 y perfiles de resolución/FPS aprobados.
- Progreso, cancelación y gestión de temporales.
- **Salida:** vídeo reproducible y sincronizado fuera de la aplicación.
- Pendiente de comprobar a mano: colores y audio en los reproductores de Windows, y un vídeo de 10 minutos a 1080p en hardware real.

## M7 — Calidad y experiencia de usuario ✅
- Rendimiento con proyectos grandes.
- Accesibilidad y navegación por teclado.
- Recuperación ante fallos y mensajes claros.
- Tutorial inicial y mejoras de usabilidad.
- **Salida:** MVP estable y validado con usuarios de distintos niveles.
- Hecho: mediciones con proyectos de 2000 trazos y línea de tiempo optimizada; auditoría automática de accesibilidad (axe) y correcciones; lienzo usable con teclado; hoja de atajos; recuperación ante fallos de la interfaz; guía de primeros pasos en el inicio.
- Pendiente (manual): validación con usuarios de distintos niveles, lector de pantalla real (NVDA) y rendimiento en hardware Windows real.

## M8 — Preparación de lanzamiento
- Empaquetado para Windows.
- Instalador, documentación y licencias de dependencias.
- Pruebas de instalación limpia y actualización.
- Release candidato y publicación aprobada.
- Hecho: instalador NSIS con fuses de Electron, asociación de `.dwings`, instancia única, licencias de terceros e icono; el CI empaqueta, instala, arranca y desinstala en Windows (ver `docs/PACKAGING.md`).
- Pendiente (requiere aprobación o medios externos): firma de código, pruebas en Windows limpio y publicación de la release candidata.

## Mejoras tras el MVP ✅
Herramientas para que dibujar y animar sea rápido y todo se vea vivo (también para videoclips):

- **Narración y audio:** grabar con el micrófono, también viendo el vídeo; arrastrar imágenes y audio desde el explorador; ritmo de la música detectado solo (golpes en la regla, ajuste magnético, aparecer al ritmo, ajustar la escena al compás, cámara que late); voz de la narración analizada para que los personajes hablen.
- **Dibujo:** estabilizador, trazo de tinta y formas rápidas; bote de pintura que cierra huecos solo; trazo vivo (las líneas tiemblan como en la animación a mano); mano que dibuja; tipo de hoja (papel, cuaderno o cuadrícula).
- **Animación:** animaciones rápidas de un clic y suavizado; animar arrastrando con trayectorias visibles; vida automática (respirar, balancearse, flotar, latir y al ritmo); elasticidad y estela; repetir movimiento; expresión y postura de los personajes en el tiempo; personajes que hablan; textos que se escriben palabra a palabra, con saltos o al ritmo; transiciones entre escenas.
- **Cámara y escenas:** cámara que sigue a un personaje; guion rápido (una escena por párrafo o por línea de una letra, con el texto escribiéndose solo); escenas a las marcas (marcar al oído mientras suena y cortar ahí).
- **Audio y salida:** efectos de sonido sintetizados por la app; guardar el fotograma del cabezal como imagen PNG.
- **Aprendizaje:** proyecto de ejemplo que enseña las herramientas; los recursos de la naturaleza nacen con vida.
- Pendiente (manual): probar el ritmo y el habla con canciones y voces reales, y ajustar el estabilizador y la tinta con ratón y tableta reales.

## Evolución posterior (no incluida en el MVP)
- Transcripción automática y sincronización asistida.
- Herramientas opcionales de IA.
- Más bibliotecas de recursos.
- Soporte ampliado para macOS/Linux.
- Colaboración o sincronización online.
