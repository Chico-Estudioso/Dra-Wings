# Changelog

Los cambios relevantes se registran aquí. Se seguirá una estructura inspirada en Keep a Changelog.

## [Unreleased]
- Preparación inicial del proyecto y del kit de desarrollo.
- M3: biblioteca original dibujada por código (36 recursos en 6 categorías, con búsqueda), constructor de personajes (pelo, expresión, postura y colores), 5 escenas de partida, grupos con ranuras de color (recolorear, agrupar y desagrupar sin perder aspecto), forma polígono, arrastrar recursos al lienzo, guías magnéticas, pestañas Biblioteca/Capas, ayudas «Primeros pasos» y comportamiento por modo (Guiado, Mixto y Libre). Corregido: duplicar elementos existentes fallaba al copiar borradores de Immer.
- M2: lienzo con zoom y desplazamiento, lápiz vectorial con presión (perfect-freehand), goma que divide trazos, rectángulo, elipse, línea, flecha y texto con fuentes OFL empaquetadas, selección con mover, escalar y rotar, duplicar, ordenar y centrar, panel de capas (crear, renombrar, ordenar, ocultar, bloquear y eliminar), panel de propiedades y atajos de teclado. Renderizador compartido en `src/core/render`.
- M1: aplicación Electron + React + TypeScript con pantalla de inicio, creación de proyectos (formato, FPS y modo), guardar, guardar como y abrir `.dwings` con guardado atómico y `.bak`, recientes, autoguardado y recuperación tras cierre inesperado, confirmación al cerrar con cambios, deshacer y rehacer, menú en español y CI en Windows y Ubuntu (lint, formato, typecheck, pruebas unitarias, build y E2E).
- M0: decisiones de arquitectura (ADR-001 a ADR-006), documentación técnica y prototipo de render y exportación (`prototypes/m0`).
