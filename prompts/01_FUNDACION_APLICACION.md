# PROMPT 01 — FUNDACIÓN DE LA APLICACIÓN

## Rol

Actúa como desarrollador principal de Dra-Wings. Implementa la base de la aplicación siguiendo las decisiones aprobadas durante M0. No cambies silenciosamente la arquitectura.

## Objetivo

Crear una aplicación de escritorio funcional que pueda abrirse, crear proyectos, guardarlos, cerrarlos y volverlos a abrir. Todavía no implementes el editor completo.

## Antes de modificar

- Lee `CLAUDE.md`, `AGENTS.md`, `ROADMAP.md` y `docs/`.
- Revisa el estado de Git y la rama actual.
- Confirma las decisiones técnicas aprobadas en M0.
- Si falta una decisión importante, informa y propone opciones antes de asumirla.
- Crea una rama `feat/m1-fundacion-aplicacion`; nunca trabajes en `main`.

## Implementación

### 1. Estructura de aplicación

Configura el framework aprobado para aplicación de escritorio, interfaz, TypeScript, lint, pruebas y build.

Si la decisión aprobada es Electron:
- Mantén proceso principal, preload y renderer claramente separados.
- Activa aislamiento de contexto.
- Desactiva Node Integration en el renderer.
- Expón únicamente operaciones IPC necesarias.
- Valida argumentos IPC en el proceso principal.
- Evita acceso arbitrario al sistema de archivos desde React.

### 2. Experiencia inicial

Crear una interfaz cuidada y coherente con una herramienta creativa:
- Pantalla de inicio.
- Crear proyecto.
- Abrir proyecto existente.
- Lista de proyectos recientes, si se puede mantener sin invadir la privacidad.
- Acceso a ajustes básicos.
- Estado visible de guardado.

No llenes la pantalla de paneles vacíos ni de opciones ficticias.

### 3. Gestión de proyectos

Implementa el formato aprobado en `docs/PROJECT_FORMAT.md`.
Debe permitir:
- Crear proyecto con nombre, dimensiones y FPS iniciales.
- Guardar.
- Guardar como.
- Abrir.
- Validar archivos al abrir.
- Mostrar errores comprensibles.
- Mantener versión del formato.
- Recuperar desde autosave cuando haya una interrupción, si el diseño aprobado lo contempla.

Las operaciones no deben sobrescribir archivos existentes sin confirmación.

### 4. Modelo mínimo

Crear tipos y modelos para proyecto, escena, capa y recurso, según el formato aprobado. No construir aún un modelo excesivamente genérico.

### 5. Guardado y recuperación

Implementar guardado seguro. Considerar escritura temporal y reemplazo atómico cuando la plataforma lo permita. No perder la última versión válida si falla un guardado.

No incluir archivos personales de prueba en Git.

### 6. Pruebas

Añadir pruebas para:
- Crear proyecto.
- Guardar y reabrir.
- Validar estructura.
- Rechazar datos malformados.
- Migrar o rechazar versiones no soportadas de forma controlada.
- Manejar archivos ausentes.

Añadir pruebas de interfaz para el flujo básico, si el stack lo permite.

## Fuera de alcance

No implementar todavía dibujo, biblioteca, línea de tiempo, audio ni exportación completa.

## Definition of Done

- La aplicación arranca en Windows.
- Se puede crear un proyecto.
- Se puede guardar, cerrar y reabrir.
- Los errores de proyecto se presentan de forma comprensible.
- El formato y el guardado están documentados.
- Lint, typecheck, pruebas y build pasan.
- Se documentan las comprobaciones manuales pendientes.

## Git y entrega

- Trabajar en la rama de la tarea.
- No fusionar ni publicar.
- No hacer push sin autorización.
- No realizar operaciones destructivas.
- Al terminar, informar de archivos, pruebas, resultado, limitaciones y siguiente fase.
