import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);
const base=process.env.RIPCORD_URL??'http://127.0.0.1:5246',out='/private/tmp/ripcord-river-browser';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],report={errors};
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 for(const id of ['rumblewater-run','rolling-bones']){
  await page.goto(`${base}/?playtest&level=${id}`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  await page.evaluate(async()=>{const g=window.__game;await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(null);});
  await page.waitForTimeout(400);
  const jpeg=await page.evaluate(()=>{
   const g=window.__game;g.renderer.setRenderTarget(null);g.renderer.render(g.scene,g.camera);
   const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
   canvas.getContext('2d').drawImage(g.renderer.domElement,0,0,640,360);return canvas.toDataURL('image/jpeg',.9);
  });
  await writeFile(`${out}/${id}.jpg`,Buffer.from(jpeg.split(',')[1],'base64'));
  if(!await page.evaluate(()=>window.__game.gameFlow.developerChromeVisible))await page.keyboard.press('KeyM');
  assert.ok(await page.evaluate(()=>window.__game.gameFlow.developerChromeVisible));
  await page.keyboard.press('KeyL');await page.waitForTimeout(250);
  const forward=await page.evaluate(()=>({position:window.__game.player.pos.toArray(),grounded:window.__game.player.grounded,sheltered:window.__game.getLevel().boulder.course.sheltered}));
  assert.ok(forward.grounded&&forward.sheltered);assert.ok(forward.position[2]<-300);
  await page.keyboard.press('KeyK');await page.waitForTimeout(250);
  assert.ok(await page.evaluate(()=>window.__game.player.pos.distanceTo(window.__game.getLevel().spawnPos)<1));
  report[id]={keyboardWarps:true,forward};
 }
 await page.evaluate(()=>{const g=window.__game;g.campaign.startEphemeral({unlockAll:true});g.gameFlow.showMapSection('level-select');g.gameFlow.levelSelectIsland='hidden-shores';g.gameFlow.levelSelectKey='secret-4';g.gameFlow.render();});
 await page.waitForTimeout(400);
 const rows=await page.locator('.game-level-row').evaluateAll(rows=>rows.map(row=>({key:row.dataset.levelKey,text:row.textContent})));
 assert.equal(rows[3].key,'secret-4');assert.match(rows[3].text,/Rolling Bones/i);
 await page.screenshot({path:`${out}/secret-island-slot-4.png`});
 await page.locator('[data-level-key="secret-4"]').dblclick();
 await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='rolling-bones'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 assert.equal(await page.evaluate(()=>window.__game.getLevel().name),'Rolling Bones');
 report.secretSlot={index:4,rows,launches:'rolling-bones'};assert.deepEqual(errors,[]);report.pass=true;
}catch(e){report.failure=e.stack;throw e;}
finally{await writeFile(`${out}/menu.json`,JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report));}
