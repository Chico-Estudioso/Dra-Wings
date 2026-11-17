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

## Capas

- La lista muestra arriba la capa que se dibuja encima. Siempre queda al menos una.
- Los elementos nuevos van a la capa activa. Si está oculta o bloqueada, se avisa y no se dibuja.
- Los elementos de capas ocultas o bloqueadas no se pueden seleccionar.

## Pendiente (siguientes fases)

- Caché rasterizada por capa, si las mediciones en hardware real lo justifican (con 2000 trazos, 32–57 ms por fotograma con raster por software en CI).
- Edición de keyframes desde el lienzo (M4).
