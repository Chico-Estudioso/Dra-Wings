import { AlertTriangle, Info, X } from 'lucide-react';
import { useApp } from '../state/app-store';

export function NoticeBar() {
  const notice = useApp((s) => s.notice);
  const notify = useApp((s) => s.notify);
  if (!notice) return null;
  const Icon = notice.kind === 'error' ? AlertTriangle : Info;
  return (
    <div className={`notice notice-${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
      <Icon size={18} aria-hidden />
      <div className="notice-body">
        <p>{notice.text}</p>
        {notice.details?.length ? (
          <ul className="notice-details">
            {notice.details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <button className="icon-btn" aria-label="Cerrar aviso" onClick={() => notify(null)}>
        <X size={16} />
      </button>
    </div>
  );
}
