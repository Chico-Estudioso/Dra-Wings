# Editor: lienzo, herramientas y atajos

## Estructura

- **Lienzo** (`src/renderer/src/editor/CanvasView.tsx`): dos `<canvas>` superpuestos.
  - **Escena:** se redibuja solo cuando cambia el documento o la vista. Usa el renderizador compartido (`src/core/render`), el mismo que usará la exportación.
  - **Superposición:** trazo en curso, selección y tiradores, marco de selección y cursor de la goma. Se redibuja con cada movimiento del puntero sin tocar la escena, así que dibujar sigue siendo fluido aunque la escena sea pesada.
- Lo que queda fuera de la hoja se ve atenuado: no saldrá en el vídeo.
- Caché de geometría: `PathCache` guarda un `Path2D` por objeto de elemento. Immer crea un objeto nuevo al editar un elemento, así que la caché se invalida sola.

## Herramientas

| Herramienta | Tecla | Comportamiento |
|---|---|---|
| Seleccionar | V | Clic para seleccionar, Mayús+clic para añadir o quitar, arrastrar en vacío para seleccionar con un marco. Arrastrar mueve. Los tiradores escalan (Mayús mantiene la proporción) y el tirador superior rota (Mayús: pasos de 15°). Doble clic en un texto para editarlo. |
| Lápiz | B / P | Trazo vectorial con perfect-freehand. Guarda cada punto como `[x, y, presión, tMs]`. |
| Goma | E | Ver «Comportamiento de la goma». |
| Rectángulo, Elipse | R, O | Arrastrar para crear (Mayús: cuadrado o círculo). Un clic crea una forma de tamaño medio. |
| Línea, Flecha | L, A | Arrastrar (Mayús: ángulos de 45°). |
| Texto | T | Clic para escribir (Esc o Ctrl+Intro para terminar). Clic sobre un texto existente para editarlo. |
| Mano | H o mantener Espacio | Desplazar el lienzo. También con el botón central del ratón. |
| Encuadre | C | Mover el marco de la cámara o hacer zoom desde su esquina inferior derecha. |
| Importar imagen | (botón) | Diálogo para elegir una imagen PNG, JPG, WEBP o GIF. Se coloca centrada en la capa activa. |

Al crear una forma se activa Seleccionar con la forma ya seleccionada, lista para ajustarla.

## Atajos

| Acción | Atajo |
|---|---|
| Deshacer / Rehacer | Ctrl+Z / Ctrl+Y o Ctrl+Mayús+Z |
| Guardar / Guardar como | Ctrl+S / Ctrl+Mayús+S |
| Duplicar | Ctrl+D |
| Agrupar / Desagrupar | Ctrl+G / Ctrl+Mayús+G |
| Seleccionar todo (capas visibles y desbloqueadas) | Ctrl+A |
| Eliminar | Supr o Retroceso |
| Deseleccionar | Esc |
| Mover 1 px / 10 px | Flechas / Mayús+Flechas |
| Grosor del lápiz o de la goma | [ y ] |
| Zoom | Ctrl+rueda, Ctrl++ y Ctrl+- |
| Ajustar a la ventana | Ctrl+0 |
| Desplazar | Rueda (Mayús+rueda en horizontal) |
| Reproducir / Pausa | Intro |
| Ir al inicio de la escena | Inicio |
| Fotograma anterior / siguiente | , y . |
| Keyframe anterior / siguiente de la selección | Mayús+, y Mayús+. |
| Añadir marca en el cabezal | M |
| Exportar vídeo | Ctrl+E |
| Hoja de atajos | ? o F1 |
| Recorrer los elementos (con el lienzo enfocado) | Tab / Mayús+Tab |
| Eliminar el clip de audio o la marca seleccionados | Supr o Retroceso |

## Comportamiento de la goma

- **Trazos:** la goma borra los segmentos que toca y divide el trazo en los tramos que quedan, cada uno como trazo independiente con el mismo estilo y transformación. Los tramos largos se subdividen antes de comprobar, para no saltarse cruces rápidos. No se rasteriza nada: todo sigue siendo vectorial y editable.
- **Formas y textos:** se eliminan completos si la goma los toca. Para recortarlos se usará una máscara en una fase posterior, si hace falta.
- **Mientras se arrastra** se ve el resultado en vivo. Al soltar se aplica en un único paso de deshacer.

## Presión de tableta

- Con un lápiz (`pointerType === 'pen'`) se guarda `PointerEvent.pressure` y se usan los eventos agrupados (`getCoalescedEvents`) para no perder muestras.
- Con ratón o táctil se guarda presión `-1` (desconocida) y el grosor es constante. **No se simula presión.**
- En Windows, Chromium recibe la presión a través de Windows Ink. Las tabletas configuradas solo en modo WinTab no la reportan: en los controladores de Wacom, Huion o XP-Pen hay que activar Windows Ink. Pendiente de validación manual con tableta real.

## Biblioteca y guías

Ver `docs/LIBRARY.md`: recursos, constructor de personajes, escenas de partida, grupos con ranuras de color, guías magnéticas (Alt para desactivarlas al arrastrar) y comportamiento por modo. Los recursos se insertan con un clic en el centro de la hoja o arrastrándolos al lienzo.

## Línea de tiempo

- **Barra superior:** ir al inicio, reproducir, tiempo, pestañas de escena (doble clic para renombrar, +, mover, duplicar y eliminar), duración de la escena, **Vista previa** (ojo), **Grabar movimiento** (●), papel cebolla y botones de fotograma (con una capa de fotogramas activa) y zoom.
- **Pistas:** una por capa. Cada elemento es una barra con su aparición (color según el tipo: dibujar, fundido o pop) y una línea fina hasta que desaparece. Arrastrar la barra cambia cuándo aparece (y desplaza sus keyframes); arrastrar su borde derecho cambia la duración. Con la selección se ven sus keyframes (rombos), y un clic en uno lleva el cabezal allí.
- **Regla:** clic o arrastre para mover el cabezal; activa la vista previa para ver el vídeo en ese instante. Tocar el lienzo vuelve al modo edición.
- **Vista previa frente a edición:** al editar se ve todo completo, con las posiciones del instante del cabezal. La vista previa muestra exactamente lo que saldrá en el vídeo (apariciones y cámara).
- **Alto:** se adapta a la ventana y se puede cambiar con el tirador del borde superior (arrastrando o con las flechas). Se recuerda.

## Audio y marcas

- **Importar:** botón «Audio» de la línea de tiempo → Narración (voz), Música o Efecto de sonido. El clip se coloca en el cabezal, en la pista de ese tipo (se crea si no existe).
- **Pistas de audio:** debajo de las capas, con su forma de onda. El altavoz de cada pista la silencia.
- **Clips:** arrastrar para moverlos; arrastrar sus bordes para recortarlos. Al seleccionar uno, el panel lateral muestra su volumen, la entrada y salida suaves (fundidos), el volumen de la pista, «Dividir en el cabezal» y «Eliminar».
- **Marcas:** con M o con el botón de la bandera se añade una en el cabezal. En la regla, un clic lleva el cabezal a la marca y la selecciona (su nombre se edita en el panel lateral); arrastrarla la mueve.
- **Ajuste magnético en el tiempo:** al arrastrar barras de elementos, clips o marcas, se pegan a las marcas y al cabezal. Alt lo desactiva.
- Detalles del motor de audio y de los medios: `docs/AUDIO_EXPORT.md`.

## Capas

- La lista muestra arriba la capa que se dibuja encima. Siempre queda al menos una.
- Clic en el nombre para dibujar en esa capa; doble clic o F2 para renombrarla.
- Los elementos nuevos van a la capa activa. Si está oculta o bloqueada, se avisa y no se dibuja.
- Los elementos de capas ocultas o bloqueadas no se pueden seleccionar.

## Pendiente (siguientes fases)

- Caché rasterizada por capa, si las mediciones en hardware real lo justifican (con 2000 trazos, 32–57 ms por fotograma con raster por software en CI).
