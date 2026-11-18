// Efectos de sonido sintetizados por código (sin archivos de terceros): siempre suenan igual y su
// contenido es determinista, así que el mismo efecto se guarda una sola vez en el proyecto.

export const SFX_RATE = 48_000;

export type SfxId = 'pop' | 'whoosh' | 'ding' | 'boing' | 'marker' | 'applause' | 'tada' | 'click';

export const SFX_LABELS: Record<SfxId, string> = {
  pop: 'Pop',
  whoosh: 'Whoosh',
  ding: 'Ding',
  boing: 'Boing',
  marker: 'Rotulador',
  applause: 'Aplausos',
  tada: 'Tachán',
  click: 'Clic',
};

/** Ruido determinista en [-1, 1]. */
function noise(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
}

const buffer = (seconds: number) => new Float32Array(Math.round(seconds * SFX_RATE));

/** Seno con frecuencia variable: integra la fase para que el barrido sea limpio. */
function sweep(out: Float32Array, f: (t: number) => number, env: (t: number) => number, gain = 1) {
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SFX_RATE;
    phase += (2 * Math.PI * f(t)) / SFX_RATE;
    out[i] = out[i]! + gain * env(t) * Math.sin(phase);
  }
}

/** Filtro paso bajo de un polo con corte variable (Hz). */
function lowpass(x: Float32Array, cutoff: (t: number) => number) {
  let y = 0;
  for (let i = 0; i < x.length; i++) {
    const a = 1 - Math.exp((-2 * Math.PI * cutoff(i / SFX_RATE)) / SFX_RATE);
    y += a * (x[i]! - y);
    x[i] = y;
  }
}

function normalize(x: Float32Array<ArrayBuffer>, peak = 0.8): Float32Array<ArrayBuffer> {
  let max = 0;
  for (const v of x) max = Math.max(max, Math.abs(v));
  if (max > 0) for (let i = 0; i < x.length; i++) x[i] = (x[i]! / max) * peak;
  // Sin chasquidos: entrada muy breve (no come el golpe del sonido) y salida de 4 ms.
  const fadeIn = Math.round(0.0005 * SFX_RATE);
  const fadeOut = Math.min(x.length >> 2, Math.round(0.004 * SFX_RATE));
  for (let i = 0; i < fadeIn; i++) x[i] = x[i]! * (i / fadeIn);
  for (let i = 0; i < fadeOut; i++) x[x.length - 1 - i] = x[x.length - 1 - i]! * (i / fadeOut);
  return x;
}

const BUILD: Record<SfxId, () => Float32Array<ArrayBuffer>> = {
  pop: () => {
    const x = buffer(0.14);
    sweep(
      x,
      (t) => 900 * Math.exp(-t * 18) + 220,
      (t) => Math.exp(-t * 32),
    );
    return x;
  },
  whoosh: () => {
    const x = buffer(0.7);
    const r = noise(7);
    for (let i = 0; i < x.length; i++) x[i] = r();
    lowpass(x, (t) => 300 + 3200 * Math.sin((Math.PI * t) / 0.7));
    const env = (t: number) => Math.sin((Math.PI * t) / 0.7) ** 2;
    for (let i = 0; i < x.length; i++) x[i] = x[i]! * env(i / SFX_RATE);
    return x;
  },
  ding: () => {
    const x = buffer(1.4);
    for (const [ratio, gain, decay] of [
      [1, 1, 3],
      [2.76, 0.5, 5],
      [5.4, 0.25, 8],
    ] as const)
      sweep(
        x,
        () => 880 * ratio,
        (t) => Math.exp(-t * decay) * Math.min(1, t * 400),
        gain,
      );
    return x;
  },
  boing: () => {
    const x = buffer(0.6);
    sweep(
      x,
      (t) => 180 + 220 * t + 60 * Math.sin(2 * Math.PI * 16 * t) * Math.exp(-t * 3),
      (t) => Math.exp(-t * 5) * Math.min(1, t * 200),
    );
    return x;
  },
  marker: () => {
    // Rotulador sobre papel: ruido áspero en trazos cortos.
    const x = buffer(1.4);
    const r = noise(21);
    for (let i = 0; i < x.length; i++) x[i] = r();
    lowpass(x, () => 4500);
    for (let i = 0; i < x.length; i++) {
      const t = i / SFX_RATE;
      const stroke = Math.max(0, Math.sin(2 * Math.PI * 3.2 * t)) ** 0.6;
      x[i] = x[i]! * stroke * (0.7 + 0.3 * Math.sin(2 * Math.PI * 11 * t));
    }
    return x;
  },
  applause: () => {
    const x = buffer(2.2);
    const r = noise(99);
    const pick = noise(5);
    // Muchas palmadas cortas al azar, más densas al principio.
    for (let k = 0; k < 260; k++) {
      const start = Math.floor(((pick() + 1) / 2) ** 1.4 * (x.length - 4000));
      const gain = 0.4 + 0.6 * ((pick() + 1) / 2);
      for (let i = 0; i < 1600; i++) x[start + i] = x[start + i]! + gain * r() * Math.exp(-i / 260);
    }
    lowpass(x, () => 6000);
    for (let i = 0; i < x.length; i++) x[i] = x[i]! * Math.min(1, (x.length - i) / (0.6 * SFX_RATE));
    return x;
  },
  tada: () => {
    // Dos notas: la última, un acorde mayor que se sostiene.
    const x = buffer(1.6);
    const note = (from: number, len: number, freqs: number[]) =>
      freqs.forEach((f) =>
        sweep(
          x,
          () => f,
          (t) => (t < from || t > from + len ? 0 : Math.min(1, (t - from) * 60) * Math.exp(-(t - from) * 2.2)),
          1 / freqs.length,
        ),
      );
    note(0, 0.18, [523.25]);
    note(0.18, 1.4, [523.25, 659.25, 783.99, 1046.5]);
    return x;
  },
  click: () => {
    const x = buffer(0.05);
    const r = noise(3);
    for (let i = 0; i < x.length; i++) x[i] = r() * Math.exp(-i / 120);
    sweep(
      x,
      () => 2400,
      (t) => Math.exp(-t * 120),
      0.6,
    );
    return x;
  },
};

/** Muestras mono (48 kHz) del efecto, normalizadas. */
export function synthSfx(id: SfxId): Float32Array<ArrayBuffer> {
  return normalize(BUILD[id]());
}
