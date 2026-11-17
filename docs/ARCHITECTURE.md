# Arquitectura — documento inicial

La arquitectura definitiva se decidirá durante M0. Este documento contiene principios y límites, no una implementación cerrada.

## Separación conceptual

1. **Aplicación de escritorio:** ventana, ciclo de vida, diálogos del sistema y empaquetado.
2. **Interfaz del editor:** paneles, herramientas, propiedades, biblioteca y línea de tiempo.
3. **Modelo de proyecto:** escenas, objetos, trazos, capas, pistas, clips, audio y metadatos.
4. **Motor de edición:** operaciones sobre el modelo, selección, transformación, undo/redo y persistencia.
5. **Motor de animación:** evaluación del estado del proyecto para un instante o fotograma determinado.
6. **Motor de renderizado:** producir fotogramas a partir del mismo estado que usa la previsualización.
7. **Audio y exportación:** decodificar, mezclar y codificar medios.

## Principios

- La interfaz no debe ser la fuente de verdad de la animación.
- El modelo de proyecto debe poder leerse sin montar toda la interfaz.
- El renderizador debe consumir el modelo y un tiempo de reproducción.
- Las operaciones de edición deben poder deshacerse cuando corresponda.
- Los formatos deben estar versionados y disponer de migraciones.
- La carga de proyectos debe validar datos antes de utilizarlos.

## Tecnologías candidatas

Electron, React, TypeScript, Vite, Konva, SVG/Canvas y FFmpeg son opciones iniciales que deben compararse en M0. Ninguna debe considerarse aprobada antes de validar el caso de uso y las licencias.

## Seguridad

Si se elige Electron, aplicar aislamiento de contexto, `nodeIntegration: false`, preload controlado, IPC tipado y validado, y acceso al sistema de archivos únicamente desde operaciones autorizadas.
