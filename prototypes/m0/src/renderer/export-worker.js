// Worker de exportación: renderiza fuera del hilo de interfaz con el mismo renderFrame que la previsualización.
import {
  Output,
  Mp4OutputFormat,
  BufferTarget,
  CanvasSource,
  AudioSampleSource,
  AudioSample,
  QUALITY_HIGH,
  getFirstEncodableVideoCodec,
  getFirstEncodableAudioCodec,
} from 'mediabunny';
import { buildScene, renderFrame, W, H, FPS, DURATION_S } from '../shared/scene.js';

const scene = buildScene();

function planarSlice(channels, from, to) {
  const len = to - from;
  const out = new Float32Array(len * channels.length);
  channels.forEach((ch, c) => out.set(ch.subarray(from, to), c * len));
  return out;
}

async function exportWebCodecs({ channels, sampleRate }) {
  const t0 = performance.now();
  const videoCodec = await getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width: W, height: H });
  const audioCodec = await getFirstEncodableAudioCodec(['aac', 'opus'], { numberOfChannels: 2, sampleRate });
  if (!videoCodec || !audioCodec) throw new Error(`Sin códec disponible (vídeo=${videoCodec}, audio=${audioCodec})`);

  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  let videoEncoderConfig = null;
  let audioEncoderConfig = null;
  const video = new CanvasSource(canvas, {
    codec: videoCodec,
    quality: QUALITY_HIGH,
    keyFrameInterval: 2,
    onEncoderConfig: (c) => (videoEncoderConfig = { codec: c.codec, hardwareAcceleration: c.hardwareAcceleration ?? null }),
  });
  const audio = new AudioSampleSource({
    codec: audioCodec,
    quality: QUALITY_HIGH,
    onEncoderConfig: (c) => (audioEncoderConfig = { codec: c.codec, bitrate: c.bitrate ?? null }),
  });
  output.addVideoTrack(video, { frameRate: FPS });
  output.addAudioTrack(audio);
  await output.start();

  const totalFrames = Math.round(DURATION_S * FPS);
  const cache = new Map();
  let audioCursor = 0;
  const totalSamples = channels[0].length;
  for (let f = 0; f < totalFrames; f++) {
    const t = f / FPS;
    // Audio intercalado por segundos para no acumular todo en memoria.
    if (f % FPS === 0 && audioCursor < totalSamples) {
      const end = Math.min(totalSamples, audioCursor + sampleRate);
      const sample = new AudioSample({
        data: planarSlice(channels, audioCursor, end),
        format: 'f32-planar',
        numberOfChannels: channels.length,
        sampleRate,
        timestamp: audioCursor / sampleRate,
      });
      await audio.add(sample);
      sample.close();
      audioCursor = end;
    }
    renderFrame(ctx, scene, t, f, cache);
    await video.add(t, 1 / FPS);
    if (f % 15 === 0) postMessage({ type: 'progress', done: f, total: totalFrames });
  }
  await output.finalize();
  const buffer = output.target.buffer;
  return {
    buffer,
    info: { videoCodec, audioCodec, videoEncoderConfig, audioEncoderConfig, ms: Math.round(performance.now() - t0) },
  };
}

// Variante FFmpeg: el worker solo produce píxeles RGBA; el proceso principal los envía a ffmpeg por stdin.
async function* rawFrames() {
  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const cache = new Map();
  const totalFrames = Math.round(DURATION_S * FPS);
  for (let f = 0; f < totalFrames; f++) {
    renderFrame(ctx, scene, f / FPS, f, cache);
    yield { f, totalFrames, data: ctx.getImageData(0, 0, W, H).data };
  }
}

let frameIter = null;

onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'export-webcodecs') {
      const { buffer, info } = await exportWebCodecs(msg);
      postMessage({ type: 'done', buffer, info }, [buffer]);
    } else if (msg.type === 'raw-start') {
      frameIter = rawFrames();
      postMessage({ type: 'raw-ready' });
    } else if (msg.type === 'raw-next') {
      const { value, done } = await frameIter.next();
      if (done) postMessage({ type: 'raw-end' });
      else postMessage({ type: 'raw-frame', f: value.f, total: value.totalFrames, data: value.data.buffer }, [value.data.buffer]);
    }
  } catch (err) {
    postMessage({ type: 'error', message: String(err?.stack || err) });
  }
};
