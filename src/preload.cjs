'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('astra', {
  start: () => ipcRenderer.invoke('astra:start'),
  openProjectFolder: () => ipcRenderer.invoke('astra:open-project-folder'),
  openDocker: () => ipcRenderer.invoke('astra:open-docker'),
  onStatus: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('astra:status', listener);
    return () => ipcRenderer.removeListener('astra:status', listener);
  },
});
