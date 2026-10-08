'use strict';
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
assert.equal(process.arch, process.env.BONEMAN_TARGET_ARCH || process.arch, 'Electron architecture must match the artifact target');
app.setPath('userData', process.env.BONEMAN_USER_DATA);
app.enableSandbox();
console.log('GPU probe starting', process.arch, process.versions.electron);
app.whenReady().then(async () => {
  console.log('GPU probe app ready');
  const window = new BrowserWindow({show:false, webPreferences:{sandbox:true, contextIsolation:true, nodeIntegration:false}});
  window.webContents.on('render-process-gone', (_event, details) => console.error('Probe renderer exited', details));
  await window.loadURL('data:text/html,<canvas></canvas>');
  console.log('GPU probe document loaded');
  const result = await window.webContents.executeJavaScript("(() => { const gl=document.querySelector('canvas').getContext('webgl2'); const ext=gl?.getExtension('WEBGL_debug_renderer_info'); return {webgl2:!!gl, renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null}; })()");
  assert.equal(result.webgl2, true, JSON.stringify(result));
  console.log(JSON.stringify({...result, arch:process.arch, electron:process.versions.electron}));
  app.exit(0);
}).catch(error => {console.error(error);app.exit(1);});
