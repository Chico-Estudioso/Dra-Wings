// API mínima y explícita para el renderer del prototipo.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('proto', {
  config: () => ipcRenderer.invoke('proto:config'),
  writeOutput: (name, bytes) => ipcRenderer.invoke('proto:write-output', name, bytes),
  readOutput: (name) => ipcRenderer.invoke('proto:read-output', name),
  ffmpegStart: (opts) => ipcRenderer.invoke('proto:ffmpeg-start', opts),
  ffmpegFrame: (bytes) => ipcRenderer.invoke('proto:ffmpeg-frame', bytes),
  ffmpegEnd: () => ipcRenderer.invoke('proto:ffmpeg-end'),
  log: (m) => ipcRenderer.send('proto:log', m),
  done: (code) => ipcRenderer.send('proto:done', code),
});
