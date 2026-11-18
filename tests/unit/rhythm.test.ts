import { describe, expect, it } from 'vitest';
import { hasBeats, projectBeats, sceneBeats } from '@core/audio/rhythm';
import { addClip, trackFor, upsertAsset } from '@core/audio/edit';
import { lifeMatrix } from '@core/anim/life';
import { addScene } from '@core/edit/scenes';
import { apply } from '@core/geometry/matrix';
import { createProject, createShape } from '@core/model/factory';
import { validateProject } from '@core/model/validate';
import { TICKS_PER_SECOND } from '@core/time/ticks';

const S = TICKS_PER_SECOND;

function withSong() {
  const p = createProject({ name: 'x', aspect: 'landscape', fps: 30, mode: 'free' });
  const asset = upsertAsset(p, {
    hash: 'a'.repeat(64),
    mime: 'audio/wav',
    name: 'c.wav',
    size: 1,
    durationTicks: 20 * S,
  });
  // Un golpe cada 0,5 s desde 0,5 s; el compás empieza en el segundo golpe.
  asset.beats = { bpm: 120, ticks: Array.from({ length: 30 }, (_, i) => (i + 1) * 0.5 * S), downbeat: 1 };
  const clip = addClip(trackFor(p, 'music'), asset.id, 2 * S, 5 * S);
  clip.sourceOffset = 1 * S;
  return { p, asset, clip };
}

describe('ritmo de la música en el proyecto', () => {
  it('los golpes siguen al clip (posición y recorte) y marcan el compás', () => {
    const { p } = withSong();
    const beats = projectBeats(p);
    // Dentro del archivo, de 1 s a 6 s: golpes en 1, 1,5 … 5,5 (10 golpes), movidos +1 s.
    expect(beats.map((b) => b.t / S)).toEqual([2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5]);
    // Índices 1..10 en el archivo; compás cuando (i - 1) % 4 === 0 → i = 1, 5, 9.
    expect(beats.filter((b) => b.bar).map((b) => b.t / S)).toEqual([2, 4, 6]);
    expect(hasBeats(p)).toBe(true);
  });

  it('las pistas silenciadas, la narración o un audio sin analizar no cuentan', () => {
    const { p, asset } = withSong();
    p.audioTracks[0]!.muted = true;
    expect(projectBeats({ ...p, audioTracks: [...p.audioTracks] })).toEqual([]);
    p.audioTracks[0]!.muted = false;
    addClip(trackFor(p, 'narration'), asset.id, 0, 5 * S);
    expect(projectBeats({ ...p, audioTracks: [...p.audioTracks] })).toHaveLength(10);
    const noBeats = { ...p, assets: p.assets.map((a) => ({ ...a, beats: undefined })) };
    expect(projectBeats(noBeats)).toEqual([]);
  });

  it('cada escena ve sus golpes en su propio tiempo', () => {
    const { p } = withSong();
    p.scenes[0]!.duration = 4 * S;
    addScene(p, 'Dos');
    const second = p.scenes[1]!;
    expect(sceneBeats(p, p.scenes[0]!.id, 4 * S).map((b) => b.t / S)).toEqual([2, 2.5, 3, 3.5]);
    expect(sceneBeats(p, second.id, second.duration).map((b) => b.t / S)).toEqual([0, 0.5, 1, 1.5, 2, 2.5]);
    expect(validateProject(JSON.parse(JSON.stringify(p))).ok).toBe(true);
  });
});

describe('vida al ritmo', () => {
  const box = (kind: 'beat-pulse' | 'beat-bounce' | 'beat-sway') => {
    const r = createShape('rect', 0, 0, 100, 200, { stroke: '#000000', strokeWidth: 4, fill: null, opacity: 1 });
    r.life = { kind, amount: 1 };
    return r;
  };
  const beats = [S, 1.5 * S, 2 * S, 2.5 * S];
  const top = { x: 50, y: -2 };

  it('saltar: en cada golpe está en el suelo y entre golpes, arriba', () => {
    const item = box('beat-bounce');
    const feet = { x: 50, y: 202 };
    for (const b of beats.slice(0, -1)) {
      const onBeat = apply(lifeMatrix(item, b, beats), feet);
      expect(onBeat.y).toBeCloseTo(202, 6);
      const mid = apply(lifeMatrix(item, b + 0.25 * S, beats), feet);
      expect(mid.y).toBeLessThan(195);
    }
  });

  it('latir: lo más grande justo en el golpe; balancearse: cambia de lado en cada golpe', () => {
    const pulse = box('beat-pulse');
    const size = (t: number) => apply(lifeMatrix(pulse, t, beats), top).y;
    expect(size(1.5 * S)).toBeLessThan(size(1.9 * S));
    const sway = box('beat-sway');
    const x = (t: number) => apply(lifeMatrix(sway, t, beats), top).x - 50;
    expect(Math.sign(x(S))).toBe(-Math.sign(x(1.5 * S)));
    expect(Math.sign(x(1.5 * S))).toBe(-Math.sign(x(2 * S)));
  });

  it('fuera de los golpes no se mueve; sin música sigue 120 BPM', () => {
    const item = box('beat-bounce');
    const feet = { x: 50, y: 202 };
    expect(apply(lifeMatrix(item, 0.5 * S, beats), feet)).toEqual(feet);
    expect(apply(lifeMatrix(item, 3 * S, beats), feet)).toEqual(feet);
    // Sin golpes: salta cada medio segundo.
    expect(apply(lifeMatrix(item, 0.25 * S, []), feet).y).toBeLessThan(195);
    expect(apply(lifeMatrix(item, 0.5 * S, []), feet).y).toBeCloseTo(202, 6);
  });
});
