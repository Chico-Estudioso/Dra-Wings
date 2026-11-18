// Propiedades del clip de audio o de la marca seleccionados en la línea de tiempo.
import { useState } from 'react';
import { Drum, MessageCircle, Scissors, Trash2 } from 'lucide-react';
import { TRACK_NAMES } from '@core/audio/edit';
import type { Asset, Project } from '@core/model/types';
import { analyzeVoice, detectRhythm, useRhythm } from './rhythm-actions';
import { formatTimecode, secondsFromTicks, ticksFromSeconds } from '@core/time/ticks';
import { ValueSlider } from './controls';
import {
  deleteClip,
  deleteMarker,
  renameMarkerTo,
  setClipGain,
  setFades,
  splitClipAtPlayhead,
  updateTrack,
} from './media-actions';

const pct = (v: number) => `${Math.round(v * 100)} %`;
const secs = (v: number) => `${v.toFixed(1)} s`;

/** Deslizador que aplica el valor al soltar (un solo paso de deshacer). */
function CommitSlider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState<number | null>(null);
  return (
    <ValueSlider
      {...props}
      value={draft ?? props.value}
      onChange={setDraft}
      onCommit={(v) => {
        setDraft(null);
        props.onCommit(v);
      }}
    />
  );
}

export function AudioClipPanel({ project, clipId }: { project: Project; clipId: string }) {
  const track = project.audioTracks.find((t) => t.clips.some((c) => c.id === clipId));
  const clip = track?.clips.find((c) => c.id === clipId);
  if (!track || !clip) return null;
  const asset = project.assets.find((a) => a.id === clip.assetId);
  const fps = project.settings.fps;
  const maxFade = Math.max(0.1, Math.min(10, secondsFromTicks(clip.duration)));
  return (
    <section className="panel" aria-labelledby="clip-title">
      <header className="panel-header">
        <h2 id="clip-title" className="panel-title">
          {TRACK_NAMES[track.kind]}
        </h2>
      </header>
      <div className="panel-body">
        <p className="panel-note" title={asset?.name}>
          {asset?.name ?? 'Medio ausente'}
          <br />
          {formatTimecode(clip.start, fps)} · dura {secondsFromTicks(clip.duration).toFixed(2)} s
        </p>
        <CommitSlider
          label="Volumen del clip"
          value={clip.gain}
          min={0}
          max={2}
          step={0.05}
          format={pct}
          onCommit={(v) => setClipGain(clip.id, v)}
        />
        <CommitSlider
          label="Entrada suave"
          value={secondsFromTicks(clip.fadeIn)}
          min={0}
          max={maxFade}
          step={0.1}
          format={secs}
          onCommit={(v) => setFades(clip.id, { fadeIn: ticksFromSeconds(v) })}
        />
        <CommitSlider
          label="Salida suave"
          value={secondsFromTicks(clip.fadeOut)}
          min={0}
          max={maxFade}
          step={0.1}
          format={secs}
          onCommit={(v) => setFades(clip.id, { fadeOut: ticksFromSeconds(v) })}
        />
        <CommitSlider
          label={`Volumen de ${track.name.toLowerCase()}`}
          value={track.volume}
          min={0}
          max={2}
          step={0.05}
          format={pct}
          onCommit={(v) => updateTrack(track.id, 'Volumen de la pista', (t) => void (t.volume = v))}
        />
        {track.kind === 'music' && asset && <RhythmRow asset={asset} />}
        {track.kind === 'narration' && asset && <VoiceRow asset={asset} />}
        <div className="button-grid" role="group" aria-label="Clip de audio">
          <button
            className="icon-btn"
            title="Dividir en el cabezal"
            aria-label="Dividir en el cabezal"
            onClick={() => splitClipAtPlayhead(clip.id)}
          >
            <Scissors size={17} />
          </button>
          <button
            className="icon-btn"
            title="Eliminar (Supr)"
            aria-label="Eliminar audio"
            onClick={() => deleteClip(clip.id)}
          >
            <Trash2 size={17} />
          </button>
        </div>
      </div>
    </section>
  );
}

/** Voz analizada de la narración (para que los personajes hablen con ella). */
function VoiceRow({ asset }: { asset: Asset }) {
  const busy = useRhythm((s) => s.busy.has(asset.id));
  return (
    <div className="rhythm-row" role="group" aria-label="Voz">
      <MessageCircle size={15} aria-hidden />
      <span data-testid="voice-status">
        {busy ? 'Analizando la voz…' : asset.voice ? 'Voz lista para los personajes' : 'Voz sin analizar'}
      </span>
      {!asset.voice && (
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void analyzeVoice(asset.id)}>
          Analizar la voz
        </button>
      )}
    </div>
  );
}

/** Ritmo detectado de la música (para animar y cortar al compás). */
function RhythmRow({ asset }: { asset: Asset }) {
  const busy = useRhythm((s) => s.busy.has(asset.id));
  return (
    <div className="rhythm-row" role="group" aria-label="Ritmo">
      <Drum size={15} aria-hidden />
      <span data-testid="rhythm-status">
        {busy
          ? 'Analizando el ritmo…'
          : asset.beats
            ? `${asset.beats.bpm.toFixed(0)} BPM · ${asset.beats.ticks.length} golpes`
            : 'Sin ritmo detectado'}
      </span>
      <button
        className="btn btn-ghost btn-sm"
        disabled={busy}
        title="Busca los golpes de la canción para animar y cortar al ritmo"
        onClick={() => void detectRhythm(asset.id)}
      >
        {asset.beats ? 'Volver a detectar' : 'Detectar ritmo'}
      </button>
    </div>
  );
}

export function MarkerPanel({ project, markerId }: { project: Project; markerId: string }) {
  const marker = project.markers.find((m) => m.id === markerId);
  const [draft, setDraft] = useState<string | null>(null);
  if (!marker) return null;
  const commit = () => {
    if (draft !== null && draft.trim() && draft.trim() !== marker.label) renameMarkerTo(marker.id, draft);
    setDraft(null);
  };
  return (
    <section className="panel" aria-labelledby="marker-title">
      <header className="panel-header">
        <h2 id="marker-title" className="panel-title">
          Marca
        </h2>
      </header>
      <div className="panel-body">
        <label className="field">
          <span className="control-label">Nombre</span>
          <input
            className="input input-sm"
            aria-label="Nombre de la marca"
            value={draft ?? marker.label}
            maxLength={200}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') setDraft(null);
            }}
          />
        </label>
        <p className="panel-note">
          En {formatTimecode(marker.t, project.settings.fps)} del vídeo. Arrastra la marca en la regla para moverla; los
          elementos y el audio se pegan a ella.
        </p>
        <div className="button-grid" role="group" aria-label="Marca">
          <button
            className="icon-btn"
            title="Eliminar (Supr)"
            aria-label="Eliminar marca"
            onClick={() => deleteMarker(marker.id)}
          >
            <Trash2 size={17} />
          </button>
        </div>
      </div>
    </section>
  );
}
