# Proceso de lanzamiento

1. Confirmar que `main` contiene únicamente cambios aprobados.
2. Revisar versión, changelog y documentación.
3. Ejecutar lint, typecheck, pruebas y build.
4. Probar instalación limpia en Windows.
5. Crear un candidato de lanzamiento en una rama o etiqueta de preparación.
6. Revisar dependencias, licencias, avisos y componentes redistribuidos.
7. Obtener aprobación explícita antes de publicar o distribuir instaladores.
8. Crear release con notas, versión y archivos verificados.

No publicar automáticamente desde cada push. Las acciones de CI pueden validar y construir artefactos de prueba; la publicación requiere aprobación.
