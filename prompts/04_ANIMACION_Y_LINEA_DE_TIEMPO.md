# PROMPT 04 — ANIMACIÓN Y LÍNEA DE TIEMPO

## Rol

Actúa como ingeniero senior de animación 2D y herramientas de timeline. Implementa un motor predecible y editable, separado de la interfaz.

## Objetivo

Animar trazos, objetos, escenas y, dentro del alcance aprobado, fotogramas dibujados manualmente.

## Diseño fundamental

La interfaz no debe ser la fuente de verdad del estado animado. El motor debe poder evaluar el proyecto para un tiempo `t` o un número de fotograma y obtener el estado visual correspondiente.

La previsualización y exportación deben utilizar la misma evaluación temporal.

## 1. Línea de tiempo

- Regla temporal clara.
- FPS del proyecto.
- Pistas visuales.
- Clips con inicio y duración.
- Zoom horizontal.
- Desplazamiento temporal.
- Playhead.
- Reproducción, pausa y salto.
- Selección y ajuste de clips.
- Marcadores.

Evitar una interfaz excesivamente compleja en la primera implementación.

## 2. Animación de trazos

Conservar orden y puntos del trazo para poder revelar su recorrido progresivamente.
Permitir definir:
- Momento de inicio.
- Duración.
- Velocidad o distribución del progreso si aporta valor.
- Pausa o retención al terminar.

Evitar que el progreso dependa del número de eventos de ratón recibidos durante la reproducción. Debe evaluarse a partir del tiempo y los datos guardados.

## 3. Animación de objetos

Como mínimo estudiar e implementar:
- Posición.
- Escala.
- Rotación.
- Opacidad.
- Aparición y desaparición.

Definir interpolaciones y comportamiento cuando existan clips solapados.

## 4. Cámara

Permitir animar zoom y desplazamiento de cámara para dirigir la atención. Mantener una separación clara entre coordenadas del proyecto y coordenadas de la vista del editor.

## 5. Fotograma a fotograma

Diseñar una representación para cels/fotogramas dibujados manualmente, con:
- Crear, duplicar y eliminar fotogramas.
- Duración o exposición.
- Reproducción a FPS definidos.
- Onion skin configurable.
- Edición de un fotograma sin modificar accidentalmente los demás.

Si el modelo de proyecto necesita una decisión de formato, documentarla antes de implementarla.

## 6. Previsualización

- Reproducir y pausar.
- Navegar a un tiempo concreto.
- Actualizar correctamente al mover el playhead.
- No modificar el documento al previsualizar.
- Mantener sincronía con los clips de audio cuando se incorporen.

## 7. Pruebas

Probar:
- Trazos cortos y largos.
- Clips al inicio y final.
- Clips solapados.
- Valores límite de duración.
- Cambios de FPS.
- Pausa y reanudación.
- Reproducción repetida determinista.
- Fotogramas y onion skin.
- Mismo resultado en evaluación de preview y evaluación para render.

## Definition of Done

El usuario puede crear una secuencia, animar la aparición de trazos y el movimiento de objetos, navegar por la línea de tiempo y reproducir un resultado consistente. Las funciones de fotograma a fotograma deben quedar implementadas o su alcance pendiente debe estar documentado explícitamente, sin presentarlas como terminadas.
