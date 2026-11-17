import { useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  Eye,
  Layers,
  Minus,
  Pause,
  Play,
  Plus,
  SkipBack,
  Trash2,
  Video,
} from 'lucide-react';
import { keyTimes, transformKeyTimes } from '@core/anim/keyframes';
import { celAt, layerItemCount } from '@core/edit/ops';
import type { Item, Layer, Project, Scene } from '@core/model/types';
import {
  formatTimecode,
  secondsFromTicks,
  snapToFrame,
  TICKS_PER_SECOND,
  ticksFromSeconds,
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
import { togglePlay } from './playback';

const NAME_W = 150;
const RULER_H = 24;
const LANE_H = 12;
const ROW_PAD = 5;
const MIN_BAR_PX = 6;

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

type Drag = { kind: 'shift' | 'duration'; x0: number; id: string; base: number } | { kind: 'scrub' };

function SceneTabs({ project, sceneId }: { project: Project; sceneId: string }) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  return (
    <div className="tl-scenes" role="tablist" aria-label="Escenas">
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

/** Tirador para cambiar el alto de la línea de tiempo (arrastrar o flechas). */
function TimelineResizer() {
  const start = useRef<{ y: number; h: number } | null>(null);
  const current = () =>
    document.querySelector<HTMLElement>('.timeline')?.getBoundingClientRect().height ?? TIMELINE_MIN_H;
  const set = (h: number) => useEditor.getState().setTimelineHeight(Math.min(h, window.innerHeight * 0.6));
  return (
    <div
      className="tl-resizer"
      role="separator"
      aria-orientation="horizontal"
      aria-label="Alto de la línea de tiempo"
      aria-valuenow={Math.round(useEditor.getState().timelineHeight ?? 0) || undefined}
      tabIndex={0}
      title="Arrastra para cambiar el alto"
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
  const playhead = useEditor((s) => s.playhead);
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
  const [dragDelta, setDragDelta] = useState<{ id: string; kind: 'shift' | 'duration'; dt: number } | null>(null);

  const pxPerTick = zoom / TICKS_PER_SECOND;
  const width = Math.max(scene.duration * pxPerTick + 120, 400);
  const minTicks = MIN_BAR_PX / pxPerTick;
  const layers = [...scene.layers].reverse();
  const selected = useMemo(() => new Set(selection), [selection]);
  const cameraKeys = transformKeyTimes(scene.camera);
  const activeLayer = scene.layers.find((l) => l.id === activeLayerId);
  const hasFrames = scene.layers.some((l) => l.kind === 'frames');

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
    const dt = snapToFrame((e.clientX - d.x0) / pxPerTick, fps);
    setDragDelta({ id: d.id, kind: d.kind, dt });
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.kind === 'scrub' || !dragDelta) {
      setDragDelta(null);
      return;
    }
    if (d.kind === 'shift') shiftItemsTime(selection.includes(d.id) ? selection : [d.id], dragDelta.dt);
    else setEnterDuration(d.id, Math.max(snapToFrame(d.base + dragDelta.dt, fps), TICKS_PER_SECOND / fps));
    setDragDelta(null);
  };

  const startBarDrag = (e: React.PointerEvent, bar: Bar, kind: 'shift' | 'duration') => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const id = bar.item.id;
    if (e.shiftKey) ed.select(selected.has(id) ? selection.filter((x) => x !== id) : [...selection, id]);
    else if (!selected.has(id)) ed.select([id]);
    ed.setTool('select');
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { kind, x0: e.clientX, id, base: bar.item.enter?.duration ?? 0 };
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
            <button
              key={c.id}
              className={`tl-cel ${celAt(layer, playhead) === c ? 'is-current' : ''}`}
              style={{ left: c.start * pxPerTick, width: Math.max(4, c.duration * pxPerTick - 1), top: ROW_PAD }}
              title={`Fotograma ${i + 1}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                ed.setActiveLayer(layer.id);
                ed.setPlayhead(c.start);
              }}
            >
              {c.duration * pxPerTick > 16 ? i + 1 : ''}
            </button>
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
                title={`${b.item.name ?? nameOf(b.item)} · aparece en ${formatTimecode(b.start, fps)}`}
                data-testid="timeline-bar"
                onPointerDown={(e) => startBarDrag(e, b, 'shift')}
              >
                <span className="tl-bar-handle" onPointerDown={(e) => startBarDrag(e, b, 'duration')} />
              </div>
              <div className="tl-tail" style={{ left: drawW, width: tailW }} />
              {isSel &&
                keyTimes(b.item).map((k) => (
                  <button
                    key={k}
                    className={`tl-key ${k === playhead ? 'is-current' : ''}`}
                    style={{ left: (k - b.start) * pxPerTick }}
                    aria-label={`Keyframe en ${formatTimecode(k, fps)}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => ed.setPlayhead(k)}
                  />
                ))}
            </div>
          );
        })}
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
        <span className="tl-time" data-testid="timeline-time">
          {formatTimecode(playhead, fps)} / {formatTimecode(scene.duration, fps)}
        </span>
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
            </div>
            {cameraKeys.length > 0 && (
              <div className="tl-row" style={{ height: LANE_H + ROW_PAD * 2 }}>
                {cameraKeys.map((k) => (
                  <button
                    key={k}
                    className={`tl-key tl-key-camera ${k === playhead ? 'is-current' : ''}`}
                    style={{ left: k * pxPerTick, top: ROW_PAD + 2 }}
                    aria-label={`Keyframe de cámara en ${formatTimecode(k, fps)}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => ed.setPlayhead(k)}
                  />
                ))}
              </div>
            )}
            {layers.map(renderLayerRow)}
            <div className="tl-playhead" style={{ left: playhead * pxPerTick }} />
            <div className="tl-after-end" style={{ left: scene.duration * pxPerTick }} />
          </div>
        </div>
      </div>
    </section>
  );
}

function nameOf(item: Item): string {
  switch (item.type) {
    case 'stroke':
      return 'Trazo';
    case 'shape':
      return 'Forma';
    case 'text':
      return `Texto «${item.text.slice(0, 20)}»`;
    case 'group':
      return 'Grupo';
  }
}
