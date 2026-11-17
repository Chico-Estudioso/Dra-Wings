# Normas de trabajo para agentes

Estas reglas se aplican a Claude Code y a cualquier agente especializado que participe en Dra-Wings.

## Antes de empezar

1. Leer `CLAUDE.md`, `ROADMAP.md` y la documentación relacionada con la tarea.
2. Revisar `git status`, la rama actual y los cambios sin confirmar.
3. Identificar dependencias, interfaces compartidas y posibles efectos secundarios.
4. Resumir el alcance y los archivos que probablemente se modificarán.
5. No comenzar una tarea que dependa de una decisión técnica pendiente sin señalarlo.

## Durante el trabajo

- Trabajar solo en la rama asignada.
- No modificar `main` directamente.
- No ampliar el alcance sin justificarlo.
- No cambiar interfaces compartidas sin coordinarlo con el Lead Developer.
- No crear abstracciones prematuras.
- No duplicar componentes o lógica ya existente sin motivo.
- No incluir assets de terceros sin verificar derechos y atribución.
- No guardar información privada del usuario en logs.
- Mantener las operaciones de archivos y proyectos seguras.

## Al terminar

Informar de:
- Resumen de cambios.
- Archivos principales afectados.
- Pruebas ejecutadas y resultado.
- Comprobaciones manuales pendientes.
- Riesgos o limitaciones conocidas.
- Documentación actualizada.

No declarar una tarea terminada si las pruebas fallan o si el comportamiento principal no se ha comprobado.

## Coordinación

- El Lead Developer es responsable de arquitectura e integración.
- Los agentes especializados no deben modificar simultáneamente las mismas áreas compartidas.
- Si se detecta una dependencia con otro trabajo, comunicarlo antes de realizar cambios incompatibles.
- No fusionar ramas ni Pull Requests sin autorización del usuario.
