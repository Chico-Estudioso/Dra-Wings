# PROMPT 06 — RENDERIZADO Y EXPORTACIÓN DE VÍDEO

## Rol

Actúa como ingeniero senior de renderizado multimedia y exportación de vídeo.

## Objetivo

Convertir el estado del proyecto y su línea de tiempo en un archivo de vídeo final con audio sincronizado.

## Principio obligatorio

El renderizado debe utilizar el mismo modelo de animación que la previsualización. No implementes una segunda lógica de animación que pueda producir resultados distintos.

## 1. Motor de renderizado

- Evaluar el proyecto para cada instante/fotograma requerido.
- Componer escenas, capas, objetos, trazos, imágenes y textos.
- Respetar cámara, transformaciones y opacidad.
- Renderizar con dimensiones y FPS seleccionados.
- Mantener tiempos exactos y duración definida.
- Gestionar escenas vacías y elementos fuera de duración.

## 2. Audio

- Mezclar las pistas según su posición temporal.
- Respetar volumen, silencio y fundidos implementados.
- Mantener la duración correcta.
- Evitar desfases entre audio y vídeo.

## 3. Formatos y codecs

Investiga y recomienda los formatos adecuados para el MVP. MP4 con H.264 y AAC es una opción inicial, no una decisión cerrada hasta validar disponibilidad, compatibilidad y licencias.

Revisa cuidadosamente las condiciones de distribución de FFmpeg y codecs. Documenta qué se instala, qué se empaqueta y qué avisos legales deben incluirse.

## 4. Interfaz de exportación

Permitir seleccionar:
- Nombre y destino.
- Resolución.
- FPS.
- Calidad o bitrate mediante opciones comprensibles.
- Rango completo o intervalo, si está soportado.

Mostrar:
- Progreso.
- Tiempo transcurrido o estimación solo si se puede calcular razonablemente.
- Cancelación.
- Errores claros.

No bloquear la interfaz durante el renderizado.
No sobrescribir archivos existentes sin confirmación.

## 5. Archivos temporales y recuperación

- Guardar temporales en una ubicación controlada.
- Limpiar temporales al finalizar o cancelar.
- Evitar borrar archivos ajenos al proceso.
- Mantener el proyecto intacto si falla la exportación.

## 6. Validación del vídeo final

Comprobar mediante herramientas disponibles:
- Que el archivo existe y se puede abrir.
- Duración.
- Resolución.
- FPS.
- Presencia de pista de audio cuando corresponda.
- Sincronización en escenas de prueba.
- Reproducción en reproductores habituales de Windows.

Crear proyectos de prueba con marcas temporales visibles y tonos de audio para detectar desfases.

## 7. Pruebas

- Escena simple.
- Varias escenas.
- Trazos progresivos.
- Objetos animados.
- Cámara.
- Narración y música.
- Duración larga de referencia.
- Cancelación.
- Error de destino sin permisos.
- Archivo de salida ya existente.

## Definition of Done

Se puede exportar un vídeo reproducible con imagen y audio sincronizados, sin bloquear la aplicación ni modificar el proyecto original. Documenta las limitaciones reales de calidad, rendimiento y formatos.
