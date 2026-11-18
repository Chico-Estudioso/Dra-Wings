// Modo grabación de la narración. Es un panel sobre el lienzo (no una ventana modal) para que el vídeo
// se vea mientras se narra: cuenta atrás, grabación con la animación reproduciéndose, y la toma se
// coloca al momento en la pista de narración para escucharla con el vídeo o repetirla.
import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { Mic, Play, RotateCcw, Square, X } from 'lucide-react';
import { locateTime } from '@core/edit/scenes';
import { secondsFromTicks, type Ticks } from '@core/time/ticks';
import { useApp } from '../state/app-store';
import { useEditor } from './editor-store';
import { addAudio, deleteClip, globalPlayhead } from './media-actions';
import { MicError, NarrationRecorder, recordingToWav } from './recorder';

export const useRecordPanel = create<{ open: boolean }>(() => ({ open: false }));
export const openRecordPanel = () => useRecordPanel.setState({ open: true });

/** Duración máxima de una toma (después se detiene sola). */
const MAX_SECONDS = 20 * 60;
const COUNTDOWN = 3;

type Phase =
  | { kind: 'opening' }
  | { kind: 'ready' }
  | { kind: 'countdown'; n: number; at: Ticks }
  | { kind: 'recording'; started: number; at: Ticks }
  | { kind: 'processing' }
  | { kind: 'placed'; clipId: string; at: Ticks; seconds: number }
  | { kind: 'error'; message: string };

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Lleva el cabezal a un instante global (cambiando de escena si hace falta). */
function seekGlobal(t: Ticks) {
  const project = useApp.getState().doc?.project;
  if (!project) return;
  const { scene, local } = locateTime(project, t);
  const ed = useEditor.getState();
  if (scene.id !== ed.sceneId) ed.setScene(scene.id, scene.layers[scene.layers.length - 1]!.id);
  ed.setPlayhead(local);
}

function stopPlayback() {
  const ed = useEditor.getState();
  if (ed.playing) ed.setPlaying(false);
  if (ed.muteNarration) ed.setMuteNarration(false);
}

export function RecordPanel() {
  const open = useRecordPanel((s) => s.open);
  return open ? <Recorder onClose={() => useRecordPanel.setState({ open: false })} /> : null;
}

function Recorder({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'opening' });
  const [playAlong, setPlayAlong] = useState(true);
  const [mute, setMute] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const rec = useRef<NarrationRecorder | null>(null);
  const meter = useRef<HTMLSpanElement>(null);
  const meterBox = useRef<HTMLDivElement>(null);
  const hasNarration = useApp((s) => !!s.doc?.project.audioTracks.some((t) => t.kind === 'narration'));
  // Para que «Empieza en…» siga al cabezal.
  useEditor((s) => s.playhead);
  useEditor((s) => s.sceneId);

  // Abre el micrófono al entrar en el modo y lo libera al salir.
  useEffect(() => {
    let alive = true;
    NarrationRecorder.open().then(
      (r) => {
        if (!alive) return r.close();
        rec.current = r;
        setPhase({ kind: 'ready' });
      },
      (e: unknown) =>
        alive &&
        setPhase({ kind: 'error', message: e instanceof MicError ? e.message : 'No se pudo abrir el micrófono.' }),
    );
    return () => {
      alive = false;
      stopPlayback();
      rec.current?.close();
      rec.current = null;
    };
  }, []);

  // Medidor de nivel (sin re-renderizar: se actualiza el estilo directamente).
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const level = rec.current?.level() ?? 0;
      if (meter.current) meter.current.style.width = `${Math.round(level * 100)}%`;
      meterBox.current?.setAttribute('aria-valuenow', String(Math.round(level * 100)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const startCountdown = (at: Ticks) => {
    stopPlayback();
    seekGlobal(at);
    useEditor.getState().setPreview(true);
    setPhase({ kind: 'countdown', n: COUNTDOWN, at });
  };

  const finish = async () => {
    const r = rec.current;
    if (!r || phase.kind !== 'recording') return;
    stopPlayback();
    const at = phase.at;
    setPhase({ kind: 'processing' });
    try {
      const { bytes, seconds } = await recordingToWav(await r.stop());
      const stamp = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');
      const stored = await window.dw.importMediaBytes('audio', `Narración ${stamp}.wav`, bytes);
      if (stored.status !== 'ok')
        throw new Error(stored.status === 'error' ? stored.message : 'No se pudo guardar la grabación.');
      if (!(await addAudio('narration', stored, 'Grabar narración', at))) return setPhase({ kind: 'ready' });
      setPhase({ kind: 'placed', clipId: useEditor.getState().clipId ?? '', at, seconds });
    } catch (e) {
      setPhase({ kind: 'error', message: e instanceof Error ? e.message : 'No se pudo guardar la grabación.' });
    }
  };

  // Refs para los temporizadores y el teclado (siempre con el estado más reciente).
  const finishRef = useRef(finish);
  const optionsRef = useRef({ playAlong, mute });
  useEffect(() => {
    finishRef.current = finish;
    optionsRef.current = { playAlong, mute };
  });

  // Cuenta atrás y cronómetro.
  useEffect(() => {
    if (phase.kind === 'countdown') {
      const id = setTimeout(() => {
        if (phase.n > 1) return setPhase({ ...phase, n: phase.n - 1 });
        rec.current?.start();
        const ed = useEditor.getState();
        if (optionsRef.current.playAlong) {
          ed.setMuteNarration(optionsRef.current.mute);
          ed.setPreview(true);
          ed.setPlaying(true);
        }
        setElapsed(0);
        setPhase({ kind: 'recording', started: performance.now(), at: phase.at });
      }, 1000);
      return () => clearTimeout(id);
    }
    if (phase.kind === 'recording') {
      const id = setInterval(() => {
        const s = (performance.now() - phase.started) / 1000;
        setElapsed(s);
        if (s >= MAX_SECONDS) void finishRef.current();
      }, 250);
      return () => clearInterval(id);
    }
  }, [phase]);

  // Mientras graba, Intro, Espacio y Esc detienen la grabación (en vez de sus atajos habituales).
  useEffect(() => {
    if (phase.kind !== 'recording' && phase.kind !== 'countdown') return;
    const onKey = (e: KeyboardEvent) => {
      if (!['Enter', ' ', 'Escape'].includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      if (phase.kind === 'recording') void finishRef.current();
      else setPhase({ kind: 'ready' });
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [phase]);

  const listen = (at: Ticks) => {
    stopPlayback();
    seekGlobal(at);
    useEditor.getState().setPreview(true);
    useEditor.getState().setPlaying(true);
  };

  const retake = (p: Extract<Phase, { kind: 'placed' }>) => {
    deleteClip(p.clipId);
    startCountdown(p.at);
  };

  const busy = phase.kind === 'countdown' || phase.kind === 'recording' || phase.kind === 'processing';
  const actions =
    phase.kind === 'recording' ? (
      <button type="button" className="btn btn-primary btn-sm" onClick={() => void finish()}>
        <Square size={13} aria-hidden /> Detener
      </button>
    ) : phase.kind === 'placed' ? (
      <>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => listen(phase.at)}>
          <Play size={13} aria-hidden /> Escuchar con el vídeo
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => retake(phase)}>
          <RotateCcw size={13} aria-hidden /> Repetir toma
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            stopPlayback();
            setPhase({ kind: 'ready' });
          }}
        >
          <Mic size={13} aria-hidden /> Grabar otra
        </button>
      </>
    ) : phase.kind === 'error' ? null : (
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={phase.kind !== 'ready'}
        onClick={() => startCountdown(globalPlayhead())}
      >
        <span className="record-dot is-static" aria-hidden /> Grabar
      </button>
    );
  return (
    <>
      {busy && <div className="record-blocker" aria-hidden />}
      {phase.kind === 'countdown' && (
        <div className="record-countdown-overlay" aria-hidden>
          {phase.n}
        </div>
      )}
      <section className={`record-panel ${busy ? 'is-busy' : ''}`} role="region" aria-label="Grabar narración">
        <div className="record-row">
          <Mic size={16} aria-hidden className="record-icon" />
          <strong className="record-title">Grabar narración</strong>
          <span className="record-status" aria-live="polite" data-testid="record-status">
            {phase.kind === 'opening' && 'Abriendo el micrófono…'}
            {phase.kind === 'ready' && `Empieza en ${clock(secondsFromTicks(globalPlayhead()))} (el cabezal).`}
            {phase.kind === 'countdown' && `Prepárate… ${phase.n}`}
            {phase.kind === 'recording' && (
              <>
                <span className="record-dot" aria-hidden /> Grabando {clock(elapsed)} · Intro o Esc para detener
              </>
            )}
            {phase.kind === 'processing' && 'Procesando la toma…'}
            {phase.kind === 'placed' &&
              `Toma de ${phase.seconds.toFixed(1).replace('.', ',')} s colocada en ${clock(secondsFromTicks(phase.at))}.`}
            {phase.kind === 'error' && <span className="record-error">{phase.message}</span>}
          </span>
          {phase.kind !== 'error' && (
            <div
              ref={meterBox}
              className="mic-meter"
              role="meter"
              aria-label="Nivel del micrófono"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={0}
            >
              <span ref={meter} />
            </div>
          )}
          {actions}
          <button
            className="icon-btn icon-btn-sm"
            aria-label="Salir de la grabación"
            title="Salir de la grabación"
            disabled={phase.kind === 'recording' || phase.kind === 'processing'}
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        {(phase.kind === 'ready' || phase.kind === 'placed') && (
          <div className="record-options">
            <label className="check-field">
              <input type="checkbox" checked={playAlong} onChange={(e) => setPlayAlong(e.target.checked)} />
              Reproducir el vídeo mientras grabo
            </label>
            {hasNarration && (
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={mute}
                  disabled={!playAlong}
                  onChange={(e) => setMute(e.target.checked)}
                />
                Silenciar la narración que ya hay
              </label>
            )}
            <span className="hint">Mueve el cabezal para elegir dónde empieza.</span>
          </div>
        )}
      </section>
    </>
  );
}
