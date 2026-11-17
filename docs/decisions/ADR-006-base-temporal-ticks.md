# ADR-006 — Base temporal entera (ticks)

- **Estado:** Aprobada
- **Fecha:** 2026-11-17

## Contexto

Si el tiempo se guarda en segundos con decimales, se acumulan errores de redondeo. A 30 fps, el fotograma 3 empieza en 0,1 s, que no tiene representación exacta en coma flotante. Esto produce clips que empiezan un fotograma antes o después según el cálculo, y diferencias entre la previsualización y la exportación.

## Decisión

Todo el tiempo del modelo se guarda como **entero en ticks**, donde **1 s = 705 600 000 ticks** (la unidad *flick*).

- Es divisible exactamente por 24, 25, 30, 48, 50, 60, 90, 100 y 120 fps, y por 8, 16, 22,05, 24, 32, 44,1, 48, 88,2, 96 y 192 kHz.
- `Number.MAX_SAFE_INTEGER` permite unos 147 días de duración, más que suficiente.
- Fotograma `f` a `fps` → `f * 705600000 / fps` es exacto para los FPS soportados.
- Solo se convierte a segundos en las fronteras con las API del navegador (WebAudio y WebCodecs).

## Consecuencias

- Positivas: los cálculos de fotogramas y clips son exactos y comparables con `===`, y cambiar de FPS no desplaza los tiempos.
- Negativas: los números del JSON son grandes y menos legibles a mano. Se compensa con utilidades `ticksFromSeconds`, `ticksFromFrame` y `formatTimecode`.
- Los FPS admitidos se limitan a la lista anterior (los FPS NTSC 29,97 quedan fuera del MVP).
