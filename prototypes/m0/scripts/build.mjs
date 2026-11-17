// Empaqueta el renderer y el worker con esbuild en dist/.
import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
await mkdir(dist, { recursive: true });
const common = { bundle: true, format: 'iife', platform: 'browser', target: 'chrome130', logLevel: 'warning' };
await build({ ...common, entryPoints: [path.join(root, 'src/renderer/app.js')], outfile: path.join(dist, 'app.js') });
await build({ ...common, entryPoints: [path.join(root, 'src/renderer/export-worker.js')], outfile: path.join(dist, 'export-worker.js') });
await copyFile(path.join(root, 'src/renderer/index.html'), path.join(dist, 'index.html'));
console.log('Build listo en', dist);
