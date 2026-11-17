# Audio y exportación — requisitos

## Audio

- Importar archivos de audio desde rutas seleccionadas por el usuario.
- Previsualizar y mostrar forma de onda.
- Pistas separadas para narración, música y efectos.
- Recorte, posición, volumen y fundidos básicos según el alcance aprobado.
- Sincronización por tiempo con la línea de vídeo.
- Manejar medios ausentes o formatos no compatibles con mensajes claros.

## Exportación

- Resolver duración, FPS, resolución y relación de aspecto.
- Renderizar fotogramas con el mismo motor que la previsualización.
- Mezclar audio respetando posiciones y niveles.
- Exportar a un formato ampliamente reproducible, previsiblemente MP4/H.264/AAC, tras validar codecs y licencias.
- Mostrar progreso, permitir cancelar y limpiar temporales con seguridad.
- No sobrescribir archivos existentes sin confirmación.
- Verificar duración y sincronización del archivo final.

## Licencias

Revisar cómo se distribuirán FFmpeg, codecs y dependencias en cada instalador. No asumir que una instalación local del desarrollador equivale a permiso para redistribuir binarios.
