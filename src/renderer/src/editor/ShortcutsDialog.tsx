// Hoja de atajos de teclado (tecla ? o F1, o el botón del teclado en la barra de estado).
import * as Dialog from '@radix-ui/react-dialog';
import { create } from 'zustand';
import { TOOLS } from './Toolbar';

export const useShortcutsDialog = create<{ open: boolean }>(() => ({ open: false }));
export const openShortcuts = () => useShortcutsDialog.setState({ open: true });

const GROUPS: { title: string; items: [keys: string, action: string][] }[] = [
  { title: 'Herramientas', items: TOOLS.map((t) => [t.key, t.label]) },
  {
    title: 'Edición',
    items: [
      ['Ctrl+Z / Ctrl+Y', 'Deshacer / rehacer'],
      ['Ctrl+D', 'Duplicar'],
      ['Ctrl+G / Ctrl+Mayús+G', 'Agrupar / desagrupar'],
      ['Ctrl+A', 'Seleccionar todo'],
      ['Supr', 'Eliminar (también el audio o la marca seleccionados)'],
      ['Esc', 'Deseleccionar'],
      ['Flechas / Mayús+flechas', 'Mover 1 px / 10 px'],
      ['[ y ]', 'Grosor del lápiz o de la goma'],
      ['Alt al arrastrar', 'Sin guías ni ajuste magnético'],
    ],
  },
  {
    title: 'Vista',
    items: [
      ['Ctrl+rueda, Ctrl++ y Ctrl+-', 'Zoom'],
      ['Ctrl+0', 'Ajustar a la ventana'],
      ['Espacio (mantener)', 'Desplazar el lienzo'],
    ],
  },
  {
    title: 'Línea de tiempo',
    items: [
      ['Intro', 'Reproducir / pausa'],
      ['Inicio', 'Ir al inicio de la escena'],
      [', y .', 'Fotograma anterior / siguiente'],
      ['Mayús+, y Mayús+.', 'Keyframe anterior / siguiente'],
      ['M', 'Añadir marca en el cabezal'],
    ],
  },
  {
    title: 'Archivo',
    items: [
      ['Ctrl+S / Ctrl+Mayús+S', 'Guardar / guardar como'],
      ['Ctrl+E', 'Exportar vídeo'],
      ['Ctrl+N / Ctrl+O', 'Nuevo / abrir proyecto'],
      ['? o F1', 'Esta hoja de atajos'],
    ],
  },
];

export function ShortcutsDialog() {
  const open = useShortcutsDialog((s) => s.open);
  return (
    <Dialog.Root open={open} onOpenChange={(o) => useShortcutsDialog.setState({ open: o })}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog dialog-wide" aria-describedby={undefined}>
          <Dialog.Title className="dialog-title">Atajos de teclado</Dialog.Title>
          <div className="shortcut-groups">
            {GROUPS.map((g) => (
              <section key={g.title} aria-label={g.title}>
                <h3 className="panel-subtitle">{g.title}</h3>
                <dl className="shortcut-list">
                  {g.items.map(([keys, action]) => (
                    <div key={action}>
                      <dt>
                        <kbd>{keys}</kbd>
                      </dt>
                      <dd>{action}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
          <div className="dialog-actions">
            <Dialog.Close className="btn btn-primary">Cerrar</Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
