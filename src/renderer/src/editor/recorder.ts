// Grabación de la narración con el micrófono. Se graba con MediaRecorder y, al terminar, se
// convierte a WAV mono a 48 kHz (la misma frecuencia que el resto del audio de la app).
import { downmix, encodeWav, rms } from '@core/audio/wav';
import { AUDIO_SAMPLE_RATE } from './media';

export class MicError extends Error {}

function micMessage(e: unknown): string {
  const name = e instanceof DOMException ? e.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'El micrófono está bloqueado. En Windows, actívalo en Configuración → Privacidad y seguridad → Micrófono (también para las aplicaciones de escritorio).';
  if (name === 'NotFoundError' || name === 'OverconstrainedError')
    return 'No se encuentra ningún micrófono. Conecta uno y vuelve a intentarlo.';
  if (name === 'NotReadableError') return 'Otro programa está usando el micrófono. Ciérralo y vuelve a intentarlo.';
  return 'No se pudo abrir el micrófono.';
}

export class NarrationRecorder {
  private chunks: Blob[] = [];
  private recorder: MediaRecorder | null = null;
  private readonly buffer: Float32Array<ArrayBuffer>;

  private constructor(
    private readonly stream: MediaStream,
    private readonly ctx: AudioContext,
    private readonly analyser: AnalyserNode,
  ) {
    this.buffer = new Float32Array(analyser.fftSize);
  }

  static async open(): Promise<NarrationRecorder> {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (e) {
      throw new MicError(micMessage(e));
    }
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    return new NarrationRecorder(stream, ctx, analyser);
  }

  /** Nivel actual de la entrada (0..1, escalado para que la voz normal llene media barra). */
  level(): number {
    this.analyser.getFloatTimeDomainData(this.buffer);
    return Math.min(1, rms(this.buffer) * 4);
  }

  get recording(): boolean {
    return this.recorder?.state === 'recording';
  }

  start(): void {
    this.chunks = [];
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
    this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.recorder.ondataavailable = (e) => e.data.size > 0 && this.chunks.push(e.data);
    this.recorder.start(250);
  }

  stop(): Promise<Blob> {
    const rec = this.recorder;
    if (!rec || rec.state === 'inactive') return Promise.resolve(new Blob(this.chunks));
    return new Promise((resolve) => {
      rec.onstop = () => resolve(new Blob(this.chunks, { type: rec.mimeType }));
      rec.stop();
    });
  }

  close(): void {
    if (this.recorder?.state === 'recording') this.recorder.stop();
    for (const t of this.stream.getTracks()) t.stop();
    void this.ctx.close().catch(() => undefined);
  }
}

/** Convierte una grabación a WAV mono de 16 bits a 48 kHz. */
export async function recordingToWav(blob: Blob): Promise<{ bytes: Uint8Array<ArrayBuffer>; seconds: number }> {
  const decoded = await new OfflineAudioContext(1, 1, AUDIO_SAMPLE_RATE).decodeAudioData(await blob.arrayBuffer());
  const channels = Array.from({ length: decoded.numberOfChannels }, (_, c) => decoded.getChannelData(c));
  return { bytes: encodeWav(downmix(channels), decoded.sampleRate), seconds: decoded.duration };
}
