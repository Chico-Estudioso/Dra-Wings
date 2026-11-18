import { describe, expect, it } from 'vitest';
import { buildCharacter, characterOptions, DEFAULT_CHARACTER, setCharacterLook } from '@core/library/character';
import { placeGroup } from '@core/library/place';
import { childrenAt, variantAt } from '@core/anim/swaps';
import { shiftItemTime } from '@core/anim/keyframes';
import { recolorSlot, removeSwap } from '@core/edit/group';
import { withNewIds } from '@core/edit/ops';
import { deepClone } from '@core/edit/clone';
import { apply, multiply } from '@core/geometry/matrix';
import { itemMatrix } from '@core/geometry/items';
import { createProject } from '@core/model/factory';
import { validateProject } from '@core/model/validate';
import { evaluateScene } from '@core/render/evaluate';
import type { Group, Item } from '@core/model/types';
import { TICKS_PER_SECOND } from '@core/time/ticks';

const S = TICKS_PER_SECOND;
const character = () => {
  const g = placeGroup(buildCharacter(DEFAULT_CHARACTER), { cx: 960, cy: 540, height: 600 });
  g.in = S;
  return g;
};
/** La cabeza (elipse de piel de 84 × 92) en coordenadas de la escena. */
function headCenter(g: Group, list: Item[]) {
  const head = list.find((c) => c.type === 'shape' && c.shape === 'ellipse' && Math.round(c.w) === 84)!;
  const m = multiply(itemMatrix(g), itemMatrix(head));
  return apply(m, { x: 42, y: 46 });
}

describe('cambios de expresión y postura', () => {
  it('desde un instante el personaje se dibuja con otra expresión, en el mismo sitio', () => {
    const g = character();
    const before = headCenter(g, g.children);
    expect(setCharacterLook(g, 3 * S, { expression: 'triste' })).toBe(true);
    expect(g.swaps).toHaveLength(1);
    expect(childrenAt(g, 3 * S - 1)).toBe(g.children);
    expect(childrenAt(g, 3 * S)).toBe(g.swaps![0]!.children);
    expect(variantAt(g, 4 * S)).toBe('corto/triste/de-pie');
    expect(characterOptions(g, 4 * S)).toMatchObject({ expression: 'triste', pose: 'de-pie' });
    expect(characterOptions(g, 2 * S)).toMatchObject({ expression: 'feliz' });
    const after = headCenter(g, g.swaps![0]!.children);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it('una postura que sobresale amplía la caja sin mover el personaje', () => {
    const g = character();
    const before = headCenter(g, g.children);
    const box = { w: g.w, h: g.h };
    setCharacterLook(g, 2 * S, { pose: 'brazos-arriba' });
    expect(g.w * g.h).toBeGreaterThan(box.w * box.h);
    for (const list of [g.children, g.swaps![0]!.children]) {
      const p = headCenter(g, list);
      expect(p.x).toBeCloseTo(before.x, 6);
      expect(p.y).toBeCloseTo(before.y, 6);
    }
  });

  it('en su aparición cambia el dibujo original; volver al aspecto anterior quita el cambio', () => {
    const g = character();
    setCharacterLook(g, 0, { expression: 'sorpresa' });
    expect(g.swaps).toBeUndefined();
    expect(g.source?.id).toBe('corto/sorpresa/de-pie');
    setCharacterLook(g, 2 * S, { pose: 'saludando' });
    setCharacterLook(g, 3 * S, { pose: 'de-pie' });
    expect(g.swaps!.map((s) => s.variant)).toEqual(['corto/sorpresa/saludando', 'corto/sorpresa/de-pie']);
    // Cambiar el de 2 s a lo mismo que antes lo quita, y entonces el de 3 s también sobra.
    setCharacterLook(g, 2 * S, { pose: 'de-pie' });
    expect(g.swaps).toBeUndefined();
    setCharacterLook(g, 2 * S, { expression: 'risa' });
    removeSwap(g, 2 * S);
    expect(g.swaps).toBeUndefined();
  });

  it('se renderiza, se toca y se recolorea con el dibujo de cada instante', () => {
    const g = character();
    setCharacterLook(g, 2 * S, { pose: 'brazos-arriba' });
    const scene = { ...createProject({ name: 'x', aspect: 'landscape', fps: 30, mode: 'free' }).scenes[0]! };
    scene.layers = [{ ...scene.layers[0]!, items: [g] }];
    const ids = (t: number) => new Set(evaluateScene(scene, t, { mode: 'edit' }).map((r) => r.item.id));
    const swapIds = new Set(g.swaps![0]!.children.map((c) => c.id));
    expect([...ids(S)].some((id) => swapIds.has(id))).toBe(false);
    expect([...ids(2 * S)].every((id) => swapIds.has(id))).toBe(true);
    recolorSlot(g, 'shirt', '#123456');
    const shirts = g.swaps![0]!.children.filter((c) => c.slot === 'shirt');
    expect(shirts.length).toBeGreaterThan(0);
    expect(
      shirts.every((c) => (c.type === 'stroke' ? c.style.color : c.type === 'shape' ? c.style.fill : '') === '#123456'),
    ).toBe(true);
    expect(characterOptions(g, 3 * S)?.shirt).toBe('#123456');
  });

  it('se desplaza en el tiempo con el elemento, se copia con ids nuevos y se guarda', () => {
    const g = character();
    setCharacterLook(g, 3 * S, { expression: 'enfado' });
    shiftItemTime(g, S);
    expect(g.swaps![0]!.t).toBe(4 * S);
    const copy = withNewIds(deepClone(g));
    expect(copy.swaps![0]!.children[0]!.id).not.toBe(g.swaps![0]!.children[0]!.id);
    const p = createProject({ name: 'x', aspect: 'landscape', fps: 30, mode: 'free' });
    p.scenes[0]!.layers[0]!.items!.push(g);
    const r = validateProject(JSON.parse(JSON.stringify(p)));
    expect(r.ok).toBe(true);
    const saved = r.ok && (r.project.scenes[0]!.layers[0]!.items![0] as Group);
    expect(saved && saved.swaps?.[0]?.variant).toBe('corto/enfado/de-pie');
  });

  it('un grupo que no es un personaje no cambia de aspecto', () => {
    const g = character();
    g.source = { kind: 'library', id: 'arbol' };
    expect(characterOptions(g, 0)).toBeNull();
    expect(setCharacterLook(g, 2 * S, { expression: 'triste' })).toBe(false);
  });
});
