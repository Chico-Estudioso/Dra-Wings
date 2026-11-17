# PROMPT 00 — INVESTIGACIÓN, DEFINICIÓN DEL PRODUCTO Y ARQUITECTURA

## Rol

Actúa como arquitecto de software senior, ingeniero de aplicaciones de escritorio, especialista en herramientas creativas y responsable técnico del proyecto Dra-Wings.

Tu objetivo en esta primera fase es investigar, definir y validar la base del producto. No debes empezar construyendo el editor completo ni generar grandes cantidades de código sin haber resuelto las decisiones fundamentales.

Trabaja en Plan Mode. Investiga primero, documenta después y presenta una propuesta para aprobación.

## 1. Visión del producto

Dra-Wings será una aplicación de escritorio para crear historias visuales narradas, vídeos estilo Draw My Life y animaciones sencillas.

Debe permitir que una persona sin habilidades de dibujo cree escenas atractivas mediante recursos prediseñados y ayudas editables. Al mismo tiempo, debe proporcionar un espacio de dibujo y animación libre para usuarios que sí saben dibujar y desean controlar cada elemento.

La aplicación debe ofrecer tres modos, cambiables en cualquier momento:

- **Guiado:** biblioteca de personajes, objetos, escenas de partida, guías y ayudas.
- **Mixto:** combinación de recursos prediseñados y dibujo libre.
- **Libre:** lienzo limpio y herramientas completas, sin ayudas obligatorias.

Los tres modos deben usar el mismo formato de proyecto. Cambiar de modo no puede borrar ni aplanar el contenido existente.

## 2. Decisiones de producto ya establecidas

- Aplicación de escritorio.
- Windows es la primera plataforma objetivo.
- Se intentará mantener una arquitectura que permita ampliar a macOS y Linux.
- Proyectos y medios locales: no se necesita nube para el MVP.
- El núcleo del producto combina dibujo, escenas, animación, narración y exportación de vídeo.
- Se necesita dibujo libre y también animación de trazos progresivos.
- Se desea animación fotograma a fotograma, aunque su alcance y diseño deben evaluarse.
- Debe existir línea de tiempo visual.
- Debe poder importarse narración, música y efectos de sonido.
- El vídeo exportado debe mantener sincronización entre imagen y audio.
- La aplicación debe ser comprensible para principiantes sin frustrar a usuarios avanzados.

Fuera del MVP salvo aprobación posterior: generación de imágenes con IA, cuentas, sincronización en la nube, colaboración online, marketplace, publicación directa en redes y pagos.

## 3. Investigar las tecnologías candidatas

La propuesta inicial es:
- Electron para aplicación de escritorio.
- React y TypeScript para interfaz.
- Vite para desarrollo y empaquetado de frontend.
- React Konva como una posible tecnología para el lienzo.
- FFmpeg como posible herramienta de exportación de vídeo.

Estas son hipótesis, no decisiones cerradas.

Compara de forma razonada:

### Aplicación de escritorio
- Electron frente a Tauri.
- Complejidad de desarrollo en Windows.
- Consumo de memoria y tamaño de distribución.
- Acceso seguro al sistema de archivos.
- Facilidad para trabajar con procesos de renderizado y FFmpeg.
- Posibilidades de soporte multiplataforma.

### Lienzo y dibujo
- React Konva.
- Fabric.js.
- SVG y Canvas 2D.
- Solución propia cuando esté justificada.

Evalúa especialmente:
- Dibujo libre fluido.
- Puntero, ratón y tableta gráfica.
- Presión del lápiz cuando el dispositivo la ofrezca.
- Suavizado de trazos.
- Capas y orden de composición.
- Selección y transformación.
- Objetos vectoriales editables.
- Importación de imágenes.
- Reproducción progresiva de trazos.
- Rendimiento con cientos o miles de elementos.
- Posibilidad de compartir el mismo modelo entre editor y renderizador.

No elijas una biblioteca solo porque tenga una demo atractiva. Comprueba su API, mantenimiento, licencia y limitaciones reales.

### Animación

Investiga la mejor representación para:
- Aparición progresiva de trazos.
- Movimiento, escala, rotación y opacidad de objetos.
- Animación de cámara (zoom y desplazamiento).
- Escenas y clips en una línea de tiempo.
- Fotogramas dibujados manualmente.
- Onion skin.
- Reproducción a FPS constante.

Compara si conviene un motor propio, una biblioteca existente o una combinación.

### Audio y exportación

Investiga:
- Importación y previsualización de audio.
- Forma de onda y recorte.
- Mezcla de varias pistas.
- Renderizado de fotogramas.
- Exportación MP4 y codecs comunes.
- FFmpeg y alternativas.
- Distribución de binarios y obligaciones de licencia.
- Procesamiento en segundo plano, cancelación y progreso.
- Cómo comprobar duración y sincronización del resultado.

No asumas que poder usar FFmpeg instalado localmente autoriza a redistribuirlo dentro del instalador.

## 4. Definir los flujos principales de usuario

Documenta al menos estos recorridos:

1. Crear una historia corta sin saber dibujar.
2. Crear una escena combinando recursos y dibujo libre.
3. Crear una escena dibujando todo manualmente.
4. Importar una narración y sincronizar escenas con ella.
5. Crear una animación de trazado progresivo.
6. Crear una secuencia fotograma a fotograma.
7. Guardar, cerrar y reabrir un proyecto.
8. Exportar un vídeo y verificarlo.

Identifica los puntos en los que un principiante podría confundirse y propone soluciones simples.

## 5. Definir el modelo de proyecto

Propón un modelo que pueda representar:
- Proyecto y ajustes generales.
- Escenas y duración.
- Capas.
- Trazos vectoriales con puntos y atributos.
- Objetos y recursos de biblioteca.
- Imágenes importadas.
- Textos y formas.
- Animación y keyframes.
- Fotogramas dibujados manualmente.
- Pistas y clips de audio.
- Marcadores de narración.
- Ajustes de renderizado.

Evalúa si los proyectos deben ser carpetas o archivos contenedores. Define estrategia de rutas relativas, empaquetado de recursos, validación, guardado seguro y migración de versiones.

No implementes todavía el formato definitivo: presenta la propuesta y sus ventajas e inconvenientes.

## 6. Prototipos técnicos mínimos

Determina qué prototipos son necesarios para eliminar riesgos. Prioriza pruebas pequeñas y medibles:

- Dibujar trazos con ratón y, si está disponible, presión.
- Guardar y reabrir trazos editables.
- Reproducir un trazo progresivamente.
- Evaluar el estado visual para un tiempo concreto.
- Renderizar una secuencia de prueba a FPS constantes.
- Mezclar una pista de voz con música.
- Exportar un clip corto y comprobarlo.

No construyas prototipos innecesarios. Elige los que respondan a los mayores riesgos técnicos.

## 7. Seguridad y privacidad

La aplicación debe funcionar localmente.

Si recomiendas Electron, define cómo aplicar:
- contextIsolation activado.
- nodeIntegration desactivado en el renderer.
- preload pequeño y tipado.
- IPC validado y con operaciones permitidas explícitamente.
- acceso al sistema de archivos controlado.
- no ejecutar comandos o rutas construidas con datos no confiables.

Los proyectos importados deben validarse. No ejecutar código activo contenido en archivos de proyecto.

## 8. Requisitos de experiencia de usuario

- Los modos Guiado, Mixto y Libre son configuraciones de ayuda, no formatos diferentes.
- El modo Libre no debe ser una versión recortada del editor.
- Las ayudas deben poder ocultarse.
- Todo elemento insertado desde la biblioteca debe poder modificarse en lo posible.
- Guardado automático y recuperación deben ser claros.
- Las operaciones largas deben mostrar progreso y permitir cancelar.
- La interfaz debe estar en español inicialmente.
- Considerar accesibilidad, atajos y uso con tableta gráfica.

## 9. Gestión del repositorio

Revisa el repositorio y respeta los archivos ya existentes.

- No trabajar directamente en `main`.
- Crear una rama `docs/m0-investigacion-arquitectura` si el repositorio está preparado y no hay trabajo previo que pueda perderse.
- No hacer push, merge ni publicar sin autorización explícita.
- No usar operaciones destructivas de Git.
- No sobrescribir documentación útil existente sin revisarla.

## 10. Documentación que debes producir

Actualizar o crear:
- `docs/PROJECT_CHARTER.md`
- `docs/ARCHITECTURE.md`
- `docs/TECHNICAL_DECISIONS.md`
- `docs/UI_UX_GUIDELINES.md`
- `docs/PROJECT_FORMAT.md`
- `docs/ANIMATION_ENGINE.md`
- `docs/AUDIO_EXPORT.md`
- `docs/TESTING_STRATEGY.md`
- `ROADMAP.md`

Añadir ADRs para decisiones tecnológicas importantes. No crear documentación vacía ni inventar resultados.

## 11. Entrega final

Presenta:
1. Resumen ejecutivo.
2. Comparativa de tecnologías y recomendación.
3. Arquitectura propuesta.
4. Flujos de usuario.
5. Propuesta de formato de proyecto.
6. Diseño inicial del motor de animación.
7. Diseño de audio y exportación.
8. Riesgos técnicos y formas de validarlos.
9. Alcance recomendado para el MVP.
10. Roadmap por fases y criterios de salida.
11. Decisiones pendientes que requieren aprobación.
12. Próximas tareas de M1.

No afirmes que una tecnología es compatible o adecuada sin evidencia. Distingue investigación, inferencias y prototipos realmente ejecutados.

**Resultado esperado:** un diseño técnico sólido y comprensible, listo para que el usuario lo revise antes de iniciar la implementación.
