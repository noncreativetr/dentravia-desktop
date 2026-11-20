// Dentravia masaüstü uygulaması: crm.dentravia.com'u kendi penceresinde açar. Uygulamanın kendisi sunucuda kalır; her
// güncelleme açılışta kendiliğinden gelir. Pencere yalnız Dentravia'yı gösterir: başka adresler (WhatsApp, haritalar,
// web siteleri) varsayılan tarayıcıda açılır. Kodun internetten gelen sayfaya Node.js erişimi yoktur.
// Bildirimler: pencere kapatılınca program sistem tepsisinde çalışmaya devam eder ve Windows açılışında kendiliğinden
// (gizli) başlar; yeni hasta mesajında CRM'in gösterdiği Windows bildirimi gelir.
const { app, BrowserWindow, shell, session, Menu, Tray, nativeImage, ipcMain, Notification } = require('electron');
const { spawn, execFile } = require('node:child_process');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');
const fs = require('node:fs');

const START = process.env.DENTRAVIA_URL || 'https://crm.dentravia.com/';
const ORIGIN = new URL(START).origin;
const sameSite = url => { try { return new URL(url).origin === ORIGIN; } catch { return false; } };
const openOutside = url => { try { if (['https:', 'http:', 'mailto:', 'tel:'].includes(new URL(url).protocol)) void shell.openExternal(url); } catch { /* ignore */ } };

const secure = { contextIsolation: true, sandbox: true, nodeIntegration: false, webviewTag: false, spellcheck: true };
const ICON = path.join(__dirname, 'build/icon.png');
let main = null, tray = null, quitting = false, updateReady = null, refreshTray = () => {};
const hidden = process.argv.includes('--hidden');
const showMain = () => { if (!main) return createWindow(); if (main.isMinimized()) main.restore(); main.show(); main.focus(); };

function guard(contents) {
  // Links to other sites open in the browser; Dentravia's own pages and the print / form windows stay here.
  contents.setWindowOpenHandler(({ url }) => {
    if (!url || url === 'about:blank' || sameSite(url)) {
      return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, icon: path.join(__dirname, 'build/icon.png'), webPreferences: secure } };
    }
    openOutside(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (event, url) => { if (!sameSite(url)) { event.preventDefault(); openOutside(url); } });
  contents.on('will-attach-webview', event => event.preventDefault());
}

function createWindow() {
  main = new BrowserWindow({
    width: 1400, height: 900, minWidth: 380, minHeight: 600, title: 'Dentravia', backgroundColor: '#f6fafc',
    autoHideMenuBar: true, icon: ICON, show: false,
    // Keeps checking for new messages while minimized or in the tray.
    webPreferences: { ...secure, backgroundThrottling: false, preload: path.join(__dirname, 'preload.js') }
  });
  main.once('ready-to-show', () => { if (!hidden) main.show(); });
  // Closing the window keeps the program in the tray (notifications go on); "Çıkış" in the tray menu ends it.
  main.on('close', event => {
    if (quitting) return;
    event.preventDefault(); main.hide();
    if (!tray.shownHint) { tray.shownHint = true; tray.displayBalloon?.({ iconType: 'info', title: 'Dentravia arka planda çalışıyor', content: 'Yeni hasta mesajında bildirim gelir. Kapatmak için simgeye sağ tıklayıp Çıkış.' }); }
  });
  // No internet: a small page with a retry button instead of an empty window.
  main.webContents.on('did-fail-load', (_event, code, _description, url, isMainFrame) => {
    if (isMainFrame && code !== -3 && sameSite(url)) void main.loadFile(path.join(__dirname, 'offline.html'), { query: { url: START } });
  });
  void main.loadURL(START);
}

// --- Canlı destek: RustDesk (açık kaynak uzak masaüstü, AGPL-3.0, resmi 1.5.1 sürümü) programla birlikte gelir. Yalnız
// kişi CRM'deki destek penceresinde "İzin ver"e bastığında açılır; ID'si okunup CRM'e verilir, şifreyi kişi RustDesk
// penceresinden kendisi yazar. "Bağlantıyı bitir" ya da programdan çıkış RustDesk'i kapatır. Kliniğin sunucusu
// tanımlıysa (RUSTDESK_HOST / RUSTDESK_KEY) RustDesk o sunucuya bağlanır; dosya adı RustDesk'in kendi ayar yoludur.
let remote = null;
const rustdeskSource = () => path.join(process.resourcesPath, 'rustdesk', process.arch === 'x64' ? 'rustdesk-x64.exe' : 'rustdesk-x86.exe');
function rustdeskId() {
  // RustDesk keeps its ID in its own settings file (%APPDATA%\RustDesk\config\RustDesk.toml).
  try {
    const file = path.join(app.getPath('appData'), 'RustDesk', 'config', 'RustDesk.toml');
    return (fs.readFileSync(file, 'utf8').match(/^id\s*=\s*['"]?(\d{6,12})['"]?/m) ?? [])[1] ?? '';
  } catch { return ''; }
}
async function startRemote({ host = '', key = '' } = {}) {
  if (process.platform !== 'win32') throw new Error('RustDesk yalnız Windows sürümünde gelir.');
  const source = rustdeskSource();
  if (!fs.existsSync(source)) throw new Error('RustDesk bulunamadı.');
  let exe = source;
  if (host) {
    if (!/^[A-Za-z0-9.-]{3,253}(:\d{2,5})?$/.test(host) || (key && !/^[A-Za-z0-9+/=]{20,100}$/.test(key))) throw new Error('RustDesk sunucu ayarı geçersiz.');
    const dir = path.join(app.getPath('userData'), 'rustdesk');
    fs.mkdirSync(dir, { recursive: true });
    exe = path.join(dir, `rustdesk-host=${host}${key ? `,key=${key}` : ''}.exe`);
    if (!fs.existsSync(exe)) fs.copyFileSync(source, exe);
  }
  if (!remote || remote.exitCode !== null) {
    remote = spawn(exe, [], { detached: false, stdio: 'ignore', windowsHide: false });
    remote.on('exit', () => { remote = null; });
  }
  // The ID appears in RustDesk's settings a few seconds after its first start.
  for (let i = 0; i < 20; i++) { const id = rustdeskId(); if (id) return { ok: true, id }; await new Promise(resolve => setTimeout(resolve, 500)); }
  return { ok: true, id: '' };
}
function stopRemote() {
  if (remote?.pid) execFile('taskkill', ['/PID', String(remote.pid), '/T', '/F'], () => {});
  remote = null;
  return { ok: true };
}

// --- Updates: new versions are published on github.com/noncreativetr/dentravia-desktop (public, no key needed). ---
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
let asked = false;
function checkUpdates(byHand) {
  if (!app.isPackaged) return;
  asked = byHand;
  autoUpdater.checkForUpdates().catch(() => { if (byHand) notify('Güncelleme denetlenemedi', 'İnternet bağlantısını kontrol edip yeniden deneyin.'); });
}
function notify(title, body, onClick) {
  if (!Notification.isSupported()) return;
  const note = new Notification({ title, body, icon: ICON });
  if (onClick) note.on('click', onClick);
  note.show();
}
function installUpdate() { quitting = true; autoUpdater.quitAndInstall(true, true); }
autoUpdater.on('update-not-available', () => { if (asked) notify('Dentravia güncel', `Sürüm ${app.getVersion()}`); });
autoUpdater.on('update-downloaded', info => {
  updateReady = info.version;
  refreshTray();
  notify('Dentravia güncellemesi hazır', `Sürüm ${info.version}. Yüklemek için tıklayın (program birkaç saniye kapanıp açılır).`, installUpdate);
});

// One window: opening the program again brings the open window forward.
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => showMain());
  app.on('before-quit', () => { quitting = true; });
  // A clicked notification brings the window forward.
  ipcMain.on('dentravia:focus', event => { if (sameSite(event.senderFrame?.url ?? '')) showMain(); });
  // Remote support: only Dentravia's own page may ask, and only after the person's "İzin ver" there.
  ipcMain.handle('dentravia:remote-start', (event, options) => { if (!sameSite(event.senderFrame?.url ?? '')) throw new Error('İzin yok.'); return startRemote(options ?? {}); });
  ipcMain.handle('dentravia:remote-stop', event => { if (!sameSite(event.senderFrame?.url ?? '')) throw new Error('İzin yok.'); return stopRemote(); });
  app.on('will-quit', stopRemote);
  app.on('web-contents-created', (_event, contents) => guard(contents));
  app.whenReady().then(() => {
    // Windows shows notifications under the program's own name.
    app.setAppUserModelId('com.dentravia.crm');
    // First run: start with Windows (hidden, in the tray), so notifications come without opening the program.
    const flag = path.join(app.getPath('userData'), 'login-item-set');
    if (app.isPackaged && !fs.existsSync(flag)) { app.setLoginItemSettings({ openAtLogin: true, args: ['--hidden'] }); try { fs.writeFileSync(flag, '1'); } catch { /* ignore */ } }
    tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
    tray.setToolTip('Dentravia');
    const trayMenu = () => Menu.buildFromTemplate([
      { label: 'Dentravia\'yı aç', click: showMain },
      ...(updateReady ? [{ label: `Güncellemeyi yükle (${updateReady})`, click: installUpdate }] : [{ label: 'Güncellemeleri denetle', click: () => checkUpdates(true) }]),
      { label: 'Windows açılışında başlat', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin,
        click: item => app.setLoginItemSettings({ openAtLogin: item.checked, args: ['--hidden'] }) },
      { type: 'separator' },
      { label: 'Çıkış', click: () => { quitting = true; app.quit(); } }
    ]);
    refreshTray = () => tray.setContextMenu(trayMenu());
    refreshTray();
    tray.on('right-click', refreshTray);
    tray.on('click', showMain);
    // Only what Dentravia uses: notifications and copying a text; camera, microphone, location are refused.
    session.defaultSession.setPermissionRequestHandler((contents, permission, callback) =>
      callback(sameSite(contents.getURL()) && ['notifications', 'clipboard-sanitized-write', 'fullscreen'].includes(permission)));
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'Dentravia', submenu: [{ role: 'reload', label: 'Yenile' }, { role: 'togglefullscreen', label: 'Tam ekran' }, { type: 'separator' }, { label: 'Çıkış', click: () => { quitting = true; app.quit(); } }] },
      { label: 'Düzen', submenu: [{ role: 'undo', label: 'Geri al' }, { role: 'redo', label: 'Yinele' }, { type: 'separator' }, { role: 'cut', label: 'Kes' }, { role: 'copy', label: 'Kopyala' }, { role: 'paste', label: 'Yapıştır' }, { role: 'selectAll', label: 'Tümünü seç' }] },
      { label: 'Görünüm', submenu: [{ role: 'zoomIn', label: 'Büyüt' }, { role: 'zoomOut', label: 'Küçült' }, { role: 'resetZoom', label: 'Normal boyut' }] }
    ]));
    createWindow();
    app.on('activate', showMain);
    // Updates: checked at start and every 4 hours; downloaded in the background, installed when the notification
    // (or the tray menu item) is clicked.
    setTimeout(() => checkUpdates(false), 15000);
    setInterval(() => checkUpdates(false), 4 * 3600000);
  });
  // The tray keeps the program running; windows closing alone do not end it.
  app.on('window-all-closed', () => {});
}
