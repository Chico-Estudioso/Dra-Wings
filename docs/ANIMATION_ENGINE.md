# Motor de animación — requisitos

El motor debe evaluar el estado visual del proyecto para un tiempo determinado.

## Tipos de animación a estudiar

- Aparición progresiva de un trazo según sus puntos y orden temporal.
- Movimiento, escala, rotación y opacidad de objetos.
- Animación de cámara: zoom y desplazamiento.
- Duración y entrada/salida de objetos.
- Fotogramas dibujados manualmente y referencias onion skin.

## Principios

- Separar datos de animación de la interfaz de edición.
- Reproducir el mismo resultado en preview y exportación.
- Definir con claridad unidades de tiempo, FPS y reglas de interpolación.
- Manejar cortes, pausas y cambios entre escenas.
- Añadir pruebas para tiempos límite, clips solapados y objetos fuera de escena.

El modo fotograma a fotograma debe diseñarse con cuidado para que conviva con la animación de trazos y objetos sin obligar a aplanar escenas enteras.
