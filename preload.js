// The only bridge from the page to the program: bring the window to the front (a notification was clicked).
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('dentravia', { desktop: true, focus: () => ipcRenderer.send('dentravia:focus') });
