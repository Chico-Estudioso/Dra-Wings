import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

const alias = {
  '@core': resolve(import.meta.dirname, 'src/core'),
  '@shared': resolve(import.meta.dirname, 'src/shared'),
};

export default defineConfig({
  main: {
    resolve: { alias },
    build: { externalizeDeps: { exclude: ['nanoid', 'zod', 'fflate'] } },
  },
  preload: {
    resolve: { alias },
    // El preload con sandbox debe ser CommonJS y autocontenido.
    build: { externalizeDeps: false, rollupOptions: { output: { format: 'cjs' } } },
  },
  renderer: {
    resolve: { alias },
    plugins: [react()],
  },
});
