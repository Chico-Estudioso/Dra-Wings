// Detección de golpes y tempo de una canción (sin dependencias): fuerza de ataque por flujo
// espectral, tempo por autocorrelación con preferencia suave por ~120 BPM y seguimiento de golpes
// por programación dinámica (Ellis, «Beat Tracking by Dynamic Programming», 2007). Pura y
// determinista: se ejecuta en un worker para no bloquear la interfaz.

export interface BeatAnalysis {
  /** Tempo estimado (golpes por minuto). */
  bpm: number;
  /** Instantes de los golpes, en segundos desde el principio del audio. */
  beats: number[];
  /** Índice del primer golpe que empieza compás (los compases se suponen de 4). */
  downbeat: number;
}

const TARGET_RATE = 11_025;
const FRAME = 512;
const HOP = 128;
const BANDS = 12;
/** Bandas de 30 a ~110 Hz. */
const LOW_BANDS = 3;

/** FFT radix-2 en el sitio (re, im de longitud potencia de 2). */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b]! * cr - im[b]! * ci;
        const ti = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - tr;
        im[b] = im[a]! - ti;
        re[a] = re[a]! + tr;
        im[a] = im[a]! + ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

/** Reduce la frecuencia de muestreo promediando bloques (suficiente para detectar ataques). */
function downsample(samples: Float32Array, rate: number): { x: Float32Array; rate: number } {
  const f = Math.max(1, Math.round(rate / TARGET_RATE));
  if (f === 1) return { x: samples, rate };
  const x = new Float32Array(Math.floor(samples.length / f));
  for (let i = 0; i < x.length; i++) {
    let s = 0;
    for (let k = 0; k < f; k++) s += samples[i * f + k]!;
    x[i] = s / f;
  }
  return { x, rate: rate / f };
}

/** Fuerza de ataque por fotograma: subidas del espectro (en escala logarítmica) sumadas. */
export function onsetEnvelope(
  samples: Float32Array,
  sampleRate: number,
): { env: Float64Array; low: Float64Array; fps: number } {
  const { x, rate } = downsample(samples, sampleRate);
  const frames = Math.max(0, Math.floor((x.length - FRAME) / HOP) + 1);
  const env = new Float64Array(frames);
  /** Solo las bandas graves (bombo y bajo): sirve para encontrar el inicio de compás. */
  const low = new Float64Array(frames);
  const win = new Float64Array(FRAME).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / FRAME));
  const re = new Float64Array(FRAME);
  const im = new Float64Array(FRAME);
  // Bandas logarítmicas de 30 Hz a la mitad de la frecuencia: cada una pesa lo mismo, así el bombo
  // (pocas líneas del espectro) cuenta tanto como los platillos (muchas).
  const binHz = rate / FRAME;
  const edges = Array.from({ length: BANDS + 1 }, (_, i) =>
    Math.min(FRAME / 2, Math.max(1, Math.round((30 * Math.pow(rate / 2 / 30, i / BANDS)) / binHz))),
  );
  let prev = new Float64Array(FRAME / 2);
  let cur = new Float64Array(FRAME / 2);
  for (let f = 0; f < frames; f++) {
    const o = f * HOP;
    for (let i = 0; i < FRAME; i++) {
      re[i] = x[o + i]! * win[i]!;
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 1; k < FRAME / 2; k++) cur[k] = Math.log1p(100 * Math.hypot(re[k]!, im[k]!));
    let flux = 0;
    if (f > 0)
      for (let b = 0; b < BANDS; b++) {
        const lo = edges[b]!;
        const hi = Math.max(lo + 1, edges[b + 1]!);
        let band = 0;
        for (let k = lo; k < hi && k < FRAME / 2; k++) band += Math.max(0, cur[k]! - prev[k]!);
        flux += band / (hi - lo);
        if (b < LOW_BANDS) low[f] = low[f]! + band / (hi - lo);
      }
    env[f] = flux;
    [prev, cur] = [cur, prev];
  }
  // Quita la tendencia lenta (media local de ~0,25 s) y normaliza.
  const fps = rate / HOP;
  const half = Math.max(1, Math.round(fps * 0.125));
  const out = new Float64Array(frames);
  let sum = 0;
  for (let i = 0; i < Math.min(frames, half); i++) sum += env[i]!;
  for (let i = 0; i < frames; i++) {
    if (i + half < frames) sum += env[i + half]!;
    if (i - half - 1 >= 0) sum -= env[i - half - 1]!;
    const n = Math.min(frames - 1, i + half) - Math.max(0, i - half) + 1;
    out[i] = Math.max(0, env[i]! - sum / n);
  }
  const mean = out.reduce((a, b) => a + b, 0) / Math.max(1, frames);
  const sd = Math.sqrt(out.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, frames)) || 1;
  for (let i = 0; i < frames; i++) out[i] = out[i]! / sd;
  return { env: out, low, fps };
}

/** Suavizado gaussiano (desviación `sigma` en fotogramas). */
function smooth(env: Float64Array, sigma: number): Float64Array {
  const radius = Math.ceil(sigma * 3);
  const kernel = Array.from({ length: 2 * radius + 1 }, (_, i) => Math.exp(-0.5 * ((i - radius) / sigma) ** 2));
  const out = new Float64Array(env.length);
  for (let i = 0; i < env.length; i++) {
    let s = 0;
    for (let k = -radius; k <= radius; k++) {
      const j = i + k;
      if (j >= 0 && j < env.length) s += env[j]! * kernel[k + radius]!;
    }
    out[i] = s;
  }
  return out;
}

/** Periodo del golpe en fotogramas (con decimales). */
function estimatePeriod(raw: Float64Array, fps: number): number {
  // Suavizado: los ataques que caen entre dos fotogramas siguen correlando con su vecino.
  const env = smooth(raw, 1.5);
  const minLag = Math.floor((fps * 60) / 200);
  const maxLag = Math.min(env.length - 1, Math.ceil((fps * 60) / 50));
  const score = (lag: number) => {
    let s = 0;
    for (let i = 0; i + lag < env.length; i++) s += env[i]! * env[i + lag]!;
    s /= env.length - lag;
    const bpm = (60 * fps) / lag;
    return s * Math.exp(-0.5 * Math.log2(bpm / 120) ** 2);
  };
  let best = minLag;
  let bestScore = -Infinity;
  const scores = new Map<number, number>();
  for (let lag = minLag; lag <= maxLag; lag++) {
    const s = score(lag);
    scores.set(lag, s);
    if (s > bestScore) {
      bestScore = s;
      best = lag;
    }
  }
  // Interpolación parabólica para afinar entre fotogramas.
  const a = scores.get(best - 1);
  const c = scores.get(best + 1);
  if (a !== undefined && c !== undefined) {
    const d = a - 2 * bestScore + c;
    if (d < 0) return best + (0.5 * (a - c)) / d;
  }
  return best;
}

/** Golpes (en fotogramas) por programación dinámica: ataques fuertes a distancia regular. */
function trackBeats(env: Float64Array, period: number, tightness = 100): number[] {
  const n = env.length;
  // Suavizado de la fuerza de ataque (ancho ~ periodo / 32 a cada lado).
  const local = smooth(env, Math.max(1, period / 32));
  const cum = new Float64Array(n);
  const back = new Int32Array(n).fill(-1);
  const from = Math.round(period * 2);
  const to = Math.max(1, Math.round(period / 2));
  for (let i = 0; i < n; i++) {
    let best = -Infinity;
    let arg = -1;
    for (let j = Math.max(0, i - from); j <= i - to; j++) {
      const s = cum[j]! - tightness * Math.log((i - j) / period) ** 2;
      if (s > best) {
        best = s;
        arg = j;
      }
    }
    cum[i] = local[i]! + (arg >= 0 ? best : 0);
    back[i] = arg;
  }
  // El último golpe: el mejor de los dos últimos periodos.
  let end = n - 1;
  for (let i = Math.max(0, n - Math.round(period * 2)); i < n; i++) if (cum[i]! > cum[end]!) end = i;
  const beats: number[] = [];
  for (let i = end; i >= 0; i = back[i]!) beats.push(i);
  beats.reverse();
  // Sin golpes al principio o al final si allí no suena nada.
  const strength = beats.map((b) => local[b]!);
  const threshold = 0.25 * (strength.reduce((a, b) => a + b, 0) / Math.max(1, strength.length));
  let first = 0;
  while (first < beats.length && strength[first]! < threshold) first++;
  let last = beats.length - 1;
  while (last > first && strength[last]! < threshold) last--;
  return beats.slice(first, last + 1);
}

/** Analiza una señal mono. Devuelve null si es demasiado corta o no tiene ritmo apreciable. */
export function detectBeats(samples: Float32Array, sampleRate: number): BeatAnalysis | null {
  const { env, low, fps } = onsetEnvelope(samples, sampleRate);
  if (env.length < fps * 3 || env.every((v) => v === 0)) return null;
  const period = estimatePeriod(env, fps);
  const frames = trackBeats(env, period);
  if (frames.length < 4) return null;
  const offset = FRAME / 2 / (fps * HOP); // centro de la ventana
  const beats = frames.map((f) => Math.round((f / fps + offset) * 1000) / 1000);
  // Compás: la fase (de 4) con los graves más fuertes (el bombo suele marcar el «uno»).
  const lowPeak = (f: number) => Math.max(...[-2, -1, 0, 1, 2].map((d) => low[f + d] ?? 0));
  let downbeat = 0;
  let best = -Infinity;
  for (let p = 0; p < 4; p++) {
    let s = 0;
    for (let i = p; i < frames.length; i += 4) s += lowPeak(frames[i]!);
    if (s > best) {
      best = s;
      downbeat = p;
    }
  }
  return { bpm: Math.round(((60 * fps) / period) * 10) / 10, beats, downbeat };
}
