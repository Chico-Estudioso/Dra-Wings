# Project Charter — Dra-Wings

## Visión

Hacer accesible la creación de historias visuales narradas y vídeos estilo Draw My Life, incluso para personas que no saben dibujar, sin limitar a quienes prefieren crear cada trazo y fotograma manualmente.

## Usuarios principales

1. Personas que tienen historias que contar, pero necesitan ayuda para crear elementos visuales.
2. Creadores que combinan dibujo libre con recursos prediseñados.
3. Dibujantes y animadores que quieren controlar lienzo, capas, trazos, fotogramas y tiempos.

## Propuesta de valor

Un editor de escritorio que une dibujo, biblioteca visual, animación, narración y exportación de vídeo en un flujo comprensible.

## Modos

- Guiado.
- Mixto.
- Libre.

Deben poder cambiarse sin convertir el proyecto ni perder objetos.

## Alcance del MVP

Confirmado tras M0:

- Proyectos locales `.dwings` con autoguardado y recuperación.
- Escenas secuenciales con duración, cámara animable (desplazamiento y zoom) y fondo.
- Dibujo libre con presión, goma, formas, texto, imágenes importadas, selección y transformación, capas y undo/redo.
- Biblioteca inicial original (personajes modulares sencillos, objetos y fondos) y plantillas de escena.
- Animación: revelado progresivo de trazos, keyframes de transformación y opacidad, entrada y salida de elementos, y fotograma a fotograma básico con onion skin.
- Línea de tiempo con escenas, capas, pistas de audio y marcadores.
- Audio: narración, música y efectos con recorte, volumen y fundidos.
- Exportación MP4 (H.264 + AAC, u Opus si no hay AAC) en 720p, 1080p, cuadrado y vertical a 24, 25, 30 o 60 fps.
- Interfaz en español, Windows primero.

## Fuera de alcance inicial

Cuentas de usuario, nube, colaboración online, marketplace, publicación directa, generación de imágenes por IA y monetización.

## Criterios de éxito

- Un usuario sin experiencia puede crear una historia corta con recursos guiados.
- Un usuario avanzado puede dibujar y editar sin ayudas obligatorias.
- El proyecto se puede guardar, cerrar y reabrir sin pérdida.
- La previsualización y el vídeo exportado mantienen tiempos y sincronización.
- La aplicación sigue siendo utilizable con proyectos de tamaño razonable definidos en pruebas.
