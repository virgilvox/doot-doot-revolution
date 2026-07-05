// Preload: expose one wrapper method per IPC channel on window.doot, never the raw
// ipcRenderer. Bundled to a single file, as the sandbox requires. The renderer
// gets a desktop flag, a CORS-free audio fetch, and a filesystem-backed song
// library keyed by id. Serialization stays in the renderer; the main process only
// moves strings.

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('doot', {
  isDesktop: true,
  fetchAudio: (url) => ipcRenderer.invoke('audio:fetch', url),
  fetchYouTube: (url) => ipcRenderer.invoke('audio:youtube', url),
  lib: {
    dir: () => ipcRenderer.invoke('lib:dir'),
    choose: () => ipcRenderer.invoke('lib:choose'),
    list: () => ipcRenderer.invoke('lib:list'),
    read: (id) => ipcRenderer.invoke('lib:read', id),
    put: (id, json) => ipcRenderer.invoke('lib:put', id, json),
    remove: (id) => ipcRenderer.invoke('lib:remove', id),
    reveal: () => ipcRenderer.invoke('lib:reveal')
  },
  // auto-update: subscribe to status (available/ready/error) and trigger the install
  onUpdate: (cb) => ipcRenderer.on('update:status', (_e, data) => cb(data)),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  checkUpdate: () => ipcRenderer.invoke('update:check')
});
