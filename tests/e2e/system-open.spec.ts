import { expect, test } from '@playwright/test';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createProject } from '../../src/core/model/factory';
import { encodeProject } from '../../src/main/project-file';
import { launch, stubMessageBox, tempDir } from './helpers';

async function projectFile(dir: string, name: string) {
  const file = path.join(dir, `${name}.dwings`);
  await writeFile(file, encodeProject(createProject({ name, aspect: 'landscape', fps: 30, mode: 'free' }), 'test'));
  return file;
}

test('un .dwings abierto desde el sistema se abre al arrancar y con la app ya abierta', async () => {
  const dir = await tempDir();
  const first = await projectFile(dir, 'Desde el explorador');
  const second = await projectFile(dir, 'Segundo proyecto');
  const userData = await tempDir();

  // Arranque con la ruta en la línea de órdenes (doble clic en el archivo).
  const { app, page } = await launch(userData, [first]);
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Desde el explorador');

  // Otra instancia con otro archivo: no abre una segunda ventana, se lo pasa a la primera.
  const electron = path.join(
    process.cwd(),
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'electron.cmd' : 'electron',
  );
  const extra = process.platform === 'linux' && (process.getuid?.() === 0 || process.env.CI) ? ['--no-sandbox'] : [];
  const child = spawn(electron, ['.', second, ...extra], {
    env: { ...process.env, DW_USER_DATA: userData },
    shell: process.platform === 'win32',
    stdio: 'ignore',
  });
  const exited = new Promise<number | null>((r) => child.on('exit', r));
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Segundo proyecto', { timeout: 15_000 });
  await exited;
  expect(app.windows()).toHaveLength(1);
  await stubMessageBox(app, 1);
  await app.close();
});
