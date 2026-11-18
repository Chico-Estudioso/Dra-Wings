// Worker que analiza el ritmo de un audio (puede tardar un segundo en una canción entera).
import { detectBeats, type BeatAnalysis } from '@core/audio/beats';

declare const self: {
  postMessage(msg: BeatAnalysis | null): void;
  onmessage: ((e: MessageEvent<{ samples: Float32Array; sampleRate: number }>) => void) | null;
};

self.onmessage = (e) => self.postMessage(detectBeats(e.data.samples, e.data.sampleRate));
