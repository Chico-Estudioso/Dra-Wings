import { describe, expect, it } from 'vitest';
import { audioEnd, clipGainAt, pruneAssets, scheduleFrom, usedAssetIds, withoutNarration } from '@core/audio/clips';
import {
  addClip,
  addMarker,
  MIN_CLIP,
  moveMarker,
  removeClip,
  removeMarker,
  renameMarker,
  setClipFades,
  snapTo,
  splitClip,
  trackFor,
  trimClip,
  trimmed,
  upsertAsset,
} from '@core/audio/edit';
import { createImage, createProject } from '@core/model/factory';
import { makeGroup } from '@core/edit/group';
import { checkReferences, validateProject } from '@core/model/validate';
import type { AudioClip, Project } from '@core/model/types';
import { TICKS_PER_SECOND } from '@core/time/ticks';

const S = TICKS_PER_SECOND;
const HASH = (c: string) => c.repeat(64);
const project = (): Project => createProject({ name: 'Audio', aspect: 'landscape', fps: 30, mode: 'free' });

function withClip(clip: Partial<AudioClip> = {}) {
  const p = project();
  const asset = upsertAsset(p, {
    hash: HASH('a'),
    mime: 'audio/wav',
    name: 'voz.wav',
    size: 10,
    durationTicks: 10 * S,
  });
  const track = trackFor(p, 'narration');
  const c = addClip(track, asset.id, 0, 4 * S);
  Object.assign(c, clip);
  return { p, asset, track, clip: c };
}

describe('fundidos y programación de clips', () => {
  it('la ganancia sube y baja linealmente en los fundidos', () => {
    const { clip } = withClip({ gain: 0.8, fadeIn: S, fadeOut: 2 * S });
    expect(clipGainAt(clip, 0)).toBe(0);
    expect(clipGainAt(clip, S / 2)).toBeCloseTo(0.4);
    expect(clipGainAt(clip, 1.5 * S)).toBeCloseTo(0.8);
    expect(clipGainAt(clip, 3 * S)).toBeCloseTo(0.4);
    expect(clipGainAt(clip, 4 * S)).toBe(0);
    expect(clipGainAt(clip, 5 * S)).toBe(0);
  });

  it('desde un instante, cada clip sabe cuándo y desde dónde sonar', () => {
    const { p, track, asset } = withClip({ start: 2 * S, sourceOffset: S });
    addClip(track, asset.id, 10 * S, 2 * S);
    const all = scheduleFrom(p, 3 * S);
    expect(all).toHaveLength(2);
    const [a, b] = all;
    // El primero ya está sonando: empieza ya, 1 s dentro del clip (2 s dentro del archivo).
    expect(a).toMatchObject({ delay: 0, clipOffset: S, sourceStart: 2 * S, length: 3 * S });
    // El segundo espera 7 s.
    expect(b).toMatchObject({ delay: 7 * S, clipOffset: 0, sourceStart: 0, length: 2 * S });
    // Con límite final, se recorta lo que suena.
    expect(scheduleFrom(p, 3 * S, 11 * S)[1]).toMatchObject({ length: S });
    // Lo que ya terminó no se programa.
    expect(scheduleFrom(p, 13 * S)).toHaveLength(0);
  });

  it('para grabar una narración nueva se puede silenciar la que ya hay (sin tocar el proyecto)', () => {
    const { p, asset } = withClip();
    addClip(trackFor(p, 'music'), asset.id, 0, S);
    const quiet = withoutNarration(p);
    expect(quiet.audioTracks.map((t) => t.kind)).toEqual(['music']);
    expect(p.audioTracks.map((t) => t.kind)).toEqual(['narration', 'music']);
    expect(scheduleFrom(quiet, 0).map((s) => s.track.kind)).toEqual(['music']);
    const noNarration = { ...p, audioTracks: p.audioTracks.filter((t) => t.kind === 'music') };
    expect(withoutNarration(noNarration)).toBe(noNarration);
  });

  it('las pistas silenciadas no suenan y el final del audio se calcula', () => {
    const { p, track } = withClip({ start: S });
    expect(audioEnd(p)).toBe(5 * S);
    track.muted = true;
    expect(scheduleFrom(p, 0)).toHaveLength(0);
  });
});

describe('edición de clips', () => {
  it('el mismo contenido se registra una sola vez', () => {
    const { p, asset } = withClip();
    const again = upsertAsset(p, { hash: HASH('a'), mime: 'audio/wav', name: 'otra.wav', size: 10 });
    expect(again.id).toBe(asset.id);
    expect(p.assets).toHaveLength(1);
  });

  it('las pistas se crean en orden: narración, música, efectos', () => {
    const p = project();
    trackFor(p, 'sfx');
    trackFor(p, 'narration');
    trackFor(p, 'music');
    expect(p.audioTracks.map((t) => t.kind)).toEqual(['narration', 'music', 'sfx']);
    expect(trackFor(p, 'music')).toBe(p.audioTracks[1]);
  });

  it('un clip nuevo no se solapa: se encadena tras los existentes', () => {
    const { track, asset } = withClip();
    const second = addClip(track, asset.id, S, 2 * S);
    expect(second.start).toBe(4 * S);
    const third = addClip(track, asset.id, 0, S);
    expect(third.start).toBe(6 * S);
  });

  it('recortar respeta el archivo de origen y la duración mínima', () => {
    const { p, clip } = withClip({ start: 2 * S, sourceOffset: S });
    // No se puede empezar antes del principio del archivo.
    expect(trimmed(clip, 'start', -5 * S, 10 * S)).toEqual({ start: S, sourceOffset: 0, duration: 5 * S });
    // Ni dejar el clip por debajo del mínimo.
    expect(trimmed(clip, 'start', 10 * S).duration).toBe(MIN_CLIP);
    // Ni alargarlo más allá del final del archivo.
    trimClip(p, clip.id, 'end', 100 * S);
    expect(p.audioTracks[0]!.clips[0]!.duration).toBe(9 * S);
  });

  it('los fundidos no suman más que el clip', () => {
    const { p, clip } = withClip();
    setClipFades(p, clip.id, { fadeIn: 3 * S, fadeOut: 3 * S });
    const c = p.audioTracks[0]!.clips[0]!;
    expect(c.fadeIn + c.fadeOut).toBeLessThanOrEqual(c.duration);
  });

  it('dividir crea dos clips contiguos que suenan igual que el original', () => {
    const { p, clip } = withClip({ start: S, fadeIn: S / 2, fadeOut: S / 2 });
    const id = splitClip(p, clip.id, 2.5 * S)!;
    const [a, b] = p.audioTracks[0]!.clips;
    expect(b!.id).toBe(id);
    expect(a).toMatchObject({ start: S, duration: 1.5 * S, fadeIn: S / 2, fadeOut: 0 });
    expect(b).toMatchObject({ start: 2.5 * S, sourceOffset: 1.5 * S, duration: 2.5 * S, fadeIn: 0, fadeOut: S / 2 });
    expect(splitClip(p, id, 2.5 * S)).toBeNull();
  });

  it('al quitar el último clip desaparece la pista', () => {
    const { p, clip } = withClip();
    removeClip(p, clip.id);
    expect(p.audioTracks).toHaveLength(0);
  });
});

describe('marcas', () => {
  it('se añaden ordenadas, sin duplicar instantes, y se editan', () => {
    const p = project();
    const b = addMarker(p, 3 * S);
    const a = addMarker(p, S, 'Inicio');
    expect(addMarker(p, 3 * S).id).toBe(b.id);
    expect(p.markers.map((m) => m.id)).toEqual([a.id, b.id]);
    renameMarker(p, b.id, '  Clímax  ');
    moveMarker(p, b.id, 0);
    expect(p.markers[0]).toMatchObject({ id: b.id, label: 'Clímax', t: 0 });
    removeMarker(p, a.id);
    expect(p.markers).toHaveLength(1);
  });

  it('el ajuste magnético elige el objetivo más cercano dentro de la tolerancia', () => {
    expect(snapTo(100, [50, 104, 97], 5)).toBe(97);
    expect(snapTo(100, [50, 120], 5)).toBe(100);
  });
});

describe('medios del proyecto', () => {
  it('se detectan los usados (también dentro de grupos y fotogramas) y se podan los demás', () => {
    const p = project();
    const img = upsertAsset(p, { hash: HASH('b'), mime: 'image/png', name: 'foto.png', size: 1 });
    const unused = upsertAsset(p, { hash: HASH('c'), mime: 'image/png', name: 'vieja.png', size: 1 });
    const audio = upsertAsset(p, { hash: HASH('d'), mime: 'audio/mpeg', name: 'm.mp3', size: 1 });
    addClip(trackFor(p, 'music'), audio.id, 0, S);
    p.scenes[0]!.layers[0]!.items!.push(makeGroup([createImage(img.id, 0, 0, 10, 10)]));
    expect([...usedAssetIds(p)].sort()).toEqual([img.id, audio.id].sort());
    const pruned = pruneAssets(p);
    expect(pruned.assets.map((a) => a.id)).not.toContain(unused.id);
    expect(pruned.assets).toHaveLength(2);
    expect(pruneAssets(pruned)).toBe(pruned);
  });

  it('una imagen que apunta a un medio inexistente es una referencia incoherente', () => {
    const p = project();
    p.scenes[0]!.layers[0]!.items!.push(createImage('noexiste', 0, 0, 10, 10));
    expect(validateProject(JSON.parse(JSON.stringify(p))).ok).toBe(true);
    expect(checkReferences(p).join()).toMatch(/medio inexistente/);
  });
});
