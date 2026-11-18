// Pregunta a qué pista va el audio soltado fuera de una pista concreta.
import * as Dialog from '@radix-ui/react-dialog';
import { AudioLines, Mic, Music } from 'lucide-react';
import type { TrackKind } from '@core/audio/edit';
import { addAudioFiles, usePendingAudio } from './drop-files';

const OPTIONS: { kind: TrackKind; label: string; icon: typeof Mic }[] = [
  { kind: 'narration', label: 'Narración (voz)', icon: Mic },
  { kind: 'music', label: 'Música', icon: Music },
  { kind: 'sfx', label: 'Efecto de sonido', icon: AudioLines },
];

export function AudioDropChooser() {
  const { files, at } = usePendingAudio();
  const close = () => usePendingAudio.setState({ files: [], at: null });
  const choose = (kind: TrackKind) => {
    close();
    void addAudioFiles(files, kind, at ?? undefined);
  };
  return (
    <Dialog.Root open={files.length > 0} onOpenChange={(o) => !o && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog dialog-narrow" aria-describedby="drop-audio-desc">
          <Dialog.Title className="dialog-title">¿En qué pista va el audio?</Dialog.Title>
          <p id="drop-audio-desc" className="hint">
            {files.length === 1 ? `«${files[0]!.name}»` : `${files.length} archivos de audio`}. Se colocará donde lo
            soltaste.
          </p>
          <div className="choice-col">
            {OPTIONS.map(({ kind, label, icon: Icon }) => (
              <button key={kind} type="button" className="choice choice-wide" onClick={() => choose(kind)}>
                <Icon size={18} aria-hidden /> <span className="choice-title">{label}</span>
              </button>
            ))}
          </div>
          <div className="dialog-actions">
            <Dialog.Close type="button" className="btn btn-ghost">
              Cancelar
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
