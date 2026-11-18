// Genera out/licenses/THIRD_PARTY_LICENSES.txt con la licencia de cada dependencia de producción
// (incluidas las transitivas) que va empaquetada en la aplicación. Electron y Chromium añaden las
// suyas por su cuenta (LICENSE.electron.txt y LICENSES.chromium.html junto al ejecutable).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const tree = JSON.parse(
  execFileSync('npm', ['ls', '--omit=dev', '--all', '--json'], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  }),
);

const found = new Map();
(function walk(deps) {
  for (const [name, info] of Object.entries(deps ?? {})) {
    if (!info.version || found.has(`${name}@${info.version}`)) continue;
    found.set(`${name}@${info.version}`, { name, version: info.version });
    walk(info.dependencies);
  }
})(tree.dependencies);

const LICENSE_FILE = /^(licen[cs]e|copying|ofl)(\.(md|txt))?$/i;
const sections = [];
const missing = [];
for (const { name, version } of [...found.values()].sort((a, b) => a.name.localeCompare(b.name))) {
  const dir = path.join(root, 'node_modules', name);
  if (!existsSync(dir)) continue;
  const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const license = typeof pkg.license === 'string' ? pkg.license : (pkg.license?.type ?? 'desconocida');
  const file = readdirSync(dir).find((f) => LICENSE_FILE.test(f));
  if (!file) missing.push(`${name}@${version}`);
  const text = file
    ? readFileSync(path.join(dir, file), 'utf8').trim()
    : `(Licencia ${license}; el paquete no incluye el texto.)`;
  sections.push(
    `${'='.repeat(78)}\n${name} ${version} — ${license}\n${pkg.homepage ?? ''}\n${'='.repeat(78)}\n\n${text}\n`,
  );
}

const header = `Dra-Wings incluye el siguiente software de terceros (${sections.length} paquetes).\n\n`;
const out = path.join(root, 'out', 'licenses');
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'THIRD_PARTY_LICENSES.txt'), header + sections.join('\n'));
console.log(`Licencias de ${sections.length} paquetes en out/licenses/THIRD_PARTY_LICENSES.txt`);
if (missing.length) console.log(`Sin archivo de licencia (se cita el campo de package.json): ${missing.join(', ')}`);
