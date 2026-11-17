# Instrucciones para Claude Code — Dra-Wings

@AGENTS.md

## Criterio

Los prompts de `prompts/` y estas normas son una **base orientativa**, no un reglamento. Claude tiene autonomía para ajustar procesos, alcance o detalles que no encajen, sin consultar, siempre que lo deje documentado (en la PR o en `docs/`). Se evitan las verificaciones y ceremonias que no aporten valor real.

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
- Fusión autónoma autorizada: el usuario ha autorizado de forma permanente que Claude fusione sus propias Pull Requests cuando la validación de CI esté en verde y la tarea cumpla la Definition of Done. Si el volumen de PRs o los resultados de CI lo desaconsejan, dejar la PR abierta e informar para que la fusione el usuario.
- Esta autorización sustituye a las indicaciones de «no fusionar» y «no hacer push» de los prompts de `prompts/`. Publicar releases o distribuir instaladores sigue requiriendo aprobación explícita.
- No usar `git push --force`, `reset --hard` ni reescribir historial compartido.
- No descartar cambios existentes del usuario.
- Antes de modificar archivos, revisar `git status` y comprender el estado del repositorio.
- Mantener cambios limitados al alcance de la tarea.
- No publicar releases ni distribuir instaladores sin autorización.

## Autoría

- Los commits se firman como `Mauro Serrano Hevia <144903323+Chico-Estudioso@users.noreply.github.com>` (configurar `git config user.name` y `user.email` en el repositorio).
- Sin líneas `Co-Authored-By`, `Claude-Session` ni pies del tipo «Generated with Claude Code» en commits, Pull Requests o comentarios.
- Al fusionar, preservar esta autoría (por ejemplo, fusionando en local y haciendo push de `main`) para no exponer otro email.

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
