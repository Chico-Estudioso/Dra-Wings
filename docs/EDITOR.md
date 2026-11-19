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
| Lápiz | B / P | Trazo vectorial con perfect-freehand. Guarda cada punto como `[x, y, presión, tMs]`. Pincel: Rotulador (liso), Lápiz (grafito con grano) o Tiza (con huecos); ver «Pinceles». |
| Goma | E | Ver «Comportamiento de la goma». |
| Bote de pintura | G | Clic dentro de un dibujo cerrado para pintarlo con su color (aparte del de las líneas). Ver «Bote de pintura». |
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
| Guardar el fotograma como imagen (PNG) | Ctrl+Mayús+E |
| Hoja de atajos | ? o F1 |
| Recorrer los elementos (con el lienzo enfocado) | Tab / Mayús+Tab |
| Eliminar el clip de audio o la marca seleccionados | Supr o Retroceso |

## Pinceles

El pincel se elige en las opciones del lápiz y se puede cambiar después en las propiedades de uno o varios trazos (`style.brush`; `src/core/render/brush.ts`). El trazo se rellena con su color liso (rotulador) o con un patrón de ese color cuya transparencia tiene grano (lápiz: nunca vacío, entre el 18 % y el 100 %) o huecos (tiza). El patrón es una tesela de 192 × 192 calculada con ruido determinista y se dibuja en el espacio del trazo: el grano viaja con él al moverlo o temblar y la vista previa coincide con el vídeo. Los patrones se guardan en caché por color (hasta 64).

## Bote de pintura

Pensado para colorear lo dibujado a mano alzada (`src/core/draw/fill.ts` y `src/renderer/src/editor/fill-actions.ts`):

- **Zona:** se dibuja la escena tal como se ve al editar (sin la textura del papel) en una imagen de hasta 1600 px de lado y se rellenan los píxeles conectados de color parecido al del clic (tolerancia 40 por canal). Las líneas, también las de capas bloqueadas, hacen de borde.
- **Huecos:** si el relleno se escapa hasta el borde de la hoja, se repite cerrando huecos de 3, 6 y 10 px de **pantalla** (lo que el usuario ve como un hueco pequeño, sea cual sea el zoom). Si aun así llega al borde, es una zona que de verdad acaba en la hoja (el cielo sobre un horizonte, el fondo) y se rellena tal cual.
- **Forma:** el contorno se vectoriza (seguimiento de Moore y simplificación Douglas-Peucker, hasta 1800 vértices) en un polígono suavizado sin línea. Lo que queda sin pintar dentro (una nube cerrada en el cielo, un ojo) son **agujeros** del polígono. El relleno entra 1 px bajo las líneas para que no quede rendija.
- **Dónde y cuándo:** justo debajo de la más baja de las líneas que lo rodean (o al fondo de la capa activa si esas líneas están en una capa bloqueada), y aparece con un fundido corto cuando terminan de dibujarse.
- **Sobre un relleno** (o cualquier forma rellena) cambia su color. Sobre una línea, una imagen o un recurso de la biblioteca no rellena y explica por qué.
- Tarda del orden de 0,1–0,2 s en una hoja Full HD; se hace en el hilo de interfaz.

## Comportamiento de la goma

- **Trazos:** la goma borra los segmentos que toca y divide el trazo en los tramos que quedan, cada uno como trazo independiente con el mismo estilo y transformación. Los tramos largos se subdividen antes de comprobar, para no saltarse cruces rápidos. No se rasteriza nada: todo sigue siendo vectorial y editable.
- **Formas y textos:** se eliminan completos si la goma los toca. Para recortarlos se usará una máscara en una fase posterior, si hace falta.
- **Mientras se arrastra** se ve el resultado en vivo. Al soltar se aplica en un único paso de deshacer.

## Presión de tableta

- Con un lápiz (`pointerType === 'pen'`) se guarda `PointerEvent.pressure` y se usan los eventos agrupados (`getCoalescedEvents`) para no perder muestras.
- Con ratón o táctil se guarda presión `-1` (desconocida) y el grosor es constante, salvo con «Trazo de tinta» activo (ver abajo): entonces la presión se calcula a partir de la velocidad y se guarda en los puntos. La presión real de una tableta nunca se sustituye.
- En Windows, Chromium recibe la presión a través de Windows Ink. Las tabletas configuradas solo en modo WinTab no la reportan: en los controladores de Wacom, Huion o XP-Pen hay que activar Windows Ink. Pendiente de validación manual con tableta real.

## Ayudas al dibujar (lápiz)

Botón «Ayudas» en las opciones del lápiz (`src/core/draw/`). Están activas por defecto (salvo el espejo) y se recuerdan durante la sesión.

- **Estabilizador** (Sin, Bajo, Medio, Alto): «pincel con cuerda» (`LazyBrush`). El trazo sigue al puntero a 6, 12 o 22 píxeles de pantalla y solo avanza cuando el puntero se aleja más que eso, así que el temblor de la mano no llega a la línea. Al soltar, el trazo alcanza el punto donde se soltó.
- **Trazo de tinta:** con ratón o táctil, la presión sale de la velocidad en píxeles de pantalla (deprisa, más fino; despacio, más grueso), suavizada, y las puntas se afinan (`style.taper`, hasta 2,5 veces el grosor y como mucho el 22 % del largo). Se guarda en el trazo, así que se ve igual en todas partes.
- **Formas rápidas:** si el puntero se queda quieto 0,45 s mientras se dibuja, el trazo se reconoce (`recognizeShape`) y, si encaja, se sustituye por la forma limpia con una etiqueta junto al puntero: línea (exacta si está casi a 0°, 45° o 90°), círculo, elipse, rectángulo (recto si casi lo está), triángulo o polígono de hasta 8 lados. Sigue siendo un trazo del mismo pincel: se dibuja progresivamente y tiembla con el trazo vivo. Moverse claramente vuelve a la mano alzada. Garabatos, curvas abiertas y espirales no se convierten.
  - Reconocimiento: el recorrido se remuestrea por longitud; se ajusta una elipse (ejes principales) y un polígono (Ramer–Douglas–Peucker cerrado desde el punto más alejado del centro), y se comparan sus errores medios en unidades de la escena. Un polígono de 3 o 4 lados gana si encaja claramente mejor; uno de 5 a 8, solo si encaja mucho mejor (si no, es una curva).

- **Espejo** (No, Izquierda y derecha, Cuatro lados): lo que se dibuja se repite reflejado en el eje vertical del centro de la hoja (y en el horizontal con cuatro lados), que se ve como una guía discontinua azul mientras el lápiz está activo. La vista previa muestra las copias en vivo; al soltar, el original y sus copias se añaden en un solo paso de deshacer y con el mismo tiempo de aparición, así que en el vídeo se dibujan a la vez (`mirrorPoints` en `assist.ts`). Funciona también con las formas rápidas. Las copias son trazos normales: se pueden mover o borrar por separado.

## Biblioteca y guías

Ver `docs/LIBRARY.md`: recursos, constructor de personajes, escenas de partida, grupos con ranuras de color, guías magnéticas (Alt para desactivarlas al arrastrar) y comportamiento por modo. Los recursos se insertan con un clic en el centro de la hoja o arrastrándolos al lienzo. Las imágenes y el audio propios también se pueden arrastrar desde el explorador (imágenes al lienzo, audio a la línea de tiempo).

## Línea de tiempo

- **Barra superior:** ir al inicio, reproducir, **repetir la escena** (bucle al reproducir), tiempo, pestañas de escena (doble clic para renombrar, +, mover, duplicar y eliminar), duración de la escena, **Vista previa** (ojo), **Grabar movimiento** (●), papel cebolla y botones de fotograma (con una capa de fotogramas activa) y zoom.
- **Pistas:** una por capa. Cada elemento es una barra con su aparición (color según el tipo: dibujar, fundido o pop) y una línea fina hasta que desaparece. Arrastrar la barra cambia cuándo aparece (y desplaza sus keyframes); arrastrar su borde derecho cambia la duración. Con la selección se ven sus keyframes (rombos), y un clic en uno lleva el cabezal allí.
- **Regla:** clic o arrastre para mover el cabezal; activa la vista previa para ver el vídeo en ese instante. Tocar el lienzo vuelve al modo edición.
- **Animaciones rápidas:** en el panel «Animación» del elemento seleccionado, botones de un clic (entrar, salir, saltar, balancearse, latir, flotar, girar, temblar y crecer) y el selector de suavizado. Ver `docs/ANIMATION_ENGINE.md`.
- **Copiar y pegar animación:** en el mismo panel. Se copia la de un elemento y se pega en uno o varios seleccionados (por ejemplo, todos los bailarines de un videoclip): cada uno hace el mismo movimiento desde su sitio, todos a la vez o en ola (uno detrás de otro, de izquierda a derecha, o uno en cada golpe).
- **Hoja:** en el mismo menú, lisa, papel con grano, cuaderno de rayas o cuadrícula.
- **Mano que dibuja:** en el mismo menú del trazo vivo (Sin mano, Rotulador o Lápiz).
- **Trazo vivo** (icono de pulso en la barra de la línea de tiempo): cuánto tiemblan las líneas al reproducir y en el vídeo (Quieto, Suave, Normal o Marcado). Ver `docs/ANIMATION_ENGINE.md`.
- **Habla con la narración** (panel de un personaje): mueve la boca con la voz. El panel de un clip de narración indica si la voz está analizada. Ver `docs/LIBRARY.md`.
- **Expresión y postura:** en el panel de un personaje; se aplican desde el cabezal y cada cambio se ve como un círculo en su barra (clic para ir a él). Ver `docs/LIBRARY.md`.
- **Al terminar** (panel «Animación» con keyframes): se queda quieto, se repite o va y vuelve. Ver `docs/ANIMATION_ENGINE.md`.
- **Seguir con la cámara** (panel «Animación» de un elemento): la cámara de la escena lo sigue suavemente, cerca, a media distancia o lejos.
- **Guion rápido:** en la pestaña «Escenas» de la biblioteca, pegar un guion o una letra crea una escena por párrafo o por línea. Ver `docs/LIBRARY.md`.
- **Escritura** (panel de un texto): letra a letra, palabra a palabra, letras que saltan o una palabra en cada golpe. Ver `docs/ANIMATION_ENGINE.md`.
- **Contorno y sombra** (panel de un texto): contorno de cualquier color por fuera de las letras (fino, medio o grueso, proporcional al tamaño de letra) y sombra desplazada, para que se lea sobre cualquier fondo o dibujo. La sombra es un duplicado desplazado en las unidades del texto (no una sombra del lienzo, que se mide en píxeles de pantalla), así que se ve igual a cualquier zoom y en el vídeo; también se aplica a cada palabra o letra mientras se escribe (`paintText` en `src/core/render/draw.ts`).
- **Transición** (icono de mezcla junto a la duración, en las escenas que no son la primera): cómo entra la escena desde la anterior y a qué velocidad. Ver `docs/ANIMATION_ENGINE.md`.
- **Fondo de la escena** (icono de rodillo): color de fondo de esta escena, entre tonos claros y suaves (para que las líneas se lean bien) o dos oscuros, u otro cualquiera. «Usar en todas las escenas» lo convierte en el fondo del proyecto y quita los de cada escena; «Como el resto del vídeo» vuelve al del proyecto. Se ve al editar, en la vista previa, en el vídeo y en el fotograma como imagen, el bote de pintura lo tiene en cuenta y el «fundido a color» pasa por el fondo de la escena que entra (`sceneBackground` en `src/core/render/frame.ts`).
- **Elasticidad** (icono de curva junto al trazo vivo): cuánto se estira lo que se mueve deprisa. **Estela al moverse**, en el panel «Animación» de cada elemento. Ver `docs/ANIMATION_ENGINE.md`.
- **Botón «Ritmo»** (tambor, en la barra de la línea de tiempo): aparecer uno en cada golpe o compás, ajustar el final de la escena al compás y cámara que late. Ver `docs/AUDIO_EXPORT.md`.
- En ventanas estrechas (menos de 1180 px) la barra oculta los textos «Duración» y «Audio» (quedan sus nombres accesibles) y las pestañas de escena se desplazan dentro de su zona.
- **Efectos de sonido:** en el menú «Audio», ocho efectos sintetizados que se añaden en el cabezal. Ver `docs/AUDIO_EXPORT.md`.
- **Ritmo:** al importar música se detectan sus golpes; se ven en la regla (los de compás, más marcados) y las barras, clips y marcas se pegan a ellos. Ver `docs/AUDIO_EXPORT.md`.
- **Vida automática:** selector «Vida» del panel «Animación» (Quieto, Respirar, Balancearse, Flotar o Latir) con su intensidad. Se ve al reproducir y en el vídeo, sin keyframes. Ver `docs/ANIMATION_ENGINE.md`.
- **Animar arrastrando:** botón del panel «Animación». Con él activo, arrastrar un elemento reproduce la escena y graba su recorrido como keyframes; Esc cancela. La barra de opciones lo recuerda y tiene «Dejar de animar». Con un elemento animado seleccionado se ve su trayectoria (línea discontinua con un punto por keyframe).
- **Vista previa frente a edición:** al editar se ve todo completo, con las posiciones del instante del cabezal. La vista previa muestra exactamente lo que saldrá en el vídeo (apariciones y cámara).
- **Alto:** se adapta a la ventana y se puede cambiar con el tirador del borde superior (arrastrando o con las flechas). Se recuerda.

## Audio y marcas

- **Grabar:** botón «Audio» de la línea de tiempo → «Grabar narración…». Ver `docs/AUDIO_EXPORT.md`.
- **Importar:** botón «Audio» de la línea de tiempo → Narración (voz), Música o Efecto de sonido. El clip se coloca en el cabezal, en la pista de ese tipo (se crea si no existe).
- **Pistas de audio:** debajo de las capas, con su forma de onda. El altavoz de cada pista la silencia.
- **Clips:** arrastrar para moverlos; arrastrar sus bordes para recortarlos. Al seleccionar uno, el panel lateral muestra su volumen, la entrada y salida suaves (fundidos), el volumen de la pista, «Dividir en el cabezal» y «Eliminar».
- **Marcas:** con M o con el botón de la bandera se añade una en el cabezal. En la regla, un clic lleva el cabezal a la marca y la selecciona (su nombre se edita en el panel lateral); arrastrarla la mueve.
- **Escenas a las marcas (videoclips):** reproduce la canción y pulsa M cada vez que cambie la frase. Al parar, «Ajustar las escenas a las marcas» hace que en cada marca empiece la escena siguiente (también desde el panel de una marca). Con «Crear escenas desde un guion» por líneas, la letra queda sincronizada en un par de pasadas.
- **Ajuste magnético en el tiempo:** al arrastrar barras de elementos, clips o marcas, se pegan a las marcas y al cabezal. Alt lo desactiva.
- Detalles del motor de audio y de los medios: `docs/AUDIO_EXPORT.md`.

## Capas

- La lista muestra arriba la capa que se dibuja encima. Siempre queda al menos una.
- Clic en el nombre para dibujar en esa capa; doble clic o F2 para renombrarla.
- Los elementos nuevos van a la capa activa. Si está oculta o bloqueada, se avisa y no se dibuja.
- Los elementos de capas ocultas o bloqueadas no se pueden seleccionar.

## Pendiente (siguientes fases)

- Caché rasterizada por capa, si las mediciones en hardware real lo justifican (con 2000 trazos, 32–57 ms por fotograma con raster por software en CI).
