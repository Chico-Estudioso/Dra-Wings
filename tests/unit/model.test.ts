import { describe, expect, it } from 'vitest';
import { createProject, identityTransform } from '@core/model/factory';
import { migrate, UnsupportedVersionError } from '@core/model/migrations';
import { checkReferences, validateProject } from '@core/model/validate';
import type { Project } from '@core/model/types';

export const sampleProject = (): Project =>
  createProject({
    name: 'Mi historia',
    aspect: 'landscape',
    fps: 30,
    mode: 'guided',
    now: new Date('2026-01-01T10:00:00Z'),
  });

describe('createProject', () => {
  it('crea un proyecto válido con una escena y una capa', () => {
    const p = sampleProject();
    expect(validateProject(p)).toEqual({ ok: true, project: p });
    expect(p.settings).toMatchObject({ width: 1920, height: 1080, fps: 30, mode: 'guided' });
    expect(p.scenes).toHaveLength(1);
    expect(p.scenes[0]!.layers[0]!.items).toEqual([]);
  });

  it('respeta formato vertical y cuadrado', () => {
    expect(createProject({ name: 'a', aspect: 'vertical', fps: 24, mode: 'free' }).settings).toMatchObject({
      width: 1080,
      height: 1920,
    });
    expect(createProject({ name: 'a', aspect: 'square', fps: 60, mode: 'mixed' }).export.preset).toBe('square');
  });
});

describe('validateProject', () => {
  it('rechaza datos malformados con mensajes localizables', () => {
    const p = sampleProject() as unknown as Record<string, unknown>;
    const bad = { ...p, name: '   ', settings: { ...(p.settings as object), fps: 29.97 } };
    const r = validateProject(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.some((i) => i.startsWith('name:'))).toBe(true);
      expect(r.issues.some((i) => i.startsWith('settings.fps'))).toBe(true);
    }
  });

  it('rechaza un proyecto sin escenas', () => {
    const r = validateProject({ ...sampleProject(), scenes: [] });
    expect(r.ok).toBe(false);
  });

  it('rechaza keyframes desordenados y puntos de trazo incompletos', () => {
    const p = sampleProject();
    p.scenes[0]!.layers[0]!.items!.push({
      id: 's1',
      type: 'stroke',
      transform: {
        ...identityTransform(),
        x: {
          keys: [
            { t: 10, v: 0, ease: 'linear' },
            { t: 5, v: 1, ease: 'linear' },
          ],
        },
      },
      opacity: { value: 1 },
      in: 0,
      points: [1, 2, 0.5],
      style: { color: '#000000', size: 8, thinning: 0.5, smoothing: 0.5, streamline: 0.5, opacity: 1 },
      reveal: null,
    });
    const r = validateProject(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.join('\n')).toMatch(/ordenados|grupos de 4/);
  });
});

describe('checkReferences', () => {
  it('detecta identificadores duplicados y clips sin medio', () => {
    const p = sampleProject();
    p.scenes.push({ ...p.scenes[0]!, layers: [] });
    p.audioTracks.push({
      id: 't1',
      name: 'Narración',
      kind: 'narration',
      volume: 1,
      muted: false,
      clips: [{ id: 'c1', assetId: 'nope', start: 0, sourceOffset: 0, duration: 10, gain: 1, fadeIn: 0, fadeOut: 0 }],
    });
    const problems = checkReferences(p);
    expect(problems.some((x) => x.includes('duplicado'))).toBe(true);
    expect(problems.some((x) => x.includes('medio inexistente'))).toBe(true);
  });
});

describe('migrate', () => {
  it('no hace nada con la versión actual', () => {
    const doc = { a: 1 };
    expect(migrate(doc, 1)).toEqual({ doc, migrated: false });
  });

  it('aplica migraciones encadenadas en orden', () => {
    const table = {
      1: (d: unknown) => ({ ...(d as object), v2: true }),
      2: (d: unknown) => ({ ...(d as object), v3: true }),
    };
    expect(migrate({ base: true }, 1, table, 3)).toEqual({ doc: { base: true, v2: true, v3: true }, migrated: true });
  });

  it('rechaza versiones futuras y saltos sin migración', () => {
    expect(() => migrate({}, 2)).toThrow(UnsupportedVersionError);
    expect(() => migrate({}, 2)).toThrow(/versión más reciente/);
    expect(() => migrate({}, 1, {}, 2)).toThrow(UnsupportedVersionError);
  });
});
