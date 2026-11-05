'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('astra', {
  start: () => ipcRenderer.invoke('astra:start'),
  openProjectFolder: () => ipcRenderer.invoke('astra:open-project-folder'),
  addWorkspaceRoot: () => ipcRenderer.invoke('astra:add-workspace-root'),
  listWorkspaceRoots: () => ipcRenderer.invoke('astra:list-workspace-roots'),
  openDocker: () => ipcRenderer.invoke('astra:open-docker'),
  onStatus: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('astra:status', listener);
    return () => ipcRenderer.removeListener('astra:status', listener);
  },
});
