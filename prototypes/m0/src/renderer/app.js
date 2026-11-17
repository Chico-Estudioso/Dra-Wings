// Orquestador del prototipo M0 (hilo de interfaz del renderer).
import { Input, BufferSource, ALL_FORMATS, CanvasSink, AudioBufferSink } from 'mediabunny';
import {
  buildScene,
  buildStressStrokes,
  renderFrame,
  renderAudioMix,
  strokeOutline,
  outlineToPath,
  W,
  H,
  FPS,
  DURATION_S,
  SYNC_MARKS_S,
} from '../shared/scene.js';

const results = { startedAt: new Date().toISOString() };
const log = (m) => {
  window.proto.log(m);
  document.getElementById('log').textContent += m + '\n';
};

async function sha256(bytes) {
  const d = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function probe() {
  const video = [
    ['H.264 baseline', 'avc1.42001f'],
    ['H.264 high', 'avc1.640028'],
    ['HEVC', 'hvc1.1.6.L93.B0'],
    ['VP9', 'vp09.00.10.08'],
    ['AV1', 'av01.0.04M.08'],
  ];
  const audio = [
    ['AAC-LC', 'mp4a.40.2'],
    ['Opus', 'opus'],
    ['FLAC', 'flac'],
  ];
  const out = { videoEncoders: {}, audioEncoders: {}, videoDecoders: {}, audioDecoders: {} };
  for (const [name, codec] of video) {
    for (const hw of ['no-preference', 'prefer-hardware', 'prefer-software']) {
      const cfg = { codec, width: W, height: H, bitrate: 6_000_000, framerate: FPS, hardwareAcceleration: hw };
      let ok = false;
      try {
        ok = (await VideoEncoder.isConfigSupported(cfg)).supported;
      } catch (e) {
        ok = `error: ${e.message}`;
      }
      out.videoEncoders[`${name} [${hw}]`] = ok;
    }
    try {
      out.videoDecoders[name] = (await VideoDecoder.isConfigSupported({ codec, codedWidth: W, codedHeight: H })).supported;
    } catch (e) {
      out.videoDecoders[name] = `error: ${e.message}`;
    }
  }
  for (const [name, codec] of audio) {
    try {
      out.audioEncoders[name] = (
        await AudioEncoder.isConfigSupported({ codec, sampleRate: 48000, numberOfChannels: 2, bitrate: 192_000 })
      ).supported;
    } catch (e) {
      out.audioEncoders[name] = `error: ${e.message}`;
    }
    try {
      out.audioDecoders[name] = (await AudioDecoder.isConfigSupported({ codec, sampleRate: 48000, numberOfChannels: 2 })).supported;
    } catch (e) {
      out.audioDecoders[name] = `error: ${e.message}`;
    }
  }
  out.pointer = {
    pointerEvents: 'PointerEvent' in window,
    getCoalescedEvents: 'getCoalescedEvents' in PointerEvent.prototype,
    getPredictedEvents: 'getPredictedEvents' in PointerEvent.prototype,
    pointerrawupdate: 'onpointerrawupdate' in window,
  };
  out.offscreenCanvas = typeof OffscreenCanvas === 'function';
  out.isSecureContext = window.isSecureContext;
  out.hardwareConcurrency = navigator.hardwareConcurrency;
  return out;
}

async function determinism(scene) {
  const make = (opts) => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return c.getContext('2d', opts);
  };
  const ctx = make({ willReadFrequently: true });
  const times = [0, 0.733, 1.05, 2.5, 3.3, 4.966];
  const hashes = (order, cache) =>
    order.reduce(async (accP, t) => {
      const acc = await accP;
      renderFrame(ctx, scene, t, Math.round(t * FPS), cache);
      acc[t] = await sha256(ctx.getImageData(0, 0, W, H).data);
      return acc;
    }, Promise.resolve({}));
  const fwd = await hashes(times, null);
  const rev = await hashes([...times].reverse(), new Map());
  const sameOrderIndependent = times.every((t) => fwd[t] === rev[t]);

  // Lienzo acelerado (por defecto) frente a lienzo de lectura frecuente (software).
  const gpu = make({});
  const t = 1.6;
  renderFrame(gpu, scene, t, 48, null);
  renderFrame(ctx, scene, t, 48, null);
  const a = gpu.getImageData(0, 0, W, H).data;
  const b = ctx.getImageData(0, 0, W, H).data;
  let maxDiff = 0;
  let diffPixels = 0;
  for (let i = 0; i < a.length; i += 4) {
    const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
    if (d > 0) diffPixels++;
    if (d > maxDiff) maxDiff = d;
  }
  return { times, sameOrderIndependent, acceleratedVsSoftware: { maxChannelDiff: maxDiff, differingPixels: diffPixels } };
}

function benchmark() {
  const strokes = buildStressStrokes(2000, 60);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  let t0 = performance.now();
  const paths = strokes.map((s) => outlineToPath(strokeOutline(s.points, s.size, true)));
  const outlineMs = performance.now() - t0;
  const frames = 20;
  t0 = performance.now();
  for (let f = 0; f < frames; f++) {
    ctx.fillStyle = '#f7f4ec';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1d1d1f';
    for (const p of paths) ctx.fill(p);
  }
  ctx.getImageData(0, 0, 1, 1); // fuerza la finalización del dibujo
  const drawMs = (performance.now() - t0) / frames;
  t0 = performance.now();
  for (let f = 0; f < frames; f++) outlineToPath(strokeOutline(strokes[f].points, strokes[f].size, false));
  const partialMs = (performance.now() - t0) / frames;
  return {
    strokes: strokes.length,
    pointsPerStroke: 60,
    outlineAllStrokesMs: +outlineMs.toFixed(1),
    drawCachedFrameMs: +drawMs.toFixed(2),
    recomputePartialStrokeMs: +partialMs.toFixed(3),
  };
}

// Verificación independiente del archivo final: demultiplexa, decodifica y mide marcas de imagen y sonido.
async function verifyMp4(bytes) {
  const input = new Input({ source: new BufferSource(bytes), formats: ALL_FORMATS });
  const v = await input.getPrimaryVideoTrack();
  const a = await input.getPrimaryAudioTrack();
  const vStats = await v.computePacketStats();
  const res = {
    sizeBytes: bytes.byteLength,
    durationS: +(await input.computeDuration()).toFixed(4),
    video: {
      codec: await v.getCodecParameterString(),
      width: await v.getCodedWidth(),
      height: await v.getCodedHeight(),
      frames: vStats.packetCount,
      fps: +vStats.averagePacketRate.toFixed(3),
      durationS: +(await v.computeDuration()).toFixed(4),
    },
    audio: a
      ? {
          codec: await a.getCodecParameterString(),
          sampleRate: await a.getSampleRate(),
          channels: await a.getNumberOfChannels(),
          durationS: +(await a.computeDuration()).toFixed(4),
        }
      : null,
  };
  const flashOnsets = [];
  let prevDark = false;
  for await (const w of new CanvasSink(v, { width: 64, height: 36, fit: 'fill' }).canvases()) {
    const d = w.canvas.getContext('2d').getImageData(0, 0, 64, 36).data;
    let s = 0;
    for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    const dark = s / (64 * 36) < 60;
    if (dark && !prevDark) flashOnsets.push(w.timestamp);
    prevDark = dark;
  }
  const beepOnsets = [];
  if (a) {
    let lastLoud = -1;
    for await (const w of new AudioBufferSink(a).buffers()) {
      const ch = w.buffer.getChannelData(0);
      const sr = w.buffer.sampleRate;
      for (let i = 0; i < ch.length; i++) {
        if (Math.abs(ch[i]) > 0.3) {
          const tt = w.timestamp + i / sr;
          if (tt - lastLoud > 0.3) beepOnsets.push(tt);
          lastLoud = tt;
        }
      }
    }
  }
  res.sync = SYNC_MARKS_S.map((m, i) => ({
    markS: m,
    videoS: flashOnsets[i] !== undefined ? +flashOnsets[i].toFixed(4) : null,
    audioS: beepOnsets[i] !== undefined ? +beepOnsets[i].toFixed(4) : null,
    avOffsetMs: flashOnsets[i] !== undefined && beepOnsets[i] !== undefined ? +((beepOnsets[i] - flashOnsets[i]) * 1000).toFixed(1) : null,
  }));
  res.extraOnsets = { video: flashOnsets.length, audio: beepOnsets.length };
  return res;
}

// Mide la respuesta del hilo de interfaz mientras trabaja el worker.
function watchUiThread() {
  let last = performance.now();
  let maxGap = 0;
  const id = setInterval(() => {
    const now = performance.now();
    maxGap = Math.max(maxGap, now - last);
    last = now;
  }, 16);
  return () => {
    clearInterval(id);
    return +maxGap.toFixed(1);
  };
}

function runWorker(worker, message, transfer, onProgress) {
  return new Promise((resolve, reject) => {
    worker.onmessage = (e) => {
      if (e.data.type === 'progress') onProgress?.(e.data);
      else if (e.data.type === 'error') reject(new Error(e.data.message));
      else resolve(e.data);
    };
    worker.postMessage(message, transfer);
  });
}

async function exportWithWebCodecs(mix) {
  const worker = new Worker('./export-worker.js');
  const channels = [mix.getChannelData(0).slice(), mix.getChannelData(1).slice()];
  const stop = watchUiThread();
  const r = await runWorker(
    worker,
    { type: 'export-webcodecs', channels, sampleRate: mix.sampleRate },
    channels.map((c) => c.buffer),
    (p) => log(`  webcodecs: fotograma ${p.done}/${p.total}`),
  );
  const maxUiGapMs = stop();
  worker.terminate();
  const bytes = new Uint8Array(r.buffer);
  const path = await window.proto.writeOutput('export-webcodecs.mp4', bytes);
  return { ...r.info, maxUiGapMs, path, verification: await verifyMp4(bytes) };
}

function wav16(mix) {
  const n = mix.length;
  const ch = mix.numberOfChannels;
  const buf = new ArrayBuffer(44 + n * ch * 2);
  const dv = new DataView(buf);
  const str = (o, s) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  dv.setUint32(4, 36 + n * ch * 2, true);
  str(8, 'WAVEfmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, ch, true);
  dv.setUint32(24, mix.sampleRate, true);
  dv.setUint32(28, mix.sampleRate * ch * 2, true);
  dv.setUint16(32, ch * 2, true);
  dv.setUint16(34, 16, true);
  str(36, 'data');
  dv.setUint32(40, n * ch * 2, true);
  const data = [...Array(ch).keys()].map((c) => mix.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++)
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, data[c][i]));
      dv.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  return new Uint8Array(buf);
}

// Recorre los fotogramas del worker: compara cada uno con la previsualización y, si hay ffmpeg, los codifica.
async function workerFramesVsPreview(scene, useFfmpeg, mix) {
  const worker = new Worker('./export-worker.js');
  const ctx = Object.assign(document.createElement('canvas'), { width: W, height: H }).getContext('2d', { willReadFrequently: true });
  const cache = new Map();
  let identical = 0;
  let compared = 0;
  const t0 = performance.now();
  if (useFfmpeg) {
    await window.proto.writeOutput('mix.wav', wav16(mix));
    await window.proto.ffmpegStart({ width: W, height: H, fps: FPS, audio: 'mix.wav', output: 'export-ffmpeg.mp4' });
  }
  const stop = watchUiThread();
  await runWorker(worker, { type: 'raw-start' }, []);
  for (;;) {
    const m = await runWorker(worker, { type: 'raw-next' }, []);
    if (m.type === 'raw-end') break;
    const workerPixels = new Uint8Array(m.data);
    renderFrame(ctx, scene, m.f / FPS, m.f, cache);
    const preview = new Uint8Array(ctx.getImageData(0, 0, W, H).data.buffer);
    compared++;
    if ((await sha256(workerPixels)) === (await sha256(preview))) identical++;
    if (useFfmpeg) await window.proto.ffmpegFrame(workerPixels);
  }
  const maxUiGapMs = stop();
  worker.terminate();
  const out = { framesCompared: compared, framesIdentical: identical, maxUiGapMs };
  if (useFfmpeg) {
    out.ffmpeg = await window.proto.ffmpegEnd();
    out.ffmpeg.totalMs = Math.round(performance.now() - t0);
    if (out.ffmpeg.code === 0) out.ffmpeg.verification = await verifyMp4(await window.proto.readOutput('export-ffmpeg.mp4'));
  }
  return out;
}

async function main() {
  const cfg = await window.proto.config();
  results.environment = cfg;
  log(`Electron ${cfg.versions.electron} / Chromium ${cfg.versions.chrome} / ${cfg.platform}-${cfg.arch}`);

  results.capabilities = await probe();
  log('Capacidades:\n' + JSON.stringify(results.capabilities, null, 2));

  const scene = buildScene();
  results.determinism = await determinism(scene);
  log('Determinismo: ' + JSON.stringify(results.determinism));

  results.benchmark = benchmark();
  log('Rendimiento: ' + JSON.stringify(results.benchmark));

  const mix = await renderAudioMix(48000);
  log(`Mezcla de audio: ${mix.duration}s, ${mix.numberOfChannels} canales`);

  try {
    results.exportWebCodecs = await exportWithWebCodecs(mix);
    log('Exportación WebCodecs: ' + JSON.stringify(results.exportWebCodecs, null, 2));
  } catch (e) {
    results.exportWebCodecs = { error: String(e?.stack || e) };
    log('Exportación WebCodecs FALLÓ: ' + e);
  }

  try {
    results.previewVsExport = await workerFramesVsPreview(scene, cfg.ffmpeg.available, mix);
    log('Preview frente a worker (+ffmpeg): ' + JSON.stringify(results.previewVsExport, null, 2));
  } catch (e) {
    results.previewVsExport = { error: String(e?.stack || e) };
    log('Comparación/ffmpeg FALLÓ: ' + e);
  }

  results.finishedAt = new Date().toISOString();
  await window.proto.writeOutput(`results-${cfg.platform}.json`, new TextEncoder().encode(JSON.stringify(results, null, 2)));
  window.proto.done(results.exportWebCodecs.error ? 1 : 0);
}

main().catch((e) => {
  log('ERROR: ' + (e?.stack || e));
  window.proto.done(2);
});
