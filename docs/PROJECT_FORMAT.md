# Formato de proyecto — requisitos

El formato definitivo se especificará en M1. Debe permitir guardar y recuperar:

- Versión del formato.
- Dimensiones, relación de aspecto y FPS del proyecto.
- Escenas y su duración.
- Capas y orden de composición.
- Objetos vectoriales, textos e imágenes importadas.
- Trazos con puntos, grosor, color y, cuando esté disponible, presión.
- Información temporal para reproducir trazos progresivamente.
- Clips, keyframes y datos de animación.
- Pistas de audio y referencias a medios.
- Ajustes de exportación.
- Recursos locales del proyecto o rutas relativas controladas.

## Requisitos

- Formato versionado.
- Validación de datos al abrir.
- Migraciones entre versiones.
- Guardado atómico o estrategia equivalente para reducir corrupción.
- Autosave y recuperación tras cierre inesperado.
- No depender de rutas absolutas del equipo original cuando se puedan usar rutas relativas.
- No ejecutar contenido activo desde proyectos importados.
- Importar recursos mediante operaciones controladas.

Se debe decidir si el proyecto será un archivo contenedor (por ejemplo, ZIP con manifiesto y recursos) o una carpeta de proyecto. Evaluar facilidad de copia, tamaño, integridad y edición.
