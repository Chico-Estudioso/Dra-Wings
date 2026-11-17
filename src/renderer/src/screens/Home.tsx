import { useCallback, useEffect, useState } from 'react';
import { FileWarning, FolderOpen, History, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import type { RecentEntry, RecoveryEntry } from '@shared/ipc';
import { useApp } from '../state/app-store';
import { openRecent, openWithDialog, restoreRecovery } from '../state/doc-actions';
import { relativeTime } from '../format';

export function Home() {
  const setNewProjectOpen = useApp((s) => s.setNewProjectOpen);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [recovery, setRecovery] = useState<RecoveryEntry[]>([]);

  const refresh = useCallback(async () => {
    const [r, rec] = await Promise.all([window.dw.listRecent(), window.dw.listRecovery()]);
    setRecent(r);
    setRecovery(rec);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde el proceso principal
    void refresh();
  }, [refresh]);

  return (
    <main className="home">
      <header className="home-header">
        <h1 className="brand">
          Dra<span className="brand-dash">-</span>Wings
        </h1>
        <p className="tagline">Cuenta tu historia dibujando, aunque no sepas dibujar.</p>
      </header>

      {recovery.length > 0 && (
        <section className="recovery" aria-labelledby="recovery-title">
          <h2 id="recovery-title" className="section-title">
            <History size={18} aria-hidden /> Trabajo sin guardar
          </h2>
          <ul className="list">
            {recovery.map((r) => (
              <li key={r.projectId} className="list-item recovery-item">
                <div className="list-main">
                  <span className="list-title">{r.name}</span>
                  <span className="list-sub">
                    {r.filePath ? 'Cambios posteriores al último guardado' : 'Proyecto nunca guardado'} ·{' '}
                    {relativeTime(r.savedAt)}
                  </span>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => void restoreRecovery(r.projectId)}>
                  <RotateCcw size={16} aria-hidden /> Restaurar
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={async () => {
                    await window.dw.discardRecovery(r.projectId);
                    void refresh();
                  }}
                >
                  <Trash2 size={16} aria-hidden /> Descartar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="home-actions">
        <button className="btn btn-primary btn-lg" onClick={() => setNewProjectOpen(true)}>
          <Plus size={20} aria-hidden /> Nuevo proyecto
        </button>
        <button className="btn btn-secondary btn-lg" onClick={() => void openWithDialog()}>
          <FolderOpen size={20} aria-hidden /> Abrir proyecto…
        </button>
      </div>

      <section aria-labelledby="recent-title" className="recent">
        <h2 id="recent-title" className="section-title">
          Recientes
        </h2>
        {recent.length === 0 ? (
          <p className="empty">Aquí aparecerán los proyectos que abras o guardes.</p>
        ) : (
          <ul className="list">
            {recent.map((r) => (
              <li key={r.filePath} className={`list-item ${r.exists ? '' : 'is-missing'}`}>
                <button
                  className="list-main list-button"
                  disabled={!r.exists}
                  onClick={() => void openRecent(r.filePath)}
                  title={r.filePath}
                >
                  <span className="list-title">
                    {!r.exists && <FileWarning size={16} aria-label="No encontrado" />} {r.name}
                  </span>
                  <span className="list-sub">
                    {r.exists ? r.filePath : 'No se encuentra el archivo'} · {relativeTime(r.openedAt)}
                  </span>
                </button>
                <button
                  className="icon-btn"
                  aria-label={`Quitar «${r.name}» de recientes`}
                  onClick={async () => {
                    await window.dw.removeRecent(r.filePath);
                    void refresh();
                  }}
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
