# PROMPT 03 — MODO GUIADO Y BIBLIOTECA DE RECURSOS

## Rol

Actúa como ingeniero de producto y desarrollador de herramientas creativas centrado en accesibilidad para principiantes.

## Objetivo

Permitir crear escenas sin tener que dibujar cada elemento a mano, manteniendo la capacidad de editar los recursos insertados.

## Principios

- Guiado, Mixto y Libre son modos de asistencia sobre el mismo editor y formato de proyecto.
- Cambiar de modo no debe borrar, rasterizar ni bloquear contenido.
- La biblioteca inicial debe utilizar recursos originales o recursos con licencias verificadas.
- No descargar ni incorporar packs de terceros sin permiso.
- No implementar generación de imágenes con IA en esta fase.

## Funcionalidades

### 1. Biblioteca
Crear un panel para explorar recursos por categorías, por ejemplo:
- Personajes.
- Expresiones y posturas.
- Objetos cotidianos.
- Viviendas y edificios.
- Vehículos.
- Naturaleza.
- Lugares.
- Símbolos y elementos gráficos.
- Fondos y composiciones sencillas.

Las categorías iniciales se pueden ajustar según el diseño de producto.

### 2. Insertar y editar
Permitir arrastrar o insertar un elemento en el lienzo. Una vez insertado, debe poder:
- Moverse.
- Cambiar tamaño.
- Rotarse.
- Recolorearse cuando el recurso lo permita.
- Cambiar atributos previstos por el recurso.
- Duplicarse.
- Eliminarse.
- Organizarse por capas.

### 3. Constructor de personajes
Evaluar un sistema modular para combinar cabeza, pelo, cuerpo, ropa, expresiones y posturas. No crear un constructor complejo si los recursos actuales no lo justifican.
Debe permitir guardar personajes propios o variaciones dentro del proyecto.

### 4. Escenas y composiciones de partida
Permitir insertar una composición editable como punto de partida. No deben ser escenas rígidas ni convertirse en una única imagen plana.

### 5. Ayudas
- Guías de posición.
- Alineación y ajuste.
- Sugerencias visuales discretas.
- Ayudas que se puedan ocultar.
- Mensajes sencillos para explicar acciones iniciales.

### 6. Modos
Implementar el selector Guiado / Mixto / Libre.
- Guiado prioriza biblioteca y ayudas.
- Mixto presenta biblioteca y dibujo en equilibrio.
- Libre oculta ayudas y conserva el acceso completo a las herramientas.

El modo no debe eliminar herramientas del proyecto ni cambiar el formato.

## Contenido de muestra

Crear solo una pequeña biblioteca original que permita demostrar el sistema. Priorizar variedad funcional frente a cantidad. Mantener un registro de procedencia y licencia de cada recurso.

## Pruebas

- Insertar recursos.
- Editar y guardar recursos insertados.
- Cambiar entre los tres modos.
- Comprobar que ningún cambio de modo pierde datos.
- Reabrir proyecto con recursos.
- Mostrar errores si falta un recurso.

## Definition of Done

Una persona puede construir una escena corta usando la biblioteca sin dibujar manualmente todos los elementos, y otra puede ocultar las ayudas y seguir editando la misma escena libremente.
