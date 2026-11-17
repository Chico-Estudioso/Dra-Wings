// Reproducción: recorre las escenas en orden desde el cabezal. Si hay audio, el reloj maestro es
// el del AudioContext (la imagen sigue al sonido); si el dispositivo de audio no avanza, se usa
// el reloj de pared para que la vista previa no se congele.
import { useEffect } from 'react';
import { scheduleProject, type Scheduled } from '@core/audio/mix';
import { locateTime, projectDuration, sceneStart } from '@core/edit/scenes';
import type { Project } from '@core/model/types';
import { TICKS_PER_SECOND, type Ticks } from '@core/time/ticks';
import { useApp } from '../state/app-store';
import { useEditor } from './editor-store';
import { audioBuffersFor, audioContext, useMediaVersion } from './media';

const START_DELAY = 0.06;
/** Si el reloj del audio no avanza durante este tiempo, se pasa al reloj de pared. */
const STALL_MS = 400;

export function togglePlay(): void {
  const ed = useEditor.getState();
  ed.setPlaying(!ed.playing);
}

const hasAudio = (p: Project) => p.audioTracks.some((t) => !t.muted && t.clips.length > 0);

class PlaybackClock {
  private origin: Ticks;
  private wall0 = performance.now();
  private ctx: AudioContext | null = null;
  private ctx0 = 0;
  private lastCtxTime = -1;
  private lastCtxWall = performance.now();
  private scheduled: Scheduled | null = null;
  private audioClock = false;
  /** Lo que se programó: si cambia el audio del documento o termina una carga, se reprograma. */
  private key: { tracks: Project['audioTracks']; version: number } | null = null;

  constructor(origin: Ticks) {
    this.origin = origin;
  }

  now(): Ticks {
    if (this.audioClock && this.ctx) {
      const ct = this.ctx.currentTime;
      const wall = performance.now();
      if (ct !== this.lastCtxTime) {
        this.lastCtxTime = ct;
        this.lastCtxWall = wall;
      } else if (wall - this.lastCtxWall > STALL_MS) {
        // El dispositivo no consume audio: seguimos con el reloj de pared desde donde íbamos.
        const at = this.origin + Math.max(0, ct - this.ctx0) * TICKS_PER_SECOND;
        this.audioClock = false;
        this.origin = at;
        this.wall0 = wall;
        return at;
      }
      return this.origin + Math.max(0, ct - this.ctx0) * TICKS_PER_SECOND;
    }
    return this.origin + ((performance.now() - this.wall0) / 1000) * TICKS_PER_SECOND;
  }

  /** Programa (o reprograma) el audio desde el instante actual si ha cambiado algo. */
  sync(project: Project, version: number): void {
    if (this.key && this.key.tracks === project.audioTracks && this.key.version === version) return;
    const at = this.key ? this.now() : this.origin;
    this.key = { tracks: project.audioTracks, version };
    this.scheduled?.stop();
    this.scheduled = null;
    if (!hasAudio(project)) {
      this.rebase(at, false);
      return;
    }
    try {
      const ctx = (this.ctx ??= audioContext());
      void ctx.resume().catch(() => undefined);
      this.scheduled = scheduleProject(ctx, project, audioBuffersFor(project), at, { startDelay: START_DELAY });
      this.ctx0 = ctx.currentTime + START_DELAY;
      this.rebase(at, true);
    } catch {
      // Sin audio disponible: la imagen sigue con el reloj de pared.
      this.rebase(at, false);
    }
  }

  private rebase(at: Ticks, audioClock: boolean) {
    this.origin = at;
    this.wall0 = performance.now() + (audioClock ? START_DELAY * 1000 : 0);
    this.audioClock = audioClock;
    this.lastCtxTime = -1;
    this.lastCtxWall = performance.now() + START_DELAY * 1000;
  }

  stop(): void {
    this.scheduled?.stop();
    this.scheduled = null;
  }
}

export function usePlayback(): void {
  const playing = useEditor((s) => s.playing);
  useEffect(() => {
    if (!playing) return;
    const project0 = useApp.getState().doc?.project;
    const ed0 = useEditor.getState();
    if (!project0 || !ed0.sceneId) return;
    const total0 = projectDuration(project0);
    let origin = sceneStart(project0, ed0.sceneId) + ed0.playhead;
    if (origin >= total0 - 1) origin = 0; // al final: vuelve a empezar
    const clock = new PlaybackClock(origin);
    let raf = 0;
    const step = () => {
      const project = useApp.getState().doc?.project;
      const ed = useEditor.getState();
      if (!project || !ed.playing) return;
      clock.sync(project, useMediaVersion.getState().v);
      const g = clock.now();
      const total = projectDuration(project);
      const { scene, local } = locateTime(project, Math.min(g, total));
      if (scene.id !== ed.sceneId) ed.setScene(scene.id, scene.layers[scene.layers.length - 1]!.id);
      ed.setPlayhead(local);
      if (g >= total) {
        ed.setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      clock.stop();
    };
  }, [playing]);
}
