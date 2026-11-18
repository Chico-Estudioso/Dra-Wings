# Biblioteca, personajes y modo guiado

## Cómo están hechos los recursos

Todos los recursos de la biblioteca son **originales** y se dibujan por código (`src/core/library/`):

- `sketch.ts`: un «lápiz» que genera trazos con aspecto de dibujo a mano (temblor sutil, presión variable y cierres que se solapan un poco) y rellenos (rectángulo, elipse y polígono suavizado).
- `catalog.ts`: el catálogo (casas y edificios, naturaleza, objetos, vehículos y símbolos), cada recurso dibujado en una caja de unos 200 × 200 unidades.
- `character.ts`: el constructor de personajes y los seis personajes predefinidos.
- `place.ts`: colocación (escala y posición) y las escenas de partida.

Ventajas:
- No hay archivos de terceros ni dudas de licencia.
- Todo es vectorial y editable.
- Los contornos son trazos, así que en M4 podrán aparecer «dibujándose» como en un vídeo Draw My Life.
- La generación es determinista: semilla fija por recurso.

### Procedencia y licencia

| Recurso | Origen | Licencia |
|---|---|---|
| Personajes, piezas del constructor y escenas de partida | Original, generado por `character.ts` y `place.ts` | La del proyecto Dra-Wings |
| Casa, edificio, escuela, tienda, árbol, pino, flor, sol, nube, montañas, luna, estrella, libro, móvil, portátil, taza, regalo, reloj, bombilla, corazón, monedas, mochila, pizarra, mesa, coche, bicicleta, avión, autobús, bocadillos, interrogación, exclamación, correcto, incorrecto y flecha curva | Original, generado por `catalog.ts` | La del proyecto Dra-Wings |
| Fuentes del texto (Patrick Hand, Caveat y Nunito) | @fontsource | SIL Open Font License 1.1 |

Cualquier recurso nuevo debe añadirse a esta tabla con su origen y licencia. No se incorporan packs de terceros sin permiso explícito.

## Grupos y ranuras de color

- Un recurso insertado es un **grupo** (`type: 'group'`) autosuficiente: sus elementos viajan dentro del proyecto. `source` solo indica de dónde salió.
- Las piezas llevan una **ranura** (`slot`: piel, pelo, camiseta, pantalón, primario, secundario…). El panel de propiedades muestra un selector de color por ranura y recolorea todas las piezas de una vez.
- **Desagrupar** (Ctrl+Mayús+G) devuelve las piezas al lienzo conservando su aspecto exacto: los trazos absorben la transformación en sus puntos, y el resto la descompone en rotación y escala. **Agrupar** (Ctrl+G) une elementos de una misma capa.
- La goma elimina un grupo completo. Para borrar parte de un recurso, primero se desagrupa.

## Constructor de personajes

| Opción | Valores |
|---|---|
| Pelo | Corto, Largo, Coleta, Rizado, Sin pelo, Gorra |
| Expresión | Feliz, Risa, Neutral, Triste, Sorpresa, Enfado |
| Postura | De pie, Saludando, Brazos arriba, Caminando, Señalando, Pensando |
| Colores | Piel (6 tonos), pelo o gorra, camiseta y pantalón |

Son 216 combinaciones de forma, todas validadas por las pruebas, multiplicadas por los colores. Después de insertarlo, el personaje se puede recolorear desde el panel de propiedades.

### Cambiar de expresión o de postura durante el vídeo

En el panel de propiedades de un personaje, «Expresión y postura» muestra cómo está en el cabezal. Lo que se elige se aplica **desde el cabezal hasta el siguiente cambio** (con el cabezal en su aparición o antes, desde el principio). Cada cambio aparece en la lista del panel (ir a él o quitarlo) y como un círculo en su barra de la línea de tiempo.

- El personaje sigue siendo un solo elemento: se mueve, se anima (también con «Animar arrastrando») y se recolorea entero, con todos sus cambios. Al moverlo en el tiempo, sus cambios le acompañan.
- El dibujo nuevo se coloca con el mismo encuadre que el original: todos los trazos del constructor nacen en el origen del dibujo, así que su posición dentro del grupo dice dónde está ese origen (`setCharacterLook` en `src/core/library/character.ts`). La caja del grupo se amplía si una postura sobresale (por ejemplo, brazos arriba) sin mover el personaje en pantalla.
- Un cambio que deja el mismo aspecto que ya tenía se elimina solo.
- Desagrupar conserva el dibujo original y descarta los cambios (se puede deshacer).

## Escenas de partida

Casa en el campo, Ciudad, En clase, De noche y Conversación. Insertan recursos independientes (no una imagen plana), proporcionados al tamaño de la hoja y seleccionados para ajustarlos de inmediato.

## Modos

| | Guiado | Mixto | Libre |
|---|---|---|---|
| Pestaña lateral inicial | Biblioteca | Biblioteca | Capas |
| Herramienta inicial | Seleccionar | Lápiz | Lápiz |
| Guías magnéticas | Activadas | Activadas | Desactivadas (botón del imán) |
| Tarjeta «Primeros pasos» (en el panel lateral) | Sí (se puede ocultar para siempre) | No | No |

Cambiar de modo nunca toca el documento: solo ajusta paneles y ayudas.

## Proyecto de ejemplo

`src/core/library/example.ts` monta, con las mismas piezas de la biblioteca, un proyecto de tres escenas («Había una vez», «Un día en la ciudad» y «Ahora tú»). Los textos se miden con las fuentes reales al crearlo. Se abre desde «Ver un ejemplo» en el inicio.

## Guías magnéticas

Al mover elementos, sus bordes y centros se ajustan (a 7 px de pantalla) a los bordes y al centro de la hoja y a los de otros elementos, y se dibuja la guía. Mantener **Alt** al arrastrar las desactiva momentáneamente.
