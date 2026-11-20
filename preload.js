// The only bridge from the page to the program: bring the window to the front (a notification was clicked), and
// open / close RustDesk for remote support after the person allowed it in Dentravia's support window.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('dentravia', {
  desktop: true,
  focus: () => ipcRenderer.send('dentravia:focus'),
  remoteStart: options => ipcRenderer.invoke('dentravia:remote-start', { host: String(options?.host ?? ''), key: String(options?.key ?? '') }),
  remoteStop: () => ipcRenderer.invoke('dentravia:remote-stop'),
  // Program updates: the page shows "Yeni güncelleme var" and installs with one click.
  updates: {
    state: () => ipcRenderer.invoke('dentravia:update-state'),
    check: () => ipcRenderer.invoke('dentravia:update-check'),
    install: () => ipcRenderer.invoke('dentravia:update-install'),
    onChange: callback => { const listener = (_event, state) => callback(state); ipcRenderer.on('dentravia:update', listener); return () => ipcRenderer.removeListener('dentravia:update', listener); }
  }
});
