import { ChevronLeft, ChevronRight, Clock, Diamond, Hand, LogIn, LogOut, X } from 'lucide-react';
import { keyTimes } from '@core/anim/keyframes';
import type { Enter, Exit, Item } from '@core/model/types';
import { formatTimecode, secondsFromTicks, ticksFromSeconds, type Fps } from '@core/time/ticks';
import {
  clearSelectionAnimation,
  removeKeyAtPlayhead,
  setEnter,
  setExit,
  setInAtPlayhead,
  setSelectionLife,
} from './actions';
import { ValueSlider } from './controls';
import { useEditor } from './editor-store';
import { QuickAnimations } from './QuickAnimations';
import { LIFE_AMOUNT_LABELS, LIFE_AMOUNTS, LIFE_LABELS, type LifeKind } from '@core/anim/life';

const ENTER_LABELS: Record<Enter['kind'], string> = {
  draw: 'Dibujarse',
  fade: 'Fundido',
  pop: 'Aparecer de golpe',
  none: 'Sin animación',
};
const EXIT_LABELS: Record<Exit['kind'], string> = { fade: 'Fundido', pop: 'Encoger', none: 'Desaparecer sin más' };

/** Animación del elemento seleccionado: aparición, momento de entrada, salida y keyframes. */
export function AnimationSection({ items, fps }: { items: Item[]; fps: Fps }) {
  const playhead = useEditor((s) => s.playhead);
  const autoKey = useEditor((s) => s.autoKey);
  const puppet = useEditor((s) => s.puppet);
  const first = items[0];
  if (!first) return null;
  const enter: Enter = first.enter ?? { kind: 'none', duration: 0 };
  const keys = [...new Set(items.flatMap(keyTimes))].sort((a, b) => a - b);
  const prevKey = [...keys].reverse().find((k) => k < playhead);
  const nextKey = keys.find((k) => k > playhead);
  const atKey = keys.includes(playhead);

  return (
    <div className="anim-section" role="group" aria-label="Animación">
      <h3 className="panel-subtitle">Animación</h3>
      <label className="inline-field">
        <span className="control-label">Aparición</span>
        <select
          className="input input-sm"
          aria-label="Tipo de aparición"
          value={enter.kind}
          onChange={(e) => {
            const kind = e.target.value as Enter['kind'];
            setEnter({ kind, duration: kind === 'none' ? 0 : enter.duration || ticksFromSeconds(1) });
          }}
        >
          {(Object.keys(ENTER_LABELS) as Enter['kind'][]).map((k) => (
            <option key={k} value={k}>
              {ENTER_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      {enter.kind !== 'none' && (
        <ValueSlider
          label="Duración"
          value={Number(secondsFromTicks(enter.duration).toFixed(1))}
          min={0.1}
          max={10}
          step={0.1}
          format={(v) => `${v.toFixed(1)} s`}
          onChange={() => {}}
          onCommit={(v) => setEnter({ ...enter, duration: ticksFromSeconds(v) })}
        />
      )}
      <div className="anim-row">
        <Clock size={14} aria-hidden />
        <span>
          Empieza en <strong>{formatTimecode(first.in, fps)}</strong>
        </span>
        <button className="btn btn-ghost btn-sm" title="Hacer que empiece en el cabezal" onClick={setInAtPlayhead}>
          <LogIn size={14} aria-hidden /> Al cabezal
        </button>
      </div>
      <div className="anim-row">
        <LogOut size={14} aria-hidden />
        <span>
          {first.out !== undefined ? (
            <>
              Desaparece en <strong>{formatTimecode(first.out, fps)}</strong>
            </>
          ) : (
            'Se queda hasta el final'
          )}
        </span>
        {first.out !== undefined ? (
          <button
            className="icon-btn icon-btn-sm"
            aria-label="No desaparecer"
            title="No desaparecer"
            onClick={() => setExit(null, false)}
          >
            <X size={14} />
          </button>
        ) : (
          <button
            className="btn btn-ghost btn-sm"
            title="Desaparecer en el cabezal"
            onClick={() => setExit({ kind: 'fade', duration: ticksFromSeconds(0.4) }, true)}
          >
            En el cabezal
          </button>
        )}
      </div>
      {first.out !== undefined && (
        <label className="inline-field">
          <span className="control-label">Salida</span>
          <select
            className="input input-sm"
            aria-label="Tipo de desaparición"
            value={first.exit?.kind ?? 'none'}
            onChange={(e) =>
              setExit(
                { kind: e.target.value as Exit['kind'], duration: first.exit?.duration || ticksFromSeconds(0.4) },
                false,
              )
            }
          >
            {(Object.keys(EXIT_LABELS) as Exit['kind'][]).map((k) => (
              <option key={k} value={k}>
                {EXIT_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="anim-row">
        <Diamond size={14} aria-hidden />
        <span>
          {keys.length
            ? `${keys.length} keyframes de movimiento`
            : autoKey
              ? 'Mueve el elemento para grabar'
              : 'Sin movimiento'}
        </span>
      </div>
      {keys.length > 0 && (
        <div className="button-grid">
          <button
            className="icon-btn"
            aria-label="Keyframe anterior"
            title="Keyframe anterior (Mayús+,)"
            disabled={prevKey === undefined}
            onClick={() => prevKey !== undefined && useEditor.getState().setPlayhead(prevKey)}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            className="icon-btn"
            aria-label="Keyframe siguiente"
            title="Keyframe siguiente (Mayús+.)"
            disabled={nextKey === undefined}
            onClick={() => nextKey !== undefined && useEditor.getState().setPlayhead(nextKey)}
          >
            <ChevronRight size={16} />
          </button>
          <button className="btn btn-ghost btn-sm" disabled={!atKey} onClick={removeKeyAtPlayhead}>
            Quitar keyframe
          </button>
          <button className="btn btn-ghost btn-sm" onClick={clearSelectionAnimation}>
            Quitar movimiento
          </button>
        </div>
      )}
      <div className="anim-life">
        <label className="inline-field">
          <span className="control-label">Vida</span>
          <select
            className="input input-sm"
            aria-label="Vida automática"
            title="Movimiento de reposo continuo al reproducir y en el vídeo, sin keyframes"
            value={first.life?.kind ?? ''}
            onChange={(e) =>
              setSelectionLife((e.target.value || null) as LifeKind | null, first.life?.amount ?? LIFE_AMOUNTS.normal)
            }
          >
            <option value="">Quieto</option>
            {(Object.keys(LIFE_LABELS) as LifeKind[]).map((k) => (
              <option key={k} value={k}>
                {LIFE_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        {first.life && (
          <select
            className="input input-sm"
            aria-label="Intensidad de la vida"
            value={
              (Object.keys(LIFE_AMOUNTS) as (keyof typeof LIFE_AMOUNTS)[]).find(
                (k) => LIFE_AMOUNTS[k] === first.life!.amount,
              ) ?? 'normal'
            }
            onChange={(e) =>
              setSelectionLife(first.life!.kind, LIFE_AMOUNTS[e.target.value as keyof typeof LIFE_AMOUNTS])
            }
          >
            {(Object.keys(LIFE_AMOUNTS) as (keyof typeof LIFE_AMOUNTS)[]).map((k) => (
              <option key={k} value={k}>
                {LIFE_AMOUNT_LABELS[k]}
              </option>
            ))}
          </select>
        )}
      </div>
      <button
        type="button"
        className={`btn btn-sm puppet-btn ${puppet ? 'btn-primary' : 'btn-ghost'}`}
        aria-pressed={puppet}
        title="Arrastra el elemento en el lienzo: el vídeo avanza y se graba su recorrido"
        onClick={() => useEditor.getState().setPuppet(!puppet)}
      >
        <Hand size={14} aria-hidden /> Animar arrastrando
      </button>
      {puppet && (
        <p className="hint">
          Arrastra el elemento en el lienzo: el vídeo avanza desde el cabezal y se graba su recorrido. Suelta para
          terminar (Esc cancela). Puedes seguir desde donde lo dejaste.
        </p>
      )}
      <QuickAnimations items={items} hasKeys={keys.length > 0} />
      {!autoKey && keys.length === 0 && (
        <p className="hint">
          Para animarlo a mano: activa «Grabar movimiento» (●) en la línea de tiempo, lleva el cabezal a otro instante y
          mueve el elemento.
        </p>
      )}
    </div>
  );
}
