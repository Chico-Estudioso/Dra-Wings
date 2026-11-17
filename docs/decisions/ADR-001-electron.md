# ADR-001 — Electron como plataforma de escritorio

- **Estado:** Aprobada
- **Fecha:** 2026-11-17

## Contexto

Dra-Wings necesita que la previsualización y el vídeo exportado sean idénticos, codificar vídeo y audio localmente, acceder de forma controlada a archivos y empezar por Windows sin cerrar macOS y Linux.

## Opciones

| | Electron | Tauri |
|---|---|---|
| Motor web | Chromium empaquetado, la misma versión en todas las plataformas | WebView del sistema: WebView2 (Chromium) en Windows, WKWebView en macOS, WebKitGTK en Linux |
| Canvas 2D, WebCodecs y Pointer Events | Idénticos en todas las plataformas | Varían según el motor; WebKitGTK no ofrece codificadores WebCodecs completos |
| Tamaño del instalador | ~100 MB | ~10 MB |
| Backend | Node.js (mismo lenguaje que la interfaz) | Rust |
| Procesos externos y archivos | `child_process`, `fs` | Comandos Rust y plugins |

## Decisión

**Electron.** El argumento decisivo es el determinismo: un único Chromium garantiza que el lienzo, la codificación y los eventos de puntero se comportan igual en Windows, macOS y Linux. Con Tauri, el mismo proyecto podría renderizarse o exportarse distinto en cada sistema.

Versión validada en el prototipo: Electron 45.3.3 (Chromium 156, Node 24.22).

## Consecuencias

- Positivas: un solo motor para la previsualización y la exportación, ecosistema TypeScript completo y pruebas E2E con Playwright.
- Negativas: el instalador y la memoria son mayores. Hay que mantener Electron actualizado por seguridad.
- Seguridad: `contextIsolation`, `sandbox`, sin `nodeIntegration`, preload mínimo, IPC validado y protocolos propios en lugar de `file://` (ver `docs/ARCHITECTURE.md`).

## Evidencia

Prototipo `prototypes/m0`: en Linux (contenedor, sin GPU) se ejecutó con el renderer en sandbox. Las capacidades medidas en Windows y macOS están en `docs/AUDIO_EXPORT.md`.
