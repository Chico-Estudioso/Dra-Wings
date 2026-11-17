// Verificación independiente con ffprobe/ffmpeg de los MP4 generados por el prototipo.
// Uso: node scripts/verify-ffmpeg.mjs [carpeta-out]
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';

const outDir = path.resolve(process.argv[2] || 'out');
const MARKS = [1, 2, 3, 4];

function run(bin, args) {
  const r = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`${bin} falló: ${r.stderr.slice(-500)}`);
  return r;
}

function probe(file) {
  const j = JSON.parse(run('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file]).stdout);
  const v = j.streams.find((s) => s.codec_type === 'video');
  const a = j.streams.find((s) => s.codec_type === 'audio');
  return {
    container: j.format.format_name,
    durationS: +j.format.duration,
    video: v && { codec: v.codec_name, profile: v.profile, w: v.width, h: v.height, fps: v.avg_frame_rate, frames: +v.nb_frames, startS: +v.start_time, pixFmt: v.pix_fmt },
    audio: a && { codec: a.codec_name, rate: +a.sample_rate, ch: a.channels, startS: +a.start_time, durationS: +a.duration },
  };
}

function flashOnsets(file) {
  const r = run('ffmpeg', ['-hide_banner', '-i', file, '-vf', 'signalstats,metadata=print:key=lavfi.signalstats.YAVG', '-an', '-f', 'null', '-']);
  const lines = r.stderr.split('\n');
  const onsets = [];
  let pts = null;
  let prevDark = false;
  for (const l of lines) {
    const m = l.match(/pts_time:([\d.]+)/);
    if (m) pts = +m[1];
    const y = l.match(/YAVG=([\d.]+)/);
    if (y && pts !== null) {
      const dark = +y[1] < 60;
      if (dark && !prevDark) onsets.push(pts);
      prevDark = dark;
    }
  }
  return onsets;
}

function beepOnsets(file) {
  const r = run('ffmpeg', ['-hide_banner', '-i', file, '-af', 'silencedetect=n=-20dB:d=0.05', '-vn', '-f', 'null', '-']);
  return [...r.stderr.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]).filter((t) => t < 4.9);
}

const files = readdirSync(outDir).filter((f) => f.endsWith('.mp4'));
const report = {};
for (const f of files) {
  const file = path.join(outDir, f);
  const video = flashOnsets(file);
  const audio = beepOnsets(file);
  report[f] = {
    probe: probe(file),
    sync: MARKS.map((m, i) => ({ markS: m, videoS: video[i] ?? null, audioS: audio[i] ?? null, avOffsetMs: video[i] != null && audio[i] != null ? +((audio[i] - video[i]) * 1000).toFixed(1) : null })),
  };
}
console.log(JSON.stringify(report, null, 2));
