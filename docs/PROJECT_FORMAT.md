# Formato de proyecto `.dwings` (v1)

Contenedor y estrategia de guardado: ver ADR-003. Unidades de tiempo: ver ADR-006 (ticks, 1 s = 705 600 000).

## Contenido del ZIP

| Entrada | Compresión | Contenido |
|---|---|---|
| `manifest.json` | deflate | `{ "format": "dra-wings", "formatVersion": 1, "appVersion": "x.y.z" }` |
| `project.json` | deflate | Documento (ver abajo) |
| `media/<sha256>.<ext>` | store | Imágenes y audio importados |
| `cache/peaks/<sha256>.bin` | store | Picos de forma de onda (regenerables; se pueden borrar) |
| `thumbnail.png` | store | Miniatura de la primera escena |

## Documento (esquema lógico)

```ts
Project {
  id: string; name: string; createdAt: string; updatedAt: string   // ISO 8601
  settings: { width: number; height: number; fps: Fps; background: Color; mode: 'guided' | 'mixed' | 'free' }
  scenes: Scene[]                       // se reproducen en orden
  assets: Asset[]                       // medios referenciados por hash
  audioTracks: AudioTrack[]
  markers: Marker[]                     // tiempo global en ticks
  export: { preset: '720p' | '1080p' | 'square' | 'vertical'; fps?: Fps }
}

Scene { id; name; duration: Ticks; layers: Layer[]; camera: AnimatedTransform }

Layer {
  id; name; visible: boolean; locked: boolean; opacity: number
  kind: 'vector' | 'frames'
  items?: Item[]                        // kind = 'vector'
  cels?: Cel[]                          // kind = 'frames' (fotograma a fotograma)
}

Item = Stroke | Shape | Text | Image | LibraryInstance | Group
ItemBase { id; transform: AnimatedTransform; opacity: Animated<number>; in: Ticks; out?: Ticks }

Stroke extends ItemBase {
  type: 'stroke'
  points: number[]                      // empaquetado [x, y, presión, tMs, ...]; presión = -1 si el dispositivo no la da
  style: { color: Color; size: number; thinning: number; smoothing: number; streamline: number; opacity: number }
  reveal: { start: Ticks; duration: Ticks; mode: 'length' | 'recorded' } | null   // null = visible desde `in`
}

Cel { id; start: Ticks; duration: Ticks; items: Item[] }   // alineado a la rejilla de fotogramas

AudioTrack { id; name; kind: 'narration' | 'music' | 'sfx'; volume: number; muted: boolean; clips: AudioClip[] }
AudioClip { id; assetId; start: Ticks; sourceOffset: Ticks; duration: Ticks; gain: number; fadeIn: Ticks; fadeOut: Ticks }

Animated<T> = { value: T } | { keys: { t: Ticks; v: T; ease: Ease }[] }    // t relativo a la escena
AnimatedTransform = { x; y; scaleX; scaleY; rotation; anchorX; anchorY }   // cada uno Animated<number>
```

## Reglas

- Los identificadores son cadenas aleatorias únicas dentro del proyecto (nanoid).
- No hay rutas absolutas. Los medios se referencian por `assetId` → `Asset { id, hash, mime, name, size, durationTicks? }`.
- Validación completa con zod antes de entregar el documento al editor. Si falla, mensaje comprensible con la ruta del campo.
- Migraciones encadenadas `v1 → v2 → …` aplicadas al JSON antes de validar. Antes de migrar se guarda una copia `.bak`.
- Un archivo con `formatVersion` mayor que el soportado no se abre: se pide actualizar la aplicación.
- Límites defensivos al abrir: tamaño descomprimido total, número de entradas y nombres de entrada sin `..` ni rutas absolutas.

## Guardado

Implementado en `src/main/project-file.ts`:

1. Serializar → `nombre.dwings.tmp` en la misma carpeta → `fsync`.
2. Si existe `nombre.dwings`, copiarlo a `nombre.dwings.bak` (sustituye al anterior).
3. Renombrar `.tmp` → `nombre.dwings` (reemplazo atómico, con reintentos si Windows bloquea el archivo un instante). El destino nunca desaparece.
4. Si cualquier paso falla, se borra el `.tmp`, el archivo original queda intacto y se informa del error (disco lleno, permisos…).

Autoguardado (`src/main/recovery.ts`): 3 s después del último cambio, el documento se escribe en `userData/recovery/<projectId>.json` junto con la ruta de su archivo. Al guardar se borra. En la pantalla de inicio se ofrecen las recuperaciones más recientes que su archivo (o de proyectos nunca guardados) para restaurarlas o descartarlas. Los medios nuevos aún no guardados vivirán en `userData/media-cache/` (M3/M5).

## Seguridad de rutas

El proceso principal es la única autoridad sobre rutas. El renderer solo puede pedir «abrir con diálogo», «abrir un reciente» (la ruta debe estar en la lista de recientes), «guardar» (en la ruta que el proceso principal asoció al proyecto) o «guardar como» (con diálogo). Nunca envía una ruta arbitraria para leer o escribir.
