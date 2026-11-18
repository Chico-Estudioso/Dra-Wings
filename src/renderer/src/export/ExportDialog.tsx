// Diálogo de exportación: ajustes, progreso con cancelación y resultado.
import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as RadioGroup from '@radix-ui/react-radio-group';
import { create } from 'zustand';
import { AlertTriangle, CheckCircle2, FolderOpen, ImageDown } from 'lucide-react';
import {
  defaultExportSettings,
  exportSize,
  planExport,
  type ExportQuality,
  type ExportSettings,
  type Resolution,
} from '@core/export/plan';
import type { Project } from '@core/model/types';
import { secondsFromTicks, SUPPORTED_FPS, type Fps } from '@core/time/ticks';
import type { ImageSaveResult } from '@shared/ipc';
import { useEditor } from '../editor/editor-store';
import { saveFrameImage } from './frame-image';
import {
  hasAudibleClips,
  probeCodecs,
  startExport,
  type ExportOutcome,
  type ExportRun,
  type ExportStatus,
} from './run-export';

export const useExportDialog = create<{ open: boolean }>(() => ({ open: false }));
export const openExportDialog = () => useExportDialog.setState({ open: true });

const QUALITIES: { id: ExportQuality; label: string; sub: string }[] = [
  { id: 'normal', label: 'Normal', sub: 'Archivo más ligero' },
  { id: 'high', label: 'Alta', sub: 'Recomendada' },
  { id: 'max', label: 'Máxima', sub: 'Archivo más grande' },
];

const CODEC_NAMES: Record<string, string> = { avc: 'H.264', vp9: 'VP9', av1: 'AV1', aac: 'AAC', opus: 'Opus' };

export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

type View =
  | { kind: 'settings'; error?: string }
  | { kind: 'running'; run: ExportRun; status: ExportStatus; started: number; now: number }
  | { kind: 'result'; outcome: ExportOutcome }
  | { kind: 'saving-frame' }
  | { kind: 'frame'; result: Exclude<ImageSaveResult, { status: 'canceled' }> };

export function ExportDialog({ project }: { project: Project }) {
  const open = useExportDialog((s) => s.open);
  const [settings, setSettings] = useState<ExportSettings>(() => defaultExportSettings(project));
  const [view, setView] = useState<View>({ kind: 'settings' });
  const running = view.kind === 'running' || view.kind === 'saving-frame';
  const runRef = useRef<ExportRun | null>(null);

  // Al cerrar la ventana del editor o salir del proyecto con una exportación en marcha, se cancela.
  useEffect(() => () => runRef.current?.cancel(), []);

  const setOpen = (o: boolean) => {
    if (running) return;
    useExportDialog.setState({ open: o });
    if (!o) setView({ kind: 'settings' });
  };

  const plan = planExport(project, settings);
  const hasAudio = hasAudibleClips(project);
  const [probe, setProbe] = useState<{ key: string; video: string | null; audio: string | null } | null>(null);
  const probeKey = `${plan.width}x${plan.height}`;
  useEffect(() => {
    if (!open) return;
    let alive = true;
    probeCodecs(plan.width, plan.height).then(
      (c) => alive && setProbe({ key: probeKey, ...c }),
      () => alive && setProbe({ key: probeKey, video: null, audio: null }),
    );
    return () => {
      alive = false;
    };
  }, [open, plan.width, plan.height, probeKey]);
  const codecs = probe?.key === probeKey ? probe : null;

  const start = async () => {
    const started = performance.now();
    try {
      const run = await startExport(project, settings, (status) =>
        setView((v) => (v.kind === 'running' ? { ...v, status, now: performance.now() } : v)),
      );
      if (!run) return;
      runRef.current = run;
      setView({ kind: 'running', run, status: { phase: 'preparing' }, started, now: started });
      const outcome = await run.result;
      runRef.current = null;
      setView({ kind: 'result', outcome });
    } catch (e) {
      setView({ kind: 'settings', error: e instanceof Error ? e.message : 'No se pudo empezar la exportación.' });
    }
  };

  const saveFrame = async () => {
    const { sceneId, playhead } = useEditor.getState();
    setView({ kind: 'saving-frame' });
    const result = await saveFrameImage(project, sceneId, playhead, settings.resolution);
    setView(result.status === 'canceled' ? { kind: 'settings' } : { kind: 'frame', result });
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog"
          aria-describedby={undefined}
          onEscapeKeyDown={(e) => running && e.preventDefault()}
          onPointerDownOutside={(e) => running && e.preventDefault()}
        >
          <Dialog.Title className="dialog-title">Exportar vídeo</Dialog.Title>
          {view.kind === 'settings' && (
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                void start();
              }}
            >
              <fieldset className="field">
                <legend className="field-label">Resolución</legend>
                <RadioGroup.Root
                  className="choice-row"
                  value={settings.resolution}
                  onValueChange={(v) => setSettings({ ...settings, resolution: v as Resolution })}
                  aria-label="Resolución"
                >
                  {(['720p', '1080p'] as Resolution[]).map((r) => {
                    const size = exportSize(project.settings, r);
                    return (
                      <RadioGroup.Item key={r} value={r} className="choice">
                        <span className="choice-title">{r === '720p' ? 'HD' : 'Full HD'}</span>
                        <span className="choice-sub">
                          {size.width} × {size.height}
                        </span>
                      </RadioGroup.Item>
                    );
                  })}
                </RadioGroup.Root>
              </fieldset>
              <fieldset className="field">
                <legend className="field-label">Calidad</legend>
                <RadioGroup.Root
                  className="choice-row"
                  value={settings.quality}
                  onValueChange={(v) => setSettings({ ...settings, quality: v as ExportQuality })}
                  aria-label="Calidad"
                >
                  {QUALITIES.map((q) => (
                    <RadioGroup.Item key={q.id} value={q.id} className="choice">
                      <span className="choice-title">{q.label}</span>
                      <span className="choice-sub">{q.sub}</span>
                    </RadioGroup.Item>
                  ))}
                </RadioGroup.Root>
              </fieldset>
              <label className="field">
                <span className="field-label">Fotogramas por segundo</span>
                <select
                  className="input"
                  value={settings.fps}
                  onChange={(e) => setSettings({ ...settings, fps: Number(e.target.value) as Fps })}
                >
                  {SUPPORTED_FPS.map((f) => (
                    <option key={f} value={f}>
                      {f} fps{f === project.settings.fps ? ' (el del proyecto)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <p className="hint" data-testid="export-summary">
                MP4 de {clock(secondsFromTicks(plan.duration))} ({plan.frames} fotogramas),{' '}
                {hasAudio ? 'con el audio del proyecto' : 'sin audio'}. Todas las escenas, con su cámara.
              </p>
              {codecs && (
                <p className="hint" data-testid="export-codecs">
                  {codecs.video
                    ? `Formato: ${codecLabel({ video: codecs.video, audio: hasAudio ? codecs.audio : null })}.`
                    : 'Este equipo no puede codificar vídeo de este tamaño.'}
                  {hasAudio &&
                    codecs.audio === 'opus' &&
                    ' Este equipo no tiene codificador AAC: el audio irá en Opus, que algunos reproductores antiguos no admiten.'}
                </p>
              )}
              {view.error && (
                <p className="form-error" role="alert">
                  {view.error}
                </p>
              )}
              <div className="dialog-actions">
                <button
                  type="button"
                  className="btn btn-ghost action-start"
                  title="Guarda como imagen PNG lo que se ve en el cabezal, a la resolución elegida"
                  onClick={() => void saveFrame()}
                >
                  <ImageDown size={16} aria-hidden /> Guardar este fotograma…
                </button>
                <Dialog.Close type="button" className="btn btn-ghost">
                  Cancelar
                </Dialog.Close>
                <button type="submit" className="btn btn-primary" disabled={codecs?.video === null}>
                  Exportar…
                </button>
              </div>
            </form>
          )}
          {view.kind === 'running' && <Progress view={view} />}
          {view.kind === 'saving-frame' && (
            <p className="hint" role="status">
              Guardando el fotograma…
            </p>
          )}
          {view.kind === 'frame' && <FrameResult result={view.result} onClose={() => setOpen(false)} />}
          {view.kind === 'result' && <Result outcome={view.outcome} onClose={() => setOpen(false)} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function codecLabel(c: { video: string; audio: string | null } | null): string | null {
  if (!c) return null;
  const v = CODEC_NAMES[c.video] ?? c.video;
  return c.audio ? `${v} + ${CODEC_NAMES[c.audio] ?? c.audio}` : v;
}

function Progress({ view }: { view: Extract<View, { kind: 'running' }> }) {
  const { status, run, started, now } = view;
  const done = status.phase === 'rendering' ? status.done : status.phase === 'finishing' ? run.plan.frames : 0;
  const total = run.plan.frames;
  const elapsed = (now - started) / 1000;
  const remaining = done > 0 ? (elapsed / done) * (total - done) : null;
  const label =
    status.phase === 'preparing'
      ? 'Preparando imágenes y audio…'
      : status.phase === 'finishing'
        ? 'Terminando el archivo…'
        : `Fotograma ${done} de ${total}${remaining !== null ? ` · quedan unos ${clock(remaining)}` : ''}`;
  const codecs = status.phase === 'rendering' ? codecLabel(status.codecs) : null;
  return (
    <div className="form">
      <p className="hint">
        Exportando <strong>{run.fileName}</strong>
        {codecs ? ` (${codecs})` : ''}
      </p>
      <div
        className="progress"
        role="progressbar"
        aria-label="Progreso de la exportación"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <span style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <p className="hint" aria-live="polite">
        {label}
      </p>
      <div className="dialog-actions">
        <button type="button" className="btn btn-ghost" onClick={run.cancel}>
          Cancelar exportación
        </button>
      </div>
    </div>
  );
}

function FrameResult({
  result,
  onClose,
}: {
  result: Exclude<ImageSaveResult, { status: 'canceled' }>;
  onClose: () => void;
}) {
  return (
    <div className="form">
      {result.status === 'ok' ? (
        <p className="export-result" role="status">
          <CheckCircle2 size={20} aria-hidden /> Imagen guardada: <strong>{result.fileName}</strong>
        </p>
      ) : (
        <p className="form-error" role="alert">
          <AlertTriangle size={16} aria-hidden /> {result.message}
        </p>
      )}
      <div className="dialog-actions">
        {result.status === 'ok' && (
          <button type="button" className="btn btn-ghost" onClick={() => void window.dw.exportReveal()}>
            <FolderOpen size={16} aria-hidden /> Mostrar en la carpeta
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

function Result({ outcome, onClose }: { outcome: ExportOutcome; onClose: () => void }) {
  return (
    <div className="form">
      {outcome.status === 'ok' ? (
        <>
          <p className="export-result" role="status">
            <CheckCircle2 size={20} aria-hidden /> Vídeo exportado: <strong>{outcome.fileName}</strong>
          </p>
          <p className="hint">
            {codecLabel(outcome.codecs)} · en {clock(outcome.seconds)}.
            {outcome.codecs?.audio === 'opus' &&
              ' Este equipo no tiene codificador AAC: el audio va en Opus, que algunos reproductores antiguos no admiten.'}
          </p>
        </>
      ) : outcome.status === 'canceled' ? (
        <p className="hint" role="status">
          Exportación cancelada. No se ha creado ningún archivo.
        </p>
      ) : (
        <p className="form-error" role="alert">
          <AlertTriangle size={16} aria-hidden /> {outcome.message}
        </p>
      )}
      <div className="dialog-actions">
        {outcome.status === 'ok' && (
          <button type="button" className="btn btn-ghost" onClick={() => void window.dw.exportReveal()}>
            <FolderOpen size={16} aria-hidden /> Mostrar en la carpeta
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
