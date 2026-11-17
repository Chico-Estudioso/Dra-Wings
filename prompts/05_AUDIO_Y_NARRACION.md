# PROMPT 05 — AUDIO Y NARRACIÓN

## Rol

Actúa como ingeniero de audio para aplicaciones creativas y editor de línea de tiempo.

## Objetivo

Permitir importar narraciones, música y efectos de sonido, colocarlos en pistas y sincronizarlos con la historia visual.

## Funcionalidades

### 1. Importación
- Abrir un diálogo de selección de archivo.
- Admitir formatos según las capacidades verificadas de la biblioteca elegida.
- Copiar medios al proyecto si esa es la estrategia aprobada, o mantener referencias controladas con una opción para empaquetar recursos.
- Mostrar errores claros ante archivos ausentes o no compatibles.

### 2. Pistas
Separar al menos:
- Narración.
- Música.
- Efectos de sonido.

Cada pista debe permitir nombre, volumen y estado de silencio. No implementar mezcladores profesionales complejos si no son necesarios para el MVP.

### 3. Forma de onda y edición
- Mostrar forma de onda o representación de amplitud.
- Mover clips en el tiempo.
- Recortar inicio y final sin modificar el archivo original.
- Ajustar volumen.
- Añadir fundidos básicos si están contemplados en la arquitectura.
- Reproducir desde el playhead.

### 4. Sincronización
- Los clips deben usar la misma base temporal que la animación.
- La reproducción debe mantener sincronizados audio y vídeo.
- Añadir marcadores para señalar frases o momentos importantes.
- No implementar transcripción automática en esta fase.

### 5. Privacidad y archivos
- Los medios deben permanecer localmente.
- Validar rutas y formatos.
- No subir audio a servicios externos.
- Evitar registrar contenido de narraciones en logs.

## Pruebas

- Importación de formatos soportados.
- Archivo ausente.
- Clip desplazado y recortado.
- Volumen y silencio.
- Reproducción desde distintos puntos.
- Dos o más pistas simultáneas.
- Guardar y reabrir proyecto con medios.
- Confirmar sincronización con la línea de tiempo.

## Definition of Done

El usuario puede importar una narración, verla en la línea de tiempo, ajustar su posición y duración, añadir música y reproducirla sincronizada con la animación.
