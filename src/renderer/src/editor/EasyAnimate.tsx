// «Animar» en nivel Fácil: lo que hace el elemento, paso a paso, y botones grandes para añadir pasos
// desde el cabezal (ir a otro sitio, arrastrar y grabar, gestos, entrar o salir, desaparecer, cómo
// aparece y vida). Todo crea los mismos datos que el nivel Detallado.
import { useState } from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { EyeOff, Hand, MapPin, Play, X } from 'lucide-react';
import { itemSteps, type Step } from '@core/anim/steps';
import { PRESET_LABELS, type Direction, type PresetId } from '@core/anim/presets';
import { LIFE_LABELS, LIFE_AMOUNTS, type LifeKind } from '@core/anim/life';
import type { Enter, Group, Item, Scene } from '@core/model/types';
import { secondsFromTicks, ticksFromSeconds, type Fps, type Ticks } from '@core/time/ticks';
import type { TextReveal } from '@core/render/text-reveal';
import {
  applyPresetToSelection,
  removeStepFromSelection,
  setEnter,
  setExit,
  setFollow,
  setSelectionLife,
  setTextReveal,
} from './actions';
import { CharacterLook } from './CharacterLook';
import { FollowRow } from './AnimationSection';
import { DIRECTIONS, PRESETS } from './QuickAnimations';
import { useEditor } from './editor-store';
import { itemName } from './item-names';

/** «0:02,5»: minutos y segundos con una décima. */
export function shortTime(t: Ticks): string {
  const s = secondsFromTicks(t);
  const m = Math.floor(s / 60);
  const rest = (s - m * 60).toFixed(1).replace('.', ',');
  return `${m}:${rest.padStart(4, '0')}`;
}

const GESTURES: PresetId[] = ['jump', 'sway', 'pulse', 'float', 'spin', 'shake', 'grow'];

const LIVES: { kind: LifeKind | null; label: string }[] = [
  { kind: null, label: 'Quieto' },
  { kind: 'breathe', label: LIFE_LABELS.breathe },
  { kind: 'sway', label: LIFE_LABELS.sway },
  { kind: 'float', label: LIFE_LABELS.float },
  { kind: 'pulse', label: LIFE_LABELS.pulse },
  { kind: 'beat-bounce', label: 'Al ritmo' },
];

const SPEEDS = [
  { label: 'Rápido', seconds: 0.5 },
  { label: 'Normal', seconds: 1 },
  { label: 'Lento', seconds: 2 },
];

function appearChoices(item: Item): { id: string; label: string; apply: () => void; active: boolean }[] {
  const e = item.enter;
  const draw = (reveal?: TextReveal) => () => {
    setEnter({ kind: 'draw', duration: e?.kind === 'draw' && e.duration ? e.duration : ticksFromSeconds(1) });
    if (reveal) setTextReveal(reveal);
  };
  const other = (kind: Enter['kind'], seconds: number) => () =>
    setEnter({ kind, duration: kind === 'none' ? 0 : ticksFromSeconds(seconds) });
  const base = [
    { id: 'fade', label: 'Con un fundido', apply: other('fade', 0.6), active: e?.kind === 'fade' },
    { id: 'pop', label: 'De golpe', apply: other('pop', 0.3), active: e?.kind === 'pop' },
  ];
  if (item.type === 'text') {
    const r = item.reveal ?? 'letters';
    const drawn = e?.kind === 'draw';
    return [
      { id: 'letters', label: 'Letra a letra', apply: draw('letters'), active: drawn && r === 'letters' },
      { id: 'words', label: 'Palabra a palabra', apply: draw('words'), active: drawn && r === 'words' },
      { id: 'bounce', label: 'Letras que saltan', apply: draw('bounce'), active: drawn && r === 'bounce' },
      ...base,
    ];
  }
  return [{ id: 'draw', label: 'Dibujándose', apply: draw(), active: e?.kind === 'draw' }, ...base];
}

export function EasyAnimate({ items, fps, scene }: { items: Item[]; fps: Fps; scene: Scene }) {
  const playhead = useEditor((s) => s.playhead);
  const moveTo = useEditor((s) => s.moveTo);
  const puppet = useEditor((s) => s.puppet);
  const [direction, setDirection] = useState<Direction>('left');
  const first = items[0];
  if (!first) return null;
  const single = items.length === 1;
  const name = single ? `«${itemName(first)}»` : `los ${items.length} elementos`;
  const steps: (Step & { remove?: () => void })[] = single ? itemSteps(first) : [];
  if (single && scene.follow?.id === first.id)
    steps.push({ key: 'follow', kind: 'life', t: null, label: 'La cámara lo sigue', remove: () => setFollow(null) });
  const character = single && first.type === 'group' && first.source?.kind === 'character' ? (first as Group) : null;

  return (
    <div className="easy-anim" role="group" aria-label="Animar paso a paso">
      {single && (
        <section className="easy-block" role="group" aria-label="Lo que hace">
          <h3 className="panel-subtitle">Lo que hace {name}</h3>
          <ol className="steps">
            {steps.map((s) => (
              <li key={s.key} className="step">
                <button
                  className="step-time"
                  disabled={s.t === null}
                  title={s.t === null ? 'Durante todo el tiempo que se ve' : 'Ir a este momento'}
                  onClick={() => s.t !== null && useEditor.getState().setPlayhead(s.t)}
                >
                  {s.t === null ? 'siempre' : shortTime(s.t)}
                </button>
                <span className="step-label">{s.label}</span>
                {s.kind !== 'enter' || first.enter?.kind !== 'none' ? (
                  <button
                    className="icon-btn icon-btn-xs"
                    aria-label={`Quitar: ${s.label}`}
                    title="Quitar este paso"
                    onClick={() => (s.remove ? s.remove() : removeStepFromSelection(s))}
                  >
                    <X size={13} />
                  </button>
                ) : (
                  <span className="icon-btn-xs" aria-hidden />
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <p className="hint easy-when">
        Lo que añadas empieza en <strong>{shortTime(playhead)}</strong>, donde está la línea roja de la línea de tiempo.
        Muévela para elegir cuándo pasa.
      </p>

      <section className="easy-block" role="group" aria-label="Moverse">
        <h3 className="panel-subtitle">Moverse</h3>
        <div className="easy-grid">
          <button
            className={`easy-btn ${moveTo ? 'is-on' : ''}`}
            aria-pressed={!!moveTo}
            title="Arrastra el elemento a donde tiene que llegar; puedes encadenar varios sitios"
            onClick={() => useEditor.getState().setMoveTo(moveTo ? null : { duration: ticksFromSeconds(1) })}
          >
            <MapPin size={20} aria-hidden />
            Ir a otro sitio
          </button>
          <button
            className={`easy-btn ${puppet ? 'is-on' : ''}`}
            aria-pressed={puppet}
            title="Arrastra el elemento en el lienzo: el vídeo avanza y se graba su recorrido"
            onClick={() => {
              useEditor.getState().setMoveTo(null);
              useEditor.getState().setPuppet(!puppet);
            }}
          >
            <Hand size={20} aria-hidden />
            Arrastrar y grabar
          </button>
        </div>
        {moveTo && (
          <div className="easy-note" role="note">
            <p>
              Arrastra {name} en el lienzo a donde tiene que llegar. Puedes seguir arrastrándolo para ir a más sitios.
            </p>
            <div className="chips" role="radiogroup" aria-label="Lo que tarda en llegar">
              {SPEEDS.map((s) => {
                const on = moveTo.duration === ticksFromSeconds(s.seconds);
                return (
                  <button
                    key={s.label}
                    role="radio"
                    aria-checked={on}
                    className={`chip ${on ? 'is-active' : ''}`}
                    onClick={() => useEditor.getState().setMoveTo({ duration: ticksFromSeconds(s.seconds) })}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => useEditor.getState().setMoveTo(null)}>
              Listo
            </button>
          </div>
        )}
        {puppet && (
          <p className="easy-note" role="note">
            Arrastra {name} en el lienzo: el vídeo avanza mientras lo mueves y se graba el recorrido. Suelta para
            terminar (Esc cancela).
          </p>
        )}
      </section>

      <section className="easy-block" role="group" aria-label="Gestos">
        <h3 className="panel-subtitle">Gestos</h3>
        <div className="easy-grid easy-grid-3">
          {PRESETS.filter((p) => GESTURES.includes(p.id)).map((p) => (
            <button
              key={p.id}
              className="easy-btn easy-btn-sm"
              title={`${PRESET_LABELS[p.id]} desde ${shortTime(playhead)}`}
              onClick={() => applyPresetToSelection(p.id, direction)}
            >
              <p.icon size={18} aria-hidden />
              {PRESET_LABELS[p.id]}
            </button>
          ))}
        </div>
      </section>

      <section className="easy-block" role="group" aria-label="Entrar, salir y desaparecer">
        <h3 className="panel-subtitle">Entrar y salir</h3>
        <ToggleGroup.Root
          type="single"
          className="quick-dir-group"
          aria-label="Por qué lado"
          value={direction}
          onValueChange={(v) => v && setDirection(v as Direction)}
        >
          {DIRECTIONS.map((d) => (
            <ToggleGroup.Item key={d.id} value={d.id} className="icon-btn" aria-label={d.label} title={d.label}>
              <d.icon size={15} />
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>
        <div className="easy-grid easy-grid-3">
          {PRESETS.filter((p) => p.id === 'enter' || p.id === 'exit').map((p) => (
            <button
              key={p.id}
              className="easy-btn easy-btn-sm"
              title={`${PRESET_LABELS[p.id]} por la ${DIRECTIONS.find((d) => d.id === direction)!.label.toLowerCase()}`}
              onClick={() => applyPresetToSelection(p.id, direction)}
            >
              <p.icon size={18} aria-hidden />
              {PRESET_LABELS[p.id]}
            </button>
          ))}
          <button
            className="easy-btn easy-btn-sm"
            title={`Desaparece con un fundido en ${shortTime(playhead)}`}
            onClick={() => setExit({ kind: 'fade', duration: ticksFromSeconds(0.4) }, true)}
          >
            <EyeOff size={18} aria-hidden />
            Desaparecer aquí
          </button>
        </div>
      </section>

      <section className="easy-block" role="group" aria-label="Cómo aparece">
        <h3 className="panel-subtitle">Cómo aparece</h3>
        <div className="chips" role="radiogroup" aria-label="Cómo aparece">
          {appearChoices(first).map((c) => (
            <button
              key={c.id}
              role="radio"
              aria-checked={c.active}
              className={`chip ${c.active ? 'is-active' : ''}`}
              onClick={c.apply}
            >
              {c.label}
            </button>
          ))}
        </div>
      </section>

      <section className="easy-block" role="group" aria-label="Siempre">
        <h3 className="panel-subtitle">Siempre (sin hacer nada más)</h3>
        <div className="chips" role="radiogroup" aria-label="Vida">
          {LIVES.map((l) => {
            const on = (first.life?.kind ?? null) === l.kind;
            return (
              <button
                key={l.label}
                role="radio"
                aria-checked={on}
                className={`chip ${on ? 'is-active' : ''}`}
                onClick={() => setSelectionLife(l.kind, first.life?.amount ?? LIFE_AMOUNTS.normal)}
              >
                {l.label}
              </button>
            );
          })}
        </div>
      </section>

      {character && <CharacterLook group={character} fps={fps} />}
      {single && <FollowRow id={first.id} />}

      <button
        className="btn btn-secondary btn-sm easy-play"
        onClick={() => {
          const ed = useEditor.getState();
          ed.setPlayhead(0);
          ed.setPlaying(true);
        }}
      >
        <Play size={14} aria-hidden /> Ver cómo queda (desde el principio de la escena)
      </button>
    </div>
  );
}
