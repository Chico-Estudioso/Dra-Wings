# Guía de experiencia de usuario

## Objetivo

Que alguien sin experiencia cree su primera escena en minutos, y que quien sabe dibujar nunca sienta que las ayudas le estorban.

## Estructura de la ventana del editor

```
┌───────────────────────────────────────────────────────────────────────────┐
│ ☰  Nombre del proyecto ●guardado    [Guiado | Mixto | Libre]   ▶  Exportar│
├────┬───────────────────────────────────────────────────────┬──────────────┤
│ H  │                                                       │ Biblioteca / │
│ e  │                     Lienzo                            │ Propiedades /│
│ r  │                                                       │ Capas        │
│ r. │                                                       │ (pestañas)   │
├────┴───────────────────────────────────────────────────────┴──────────────┤
│ Escenas · Línea de tiempo (vídeo, capas, audio, marcadores)               │
└───────────────────────────────────────────────────────────────────────────┘
```

## Modos

Son **preferencias de ayuda**, no formatos distintos. Se guardan en el proyecto y se cambian con un solo clic sin tocar el contenido.

| | Guiado | Mixto | Libre |
|---|---|---|---|
| Panel lateral por defecto | Biblioteca | Biblioteca y Capas | Capas |
| Herramienta inicial | Seleccionar | Lápiz | Lápiz |
| Consejos contextuales | Sí | Breves | No |
| Guías y ajuste a guías | Activados | Activados | Desactivados (se pueden activar) |
| Plantillas al crear escena | Se ofrecen | Se ofrecen | Escena en blanco |
| Herramientas disponibles | Todas | Todas | Todas |

El modo Libre no recorta nada: solo oculta ayudas.

## Reglas comunes

- Interfaz en español, con textos cortos y verbos claros («Añadir escena», «Exportar vídeo»).
- Estado de guardado siempre visible: «Guardado», «Cambios sin guardar» o «Guardando…».
- Deshacer y rehacer con Ctrl+Z, Ctrl+Y y Ctrl+Mayús+Z, más botones en la barra.
- Atajos visibles en los *tooltips* y en una hoja de atajos (tecla `?` o F1, o el botón del teclado en la barra de estado).
- Operaciones largas con barra de progreso y botón Cancelar. Nunca un diálogo modal sin salida.
- Los errores explican qué ha pasado y qué hacer («No se pudo guardar: el disco está lleno. Libera espacio y vuelve a intentarlo.»).
- Foco visible, todo accesible con teclado, contraste AA, y estados que no dependen solo del color. Se comprueba en cada PR con axe (WCAG 2.1 AA, temas claro y oscuro). El naranja de acento es `#c2521e` en el tema claro para que el texto blanco de los botones cumpla 4,5:1.
- El lienzo también se maneja con teclado: con el foco en él, Tab y Mayús+Tab recorren los elementos (se anuncia cuál está seleccionado), las flechas los mueven y Supr los elimina.
- Tableta gráfica: la presión se usa cuando el sistema la proporciona. Si no hay presión, el grosor es constante; no se inventa.
- Tema claro por defecto (el lienzo es «papel») y tema oscuro para la interfaz.

## Pantalla de inicio

- «Nuevo proyecto» (nombre, formato 16:9, 1:1 o 9:16, FPS y modo inicial).
- «Abrir…» y la lista de recientes con miniatura. Los recientes que ya no existen se marcan y se pueden quitar.
- Si hay una recuperación pendiente, aparece primero: «Restaurar» o «Descartar».
- Mientras no hay proyectos recientes, una guía breve explica en cuatro pasos cómo se hace un vídeo.
- «Ver un ejemplo» abre un proyecto nuevo de tres escenas hecho con la biblioteca (textos que se escriben, un fundido de salida y un zoom de cámara) para aprender viéndolo y modificándolo. Es un proyecto normal, sin guardar.

## Puntos de confusión previstos para principiantes

| Situación | Solución |
|---|---|
| No saber por dónde empezar | Plantillas de escena en Guiado y un primer proyecto de ejemplo |
| Dibujar en una capa bloqueada u oculta | Aviso en el cursor y botón para desbloquearla |
| No entender la línea de tiempo | Los clips se crean solos al dibujar o insertar; arrastrarlos es opcional |
| Audio desincronizado | Marcadores visibles y ajuste magnético de clips a los marcadores |
| Miedo a perder trabajo | Autoguardado visible y recuperación tras un cierre inesperado |
