'use strict';
const { app, BrowserWindow, Menu, session, protocol, dialog } = require('electron');
const path = require('node:path');
const { readFile } = require('node:fs/promises');
const { ORIGIN, allowedRequest, allowedNavigation } = require('./policy.cjs');
const { assetHandler } = require('./protocol.cjs');

app.setName('BONEMAN');
// Stable across versions. Tests can request a separate profile without touching saves.
app.setPath('userData', process.env.BONEMAN_USER_DATA || path.join(app.getPath('appData'), 'BONEMAN'));
app.enableSandbox();
for (const flag of ['disable-background-networking', 'disable-component-update', 'no-pings'])
  app.commandLine.appendSwitch(flag);
// No DNS resolution or direct WebRTC UDP in this entirely local application.
app.commandLine.appendSwitch('host-resolver-rules', 'MAP * ~NOTFOUND');
protocol.registerSchemesAsPrivileged([{
  scheme:'boneman',
  privileges:{ standard:true, secure:true, supportFetchAPI:true, corsEnabled:true, stream:true, codeCache:true },
}]);

let window;
let prompting = false;
let quitting = false;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { window.restore(); window.show(); window.focus(); } });
  app.whenReady().then(start).catch(fatal);
}
app.on('before-quit', () => {
  quitting = true;
  if (app.isReady()) session.fromPartition('persist:boneman').flushStorageData();
});
app.on('window-all-closed', () => app.quit());

function lockSession(ses) {
  ses.webRequest.onBeforeRequest((details, done) => done({ cancel: !allowedRequest(details.url) }));
  ses.setPermissionRequestHandler((_contents, _permission, done) => done(false));
  ses.setPermissionCheckHandler(() => false);
  ses.setDevicePermissionHandler(() => false);
  ses.on('will-download', (event, item) => {
    // Local JSON/replay exports remain ordinary Save dialogs. No remote downloads.
    if (!allowedRequest(item.getURL())) event.preventDefault();
  });
}
async function start() {
  Menu.setApplicationMenu(null);
  lockSession(session.defaultSession);
  const ses = session.fromPartition('persist:boneman');
  lockSession(ses);
  // Defence in depth for browser services: all HTTP(S) would hit a closed local port.
  for (const current of [session.defaultSession, ses])
    await current.setProxy({ proxyRules:'http://127.0.0.1:9', proxyBypassRules:'<-loopback>' });

  const root = path.join(app.getAppPath(), 'web');
  const manifest = JSON.parse(await readFile(path.join(root, 'asset-manifest.json'), 'utf8'));
  ses.protocol.handle('boneman', assetHandler(root, manifest, key => console.error('Missing bundled asset:', key)));
  window = new BrowserWindow({
    title:'BONEMAN', width:1280, height:800, minWidth:640, minHeight:480,
    backgroundColor:'#1a1c24', show:false, autoHideMenuBar:true,
    webPreferences:{
      session:ses, sandbox:true, contextIsolation:true, nodeIntegration:false,
      nodeIntegrationInWorker:false, nodeIntegrationInSubFrames:false, webSecurity:true,
      allowRunningInsecureContent:false, webviewTag:false, spellcheck:false,
      backgroundThrottling:true, devTools:!app.isPackaged,
    },
  });
  const contents = window.webContents;
  contents.setWebRTCIPHandlingPolicy('disable_non_proxied_udp');
  contents.setWindowOpenHandler(() => ({ action:'deny' }));
  contents.on('will-attach-webview', event => event.preventDefault());
  for (const event of ['will-navigate', 'will-redirect', 'will-frame-navigate'])
    contents.on(event, e => { if (!allowedNavigation(e.url)) e.preventDefault(); });
  contents.on('render-process-gone', (_event, details) => {
    if (!quitting && details.reason !== 'clean-exit') void recover('The game stopped unexpectedly. Your saved progress is kept.');
  });
  contents.on('unresponsive', () => { if (!quitting) void recover('The game is taking too long to respond.'); });
  contents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { window.setFullScreen(!window.isFullScreen()); event.preventDefault(); }
    if (input.type === 'keyDown' && input.key.toLowerCase() === 'q' && (input.meta || input.control)) app.quit();
  });
  window.once('ready-to-show', () => window.show());
  try { await contents.loadURL(ORIGIN + '/'); }
  catch (error) {
    // A permitted local navigation can replace startup while assets are still
    // loading. It is not a damaged installation and must not open a fatal modal.
    if (!quitting && !(error.code === 'ERR_ABORTED' && allowedNavigation(contents.getURL()))) throw error;
  }
}
async function recover(message) {
  if (prompting || quitting) return;
  prompting = true;
  try {
    const result = await dialog.showMessageBox(window, {
      type:'warning', title:'BONEMAN', message, buttons:['Reload game', 'Quit'], defaultId:0, cancelId:1,
    });
    if (result.response === 0 && !window.isDestroyed()) await window.loadURL(ORIGIN + '/');
    else app.quit();
  } catch { app.quit(); }
  finally { prompting = false; }
}
function fatal(error) {
  console.error(error);
  dialog.showErrorBox('BONEMAN could not start', 'The local game bundle could not be opened. Reinstall the complete app. Saved progress is kept separately.');
  app.exit(1);
}
