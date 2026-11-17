# Arquitectura

Decisiones de base: ADR-001 a ADR-006 en `docs/decisions/`.

## Vista general

```
┌──────────────────────────── Proceso principal (Node) ────────────────────────────┐
│ ciclo de vida · ventanas · menús · diálogos nativos                              │
│ ProjectStore: abrir/guardar .dwings (ZIP, escritura atómica, .bak, recuperación) │
│ MediaStore: caché de medios por SHA-256 (importar, extraer y verificar)          │
│ protocolo app://dra-wings: interfaz y /media/<sha256>.<ext> (solo lectura)       │
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
│   audio/    clips (cálculos puros), edit, mix: scheduleProject(ctx, project, …)  │
│ Medios: imágenes (ImageBitmap) y audio (AudioBuffer 48 kHz) en caché por hash    │
│ Workers: export (OffscreenCanvas + WebCodecs + mediabunny)                       │
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
| `core/audio` | Programar clips, fundidos y mezcla a partir del documento; editar pistas, clips y marcas | Reproducir por su cuenta ni cargar medios |
| `main/media.ts` | Importar medios validados a la caché y servirlos por nombre `<sha256>.<ext>` | Aceptar rutas del renderer |
| `main/export.ts` | Destino de la exportación: `.part`, escrituras por posición validadas, renombrado o borrado | Codificar ni conocer el documento |
| `core/export` | Plan de exportación: tamaño, fotogramas e instantes exactos | Depender del navegador |
| `renderer/export` | Diálogo, mezcla de audio y worker de exportación (WebCodecs + mediabunny) | Escribir archivos directamente |
| `renderer/editor` | Herramientas, selección, comandos y undo/redo | Escribir archivos directamente |
| `renderer/ui` | Componentes y paneles | Contener reglas del modelo |

La previsualización y la exportación llaman a `evaluateScene` + `drawRenderList` (vídeo) y `scheduleProject` (audio) con el mismo documento y el mismo tick. Es la garantía de que el vídeo coincide con lo que se ve.

## Flujo de edición

1. Una herramienta genera un **comando** (`addStroke`, `moveItems`, `setKeyframe`…).
2. El store lo aplica con `produceWithPatches` y apila los parches inversos para deshacer.
3. Los suscriptores (lienzo, paneles, línea de tiempo) se actualizan a partir del documento.
4. El documento se marca como modificado y se programa el autoguardado.

## Seguridad (Electron)

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false` y `webSecurity` activado.
- La interfaz se carga desde `app://`, no desde `file://`. CSP estricta, sin orígenes remotos.
- `app://dra-wings/media/<sha256>.<ext>` sirve medios solo de la caché local, validando el nombre con una expresión estricta. Nunca acepta rutas arbitrarias. Al abrir un proyecto, cada medio se verifica contra su hash antes de entrar en la caché.
- `setWindowOpenHandler` → `deny`. `will-navigate` bloqueado. Los enlaces externos se abren con `shell.openExternal` solo tras validarlos (https).
- Cada canal IPC tiene un esquema zod. Las rutas de archivo solo salen de diálogos nativos o de la lista de recientes guardada por el proceso principal.
- No se ejecutan procesos externos en el MVP.
- Al empaquetar (M8): fuses de Electron (`RunAsNode` off, `EnableNodeCliInspectArguments` off, integridad ASAR).

## Robustez

- Una *error boundary* de React rodea cada pantalla. Si la interfaz falla, escribe al momento la copia de recuperación y ofrece «Volver a intentar» o «Ir al inicio», donde se puede restaurar.
- Si el proceso de la interfaz se cae (`render-process-gone`), el proceso principal cancela una exportación en curso, avisa y recarga la ventana; la pantalla de inicio ofrece el trabajo sin guardar.

## Rendimiento

- Caché de `Path2D` por trazo, invalidada al editarlo.
- La línea de tiempo no depende del cabezal: solo lo hacen el tiempo, la línea roja, los rombos y los fotogramas, que se suscriben por su cuenta. Así no se vuelve a renderizar entera en cada fotograma de la reproducción.
- En M2: mapa de bits por capa estática, y redibujar solo las capas con cambios o animación en el tick actual.
- Descarte por *bounding box* fuera del viewport.
- Las operaciones largas (exportar, abrir proyectos grandes) van en workers o en el proceso principal de forma asíncrona, con progreso y cancelación. Los picos de audio se calculan una vez por archivo en el hilo de interfaz (unos milisegundos por minuto de audio); si con audios muy largos se nota, pasarán a un worker.
