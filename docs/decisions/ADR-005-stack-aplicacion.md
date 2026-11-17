# ADR-005 — Stack de la aplicación

- **Estado:** Aprobada
- **Fecha:** 2026-11-17

## Decisión

| Área | Elección | Motivo |
|---|---|---|
| Lenguaje | TypeScript estricto | Tipos compartidos entre main, preload, renderer y workers. |
| Build y desarrollo | electron-vite (Vite) | Configura main, preload y renderer por separado, con HMR en el renderer. |
| Interfaz | React 19 | Ecosistema amplio. El lienzo no depende de React (ver ADR-002). |
| Componentes accesibles | Radix UI Primitives | Diálogos, menús, deslizadores y *tooltips* accesibles sin imponer estilo. |
| Iconos | Lucide | Licencia ISC y estilo de trazo coherente con la app. |
| Estado del editor | Zustand + Immer (`produceWithPatches`) | Undo/redo por parches inversos, sin un *store* pesado. |
| Validación del formato | Zod 4 | Un esquema define a la vez la validación al abrir y los tipos TS. |
| ZIP | fflate | JavaScript puro, sin código nativo, rápido y con licencia MIT. |
| Trazos | perfect-freehand | Ver ADR-002. |
| Multiplexado | mediabunny | Ver ADR-004. |
| Pruebas unitarias | Vitest (Node para el modelo; modo navegador con Playwright para el renderizado) | Mismo runner para lógica y Canvas real. |
| Pruebas E2E | Playwright con soporte de Electron | Lanza la app real y automatiza flujos. |
| Lint y formato | ESLint + Prettier | Estándar. |
| Empaquetado | electron-builder (NSIS en Windows) | Instalador Windows maduro. Se configura en M8. |

## Reglas

- Fijar versiones exactas en `package.json` y mantener el lockfile.
- No añadir dependencias fuera de esta tabla sin justificar su mantenimiento, licencia, tamaño y alternativa.
- Ningún módulo nativo de Node en el MVP: evita recompilar por cada versión de Electron.
