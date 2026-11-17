# Arquitectura

Decisiones de base: ADR-001 a ADR-006 en `docs/decisions/`.

## Vista general

```
┌──────────────────────────── Proceso principal (Node) ────────────────────────────┐
│ ciclo de vida · ventanas · menús · diálogos nativos                              │
│ ProjectStore: abrir/guardar .dwings (ZIP, escritura atómica, .bak, recuperación) │
│ protocolos app:// (interfaz) y media:// (medios del proyecto, solo lectura)      │
│ IPC tipado y validado (zod)                                                      │
└──────────────▲───────────────────────────────────────────────────────────────────┘
               │ preload: window.dw (API mínima, sin acceso a Node)
┌──────────────┴────────────── Renderer (sandbox) ─────────────────────────────────┐
│ UI React: inicio · editor · paneles · línea de tiempo                            │
│ Editor: store Zustand+Immer, comandos con undo/redo por parches                  │
│ core (TS puro, sin DOM ni React):                                                │
│   model/    tipos + esquemas zod + migraciones                                   │
│   time/     ticks, FPS, timecode                                                 │
│   engine/   evaluate(project, tick) → RenderList                                 │
│   render/   renderFrame(ctx, RenderList) sobre Canvas 2D                         │
│   audio/    buildAudioGraph(ctx, project) para AudioContext y OfflineAudioContext│
│ Workers: export (OffscreenCanvas + WebCodecs + mediabunny), picos de audio       │
└──────────────────────────────────────────────────────────────────────────────────┘
```

## Módulos y responsabilidades

| Módulo | Responsabilidad | No debe |
|---|---|---|
| `main/` | Ventanas, diálogos, sistema de archivos y protocolos | Contener lógica de edición |
| `preload/` | Exponer funciones IPC concretas | Exponer `ipcRenderer` ni Node |
| `core/model` | Fuente de verdad del documento, validación y migraciones | Importar React, DOM ni Electron |
| `core/engine` | Calcular el estado visual en un tick | Leer el estado de la interfaz |
| `core/render` | Dibujar una `RenderList` en un contexto 2D | Conocer la línea de tiempo |
| `core/audio` | Construir el grafo de audio a partir del documento | Reproducir por su cuenta |
| `renderer/editor` | Herramientas, selección, comandos y undo/redo | Escribir archivos directamente |
| `renderer/ui` | Componentes y paneles | Contener reglas del modelo |

La previsualización y la exportación llaman a `evaluate` + `renderFrame` (vídeo) y `buildAudioGraph` (audio) con el mismo documento y el mismo tick. Es la garantía de que el vídeo coincide con lo que se ve.

## Flujo de edición

1. Una herramienta genera un **comando** (`addStroke`, `moveItems`, `setKeyframe`…).
2. El store lo aplica con `produceWithPatches` y apila los parches inversos para deshacer.
3. Los suscriptores (lienzo, paneles, línea de tiempo) se actualizan a partir del documento.
4. El documento se marca como modificado y se programa el autoguardado.

## Seguridad (Electron)

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false` y `webSecurity` activado.
- La interfaz se carga desde `app://`, no desde `file://`. CSP estricta, sin orígenes remotos.
- `media://<hash>` sirve medios solo del proyecto abierto o de la caché de importación, validando el hash. Nunca acepta rutas arbitrarias.
- `setWindowOpenHandler` → `deny`. `will-navigate` bloqueado. Los enlaces externos se abren con `shell.openExternal` solo tras validarlos (https).
- Cada canal IPC tiene un esquema zod. Las rutas de archivo solo salen de diálogos nativos o de la lista de recientes guardada por el proceso principal.
- No se ejecutan procesos externos en el MVP.
- Al empaquetar (M8): fuses de Electron (`RunAsNode` off, `EnableNodeCliInspectArguments` off, integridad ASAR).

## Rendimiento

- Caché de `Path2D` por trazo, invalidada al editarlo.
- En M2: mapa de bits por capa estática, y redibujar solo las capas con cambios o animación en el tick actual.
- Descarte por *bounding box* fuera del viewport.
- Las operaciones largas (exportar, calcular picos de audio, abrir proyectos grandes) van en workers o en el proceso principal de forma asíncrona, con progreso y cancelación.
