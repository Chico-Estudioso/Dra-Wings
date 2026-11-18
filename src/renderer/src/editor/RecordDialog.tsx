// Diálogo para grabar la narración con el micrófono: nivel de entrada, cuenta atrás, grabación con la
// animación reproduciéndose (opcional), escucha previa y «Usar grabación».
import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { create } from 'zustand';
import { Mic, Square } from 'lucide-react';
import { secondsFromTicks } from '@core/time/ticks';
import { useEditor } from './editor-store';
import { addAudio, globalPlayhead } from './media-actions';
import { MicError, NarrationRecorder, recordingToWav } from './recorder';

export const useRecordDialog = create<{ open: boolean }>(() => ({ open: false }));
export const openRecordDialog = () => useRecordDialog.setState({ open: true });

/** Duración máxima de una toma (después se detiene sola). */
const MAX_SECONDS = 20 * 60;
const COUNTDOWN = 3;

type Phase =
  | { kind: 'opening' }
  | { kind: 'ready' }
  | { kind: 'countdown'; n: number }
  | { kind: 'recording'; started: number; at: number }
  | { kind: 'review'; wav: Uint8Array<ArrayBuffer>; url: string; at: number }
  | { kind: 'saving' }
  | { kind: 'error'; message: string };

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function stopPlayback() {
  if (useEditor.getState().playing) useEditor.getState().setPlaying(false);
}

export function RecordDialog() {
  const open = useRecordDialog((s) => s.open);
  return (
    <Dialog.Root open={open} onOpenChange={(o) => useRecordDialog.setState({ open: o })}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog" aria-describedby={undefined}>
          <Dialog.Title className="dialog-title">Grabar narración</Dialog.Title>
          {open && <Recorder onDone={() => useRecordDialog.setState({ open: false })} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Recorder({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'opening' });
  const [playAlong, setPlayAlong] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const rec = useRef<NarrationRecorder | null>(null);
  const meter = useRef<HTMLSpanElement>(null);
  const meterBox = useRef<HTMLDivElement>(null);

  // Abre el micrófono al mostrar el diálogo y lo libera al cerrarlo.
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

  const finish = async () => {
    const r = rec.current;
    if (!r || phase.kind !== 'recording') return;
    stopPlayback();
    const at = phase.at;
    setPhase({ kind: 'saving' });
    try {
      // Se convierte ya: la escucha previa es exactamente lo que se guardará (y con su duración,
      // que los WebM de MediaRecorder no traen).
      const { bytes } = await recordingToWav(await r.stop());
      setPhase({ kind: 'review', wav: bytes, url: URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' })), at });
    } catch {
      setPhase({ kind: 'error', message: 'No se pudo procesar la grabación. Vuelve a intentarlo.' });
    }
  };
  const finishRef = useRef(finish);
  const playAlongRef = useRef(playAlong);
  useEffect(() => {
    finishRef.current = finish;
    playAlongRef.current = playAlong;
  });

  // Cuenta atrás y cronómetro.
  useEffect(() => {
    if (phase.kind === 'countdown') {
      const id = setTimeout(() => {
        if (phase.n > 1) return setPhase({ kind: 'countdown', n: phase.n - 1 });
        const at = globalPlayhead();
        rec.current?.start();
        if (playAlongRef.current) {
          useEditor.getState().setPreview(true);
          useEditor.getState().setPlaying(true);
        }
        setElapsed(0);
        setPhase({ kind: 'recording', started: performance.now(), at });
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

  useEffect(() => () => void (phase.kind === 'review' && URL.revokeObjectURL(phase.url)), [phase]);

  const use = async () => {
    if (phase.kind !== 'review') return;
    const { wav, at } = phase;
    setPhase({ kind: 'saving' });
    try {
      const stamp = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');
      const r = await window.dw.importMediaBytes('audio', `Narración ${stamp}.wav`, wav);
      if (r.status !== 'ok') throw new Error(r.status === 'error' ? r.message : 'No se pudo guardar la grabación.');
      if (await addAudio('narration', r, 'Grabar narración', at)) onDone();
      else setPhase({ kind: 'ready' });
    } catch (e) {
      setPhase({ kind: 'error', message: e instanceof Error ? e.message : 'No se pudo guardar la grabación.' });
    }
  };

  const startAt = phase.kind === 'recording' || phase.kind === 'review' ? phase.at : globalPlayhead();
  const busy = phase.kind === 'countdown' || phase.kind === 'recording' || phase.kind === 'saving';
  return (
    <div className="form">
      {phase.kind === 'error' ? (
        <p className="form-error" role="alert">
          {phase.message}
        </p>
      ) : (
        <>
          <p className="hint">
            La grabación se coloca en la pista de narración, en {clock(secondsFromTicks(startAt))} del vídeo (el
            cabezal).
          </p>
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
          <label className="check-field">
            <input
              type="checkbox"
              checked={playAlong}
              disabled={busy}
              onChange={(e) => setPlayAlong(e.target.checked)}
            />
            Reproducir la animación mientras grabo
          </label>
          <p className="record-status" aria-live="polite" data-testid="record-status">
            {phase.kind === 'opening' && 'Abriendo el micrófono…'}
            {phase.kind === 'ready' && 'Listo para grabar.'}
            {phase.kind === 'countdown' && <span className="record-countdown">{phase.n}</span>}
            {phase.kind === 'recording' && (
              <>
                <span className="record-dot" aria-hidden /> Grabando {clock(elapsed)}
              </>
            )}
            {phase.kind === 'review' && 'Escucha la toma y decide si la usas.'}
            {phase.kind === 'saving' && 'Procesando la grabación…'}
          </p>
          {phase.kind === 'review' && <audio className="record-preview" controls src={phase.url} />}
        </>
      )}
      <div className="dialog-actions">
        {phase.kind === 'recording' ? (
          <button type="button" className="btn btn-primary" onClick={() => void finish()}>
            <Square size={14} aria-hidden /> Detener
          </button>
        ) : phase.kind === 'review' ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setPhase({ kind: 'ready' })}>
              Volver a grabar
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void use()}>
              Usar grabación
            </button>
          </>
        ) : (
          <>
            <Dialog.Close type="button" className="btn btn-ghost" disabled={busy}>
              {phase.kind === 'error' ? 'Cerrar' : 'Cancelar'}
            </Dialog.Close>
            {phase.kind !== 'error' && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={phase.kind !== 'ready'}
                onClick={() => setPhase({ kind: 'countdown', n: COUNTDOWN })}
              >
                <Mic size={16} aria-hidden /> Grabar
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
