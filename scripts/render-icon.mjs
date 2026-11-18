// Genera build/icon.png (512×512) a partir de build/icon.svg con el Chromium de Playwright.
// electron-builder crea a partir de él el .ico de Windows. Uso: node scripts/render-icon.mjs
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const svg = await readFile(path.join(root, 'build/icon.svg'), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
await page.setContent(
  `<html><body style="margin:0;background:transparent">${svg.replace('<svg ', '<svg width="512" height="512" ')}</body></html>`,
);
await page.screenshot({ path: path.join(root, 'build/icon.png'), omitBackground: true });
await browser.close();
console.log('build/icon.png generado');
