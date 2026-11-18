# Empaquetado y publicación

Estado: el empaquetado para Windows está preparado y se verifica en cada PR. **Publicar** (crear una
release, subir el instalador o distribuirlo de cualquier forma) requiere la aprobación expresa del
propietario del proyecto (CLAUDE.md).

## Construir

```bash
npm run dist:win   # instalador NSIS en dist/Dra-Wings-<versión>-instalador.exe (en Windows)
npm run dist:dir   # aplicación sin instalador en dist/<plataforma>-unpacked (para probar en Linux)
```

Ambos ejecutan `npm run build`, generan `out/licenses/THIRD_PARTY_LICENSES.txt` y llaman a
electron-builder con `--publish never`. Configuración: `electron-builder.yml`.

## Qué lleva la aplicación

- Solo `out/` (proceso principal, preload e interfaz empaquetados por Vite) y `package.json`, dentro
  de `app.asar` (unos 4 MB). No hace falta `node_modules`: todo va empaquetado.
- `resources/licenses/THIRD_PARTY_LICENSES.txt`: licencias de las 62 dependencias de producción
  (MIT, ISC, 0BSD, MPL-2.0 de mediabunny y OFL-1.1 de las fuentes). Se abre desde Ayuda → Licencias
  de terceros. Electron y Chromium añaden `LICENSE.electron.txt` y `LICENSES.chromium.html`.
- Icono original: `build/icon.svg` (fuente) y `build/icon.png` (512 px, generado con
  `node scripts/render-icon.mjs`). electron-builder crea el `.ico`.

## Endurecimiento (fuses de Electron)

| Fuse | Valor | Por qué |
|---|---|---|
| RunAsNode | desactivada | `ELECTRON_RUN_AS_NODE` no convierte la app en un Node genérico |
| EnableNodeOptionsEnvironmentVariable | desactivada | `NODE_OPTIONS` no inyecta opciones |
| EnableNodeCliInspectArguments | desactivada | `--inspect` no abre el depurador |
| GrantFileProtocolExtraPrivileges | desactivada | la interfaz se sirve por `app://`, no por `file://` |
| OnlyLoadAppFromAsar | activada | solo se carga el código de `app.asar` |
| EnableEmbeddedAsarIntegrityValidation | activada | se comprueba la integridad de `app.asar` (Windows y macOS) |
| EnableCookieEncryption | activada | cookies cifradas por el sistema (la app no las usa) |

Se puede comprobar con `npx @electron/fuses read --app <ejecutable>`.

## Instalador (Windows)

- NSIS por usuario (sin permisos de administrador), con opción de cambiar la carpeta, accesos
  directos en el escritorio y el menú Inicio, y en español.
- Asocia la extensión `.dwings`: un doble clic abre el proyecto. Si la app ya está abierta, la
  segunda instancia le pasa el archivo y se cierra (instancia única).
- Desinstalar no borra los datos del usuario (`%APPDATA%\Dra-Wings`: recientes, recuperación y caché
  de medios).

## Verificación automática (CI)

El job `package-windows` de `validate.yml` empaqueta en Windows, instala en silencio, arranca la
aplicación instalada con `DW_SMOKE_TEST=1` (comprueba que carga la interfaz y su API y escribe
`smoke.json`) y desinstala. El instalador **no** se sube como artefacto.

## Pendiente antes de publicar (requiere aprobación)

- **Firma de código:** sin certificado, Windows SmartScreen avisará al descargar e instalar. Hace
  falta un certificado de firma (OV o EV, o Azure Trusted Signing) y configurar `win.signtoolOptions`.
- **Actualizaciones:** no hay actualización automática en el MVP. Si se quiere, electron-updater
  con un canal de publicación aprobado.
- **Pruebas manuales en una instalación limpia de Windows 10 y 11:** instalar, crear, guardar,
  reabrir con doble clic, exportar y reproducir el vídeo en «Películas y TV» y VLC, desinstalar y
  reinstalar encima de una versión anterior.
- **Release candidata:** etiqueta `v0.1.0-rc.1`, notas a partir de `CHANGELOG.md` y publicación en
  GitHub Releases, solo tras la aprobación.
