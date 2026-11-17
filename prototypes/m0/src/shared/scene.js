// Escena de prueba y renderizador puro compartido por previsualización y exportación.
// Todo el estado visual se obtiene de (escena, t). No hay estado oculto entre fotogramas.
import { getStroke } from 'perfect-freehand';

export const W = 1280;
export const H = 720;
export const FPS = 30;
export const DURATION_S = 5;
// Marcas de sincronización: fundido a negro + pitido de 1 kHz en los mismos instantes.
export const SYNC_MARKS_S = [1, 2, 3, 4];
export const MARK_LEN_S = 0.1;

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Simula datos de un lápiz: puntos con presión variable y un leve temblor determinista.
function penPath(fn, n, seed) {
  const rand = mulberry32(seed);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const [x, y] = fn(u);
    const pressure = 0.35 + 0.45 * Math.sin(Math.PI * u) + (rand() - 0.5) * 0.05;
    pts.push([x + (rand() - 0.5) * 1.2, y + (rand() - 0.5) * 1.2, Math.min(1, Math.max(0.05, pressure))]);
  }
  return pts;
}

function line(x0, y0, x1, y1) {
  return (u) => [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u];
}

function withLengths(points) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0];
    const dy = points[i][1] - points[i - 1][1];
    cum.push(cum[i - 1] + Math.hypot(dx, dy));
  }
  return cum;
}

export function buildScene() {
  const defs = [
    // Casa
    { fn: line(300, 520, 300, 360), n: 40 },
    { fn: line(300, 360, 520, 360), n: 50 },
    { fn: line(520, 360, 520, 520), n: 40 },
    { fn: line(300, 360, 410, 260), n: 35 },
    { fn: line(410, 260, 520, 360), n: 35 },
    // Sol en espiral
    {
      fn: (u) => {
        const a = u * Math.PI * 6;
        const r = 10 + 50 * u;
        return [950 + r * Math.cos(a), 170 + r * Math.sin(a)];
      },
      n: 160,
    },
    // Suelo ondulado
    { fn: (u) => [80 + 1120 * u, 560 + 12 * Math.sin(u * Math.PI * 8)], n: 200 },
  ];
  let start = 0.2;
  const strokes = defs.map((d, i) => {
    const points = penPath(d.fn, d.n, 1000 + i);
    const s = { id: `s${i}`, points, cum: withLengths(points), color: '#1d1d1f', size: 9, start, duration: 0.45 };
    start += 0.5;
    return s;
  });
  return {
    strokes,
    character: {
      x: [
        { t: 0.5, v: 150 },
        { t: 4.5, v: 1130 },
      ],
      rotation: [
        { t: 0.5, v: 0 },
        { t: 4.5, v: Math.PI * 4 },
      ],
      opacity: [
        { t: 0, v: 0 },
        { t: 0.5, v: 1 },
      ],
    },
  };
}

// Escena de estrés para medir rendimiento: n trazos completos de m puntos.
export function buildStressStrokes(count, pointsPer) {
  const rand = mulberry32(42);
  const strokes = [];
  for (let i = 0; i < count; i++) {
    const x0 = rand() * W;
    const y0 = rand() * H;
    const a = rand() * Math.PI * 2;
    const len = 40 + rand() * 160;
    const bend = (rand() - 0.5) * 80;
    const points = penPath(
      (u) => [x0 + Math.cos(a) * len * u - Math.sin(a) * bend * Math.sin(Math.PI * u), y0 + Math.sin(a) * len * u + Math.cos(a) * bend * Math.sin(Math.PI * u)],
      pointsPer,
      5000 + i,
    );
    strokes.push({ id: `x${i}`, points, cum: withLengths(points), color: '#1d1d1f', size: 4 + rand() * 8, start: 0, duration: 0.01 });
  }
  return strokes;
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeInOutCubic = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

export function sampleTrack(keys, t) {
  if (t <= keys[0].t) return keys[0].v;
  const last = keys[keys.length - 1];
  if (t >= last.t) return last.v;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t >= a.t && t <= b.t) return a.v + (b.v - a.v) * easeInOutCubic((t - a.t) / (b.t - a.t));
  }
  return last.v;
}

// Revela un trazo por longitud de arco: el progreso depende solo del tiempo, no de eventos.
export function partialPoints(stroke, progress) {
  const { points, cum } = stroke;
  if (progress <= 0) return [];
  if (progress >= 1) return points;
  const target = cum[cum.length - 1] * progress;
  let i = 1;
  while (i < cum.length && cum[i] < target) i++;
  const a = points[i - 1];
  const b = points[i];
  const seg = cum[i] - cum[i - 1] || 1;
  const k = (target - cum[i - 1]) / seg;
  const out = points.slice(0, i);
  out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]);
  return out;
}

export function strokeOutline(points, size, complete) {
  return getStroke(points, {
    size,
    thinning: 0.6,
    smoothing: 0.5,
    streamline: 0.4,
    simulatePressure: false,
    last: complete,
  });
}

export function outlineToPath(outline) {
  const path = new Path2D();
  if (outline.length < 3) return path;
  path.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % outline.length];
    path.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  path.closePath();
  return path;
}

export function isFlash(t) {
  return SYNC_MARKS_S.some((m) => t >= m && t < m + MARK_LEN_S);
}

// Renderiza el estado visual en el instante t (segundos). Función pura respecto a (scene, t).
export function renderFrame(ctx, scene, t, frameIndex, cache) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#f7f4ec';
  ctx.fillRect(0, 0, W, H);

  for (const s of scene.strokes) {
    const p = clamp01((t - s.start) / s.duration);
    if (p <= 0) continue;
    let path;
    if (p >= 1 && cache) {
      path = cache.get(s.id);
      if (!path) {
        path = outlineToPath(strokeOutline(s.points, s.size, true));
        cache.set(s.id, path);
      }
    } else {
      path = outlineToPath(strokeOutline(partialPoints(s, p), s.size, p >= 1));
    }
    ctx.fillStyle = s.color;
    ctx.fill(path);
  }

  const c = scene.character;
  const x = sampleTrack(c.x, t);
  const rot = sampleTrack(c.rotation, t);
  ctx.globalAlpha = sampleTrack(c.opacity, t);
  ctx.translate(x, 470);
  ctx.rotate(rot);
  ctx.fillStyle = '#e8743b';
  ctx.beginPath();
  ctx.arc(0, 0, 40, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1d1d1f';
  ctx.fillRect(-15, -12, 8, 8);
  ctx.fillRect(7, -12, 8, 8);
  ctx.fillRect(-15, 12, 30, 5);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#1d1d1f';
  ctx.font = '28px monospace';
  ctx.fillText(`t=${t.toFixed(3)}s  f=${frameIndex}`, 24, 44);

  if (isFlash(t)) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

// Mezcla de audio de referencia: "música" continua suave + "narración" con pitidos en las marcas.
export async function renderAudioMix(sampleRate = 48000) {
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: Math.round(sampleRate * DURATION_S), sampleRate });
  const music = ctx.createGain();
  music.gain.value = 0.05;
  music.connect(ctx.destination);
  for (const f of [220, 330]) {
    const o = ctx.createOscillator();
    o.frequency.value = f;
    o.connect(music);
    o.start(0);
  }
  const narration = ctx.createGain();
  narration.gain.value = 0.8;
  narration.connect(ctx.destination);
  for (const m of SYNC_MARKS_S) {
    const o = ctx.createOscillator();
    o.frequency.value = 1000;
    o.connect(narration);
    o.start(m);
    o.stop(m + MARK_LEN_S);
  }
  return ctx.startRendering();
}
