# Estrategia de pruebas

## Pruebas unitarias

- Modelo de proyecto y validación.
- Operaciones de edición y undo/redo.
- Evaluación temporal de animaciones.
- Interpolación y cálculo de trazos progresivos.
- Migraciones del formato.
- Gestión de clips y tiempos de audio.

## Pruebas de integración

- Crear, guardar, cerrar y reabrir proyectos.
- Importar y localizar medios.
- Renderizar secuencias de prueba.
- Mezclar pistas de audio.
- Exportar vídeos y verificar propiedades básicas.

## Pruebas de interfaz

- Flujos principales de creación.
- Cambio entre modos Guiado, Mixto y Libre.
- Selección, edición de capas y línea de tiempo.
- Accesibilidad básica y navegación por teclado.

## Pruebas de rendimiento

Definir proyectos de referencia con diferentes cantidades de trazos, objetos, capas, escenas y duración. Medir respuesta del lienzo, reproducción, memoria y tiempo de exportación.

## Reporte

Separar claramente pruebas automatizadas, pruebas manuales realizadas y validaciones pendientes. No afirmar que la exportación funciona solo porque el renderizado interno se vea bien.
