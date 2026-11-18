# Formato de proyecto `.dwings` (v1)

Contenedor y estrategia de guardado: ver ADR-003. Unidades de tiempo: ver ADR-006 (ticks, 1 s = 705 600 000).

## Contenido del ZIP

| Entrada | Compresión | Contenido |
|---|---|---|
| `manifest.json` | deflate | `{ "format": "dra-wings", "formatVersion": 1, "appVersion": "x.y.z" }` |
| `project.json` | deflate | Documento (ver abajo) |
| `media/<sha256>.<ext>` | store | Imágenes y audio usados por el proyecto. `ext`: png, jpg, webp, gif, mp3, wav, ogg, m4a o flac |
| `thumbnail.png` | store | Miniatura de la primera escena (prevista; aún no se escribe) |

Los picos de la forma de onda no se guardan: se recalculan al abrir.

## Documento (esquema lógico)

```ts
Project {
  id: string; name: string; createdAt: string; updatedAt: string   // ISO 8601
  settings: { width: number; height: number; fps: Fps; background: Color; mode: 'guided' | 'mixed' | 'free'
              boil?: 'off' | 'soft' | 'medium' | 'strong'      // «trazo vivo»; sin valor = 'off' (archivos anteriores)
              elastic?: 'off' | 'soft' | 'medium' | 'strong' } // elasticidad; sin valor = 'off'
  scenes: Scene[]                       // se reproducen en orden
  assets: Asset[]                       // medios usados (imágenes y audio)
  audioTracks: AudioTrack[]
  markers: Marker[]                     // tiempo global en ticks
  export: { preset: '720p' | '1080p' | 'square' | 'vertical'; fps?: Fps }   // valor inicial del diálogo: '720p' → HD; el resto → Full HD
}

Scene { id; name; duration: Ticks; layers: Layer[]; camera: AnimatedTransform    // cámara: x, y = esquina del encuadre; scaleX = zoom
        beatPulse?: boolean                // cámara que late al empezar cada compás
        transition?: { kind: 'cut' | 'fade' | 'dip' | 'slide' | 'zoom' | 'wipe' | 'iris'; duration: Ticks } }  // entrada desde la escena anterior

Layer {
  id; name; visible: boolean; locked: boolean; opacity: number
  kind: 'vector' | 'frames'
  items?: Item[]                        // kind = 'vector'
  cels?: Cel[]                          // kind = 'frames' (fotograma a fotograma)
}

Item = Stroke | Shape | Text | Group | Image
ItemBase {
  id; transform: AnimatedTransform; opacity: Animated<number>
  in: Ticks; out?: Ticks                // relativos a la escena
  enter?: { kind: 'none' | 'draw' | 'fade' | 'pop'; duration: Ticks; mode?: 'length' | 'recorded' }
  exit?: { kind: 'none' | 'fade' | 'pop'; duration: Ticks }
  trail?: boolean                       // estela al moverse
  loop?: 'repeat' | 'pingpong'          // al acabar sus keyframes, se repite o va y vuelve
  life?: { kind: 'breathe' | 'sway' | 'float' | 'pulse' | 'beat-pulse' | 'beat-bounce' | 'beat-sway'; amount: number }  // vida automática (0–3)
}

Stroke extends ItemBase {
  type: 'stroke'
  points: number[]                      // empaquetado [x, y, presión, tMs, ...]; presión = -1 si el dispositivo no la da
  style: { color: Color; size: number; thinning: number; smoothing: number; streamline: number; opacity: number
           taper?: number }             // afinado de las puntas (unidades locales); sin valor, puntas redondas
}

Shape extends ItemBase {
  type: 'shape'; shape: 'rect' | 'ellipse' | 'line' | 'arrow' | 'polygon'
  w: number; h: number                  // rect/elipse/polígono: caja local (0,0)-(w,h); línea/flecha: de (0,0) a (w,h)
  points?: number[]; smooth?: boolean   // solo polígono: vértices locales [x0, y0, x1, y1, ...]
  style: { stroke: Color | null; strokeWidth: number; fill: Color | null; opacity: number }
}

Text extends ItemBase {
  type: 'text'; text: string; font: 'hand' | 'script' | 'rounded'; size: number; color: Color
  align: 'left' | 'center' | 'right'; lineHeight: number
  reveal?: 'letters' | 'words' | 'bounce' | 'beat-words'   // cómo se escribe al dibujarse (sin valor: letra a letra)
  w: number; h: number                  // caja medida al editar
}

Group extends ItemBase {
  type: 'group'; children: Item[]       // hijos en coordenadas locales (origen en la esquina de la caja)
  w: number; h: number
  source?: { kind: 'library' | 'character'; id: string }   // informativo
  slots?: { id: string; label: string; color: Color }[]    // ranuras de color recoloreables
  swaps?: { t: Ticks; children: Item[]; variant?: string }[]  // cambios de dibujo en el tiempo, ordenados por t
  talk?: boolean                        // personaje que mueve la boca con la narración
}
// Desde cada `swaps[i].t` (y hasta el siguiente) el grupo se dibuja con esos hijos, en las mismas
// coordenadas locales; antes del primero, con `children`. En personajes, `variant` y `source.id`
// valen `pelo/expresión/postura`. La caja (w, h) abarca todos los dibujos. Campo opcional añadido
// en v1 antes de la primera versión pública: los archivos anteriores siguen siendo válidos.
// ItemBase.slot?: string → ranura a la que pertenece una pieza dentro de un grupo

Image extends ItemBase {
  type: 'image'; assetId: string        // → Asset con mime image/*
  w: number; h: number                  // tamaño en la hoja; la imagen se estira a la caja local (0,0)-(w,h)
}

Asset {
  id: string
  hash: string                          // SHA-256 del contenido, en hexadecimal; da nombre al archivo en media/
  mime: string                          // image/png | image/jpeg | image/webp | image/gif | audio/mpeg | audio/wav | audio/ogg | audio/mp4 | audio/flac
  name: string                          // nombre original del archivo (informativo)
  size: number                          // bytes
  durationTicks?: Ticks                 // solo audio
  beats?: { bpm: number; ticks: Ticks[]; downbeat: 0 | 1 | 2 | 3 }  // ritmo detectado (música): golpes desde el inicio del archivo
  voice?: { rate: number; levels: number[] }  // voz analizada (narración): nivel 0..100 cada 1/rate s
}

Cel { id; start: Ticks; duration: Ticks; items: Item[] }   // alineado a la rejilla de fotogramas

AudioTrack { id; name; kind: 'narration' | 'music' | 'sfx'; volume: number; muted: boolean; clips: AudioClip[] }
AudioClip { id; assetId; start: Ticks; sourceOffset: Ticks; duration: Ticks; gain: number; fadeIn: Ticks; fadeOut: Ticks }
// start: tiempo global del proyecto (las escenas se suceden); sourceOffset: dónde empieza dentro del archivo;
// gain y volume: 0–4 (la interfaz ofrece 0–200 %); fadeIn + fadeOut ≤ duration
Marker { id; t: Ticks; label: string }  // t: tiempo global

Animated<T> = { value: T } | { keys: { t: Ticks; v: T; ease: Ease }[] }    // t relativo a la escena
Ease = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'hold' | 'back' | 'bounce'   // suavizado del tramo que empieza en ese keyframe
AnimatedTransform = { x; y; scaleX; scaleY; rotation; anchorX; anchorY }   // cada uno Animated<number>
```

Transformación: `rotation` en grados. Matriz = T(x + anchorX, y + anchorY) · R(rotation) · S(scaleX, scaleY) · T(−anchorX, −anchorY). Los trazos guardan sus puntos en coordenadas de escena (con transformación identidad al crearlos) y el ancla en el centro de su caja.

Compatibilidad: hasta la primera versión publicada, el formato v1 puede ampliarse con nuevos tipos de elemento. Los archivos antiguos siguen siendo válidos. A partir de la primera versión pública, cualquier cambio incompatible sube `formatVersion` y añade su migración.

## Reglas

- Los identificadores son cadenas aleatorias únicas dentro del proyecto (nanoid).
- No hay rutas absolutas. Los medios se referencian por `assetId` → `Asset`, y su archivo es `media/<hash>.<ext>`.
- Cada medio del ZIP debe coincidir con su hash; si no, el archivo se rechaza por dañado. Si falta un medio, el proyecto se abre igualmente y se avisa (los elementos sin medio se ven como marcador).
- Al guardar se omiten los medios que no usa ningún elemento ni clip (`pruneAssets`). Las referencias a medios inexistentes se rechazan al abrir (`checkReferences`).
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

Autoguardado (`src/main/recovery.ts`): 3 s después del último cambio, el documento se escribe en `userData/recovery/<projectId>.json` junto con la ruta de su archivo. Al guardar se borra. En la pantalla de inicio se ofrecen las recuperaciones más recientes que su archivo (o de proyectos nunca guardados) para restaurarlas o descartarlas. Los medios importados viven en `userData/media-cache/<sha256>.<ext>` desde que se importan, así que la recuperación los encuentra aunque el proyecto no se haya guardado nunca.

## Seguridad de rutas

El proceso principal es la única autoridad sobre rutas. El renderer solo puede pedir «abrir con diálogo», «abrir un reciente» (la ruta debe estar en la lista de recientes), «guardar» (en la ruta que el proceso principal asoció al proyecto) o «guardar como» (con diálogo). Nunca envía una ruta arbitraria para leer o escribir.
