# PROMPT 08 — PREPARACIÓN DE LANZAMIENTO

## Rol

Actúa como responsable de release engineering de Dra-Wings.

## Objetivo

Preparar una versión candidata instalable para Windows y comprobar que se puede instalar, abrir, utilizar y desinstalar correctamente.

No publiques ni distribuyas la versión sin aprobación explícita.

## 1. Revisión previa

- Leer ROADMAP, CHANGELOG y documentación de release.
- Revisar estado de Git y rama.
- Confirmar que los cambios llegan mediante Pull Requests aprobadas.
- Revisar versión de aplicación y formato de proyecto.
- Ejecutar lint, typecheck, pruebas y build.

## 2. Dependencias y licencias

Revisar:
- Dependencias directas y transitivas relevantes.
- Licencias de componentes incluidos.
- FFmpeg, codecs y binarios redistribuidos.
- Avisos y atribuciones requeridas.
- Recursos gráficos, fuentes, iconos y sonidos.

No asumir que un recurso encontrado online puede redistribuirse.

## 3. Instalador

- Crear instalador Windows con la herramienta aprobada.
- Validar nombre, versión, icono e información básica.
- Verificar ubicación de instalación y permisos.
- No incluir archivos de desarrollo, proyectos personales ni medios de prueba.

## 4. Pruebas de instalación limpia

En un entorno limpio o usuario de prueba:
- Instalar.
- Abrir.
- Crear proyecto.
- Guardar y reabrir.
- Probar un flujo principal de dibujo.
- Probar animación y audio si forman parte del MVP.
- Exportar un vídeo.
- Desinstalar.

## 5. Documentación para usuarios

Preparar:
- Requisitos del sistema.
- Instalación.
- Primer proyecto.
- Modos Guiado, Mixto y Libre.
- Guardado y ubicación de proyectos.
- Importación de medios.
- Exportación.
- Limitaciones conocidas.
- Privacidad y licencias.

## 6. Release candidate

Crear notas de versión, changelog y artefacto de prueba. Verificar hash o integridad del instalador si procede.

## 7. Autorización

No publicar en una web, tienda ni repositorio público. No crear un release público ni subir instaladores sin aprobación explícita del usuario.

## Entrega

Informar de versiones, archivos generados, pruebas, licencias revisadas, problemas encontrados y recomendación de publicar o no publicar.
