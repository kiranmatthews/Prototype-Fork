'use strict';
// Test-only entry, excluded from packaged files. No Playwright focus overrides.
const assert = require('node:assert/strict');
const path = require('node:path');
const { createServer } = require('node:http');
const { app } = require('electron');
assert.equal(process.arch, process.env.BONEMAN_TARGET_ARCH || process.arch);
app.setAppPath(path.resolve(__dirname, '../../desktop'));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(window, expression) {
  const deadline = Date.now() + 90000;
  while (!(await window.webContents.executeJavaScript(expression))) {
    if (Date.now() > deadline) throw new Error('Timed out: ' + expression);
    await sleep(100);
  }
}
app.once('browser-window-created', async (_event, window) => {
  try {
    await new Promise(resolve => window.webContents.once('did-finish-load', resolve));
    await window.loadURL('boneman://game/?playtest&lite&level=codex-lab');
    await waitFor(window, '!!window.__game && window.__game.player.grounded && !window.__game.gameFlow.blocksGameplay');
    window.hide();
    await waitFor(window, 'document.hidden');
    const before = await window.webContents.executeJavaScript('window.__game.player.pos.toArray()');
    await sleep(500);
    assert.deepEqual(await window.webContents.executeJavaScript('window.__game.player.pos.toArray()'), before);
    window.show(); window.focus();
    await waitFor(window, '!document.hidden');
    const frame = await window.webContents.executeJavaScript('window.__game.frameStats.frame');
    await sleep(300);
    assert((await window.webContents.executeJavaScript('window.__game.frameStats.frame')) > frame);
    assert.equal(window.webContents.getLastWebPreferences().sandbox, true);
    let networkHits = 0;
    const server = createServer((_request,response) => {networkHits++;response.end('must not load');});
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const url = 'http://127.0.0.1:' + server.address().port + '/';
      await assert.rejects(window.webContents.session.fetch(url));
      assert.equal(networkHits, 0);
    } finally {await new Promise(resolve => server.close(resolve));}
    console.log(JSON.stringify({status:'passed', hiddenSimulation:'stopped', restoredSimulation:'advancing', sandbox:true, nativeNetworkDenied:true, networkHits}));
    app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});
require('../../desktop/main.cjs');
