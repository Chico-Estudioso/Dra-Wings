# PROMPT 02 — LIENZO Y DIBUJO LIBRE

## Rol

Actúa como ingeniero senior de herramientas de dibujo y edición gráfica. Tu objetivo es implementar el lienzo de Dra-Wings sobre el modelo de proyecto aprobado.

## Contexto

El lienzo debe servir tanto a principiantes como a usuarios avanzados. El modo Libre debe permitir trabajar sin ayudas obligatorias. No conviertas todos los trazos en imágenes planas: conserva datos editables siempre que la tecnología elegida lo permita.

## Antes de empezar

Lee la documentación y revisa el estado de Git. Crea una rama `feat/m2-lienzo-dibujo`. No trabajes en `main`. Respeta las decisiones de M0 y M1. Si la tecnología de canvas elegida no satisface una necesidad, presenta evidencia antes de sustituirla.

## Funcionalidades

### 1. Lienzo
- Dimensiones del proyecto y área de trabajo diferenciadas.
- Zoom y desplazamiento.
- Ajustar lienzo a ventana.
- Fondo configurable.
- Indicador de zoom y posición cuando aporte valor.
- Rejilla o guías opcionales, desactivables.

### 2. Dibujo libre
- Lápiz.
- Goma de borrar.
- Grosor.
- Color.
- Opacidad.
- Suavizado de trazos.
- Selector de color.
- Historial de deshacer/rehacer.
- Captura de presión cuando el hardware y la API lo permitan.

El dibujo debe sentirse fluido y no bloquear la interfaz. Evita almacenar más datos de los necesarios por cada evento de puntero.

### 3. Elementos gráficos
- Formas geométricas básicas.
- Texto básico.
- Selección.
- Mover, redimensionar y rotar.
- Duplicar y eliminar.
- Alinear cuando sea razonable.

### 4. Capas
- Crear y eliminar capas.
- Renombrar.
- Cambiar orden.
- Mostrar/ocultar.
- Bloquear/desbloquear.
- Seleccionar capa activa.

Las capas deben formar parte del modelo de proyecto y persistir al guardar.

### 5. Edición no destructiva
- Los trazos deben conservar puntos y atributos relevantes.
- Los objetos deben mantener su identidad y propiedades.
- La goma debe tener un comportamiento definido y coherente; documenta si borra segmentos, objetos completos o utiliza una máscara.
- Las operaciones importantes deben integrarse con undo/redo.

### 6. Tableta gráfica
Investiga y utiliza la API disponible para presión y eventos de puntero. Si una característica no se puede soportar en la plataforma actual, informa de ello y ofrece un comportamiento alternativo.
No simules presión del lápiz cuando no exista información real del dispositivo.

## Rendimiento

Probar escenas con cantidades crecientes de trazos y objetos. Identificar cuellos de botella antes de introducir optimizaciones complejas.

## Pruebas

- Crear, editar y borrar trazos.
- Persistencia al cerrar y abrir.
- Deshacer y rehacer.
- Selección y transformación.
- Orden y visibilidad de capas.
- Zoom y desplazamiento.
- Manejo de eventos fuera del lienzo.
- Rendimiento con proyectos de referencia.

## Definition of Done

Un usuario puede crear una escena dibujada, editar elementos, organizar capas y recuperar la escena después de reiniciar la aplicación. El modo Libre no muestra ayudas obligatorias.

Actualiza documentación y CHANGELOG si corresponde. Informa qué pruebas fueron automatizadas y cuáles requieren tableta gráfica o validación manual.
