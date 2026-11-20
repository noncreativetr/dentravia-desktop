// The only bridge from the page to the program: bring the window to the front (a notification was clicked), and
// open / close RustDesk for remote support after the person allowed it in Dentravia's support window.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('dentravia', {
  desktop: true,
  focus: () => ipcRenderer.send('dentravia:focus'),
  remoteStart: options => ipcRenderer.invoke('dentravia:remote-start', { host: String(options?.host ?? ''), key: String(options?.key ?? '') }),
  remoteStop: () => ipcRenderer.invoke('dentravia:remote-stop')
});
