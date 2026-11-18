// Expresión y postura de un personaje a lo largo del vídeo: lo elegido se aplica desde el cabezal
// hasta el siguiente cambio, y el personaje sigue siendo un solo elemento (se mueve y anima entero).
import { X } from 'lucide-react';
import { characterOptions, EXPRESSIONS, POSES, type Expression, type Pose } from '@core/library/character';
import type { Group } from '@core/model/types';
import { formatTimecode, type Fps } from '@core/time/ticks';
import { removeLookChange, setLookAtPlayhead, setTalk } from './actions';
import { hasVoice } from '@core/audio/voice';
import { useApp } from '../state/app-store';
import { useEditor } from './editor-store';

function lookLabel(variant: string | undefined): string {
  const [, expression, pose] = (variant ?? '').split('/');
  const e = EXPRESSIONS[expression as Expression];
  const p = POSES[pose as Pose];
  return e && p ? `${e}, ${p.toLowerCase()}` : 'Otro aspecto';
}

export function CharacterLook({ group, fps }: { group: Group; fps: Fps }) {
  const playhead = useEditor((s) => s.playhead);
  const voiceReady = useApp((s) => !!s.doc && hasVoice(s.doc.project));
  const o = characterOptions(group, playhead);
  if (!o) return null;
  const fromStart = playhead <= group.in;
  const swaps = group.swaps ?? [];
  return (
    <div className="look-section" role="group" aria-label="Expresión y postura">
      <h3 className="panel-subtitle">Expresión y postura</h3>
      <label className="inline-field">
        <span className="control-label">Expresión</span>
        <select
          className="input input-sm"
          aria-label="Expresión"
          value={o.expression}
          onChange={(e) => setLookAtPlayhead({ expression: e.target.value as Expression })}
        >
          {(Object.keys(EXPRESSIONS) as Expression[]).map((k) => (
            <option key={k} value={k}>
              {EXPRESSIONS[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="inline-field">
        <span className="control-label">Postura</span>
        <select
          className="input input-sm"
          aria-label="Postura"
          value={o.pose}
          onChange={(e) => setLookAtPlayhead({ pose: e.target.value as Pose })}
        >
          {(Object.keys(POSES) as Pose[]).map((k) => (
            <option key={k} value={k}>
              {POSES[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="check-field">
        <input type="checkbox" checked={!!group.talk} onChange={(e) => setTalk(e.target.checked)} />
        Habla con la narración
      </label>
      {group.talk && !voiceReady && (
        <p className="hint">Mueve la boca cuando suena la narración. Graba o importa una en la pista de narración.</p>
      )}
      <p className="hint">
        {fromStart
          ? 'Se aplica desde que aparece. Para que cambie a mitad, lleva antes el cabezal a ese momento.'
          : `Se aplica desde ${formatTimecode(playhead, fps)} (el cabezal) hasta el siguiente cambio.`}
      </p>
      {swaps.length > 0 && (
        <ul className="look-changes" aria-label="Cambios de aspecto">
          {swaps.map((s) => {
            const at = formatTimecode(s.t, fps);
            return (
              <li key={s.t}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  title="Llevar el cabezal a este cambio"
                  onClick={() => useEditor.getState().setPlayhead(s.t)}
                >
                  {at}
                </button>
                <span>{lookLabel(s.variant)}</span>
                <button
                  type="button"
                  className="icon-btn icon-btn-sm"
                  aria-label={`Quitar el cambio de ${at}`}
                  title="Quitar este cambio"
                  onClick={() => removeLookChange(s.t)}
                >
                  <X size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
