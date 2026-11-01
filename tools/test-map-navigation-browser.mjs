import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'));
const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
const { CAMPAIGN_LEVELS: levels, CAMPAIGN_MAP_EDGES: edges, CAMPAIGN_ISLANDS: islands } = await server.ssrLoadModule('/src/campaign.ts');
await server.close();
const byKey = key => levels.find(level => level.progressKey === key);
const onePerIsland = frame => {
  const counts = new Map(islands.map(island=>[island.id,0]));
  for(const skater of frame.skaters)if(skater.visible)counts.set(skater.island,counts.get(skater.island)+1);
  if(frame.playerVisible){const id=byKey(frame.selected).islandId;counts.set(id,counts.get(id)+1);}
  for(const [id,count]of counts)assert.equal(count,1,`Expected one visible skater on ${id} at ${frame.selected}`);
};
const crossings = edges.filter(edge => byKey(edge.from).islandId !== byKey(edge.to).islandId);
const base = process.argv[2] || 'http://127.0.0.1:5376/';
const out = process.env.MAP_NAV_OUTPUT || '/private/tmp/map-navigation';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true }), report = [];
try {
  for (const mode of (process.env.MAP_NAV_CASES || 'lite,native').split(',')) {
    const errors = [], transfers = [], coast = [];
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
    await context.addInitScript(() => localStorage.setItem('solProtoRenderQuality.v1', JSON.stringify({version:1,enabled:false,baseHeight:720,outputMultiplier:1,fixed60:true})));
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push({message:message.text(),url:message.location().url}); });
    try {
      await page.goto(new URL('?playtest&level=warproom' + (mode === 'lite' ? '&lite' : ''), base).href);
      await page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay && window.__game.getWorldMapDiagnostics().skaters.length === 6, null, { timeout: 180000 });
      const buildStamp = await page.locator('.hud-build').textContent();
      assert.ok(buildStamp.includes('Codex/sol fork'), 'Unexpected deployed build channel');
      // Production has no inspection unlock. Only this disposable browser
      // profile receives completed progress so every boundary can be exercised.
      await page.evaluate(() => {
        const g = window.__game;
        for (const progress of Object.values(g.campaign.active.levels))
          Object.assign(progress, {cleared:true,crystal:true,boxGem:true,timeMedal:'gold',cup:true,raceWon:true});
        g.campaign.setMapFocus('treehouse-trail'); g.switchLevel('warproom');
      });
      await page.waitForFunction(() => window.__game.getWorldMapDiagnostics().skaters.length === 6);
      const focus = async key => {
        await page.evaluate(async key => {
          const g = window.__game; g.campaign.setMapFocus(key); g.switchLevel('warproom');
          await g.getLevel().prepareJungleAssets();
        }, key);
        await page.waitForFunction(key => window.__game.getWorldMapDiagnostics().selected === key && window.__game.getWorldMapDiagnostics().skaters.length === 6, key, { timeout: 90000 });
        await page.waitForTimeout(500);
      };
      await page.screenshot({ path: join(out, mode + '-entry.png') });
      // Real inputs around the first coast use right/left consistently.
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => window.__game.getWorldMapDiagnostics().selected === 'beachside-run' && !window.__game.getWorldMapDiagnostics().moving);
      await page.keyboard.press('ArrowLeft');
      await page.waitForFunction(() => window.__game.getWorldMapDiagnostics().selected === 'treehouse-trail' && !window.__game.getWorldMapDiagnostics().moving);
      // Exercise the actual coast of every island, including the four whose
      // former winding made the right key walk left across the screen.
      for(const island of islands){
        await focus(island.levelKeys[0]);
        for(const to of island.levelKeys.slice(1)){
          await page.evaluate(()=>{
            const g=window.__game;let previous=g.player.renderPosition.clone();
            window.__coastFrames=[];window.__recordCoast=true;
            const sample=()=>{
              if(!window.__recordCoast)return;
              const now=g.player.renderPosition.clone(),right=now.clone().setFromMatrixColumn(g.camera.matrixWorld,0);
              window.__coastFrames.push({...g.getWorldMapDiagnostics(),playerVisible:g.player.group.visible,screenStep:now.clone().sub(previous).dot(right)});
              previous=now;requestAnimationFrame(sample);
            };requestAnimationFrame(sample);
          });
          await page.keyboard.press('ArrowRight');
          await page.waitForFunction(to=>window.__game.getWorldMapDiagnostics().selected===to&&!window.__game.getWorldMapDiagnostics().moving,to);
          const frames=await page.evaluate(()=>{window.__recordCoast=false;return window.__coastFrames;});
          frames.forEach(onePerIsland);
          const moving=frames.filter(f=>f.moving);
          assert.ok(moving.some(f=>f.screenStep>.02),`${to}: no visible forward travel`);
          assert.ok(moving.every(f=>f.screenStep>=-.002),`${to}: forward progression moved screen-left`);
          coast.push({island:island.id,to,frames:moving.length,minScreenStep:Math.min(...moving.map(f=>f.screenStep))});
        }
        await page.screenshot({path:join(out,`${mode}-${island.id}.png`)});
      }
      for (const edge of crossings) for (const reverse of [false, true]) {
        const from = reverse ? edge.to : edge.from, to = reverse ? edge.from : edge.to;
        await focus(from);
        const before = await page.evaluate(() => ({...window.__game.getWorldMapDiagnostics(),playerVisible:window.__game.player.group.visible}));
        onePerIsland(before);
        assert.equal(before.directions[reverse ? 'left' : 'right'], to);
        assert.ok(before.skaters.find(s => s.key === to)?.visible, 'Destination skater must exist before the pan');
        await page.evaluate(() => {
          window.__panFrames = []; window.__recordPan = true;
          const sample = () => {
            if (!window.__recordPan) return;
            const g = window.__game, d = g.getWorldMapDiagnostics();
            window.__panFrames.push({ ...d, playerVisible: g.player.group.visible, player: g.player.renderPosition.toArray(), eye: g.camera.position.toArray() });
            requestAnimationFrame(sample);
          }; requestAnimationFrame(sample);
        });
        await page.keyboard.press(reverse ? 'ArrowLeft' : 'ArrowRight');
        await page.waitForFunction(() => window.__game.getWorldMapDiagnostics().moving);
        if (edge === crossings[0] && !reverse) {
          await page.waitForTimeout(850);
          await page.screenshot({ path: join(out, mode + '-island-pan.png') });
        }
        await page.waitForFunction(to => window.__game.getWorldMapDiagnostics().selected === to && !window.__game.getWorldMapDiagnostics().moving, to, { timeout: 30000 });
        const frames = await page.evaluate(() => { window.__recordPan = false; return window.__panFrames; });
        const moving = frames.filter(frame => frame.moving);
        assert.ok(moving.length > 12, 'Missing real camera pan samples');
        for (const frame of moving) {
          onePerIsland(frame);
          for (const key of [from, to]) assert.ok(frame.skaters.find(s => s.key === key)?.visible, `${key} disappeared during pan`);
          assert.equal(frame.playerVisible, false, 'Pan must use the already-placed residents');
          const a = byKey(from).mapPosition, b = byKey(to).mapPosition;
          assert.ok(Math.min(Math.hypot(...frame.player.map((v,i) => v-a[i])), Math.hypot(...frame.player.map((v,i) => v-b[i]))) < .05, 'Active rider crossed the sea');
        }
        const after = await page.evaluate(() => ({ ...window.__game.getWorldMapDiagnostics(), playerVisible: window.__game.player.group.visible }));
        onePerIsland(after);
        assert.equal(after.playerVisible, true); assert.equal(after.skaters.find(s => s.key === to).visible, false);
        assert.equal(after.skaters.find(s => s.key === from).visible, true, 'Departure skater disappeared after arrival');
        transfers.push({ from, to, frames: moving.length, before, after });
      }
      await page.setViewportSize({width:390,height:844});
      await page.waitForTimeout(250);
      await page.screenshot({path:join(out,mode+'-portrait.png')});
      const mattes = await page.evaluate(async () => {
        const g = window.__game; g.switchLevel('codex-lab');
        await g.getLevel().prepareJungleAssets();
        return g.getLevel().blockworksArtDiagnostics.mattes;
      });
      assert.ok(Object.values(mattes.textures).every(state=>state==='ready'), 'Gameplay matte images must decode from the release assets');
      const exit = await page.evaluate(() => ({ skaters: window.__game.getWorldMapDiagnostics().skaters,
        root: !!window.__game.scene.getObjectByName('world-map-hub-skaters'), scale: window.__game.player.group.scale.toArray(), visible: window.__game.player.group.visible }));
      assert.equal(exit.root, false); assert.deepEqual(exit.skaters, []); assert.equal(exit.visible, true);
      assert.deepEqual(exit.scale, [1,1,1]); assert.deepEqual(errors, []);
      report.push({mode,buildStamp,coast,transfers,exit,mattes,errors}); console.log(`PASS ${mode}: ${coast.length} screen-right coast links, 10 island pans, one skater per island and gameplay cleanup (${buildStamp})`);
    } finally {
      await context.close(); await writeFile(join(out,'report.json'), JSON.stringify({base,report,errors},null,2));
    }
  }
} finally { await browser.close(); }
