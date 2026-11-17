# Instrucciones para Claude Code — Dra-Wings

@AGENTS.md

## Contexto del proyecto

Dra-Wings es una aplicación de escritorio para crear historias visuales narradas y vídeos estilo Draw My Life. Debe servir tanto a personas que no saben dibujar como a artistas que quieren trabajar con un lienzo libre y herramientas completas.

La experiencia ofrece tres modos configurables y combinables a nivel de proyecto:

- **Guiado:** biblioteca, personajes, objetos, escenas de partida y ayudas.
- **Mixto:** recursos prediseñados junto con dibujo libre.
- **Libre:** edición sin ayudas obligatorias ni restricciones artificiales.

Los tres modos deben utilizar el mismo modelo de proyecto y permitir cambiar de modo sin perder contenido.

## Idioma y estilo

- Responde y documenta en español.
- Usa inglés para identificadores, nombres de clases, funciones, variables y convenciones técnicas cuando corresponda.
- Sé claro y directo. No añadas capas, herramientas, servicios o procesos que no aporten valor demostrado.
- No inventes resultados de pruebas, compatibilidades ni comportamientos de APIs.

## Principios técnicos

1. Investigar antes de elegir una tecnología o implementar una API.
2. Mantener separadas la interfaz, el modelo de proyecto, el motor de edición, el motor de animación y el renderizador.
3. Mantener un formato de proyecto versionado, documentado y migrable.
4. Guardar de forma no destructiva siempre que sea razonable: objetos, trazos, capas y clips deben seguir siendo editables.
5. Mantener el editor y el renderizado deterministas: el vídeo exportado debe corresponder con la previsualización y la línea de tiempo.
6. Priorizar guardado seguro, recuperación ante fallos y protección de los archivos del usuario.
7. Evitar bloqueos de la interfaz durante operaciones largas.
8. Añadir pruebas automatizadas a la lógica importante y distinguirlas de las pruebas manuales.
9. No introducir dependencias sin justificar mantenimiento, licencia, tamaño y compatibilidad.
10. Mantener la aplicación local-first; no subir proyectos ni medios del usuario a servicios externos.

## Seguridad de escritorio

Si se utiliza Electron:
- `contextIsolation` debe estar activado.
- `nodeIntegration` debe estar desactivado en el renderer.
- Usar preload con una API IPC pequeña, explícita y tipada.
- Validar toda petición IPC en el proceso principal.
- No exponer acceso arbitrario al sistema de archivos al renderer.
- Usar diálogos nativos y rutas controladas para abrir/guardar/importar/exportar.
- No ejecutar comandos construidos a partir de texto no confiable.

Si M0 recomienda otra tecnología, documentar cómo se aplican controles de seguridad equivalentes.

## Flujo Git obligatorio

- Nunca trabajar directamente en `main`.
- Crear una rama por tarea (`feat/`, `fix/`, `docs/`, `chore/`, `test/`).
- No fusionar Pull Requests sin aprobación explícita del usuario.
- No usar `git push --force`, `reset --hard` ni reescribir historial compartido.
- No descartar cambios existentes del usuario.
- Antes de modificar archivos, revisar `git status` y comprender el estado del repositorio.
- Mantener cambios limitados al alcance de la tarea.
- No publicar releases ni distribuir instaladores sin autorización.

## Documentación que debe mantenerse

Cuando haya cambios relevantes, actualizar los documentos afectados:

- `ROADMAP.md`
- `CHANGELOG.md`
- `docs/ARCHITECTURE.md`
- `docs/PROJECT_FORMAT.md`
- `docs/TECHNICAL_DECISIONS.md`
- `docs/TESTING_STRATEGY.md`

No modificar documentación por rutina si no hay cambios reales.

## Definition of Done

Una tarea no está terminada solo porque compile. Debe:
- Cumplir el comportamiento solicitado.
- Tener tipos y validaciones adecuados.
- Manejar errores razonablemente.
- Incluir pruebas donde aporte valor.
- No romper funcionalidades existentes.
- Actualizar documentación cuando proceda.
- Indicar qué se ha probado y qué queda pendiente de verificación manual.

## Restricciones de alcance inicial

No implementar por iniciativa propia:
- Generación de imágenes con IA.
- Registro de usuarios o sincronización en la nube.
- Colaboración en tiempo real.
- Publicación directa en YouTube u otras plataformas.
- Marketplace o tienda de recursos.
- Funciones de suscripción o pagos.

Estas ideas solo se incorporarán si el usuario las aprueba expresamente y se planifican como evolución posterior.
