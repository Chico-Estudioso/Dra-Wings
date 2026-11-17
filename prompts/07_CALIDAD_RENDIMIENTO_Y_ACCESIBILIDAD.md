# PROMPT 07 — CALIDAD, RENDIMIENTO, ACCESIBILIDAD Y USABILIDAD

## Rol

Actúa como responsable de QA, rendimiento y experiencia de usuario de Dra-Wings.

## Objetivo

Revisar la aplicación como producto completo y corregir problemas antes de su primera distribución pública.

No añadas funcionalidades grandes durante esta fase salvo que sean necesarias para corregir un defecto o completar un criterio de aceptación ya aprobado.

## 1. Flujos de usuario a validar

- Usuario principiante crea una historia con recursos guiados.
- Usuario mixto combina biblioteca y dibujo manual.
- Usuario avanzado trabaja sin ayudas.
- Usuario importa narración y sincroniza escenas.
- Usuario anima trazos y objetos.
- Usuario guarda, cierra y recupera un proyecto.
- Usuario exporta un MP4 y lo reproduce fuera de la aplicación.

## 2. Rendimiento

Crear proyectos de referencia de tamaño pequeño, medio y grande.
Medir:
- Tiempo de apertura.
- Respuesta del lienzo.
- Dibujo continuo.
- Cambio de capas.
- Reproducción de la línea de tiempo.
- Consumo de memoria.
- Tiempo de exportación.

Identificar cuellos de botella con mediciones antes de optimizar. No introducir complejidad prematura.

## 3. Robustez

Probar:
- Cierre inesperado.
- Fallo de guardado.
- Archivo de proyecto corrupto.
- Medio ausente.
- Falta de espacio en disco.
- Exportación cancelada.
- Archivo destino bloqueado.
- Proyecto con recursos grandes.
- Operaciones de undo/redo prolongadas.

No perder el último guardado válido.

## 4. Accesibilidad y usabilidad

- Navegación básica por teclado.
- Foco visible.
- Etiquetas comprensibles.
- Contraste suficiente.
- Mensajes de error accionables.
- Atajos documentados.
- No depender exclusivamente del color para comunicar estados.
- Considerar tableta gráfica y ratón.
- Permitir ocultar ayudas y paneles.

## 5. Revisión de seguridad

Si la aplicación usa Electron, revisar aislamiento del renderer, preload, IPC, acceso a archivos, enlaces externos y ejecución de procesos. Corregir cualquier acceso amplio o innecesario.

## 6. Pruebas de regresión

Ejecutar las pruebas existentes y añadir casos para defectos encontrados. No desactivar pruebas para conseguir un build verde sin justificarlo.

## 7. Revisión visual

Revisar coherencia de paneles, estados vacíos, iconos, tamaños, mensajes, flujo de creación y accesibilidad. Evitar rediseñar sin un problema concreto.

## Definition of Done

Todos los flujos principales del MVP han sido probados. Los errores críticos están corregidos. Las limitaciones no resueltas están documentadas. Se proporciona un informe con resultados automatizados y manuales separados.
