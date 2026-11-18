import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import * as Popover from '@radix-ui/react-popover';
import {
  AudioLines,
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  Eye,
  Flag,
  Layers,
  Mic,
  Minus,
  Music,
  Pause,
  Play,
  Plus,
  SkipBack,
  Trash2,
  Video,
  Volume2,
  VolumeX,
  type LucideIcon,
} from 'lucide-react';
import { snapTo, trimmed, type TrackKind } from '@core/audio/edit';
import { sceneStart } from '@core/edit/scenes';
import { keyTimes, transformKeyTimes } from '@core/anim/keyframes';
import { celAt, layerItemCount } from '@core/edit/ops';
import type { AudioClip, AudioTrack, Cel, Item, Layer, Project, Scene } from '@core/model/types';
import {
  formatTimecode,
  secondsFromTicks,
  snapToFrame,
  TICKS_PER_SECOND,
  ticksFromSeconds,
  type Fps,
  type Ticks,
} from '@core/time/ticks';
import {
  addCelAfterPlayhead,
  addSceneAfterCurrent,
  deleteCurrentScene,
  duplicateCurrentScene,
  goToScene,
  moveCurrentScene,
  setEnterDuration,
  shiftItemsTime,
  updateCurrentScene,
} from './actions';
import { TIMELINE_MIN_H, useEditor } from './editor-store';
import { itemName } from './item-names';
import { addMarkerAtPlayhead, importAudio, moveClipTo, moveMarkerTo, trimClipBy, updateTrack } from './media-actions';
import { togglePlay } from './playback';
import { openRecordPanel } from './RecordPanel';
import { hasFiles, importDroppedFiles } from './drop-files';
import { Waveform } from './Waveform';

const NAME_W = 150;
const RULER_H = 24;
const LANE_H = 12;
const ROW_PAD = 5;
const MIN_BAR_PX = 6;
const AUDIO_ROW_H = 36;
const CLIP_H = 30;
/** Distancia (px) a la que se pega un arrastre a una marca o al cabezal. */
const SNAP_PX = 8;

const TRACK_ICONS: Record<TrackKind, LucideIcon> = { narration: Mic, music: Music, sfx: AudioLines };
const IMPORT_OPTIONS: { kind: TrackKind; label: string }[] = [
  { kind: 'narration', label: 'Narración (voz)' },
  { kind: 'music', label: 'Música' },
  { kind: 'sfx', label: 'Efecto de sonido' },
];

interface Bar {
  item: Item;
  lane: number;
  start: number;
  drawEnd: number;
  end: number;
}

/** Reparte las barras de una capa en carriles para que no se solapen. */
function packBars(items: Item[], sceneDuration: Ticks, minTicks: Ticks): { bars: Bar[]; lanes: number } {
  const laneEnds: number[] = [];
  const bars = [...items]
    .sort((a, b) => a.in - b.in)
    .map((item) => {
      const drawEnd =
        item.in + Math.max(minTicks, item.enter && item.enter.kind !== 'none' ? item.enter.duration : minTicks);
      let lane = laneEnds.findIndex((end) => end <= item.in);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = drawEnd;
      return { item, lane, start: item.in, drawEnd, end: item.out ?? sceneDuration };
    });
  return { bars, lanes: Math.max(1, laneEnds.length) };
}

type DragKind = 'shift' | 'duration' | 'clip-move' | 'clip-start' | 'clip-end' | 'marker';
/** `base`: inicio del elemento (local), duración de la entrada, inicio o borde del clip, o instante de la marca (globales). */
type Drag = { kind: DragKind; x0: number; id: string; base: number } | { kind: 'scrub' };

function SceneTabs({ project, sceneId }: { project: Project; sceneId: string }) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  return (
    <div className="tl-scenes">
      <div className="tl-scene-tabs" role="tablist" aria-label="Escenas">
        {project.scenes.map((s) =>
          renaming === s.id ? (
            <input
              key={s.id}
              className="input input-sm tl-scene-input"
              aria-label="Nombre de la escena"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                const v = draft.trim();
                if (v && v !== s.name) updateCurrentScene('Renombrar escena', (sc) => void (sc.name = v));
                setRenaming(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') setRenaming(null);
              }}
            />
          ) : (
            <button
              key={s.id}
              role="tab"
              aria-selected={s.id === sceneId}
              className={`tl-scene ${s.id === sceneId ? 'is-active' : ''}`}
              title="Doble clic para renombrar"
              onClick={() => goToScene(s.id)}
              onDoubleClick={() => {
                goToScene(s.id);
                setDraft(s.name);
                setRenaming(s.id);
              }}
            >
              {s.name}
            </button>
          ),
        )}
      </div>
      <button
        className="icon-btn icon-btn-sm"
        aria-label="Nueva escena"
        title="Nueva escena"
        onClick={addSceneAfterCurrent}
      >
        <Plus size={14} />
      </button>
      <span className="tl-sep" />
      <button
        className="icon-btn icon-btn-sm"
        aria-label="Mover escena a la izquierda"
        title="Mover a la izquierda"
        onClick={() => moveCurrentScene(-1)}
      >
        <ChevronLeft size={14} />
      </button>
      <button
        className="icon-btn icon-btn-sm"
        aria-label="Mover escena a la derecha"
        title="Mover a la derecha"
        onClick={() => moveCurrentScene(1)}
      >
        <ChevronRight size={14} />
      </button>
      <button
        className="icon-btn icon-btn-sm"
        aria-label="Duplicar escena"
        title="Duplicar escena"
        onClick={duplicateCurrentScene}
      >
        <Copy size={14} />
      </button>
      <button
        className="icon-btn icon-btn-sm"
        aria-label="Eliminar escena"
        title="Eliminar escena"
        disabled={project.scenes.length < 2}
        onClick={deleteCurrentScene}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function DurationInput({ scene }: { scene: Scene }) {
  const secs = secondsFromTicks(scene.duration);
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className="inline-field tl-duration">
      <span className="control-label">Duración</span>
      <input
        className="input input-sm"
        type="number"
        min={0.5}
        step={0.5}
        aria-label="Duración de la escena en segundos"
        value={draft ?? secs.toFixed(1)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const v = Number(draft);
          if (draft !== null && Number.isFinite(v) && v >= 0.5)
            updateCurrentScene('Duración de la escena', (s) => void (s.duration = ticksFromSeconds(v)));
          setDraft(null);
        }}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <span className="control-label">s</span>
    </label>
  );
}

// Piezas que dependen del cabezal: se suscriben por su cuenta para que la línea de tiempo entera
// no se vuelva a renderizar en cada fotograma de la reproducción.

function TimeReadout({ fps, duration }: { fps: Fps; duration: Ticks }) {
  const playhead = useEditor((s) => s.playhead);
  return (
    <span className="tl-time" data-testid="timeline-time">
      {formatTimecode(playhead, fps)} / {formatTimecode(duration, fps)}
    </span>
  );
}

function PlayheadLine({ pxPerTick }: { pxPerTick: number }) {
  const playhead = useEditor((s) => s.playhead);
  return <div className="tl-playhead" style={{ left: playhead * pxPerTick }} />;
}

function KeyButton({ t, label, style, camera }: { t: Ticks; label: string; style: CSSProperties; camera?: boolean }) {
  const current = useEditor((s) => s.playhead === t);
  return (
    <button
      className={`tl-key ${camera ? 'tl-key-camera' : ''} ${current ? 'is-current' : ''}`}
      style={style}
      aria-label={label}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => useEditor.getState().setPlayhead(t)}
    />
  );
}

function CelButton({ layer, cel, index, pxPerTick }: { layer: Layer; cel: Cel; index: number; pxPerTick: number }) {
  const current = useEditor((s) => celAt(layer, s.playhead)?.id === cel.id);
  return (
    <button
      className={`tl-cel ${current ? 'is-current' : ''}`}
      style={{ left: cel.start * pxPerTick, width: Math.max(4, cel.duration * pxPerTick - 1), top: ROW_PAD }}
      title={`Fotograma ${index + 1}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => {
        useEditor.getState().setActiveLayer(layer.id);
        useEditor.getState().setPlayhead(cel.start);
      }}
    >
      {cel.duration * pxPerTick > 16 ? index + 1 : ''}
    </button>
  );
}

/** Tirador para cambiar el alto de la línea de tiempo (arrastrar o flechas). */
function TimelineResizer() {
  const ref = useRef<HTMLDivElement>(null);
  const start = useRef<{ y: number; h: number } | null>(null);
  const [height, setHeight] = useState(0);
  const [maxH, setMaxH] = useState(0);
  // Alto real de la línea de tiempo, para anunciarlo a los lectores de pantalla.
  useLayoutEffect(() => {
    const section = ref.current?.parentElement;
    if (!section) return;
    const ro = new ResizeObserver(() => {
      setHeight(Math.round(section.getBoundingClientRect().height));
      setMaxH(Math.round(window.innerHeight * 0.6));
    });
    ro.observe(section);
    return () => ro.disconnect();
  }, []);
  const current = () => ref.current?.parentElement?.getBoundingClientRect().height ?? TIMELINE_MIN_H;
  const set = (h: number) => useEditor.getState().setTimelineHeight(Math.min(h, window.innerHeight * 0.6));
  return (
    <div
      ref={ref}
      className="tl-resizer"
      role="separator"
      aria-orientation="horizontal"
      aria-label="Alto de la línea de tiempo"
      aria-valuemin={TIMELINE_MIN_H}
      aria-valuemax={Math.max(TIMELINE_MIN_H, maxH)}
      aria-valuenow={Math.max(TIMELINE_MIN_H, height)}
      tabIndex={0}
      title="Arrastra o usa las flechas para cambiar el alto"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { y: e.clientY, h: current() };
      }}
      onPointerMove={(e) => start.current && set(start.current.h - (e.clientY - start.current.y))}
      onPointerUp={() => (start.current = null)}
      onPointerCancel={() => (start.current = null)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          set(current() + (e.key === 'ArrowUp' ? 20 : -20));
        }
      }}
    />
  );
}

export function Timeline({ project, scene }: { project: Project; scene: Scene }) {
  const playing = useEditor((s) => s.playing);
  const preview = useEditor((s) => s.preview);
  const autoKey = useEditor((s) => s.autoKey);
  const onion = useEditor((s) => s.onion);
  const zoom = useEditor((s) => s.timelineZoom);
  const timelineHeight = useEditor((s) => s.timelineHeight);
  const selection = useEditor((s) => s.selection);
  const activeLayerId = useEditor((s) => s.activeLayerId);
  const ed = useEditor.getState();
  const fps = project.settings.fps;
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [dragDelta, setDragDelta] = useState<{ id: string; kind: DragKind; dt: number } | null>(null);
  const clipId = useEditor((s) => s.clipId);
  const markerId = useEditor((s) => s.markerId);

  const pxPerTick = zoom / TICKS_PER_SECOND;
  const width = Math.max(scene.duration * pxPerTick + 120, 400);
  const minTicks = MIN_BAR_PX / pxPerTick;
  const layers = [...scene.layers].reverse();
  const selected = useMemo(() => new Set(selection), [selection]);
  const cameraKeys = transformKeyTimes(scene.camera);
  const activeLayer = scene.layers.find((l) => l.id === activeLayerId);
  const hasFrames = scene.layers.some((l) => l.kind === 'frames');
  /** Inicio global de la escena: el audio y las marcas viven en el tiempo del proyecto. */
  const offset = sceneStart(project, scene.id);
  const viewEnd = width / pxPerTick;
  const assets = useMemo(() => new Map(project.assets.map((a) => [a.id, a])), [project.assets]);
  const markersHere = project.markers.filter((m) => m.t >= offset && m.t <= offset + scene.duration);

  const tickAt = (clientX: number) => {
    const r = scrollRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(scene.duration, (clientX - r.left + scrollRef.current!.scrollLeft) / pxPerTick));
  };

  const onScrubDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { kind: 'scrub' };
    ed.setPlaying(false);
    ed.setPreview(true);
    ed.setPlayhead(snapToFrame(tickAt(e.clientX), fps));
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === 'scrub') {
      ed.setPlayhead(snapToFrame(tickAt(e.clientX), fps));
      return;
    }
    let dt = snapToFrame((e.clientX - d.x0) / pxPerTick, fps);
    if (d.kind !== 'duration' && !e.altKey) {
      // Ajuste magnético a marcas y al cabezal (Alt lo desactiva). Los elementos usan tiempo de escena.
      const local = d.kind === 'shift';
      const targets = project.markers.map((m) => (local ? m.t - offset : m.t));
      const playhead = useEditor.getState().playhead;
      if (d.kind !== 'marker') targets.push(local ? playhead : offset + playhead);
      const tol = SNAP_PX / pxPerTick;
      const snapped = snapTo(d.base + dt, targets, tol) - d.base;
      const clip =
        d.kind === 'clip-move' ? project.audioTracks.flatMap((t) => t.clips).find((c) => c.id === d.id) : null;
      // Un clip también se pega por su final.
      dt =
        snapped !== dt || !clip ? snapped : snapTo(d.base + clip.duration + dt, targets, tol) - d.base - clip.duration;
    }
    setDragDelta({ id: d.id, kind: d.kind, dt });
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.kind === 'scrub' || !dragDelta) {
      setDragDelta(null);
      return;
    }
    const dt = dragDelta.dt;
    setDragDelta(null);
    if (dt === 0) return;
    if (d.kind === 'shift') shiftItemsTime(selection.includes(d.id) ? selection : [d.id], dt);
    else if (d.kind === 'duration')
      setEnterDuration(d.id, Math.max(snapToFrame(d.base + dt, fps), TICKS_PER_SECOND / fps));
    else if (d.kind === 'clip-move') moveClipTo(d.id, d.base + dt);
    else if (d.kind === 'clip-start') trimClipBy(d.id, 'start', dt);
    else if (d.kind === 'clip-end') trimClipBy(d.id, 'end', dt);
    else moveMarkerTo(d.id, d.base + dt);
  };

  const startBarDrag = (e: React.PointerEvent, bar: Bar, kind: 'shift' | 'duration') => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const id = bar.item.id;
    if (e.shiftKey) ed.select(selected.has(id) ? selection.filter((x) => x !== id) : [...selection, id]);
    else if (!selected.has(id)) ed.select([id]);
    ed.setTool('select');
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { kind, x0: e.clientX, id, base: kind === 'shift' ? bar.item.in : (bar.item.enter?.duration ?? 0) };
  };

  const startClipDrag = (e: React.PointerEvent, clip: AudioClip, kind: 'clip-move' | 'clip-start' | 'clip-end') => {
    e.stopPropagation();
    if (e.button !== 0) return;
    ed.selectClip(clip.id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = {
      kind,
      x0: e.clientX,
      id: clip.id,
      base: kind === 'clip-end' ? clip.start + clip.duration : clip.start,
    };
  };

  const startMarkerDrag = (e: React.PointerEvent, id: string, t: Ticks) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    ed.selectMarker(id);
    ed.setPlaying(false);
    ed.setPlayhead(t - offset);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { kind: 'marker', x0: e.clientX, id, base: t };
  };

  const shiftFor = (id: string) =>
    dragDelta?.kind === 'shift' && (dragDelta.id === id || (selected.has(dragDelta.id) && selected.has(id)))
      ? dragDelta.dt
      : 0;

  const seconds = Math.ceil(secondsFromTicks(scene.duration));
  const labelEvery = zoom >= 60 ? 1 : zoom >= 25 ? 2 : 5;

  const renderLayerRow = (layer: Layer) => {
    if (layer.kind === 'frames') {
      return (
        <div key={layer.id} className="tl-row" style={{ height: LANE_H + ROW_PAD * 2 }}>
          {(layer.cels ?? []).map((c, i) => (
            <CelButton key={c.id} layer={layer} cel={c} index={i} pxPerTick={pxPerTick} />
          ))}
        </div>
      );
    }
    const { bars, lanes } = packBars(layer.items ?? [], scene.duration, minTicks);
    return (
      <div
        key={layer.id}
        className={`tl-row ${layer.visible ? '' : 'is-hidden'}`}
        style={{ height: lanes * LANE_H + ROW_PAD * 2 }}
      >
        {bars.map((b) => {
          const dt = shiftFor(b.item.id);
          const durDelta = dragDelta?.kind === 'duration' && dragDelta.id === b.item.id ? dragDelta.dt : 0;
          const left = (b.start + dt) * pxPerTick;
          const drawW = Math.max(MIN_BAR_PX, (b.drawEnd - b.start + durDelta) * pxPerTick);
          const tailW = Math.max(0, (b.end - b.drawEnd) * pxPerTick);
          const isSel = selected.has(b.item.id);
          return (
            <div key={b.item.id} className="tl-bar-wrap" style={{ left, top: ROW_PAD + b.lane * LANE_H }}>
              <div
                className={`tl-bar ${isSel ? 'is-selected' : ''} tl-${b.item.enter?.kind ?? 'none'}`}
                style={{ width: drawW }}
                title={`${itemName(b.item)} · aparece en ${formatTimecode(b.start, fps)}`}
                data-testid="timeline-bar"
                onPointerDown={(e) => startBarDrag(e, b, 'shift')}
              >
                <span className="tl-bar-handle" onPointerDown={(e) => startBarDrag(e, b, 'duration')} />
              </div>
              <div className="tl-tail" style={{ left: drawW, width: tailW }} />
              {isSel &&
                keyTimes(b.item).map((k) => (
                  <KeyButton
                    key={k}
                    t={k}
                    style={{ left: (k - b.start) * pxPerTick }}
                    label={`Keyframe en ${formatTimecode(k, fps)}`}
                  />
                ))}
            </div>
          );
        })}
      </div>
    );
  };

  const renderClip = (track: AudioTrack, clip: AudioClip) => {
    const asset = assets.get(clip.assetId);
    let g = { start: clip.start, sourceOffset: clip.sourceOffset, duration: clip.duration };
    if (dragDelta?.id === clip.id) {
      if (dragDelta.kind === 'clip-move') g = { ...g, start: Math.max(0, g.start + dragDelta.dt) };
      else if (dragDelta.kind === 'clip-start' || dragDelta.kind === 'clip-end')
        g = trimmed(clip, dragDelta.kind === 'clip-start' ? 'start' : 'end', dragDelta.dt, asset?.durationTicks);
    }
    const localStart = g.start - offset;
    const localEnd = localStart + g.duration;
    const visStart = Math.max(0, localStart);
    const visEnd = Math.min(viewEnd, localEnd);
    if (visEnd <= visStart) return null;
    const w = (visEnd - visStart) * pxPerTick;
    const a = (localStart - visStart) * pxPerTick; // borde izquierdo del clip completo (≤ 0 si empieza antes)
    const fadeIn = Math.min(clip.fadeIn, g.duration) * pxPerTick;
    const fadeOut = Math.min(clip.fadeOut, g.duration) * pxPerTick;
    const full = g.duration * pxPerTick;
    const name = asset?.name ?? 'Medio ausente';
    return (
      <div
        key={clip.id}
        className={`tl-clip tl-clip-${track.kind} ${clip.id === clipId ? 'is-selected' : ''} ${track.muted ? 'is-muted' : ''}`}
        style={{ left: visStart * pxPerTick, width: w, top: (AUDIO_ROW_H - CLIP_H) / 2, height: CLIP_H }}
        title={`${name} · ${formatTimecode(localStart, fps)} – ${formatTimecode(localEnd, fps)}`}
        data-testid="audio-clip"
        onPointerDown={(e) => startClipDrag(e, clip, 'clip-move')}
      >
        {asset && (
          <Waveform
            asset={asset}
            sourceStart={g.sourceOffset + (visStart - localStart)}
            sourceLength={visEnd - visStart}
            width={w}
            height={CLIP_H - 2}
            gain={clip.gain * track.volume}
          />
        )}
        {(fadeIn > 0 || fadeOut > 0) && (
          <svg className="tl-fades" width={w} height={CLIP_H} aria-hidden>
            {fadeIn > 0 && <polygon points={`${a},0 ${a + fadeIn},0 ${a},${CLIP_H}`} />}
            {fadeOut > 0 && <polygon points={`${a + full - fadeOut},0 ${a + full},0 ${a + full},${CLIP_H}`} />}
          </svg>
        )}
        <span className="tl-clip-name">{name}</span>
        {localStart >= 0 && (
          <span className="tl-clip-handle is-start" onPointerDown={(e) => startClipDrag(e, clip, 'clip-start')} />
        )}
        {localEnd <= viewEnd && (
          <span className="tl-clip-handle is-end" onPointerDown={(e) => startClipDrag(e, clip, 'clip-end')} />
        )}
      </div>
    );
  };

  return (
    <section
      className="timeline"
      aria-label="Línea de tiempo"
      style={timelineHeight ? { height: Math.min(timelineHeight, window.innerHeight * 0.6) } : undefined}
    >
      <TimelineResizer />
      <div className="tl-toolbar">
        <button
          className="icon-btn"
          aria-label="Ir al inicio"
          title="Ir al inicio (Inicio)"
          onClick={() => ed.setPlayhead(0)}
        >
          <SkipBack size={16} />
        </button>
        <button
          className="icon-btn tl-play"
          aria-label={playing ? 'Pausa' : 'Reproducir'}
          title={playing ? 'Pausa (Intro)' : 'Reproducir (Intro)'}
          onClick={togglePlay}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <TimeReadout fps={fps} duration={scene.duration} />
        <SceneTabs project={project} sceneId={scene.id} />
        <span className="topbar-spacer" />
        <DurationInput key={scene.id + scene.duration} scene={scene} />
        <button
          className={`icon-btn icon-btn-sm ${preview ? 'is-on' : ''}`}
          aria-pressed={preview}
          aria-label="Vista previa"
          title="Vista previa: ver el vídeo en el cabezal"
          onClick={() => ed.setPreview(!preview)}
        >
          <Eye size={15} />
        </button>
        <button
          className={`icon-btn icon-btn-sm ${autoKey ? 'is-rec' : ''}`}
          aria-pressed={autoKey}
          aria-label="Grabar movimiento"
          title="Grabar movimiento: mover, escalar o girar en el cabezal crea keyframes"
          onClick={ed.toggleAutoKey}
        >
          <Circle size={14} fill={autoKey ? 'currentColor' : 'none'} />
        </button>
        {hasFrames && (
          <button
            className={`icon-btn icon-btn-sm ${onion ? 'is-on' : ''}`}
            aria-pressed={onion}
            aria-label="Papel cebolla"
            title="Papel cebolla"
            onClick={ed.toggleOnion}
          >
            <Layers size={15} />
          </button>
        )}
        {activeLayer?.kind === 'frames' && (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => addCelAfterPlayhead(false)}>
              <Plus size={14} aria-hidden /> Fotograma
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => addCelAfterPlayhead(true)}>
              <Copy size={14} aria-hidden /> Duplicar
            </button>
          </>
        )}
        <Popover.Root>
          <Popover.Trigger asChild>
            <button className="btn btn-ghost btn-sm" title="Grabar o importar audio en el cabezal">
              <Music size={14} aria-hidden /> Audio
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content className="menu-popover" sideOffset={4} align="end" aria-label="Añadir audio">
              <Popover.Close asChild>
                <button className="menu-item" onClick={openRecordPanel}>
                  <Circle size={15} fill="currentColor" className="menu-rec" aria-hidden /> Grabar narración…
                </button>
              </Popover.Close>
              <span className="menu-label">Importar archivo</span>
              {IMPORT_OPTIONS.map(({ kind, label }) => {
                const Icon = TRACK_ICONS[kind];
                return (
                  <Popover.Close asChild key={kind}>
                    <button className="menu-item" onClick={() => void importAudio(kind)}>
                      <Icon size={15} aria-hidden /> {label}
                    </button>
                  </Popover.Close>
                );
              })}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <button
          className="icon-btn icon-btn-sm"
          aria-label="Añadir marca"
          title="Añadir marca en el cabezal (M)"
          onClick={addMarkerAtPlayhead}
        >
          <Flag size={14} />
        </button>
        <button
          className="icon-btn icon-btn-sm"
          aria-label="Alejar línea de tiempo"
          title="Alejar"
          onClick={() => ed.setTimelineZoom(zoom / 1.4)}
        >
          <Minus size={14} />
        </button>
        <button
          className="icon-btn icon-btn-sm"
          aria-label="Acercar línea de tiempo"
          title="Acercar"
          onClick={() => ed.setTimelineZoom(zoom * 1.4)}
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="tl-body">
        <div className="tl-names" style={{ width: NAME_W }}>
          <div style={{ height: RULER_H }} />
          {cameraKeys.length > 0 && (
            <div className="tl-name" style={{ height: LANE_H + ROW_PAD * 2 }}>
              <Video size={13} aria-hidden /> Cámara
            </div>
          )}
          {layers.map((l) => {
            const { lanes } = l.kind === 'frames' ? { lanes: 1 } : packBars(l.items ?? [], scene.duration, minTicks);
            return (
              <button
                key={l.id}
                className={`tl-name ${l.id === activeLayerId ? 'is-active' : ''}`}
                style={{ height: lanes * LANE_H + ROW_PAD * 2 }}
                onClick={() => ed.setActiveLayer(l.id)}
              >
                {l.name} <span className="layer-count">{layerItemCount(l)}</span>
              </button>
            );
          })}
          {project.audioTracks.map((t) => {
            const Icon = TRACK_ICONS[t.kind];
            return (
              <div key={t.id} className="tl-name tl-audio-name" style={{ height: AUDIO_ROW_H }}>
                <Icon size={13} aria-hidden /> {t.name}
                <button
                  className={`icon-btn icon-btn-xs ${t.muted ? 'is-on' : ''}`}
                  aria-pressed={t.muted}
                  aria-label={`Silenciar ${t.name}`}
                  title={t.muted ? 'Activar sonido' : 'Silenciar pista'}
                  onClick={() =>
                    updateTrack(t.id, t.muted ? 'Activar pista' : 'Silenciar pista', (x) => void (x.muted = !x.muted))
                  }
                >
                  {t.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                </button>
              </div>
            );
          })}
        </div>
        <div
          className="tl-scroll"
          ref={scrollRef}
          onPointerDown={onScrubDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) ed.setTimelineZoom(zoom * Math.exp(-e.deltaY * 0.002));
          }}
          onDragOver={(e) => {
            if (!hasFiles(e.dataTransfer)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={(e) => {
            if (!hasFiles(e.dataTransfer)) return;
            e.preventDefault();
            // Audio en el instante soltado; sobre una pista de audio, en esa pista.
            const row = (e.target as HTMLElement).closest<HTMLElement>('[data-track-kind]');
            void importDroppedFiles([...e.dataTransfer.files], {
              at: offset + snapToFrame(tickAt(e.clientX), fps),
              track: (row?.dataset.trackKind as TrackKind | undefined) ?? undefined,
            });
          }}
          data-testid="timeline-scroll"
        >
          <div className="tl-content" style={{ width }}>
            <div className="tl-ruler" style={{ height: RULER_H }}>
              {Array.from({ length: seconds + 1 }, (_, s) => (
                <span
                  key={s}
                  className={`tl-tick ${s % labelEvery === 0 ? 'is-major' : ''}`}
                  style={{ left: s * zoom }}
                >
                  {s % labelEvery === 0 ? formatTimecode(ticksFromSeconds(s), fps).slice(0, 5) : ''}
                </span>
              ))}
              <span className="tl-end" style={{ left: scene.duration * pxPerTick }} title="Fin de la escena" />
              {markersHere.map((m) => {
                const t = dragDelta?.kind === 'marker' && dragDelta.id === m.id ? m.t + dragDelta.dt : m.t;
                return (
                  <button
                    key={m.id}
                    className={`tl-marker ${m.id === markerId ? 'is-selected' : ''}`}
                    style={{ left: (t - offset) * pxPerTick }}
                    aria-label={`Marca «${m.label}»`}
                    title={`${m.label} · ${formatTimecode(t - offset, fps)}`}
                    data-testid="marker"
                    onPointerDown={(e) => startMarkerDrag(e, m.id, m.t)}
                  >
                    <span className="tl-marker-label">{m.label}</span>
                  </button>
                );
              })}
            </div>
            {cameraKeys.length > 0 && (
              <div className="tl-row" style={{ height: LANE_H + ROW_PAD * 2 }}>
                {cameraKeys.map((k) => (
                  <KeyButton
                    key={k}
                    t={k}
                    camera
                    style={{ left: k * pxPerTick, top: ROW_PAD + 2 }}
                    label={`Keyframe de cámara en ${formatTimecode(k, fps)}`}
                  />
                ))}
              </div>
            )}
            {layers.map(renderLayerRow)}
            {project.audioTracks.map((t) => (
              <div key={t.id} className="tl-row tl-audio-row" style={{ height: AUDIO_ROW_H }} data-track-kind={t.kind}>
                {t.clips.map((c) => renderClip(t, c))}
              </div>
            ))}
            {markersHere.map((m) => (
              <div key={m.id} className="tl-marker-line" style={{ left: (m.t - offset) * pxPerTick }} />
            ))}
            <PlayheadLine pxPerTick={pxPerTick} />
            <div className="tl-after-end" style={{ left: scene.duration * pxPerTick }} />
          </div>
        </div>
      </div>
    </section>
  );
}
