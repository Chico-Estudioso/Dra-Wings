import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '@core/model/factory';
import { useApp } from '../../src/renderer/src/state/app-store';

const project = () => createProject({ name: 'Original', aspect: 'landscape', fps: 30, mode: 'guided' });
const s = () => useApp.getState();

beforeEach(() => {
  s().closeDoc();
  s().openDoc(project(), '/tmp/a.dwings');
});

describe('historial de edición', () => {
  it('apply marca el documento como modificado y se puede deshacer y rehacer', () => {
    s().apply('Renombrar', (p) => void (p.name = 'Nuevo'));
    s().apply('Modo', (p) => void (p.settings.mode = 'free'));
    expect(s().doc).toMatchObject({ dirty: true, saveStatus: 'unsaved' });
    expect(s().doc!.project.name).toBe('Nuevo');

    s().undo();
    expect(s().doc!.project.settings.mode).toBe('guided');
    s().undo();
    expect(s().doc!.project.name).toBe('Original');
    s().undo(); // sin más historial: no hace nada
    expect(s().future).toHaveLength(2);

    s().redo();
    s().redo();
    expect(s().doc!.project).toMatchObject({ name: 'Nuevo', settings: { mode: 'free' } });
  });

  it('una edición nueva descarta el futuro y las ediciones sin cambios no crean historial', () => {
    s().apply('A', (p) => void (p.name = 'A'));
    s().undo();
    s().apply('B', (p) => void (p.name = 'B'));
    expect(s().future).toHaveLength(0);
    s().apply('Nada', () => {});
    expect(s().past).toHaveLength(1);
  });

  it('markSaved limpia el estado solo si no hubo ediciones durante el guardado', () => {
    s().apply('A', (p) => void (p.name = 'A'));
    const snapshot = s().doc!.project;
    s().markSaved('/tmp/a.dwings', '2026-01-01T00:00:00.000Z', snapshot);
    expect(s().doc).toMatchObject({ dirty: false, saveStatus: 'saved' });

    s().apply('B', (p) => void (p.name = 'B'));
    const snap2 = s().doc!.project;
    s().apply('C', (p) => void (p.name = 'C')); // edición mientras se guarda
    s().markSaved('/tmp/a.dwings', '2026-01-01T00:00:01.000Z', snap2);
    expect(s().doc).toMatchObject({ dirty: true, saveStatus: 'unsaved' });
  });
});
