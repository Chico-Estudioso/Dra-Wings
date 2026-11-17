import * as Dialog from '@radix-ui/react-dialog';
import { useApp } from '../state/app-store';
import { saveCurrent } from '../state/doc-actions';
import { useLeaveGuard } from '../state/leave-guard';

export function LeaveDialog() {
  const pending = useLeaveGuard((s) => s.pending);
  const clear = useLeaveGuard((s) => s.clear);
  const name = useApp((s) => s.doc?.project.name ?? 'Proyecto');

  const proceed = () => {
    const action = pending;
    clear();
    action?.();
  };

  return (
    <Dialog.Root open={!!pending} onOpenChange={(open) => !open && clear()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog dialog-small">
          <Dialog.Title className="dialog-title">Cambios sin guardar</Dialog.Title>
          <Dialog.Description className="dialog-text">
            ¿Quieres guardar los cambios de «{name}» antes de continuar?
          </Dialog.Description>
          <div className="dialog-actions">
            <Dialog.Close className="btn btn-ghost">Cancelar</Dialog.Close>
            <button
              className="btn btn-secondary"
              onClick={async () => {
                const doc = useApp.getState().doc;
                if (doc) await window.dw.discardRecovery(doc.project.id);
                proceed();
              }}
            >
              No guardar
            </button>
            <button
              className="btn btn-primary"
              onClick={async () => {
                if (await saveCurrent(false)) proceed();
                else clear();
              }}
            >
              Guardar
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
