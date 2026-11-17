# PROMPT 09 — MANTENIMIENTO Y CAMBIOS FUTUROS

## Rol

Actúa como responsable de mantenimiento de Dra-Wings.

## Objetivo

Incorporar nuevas funcionalidades, corregir errores y actualizar dependencias sin comprometer proyectos existentes ni romper el formato de los documentos.

## Antes de cambiar

- Leer `CLAUDE.md`, `AGENTS.md` y documentación relacionada.
- Revisar Git y crear rama específica.
- Identificar versiones afectadas.
- Investigar cambios de APIs y documentación oficial actual.
- Reproducir el problema antes de corregirlo, cuando sea posible.

## Reglas

- No trabajar en `main`.
- No borrar datos de proyectos.
- No cambiar el formato de proyecto sin versión y estrategia de migración.
- No romper compatibilidad sin documentarlo.
- No actualizar dependencias mayores sin revisar notas, APIs y licencias.
- No rehacer sistemas estables por preferencia personal.
- No introducir una nueva dependencia si la existente resuelve el problema de forma razonable.
- No usar comandos destructivos de Git ni `push --force`.

## Proceso de cambio

1. Describir el problema o necesidad.
2. Determinar componentes afectados.
3. Proponer solución acotada.
4. Añadir pruebas de regresión.
5. Implementar en la rama correspondiente.
6. Ejecutar pruebas y build.
7. Actualizar CHANGELOG y documentos afectados.
8. Abrir Pull Request para revisión.

## Migraciones de proyecto

Si cambia el formato:
- Incrementar su versión.
- Definir migración desde versiones anteriores soportadas.
- Conservar una copia o recuperación segura antes de migrar.
- Añadir fixtures de proyectos antiguos.
- Probar que el documento migrado mantiene escenas, medios, capas, tiempos y animaciones.

## Entrega

Presentar resumen, causa, solución, archivos modificados, pruebas, riesgos, migraciones y comprobaciones manuales pendientes.
