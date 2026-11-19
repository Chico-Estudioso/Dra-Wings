import { describe, expect, it } from 'vitest';
import { drawText, type Ctx2D } from '@core/render/draw';
import { createText } from '@core/model/factory';
import type { TextItem } from '@core/model/types';

/** Contexto falso: mide 10 por carácter y apunta cada texto dibujado. */
function fakeCtx() {
  const drawn: { text: string; x: number }[] = [];
  const state: Record<string, unknown> = { globalAlpha: 1 };
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop as string];
      if (prop === 'measureText') return (s: string) => ({ width: s.length * 10 });
      if (prop === 'fillText') return (text: string, x: number) => drawn.push({ text, x });
      return () => undefined;
    },
    set(target, prop, value) {
      target[prop as string] = value;
      return true;
    },
  }) as unknown as Ctx2D;
  return { ctx, drawn };
}

const text = (reveal?: TextItem['reveal']) => {
  const t = createText(0, 0, {
    text: 'uno dos tres cuatro',
    font: 'hand',
    size: 40,
    color: '#000000',
    align: 'center',
    lineHeight: 1.2,
    w: 400,
    h: 48,
  });
  t.reveal = reveal;
  return t;
};

describe('dibujo de textos que se escriben', () => {
  it('palabra a palabra: cada una en su sitio final (centrado), las demás aún no', () => {
    const { ctx, drawn } = fakeCtx();
    drawText(ctx, text('words'), 0.5);
    // Línea de 190 de ancho centrada en 400: empieza en 105.
    expect(drawn.map((d) => d.text)).toEqual(['uno', 'dos']);
    expect(drawn[0]!.x).toBe(105);
  });

  it('una palabra en cada golpe: aparecen enteras', () => {
    const { ctx, drawn } = fakeCtx();
    drawText(ctx, text('beat-words'), 0.75);
    expect(drawn.map((d) => d.text)).toEqual(['uno', 'dos', 'tres']);
  });

  it('completo, o letra a letra, como siempre', () => {
    const full = fakeCtx();
    drawText(full.ctx, text('bounce'), 1);
    expect(full.drawn.map((d) => d.text)).toEqual(['uno dos tres cuatro']);
    const typed = fakeCtx();
    drawText(typed.ctx, text(), 0.5);
    // 19 letras a la mitad: 9.
    expect(typed.drawn.map((d) => d.text)).toEqual(['uno dos t']);
  });
});

describe('contorno y sombra de los textos', () => {
  /** Contexto falso que apunta cada operación con su estilo. */
  function recorder() {
    const ops: { op: string; x: number; y: number; style: unknown; width?: unknown }[] = [];
    const stack: Record<string, unknown>[] = [];
    const state: Record<string, unknown> = { globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1 };
    const ctx = new Proxy(state, {
      get(target, prop) {
        if (prop in target) return target[prop as string];
        if (prop === 'measureText') return (s: string) => ({ width: s.length * 10 });
        if (prop === 'save') return () => stack.push({ ...state });
        if (prop === 'restore') return () => Object.assign(state, stack.pop());
        if (prop === 'fillText')
          return (_t: string, x: number, y: number) => ops.push({ op: 'fill', x, y, style: state.fillStyle });
        if (prop === 'strokeText')
          return (_t: string, x: number, y: number) =>
            ops.push({ op: 'stroke', x, y, style: state.strokeStyle, width: state.lineWidth });
        return () => undefined;
      },
      set(target, prop, value) {
        target[prop as string] = value;
        return true;
      },
    }) as unknown as Ctx2D;
    return { ctx, ops };
  }

  it('sombra desplazada, contorno por fuera y relleno encima, en las unidades del texto', () => {
    const t = text();
    t.align = 'left';
    t.outline = { color: '#ffffff', width: 0.1 };
    t.shadow = true;
    const { ctx, ops } = recorder();
    drawText(ctx, t, 1);
    const d = 40 * 0.07;
    expect(ops).toEqual([
      { op: 'stroke', x: d, y: d, style: 'rgba(0,0,0,0.35)', width: 8 },
      { op: 'fill', x: d, y: d, style: 'rgba(0,0,0,0.35)' },
      { op: 'stroke', x: 0, y: 0, style: '#ffffff', width: 8 },
      { op: 'fill', x: 0, y: 0, style: '#000000' },
    ]);
  });

  it('sin contorno ni sombra, solo el relleno', () => {
    const { ctx, ops } = recorder();
    drawText(ctx, text(), 1);
    expect(ops.map((o) => o.op)).toEqual(['fill']);
  });

  it('al escribirse palabra a palabra, cada palabra lleva su contorno', () => {
    const t = text('words');
    t.outline = { color: '#ffffff', width: 0.05 };
    const { ctx, ops } = recorder();
    drawText(ctx, t, 0.5);
    expect(ops.map((o) => o.op)).toEqual(['stroke', 'fill', 'stroke', 'fill']);
  });
});
