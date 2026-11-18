import { describe, expect, it } from 'vitest';
import { voiceEnvelope, voiceLevel, VOICE_RATE } from '@core/audio/voice';
import { addClip, trackFor, upsertAsset } from '@core/audio/edit';
import { buildCharacter, DEFAULT_CHARACTER, talkingChildren } from '@core/library/character';
import { placeGroup } from '@core/library/place';
import { createProject } from '@core/model/factory';
import { evaluateScene } from '@core/render/evaluate';
import { validateProject } from '@core/model/validate';
import type { Item } from '@core/model/types';
import { TICKS_PER_SECOND } from '@core/time/ticks';

const S = TICKS_PER_SECOND;
const RATE = 16_000;

/** Voz sintética: «sílabas» de 0,2 s con 0,2 s de silencio entre ellas. */
function speech(seconds: number): Float32Array {
  const x = new Float32Array(seconds * RATE);
  for (let i = 0; i < x.length; i++) {
    const t = i / RATE;
    x[i] = t % 0.4 < 0.2 ? 0.5 * Math.sin(2 * Math.PI * 180 * t) : 0.0005 * Math.sin(i);
  }
  return x;
}

describe('voz de la narración', () => {
  it('sube al hablar, baja en los silencios y el silencio total es cero', () => {
    const levels = voiceEnvelope(speech(2), RATE);
    // Un valor cada 1/30 s (el último tramo puede quedar a medias).
    expect(Math.abs(levels.length - 2 * VOICE_RATE)).toBeLessThanOrEqual(1);
    // Mitad de una sílaba (0,1 s) y final de un silencio (0,38 s).
    expect(levels[3]).toBeGreaterThan(80);
    expect(levels[11]).toBeLessThan(20);
    expect(voiceEnvelope(new Float32Array(RATE), RATE).every((v) => v === 0)).toBe(true);
  });

  it('el nivel sigue al clip de narración (posición y recorte) y no a la música', () => {
    const p = createProject({ name: 'x', aspect: 'landscape', fps: 30, mode: 'free' });
    const asset = upsertAsset(p, {
      hash: 'a'.repeat(64),
      mime: 'audio/wav',
      name: 'v.wav',
      size: 1,
      durationTicks: 10 * S,
    });
    asset.voice = { rate: 30, levels: Array.from({ length: 300 }, (_, i) => (i >= 60 ? 90 : 0)) };
    const clip = addClip(trackFor(p, 'narration'), asset.id, S, 5 * S);
    clip.sourceOffset = S;
    // En el proyecto, 1 s es el segundo 1 del archivo (silencio hasta el 2) y 2 s, el segundo 2 (voz).
    expect(voiceLevel(p, 1.5 * S)).toBe(0);
    expect(voiceLevel(p, 2.5 * S)).toBeCloseTo(0.9);
    expect(voiceLevel(p, 0.5 * S)).toBe(0);
    p.audioTracks[0]!.muted = true;
    expect(voiceLevel(p, 2.5 * S)).toBe(0);
    p.audioTracks[0]!.muted = false;
    p.audioTracks[0]!.kind = 'music';
    expect(voiceLevel(p, 2.5 * S)).toBe(0);
    expect(validateProject(JSON.parse(JSON.stringify(p))).ok).toBe(true);
  });
});

describe('personajes que hablan', () => {
  const strip = (items: Item[]) => items.map((i) => JSON.stringify({ ...i, id: '' }));

  it('la boca hablando cambia solo la boca: el resto del dibujo es idéntico', () => {
    const g = placeGroup(buildCharacter(DEFAULT_CHARACTER), { cx: 960, cy: 540, height: 600 });
    const open = talkingChildren(g, 0, 'open')!;
    const half = talkingChildren(g, 0, 'half')!;
    // Feliz: la boca cerrada es 1 pieza; abierta, 3 (boca, lengua y contorno); entreabierta, 2.
    expect(open.length).toBe(g.children.length - 1 + 3);
    expect(half.length).toBe(g.children.length - 1 + 2);
    const base = strip(g.children);
    const talk = strip(open);
    // Todo lo del dibujo original salvo una pieza (la boca cerrada) está igual en la versión hablando.
    expect(base.filter((b) => !talk.includes(b))).toHaveLength(1);
    // Se reutiliza (caché) mientras el grupo no cambie.
    expect(talkingChildren(g, 0, 'open')).toBe(open);
  });

  it('al reproducir, con voz la boca se abre; sin voz o sin «habla», no', () => {
    const p = createProject({ name: 'x', aspect: 'landscape', fps: 30, mode: 'free' });
    const g = placeGroup(buildCharacter(DEFAULT_CHARACTER), { cx: 960, cy: 540, height: 600 });
    g.life = undefined;
    p.scenes[0]!.layers[0]!.items!.push(g);
    const count = (voice: number, talk: boolean) => {
      g.talk = talk;
      return evaluateScene(p.scenes[0]!, 2 * S, { mode: 'play', voice: () => voice }).length;
    };
    const closed = count(0, true);
    expect(count(0.9, true)).toBe(closed + 2);
    expect(count(0.4, true)).toBe(closed + 1);
    expect(count(0.9, false)).toBe(closed);
  });
});
