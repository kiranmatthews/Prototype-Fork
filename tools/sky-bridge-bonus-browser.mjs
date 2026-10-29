import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'));
const base=process.argv[2]||'http://127.0.0.1:5217/';
const out=process.env.SKY_BONUS_OUTPUT||'/private/tmp/sky-bridge-bonus-review';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1}),errors=[],report={base,errors,views:[]};
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.setDefaultTimeout(120000);
const ready=()=>page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay);
const snapshot=()=>page.evaluate(()=>{const g=window.__game,l=g.getLevel(),p=g.player;let decks=0,planks=0;l.root.traverse(o=>{if(o.userData.suspensionDeck)decks++;if(o.isInstancedMesh&&o.userData.woodPathModel?.startsWith('plank'))planks+=o.count;});return {level:g.getCurrentLevel().id,position:p.pos.toArray(),grounded:p.grounded,state:p.state,deaths:p.totalDeaths,sky:l.skyPreset,stamp:document.querySelector('.hud-build')?.textContent,decks,planks,cloudPass:g.cloudPathPass.diagnostics,cloudContacts:l.groundMeshes.filter(m=>m.userData.cloudRoad).length,render:g.getRenderFrameStats(),resolution:g.renderQualitySettings.regularResolution,sizes:g.getRenderQualitySizes(),canvas:[g.renderer.domElement.width,g.renderer.domElement.height],contextLost:g.renderer.getContext().isContextLost()};});
const place=x=>page.evaluate(x=>{const g=window.__game,p=g.player;p.respawn(g.getLevel(),true,false,{position:p.pos.clone().set(x,.12,0),heading:p.pos.clone().set(1,0,0)});},x);
try{
 await page.goto(new URL('?playtest&level=bonus-sky-bridge&lite',base).href);await ready();
 await page.waitForFunction(()=>window.__game.player.grounded);
 report.spawn=await snapshot();assert.equal(report.spawn.sky,'clouds');assert.equal(report.spawn.decks,0);
 assert.match(report.spawn.stamp,/Codex\/sol fork/);assert.equal(report.spawn.cloudContacts,2);assert.equal(report.spawn.cloudPass.height,360);
 // Negative fixture between two relay anchors: the carved pier art must
 // not provide hidden support. Normal gravity and death own the recovery.
 await place(10.8);
 await page.waitForFunction(()=>window.__game.player.state==='dead',null,{timeout:16000});
 report.fall=await snapshot();assert.equal(report.fall.state,'dead');
 await page.waitForFunction(()=>window.__game.player.grounded&&window.__game.player.state==='ride');
 report.pitRespawn=await snapshot();assert.ok(Math.abs(report.pitRespawn.position[0]+6)<.5);
 await page.goto(new URL('?playtest&level=bonus-sky-bridge',base).href);await ready();
 await page.evaluate(()=>window.__game.getLevel().prepareJungleAssets());
 for(const [name,x] of [['arrival',-6],['relay',5.5],['receiver',24],['cloud-bridge',36],['return',60]]){
  await place(x);await page.waitForTimeout(650);
  report.views.push({name,...await snapshot()});
  await page.screenshot({path:join(out,name+'.png')});
 }
 await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(null));
 for(const [name,x] of [['native-relay',5.5],['native-cloud-bridge',40]]){
  await place(x);await page.waitForTimeout(650);const state=await snapshot();
  assert.equal(state.resolution,'max');assert.deepEqual(state.canvas,[1440,900]);
  assert.equal(state.contextLost,false);report.views.push({name,...state});
  await page.screenshot({path:join(out,name+'.png')});
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify(report));
}finally{report.final=await snapshot().catch(()=>null);await page.screenshot({path:join(out,'last-frame.png')}).catch(()=>{});await writeFile(join(out,'review.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
