// «Mano que dibuja»: una mano original (dibujada por código) con rotulador o lápiz, con la punta
// apoyada donde se está dibujando. Solo al reproducir y en el vídeo.
import type { Point } from '../geometry/matrix';
import type { Ctx2D } from './draw';

export type HandStyle = 'none' | 'marker' | 'pencil';

export const HAND_LABELS: Record<HandStyle, string> = {
  none: 'Sin mano',
  marker: 'Mano con rotulador',
  pencil: 'Mano con lápiz',
};

const INK = '#1d1d1f';
const SKIN = '#f2c9a0';
const SLEEVE = '#2f6fd6';

/** Cápsula (segmento con extremos redondeados) de `a` a `b` con radio `r`. */
function capsule(ctx: Ctx2D, a: Point, b: Point, r: number) {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  ctx.beginPath();
  ctx.arc(a.x, a.y, r, ang + Math.PI / 2, ang - Math.PI / 2);
  ctx.arc(b.x, b.y, r, ang - Math.PI / 2, ang + Math.PI / 2);
  ctx.closePath();
}

function fillStroke(ctx: Ctx2D, fill: string, line: number) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = line;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

/**
 * Dibuja la mano con la punta en `tip`. `size` es el largo del rotulador (unidades de la escena).
 * Coordenadas propias: el instrumento va a lo largo de +x desde la punta, y todo se gira para que
 * la mano entre desde abajo a la derecha.
 */
export function drawHand(ctx: Ctx2D, tip: Point, size: number, style: Exclude<HandStyle, 'none'>): void {
  ctx.save();
  ctx.translate(tip.x, tip.y);
  ctx.rotate((52 * Math.PI) / 180);
  ctx.scale(size, size);
  const line = 0.012;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 0.04 * size;
  ctx.shadowOffsetY = 0.015 * size;

  // Brazo: muñeca y manga larga que sale de la escena (se ensancha un poco hacia el codo).
  ctx.beginPath();
  ctx.moveTo(0.7, -0.1);
  ctx.lineTo(0.92, -0.11);
  ctx.lineTo(0.92, 0.11);
  ctx.lineTo(0.72, 0.1);
  ctx.closePath();
  fillStroke(ctx, SKIN, line);
  ctx.beginPath();
  ctx.moveTo(0.9, -0.13);
  ctx.lineTo(6, -0.3);
  ctx.lineTo(6, 0.3);
  ctx.lineTo(0.9, 0.13);
  ctx.closePath();
  fillStroke(ctx, SLEEVE, line);
  // Puño de la manga.
  ctx.beginPath();
  ctx.moveTo(0.9, -0.13);
  ctx.lineTo(0.98, -0.135);
  ctx.lineTo(0.98, 0.135);
  ctx.lineTo(0.9, 0.13);
  ctx.closePath();
  fillStroke(ctx, '#ffffff', line);
  ctx.shadowColor = 'transparent';

  // Instrumento.
  if (style === 'marker') {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0.07, -0.035);
    ctx.lineTo(0.07, 0.035);
    ctx.closePath();
    fillStroke(ctx, INK, line);
    capsule(ctx, { x: 0.09, y: 0 }, { x: 0.78, y: 0 }, 0.045);
    fillStroke(ctx, '#2a2f45', line);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(0.12, -0.03, 0.5, 0.012);
  } else {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0.13, -0.04);
    ctx.lineTo(0.13, 0.04);
    ctx.closePath();
    fillStroke(ctx, '#f2d3a0', line);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0.035, -0.011);
    ctx.lineTo(0.035, 0.011);
    ctx.closePath();
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.beginPath();
    ctx.rect(0.13, -0.04, 0.66, 0.08);
    fillStroke(ctx, '#e0a526', line);
  }

  // Mano: pulgar debajo del instrumento, palma, dedos cerrados y el índice sobre él.
  capsule(ctx, { x: 0.3, y: 0.075 }, { x: 0.52, y: 0.11 }, 0.042);
  fillStroke(ctx, SKIN, line);
  ctx.beginPath();
  ctx.ellipse(0.68, 0.0, 0.2, 0.15, 0, 0, Math.PI * 2);
  fillStroke(ctx, SKIN, line);
  for (const [x, y] of [
    [0.56, -0.13],
    [0.66, -0.15],
    [0.76, -0.15],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(x, y, 0.06, 0.045, -0.15, 0, Math.PI * 2);
    fillStroke(ctx, SKIN, line);
  }
  capsule(ctx, { x: 0.24, y: -0.04 }, { x: 0.56, y: -0.07 }, 0.04);
  fillStroke(ctx, SKIN, line);
  // Uña del índice.
  ctx.beginPath();
  ctx.ellipse(0.25, -0.04, 0.018, 0.022, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#f7ddc4';
  ctx.fill();
  ctx.restore();
}
