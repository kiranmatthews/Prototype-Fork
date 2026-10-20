import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {join} from 'node:path';
const require=createRequire(import.meta.url);
let pw;try{pw=require.resolve('playwright');}catch{pw=join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');}
const {chromium}=await import(pw),base=process.env.CARLISLE_URL||'http://127.0.0.1:5242';
const out=process.env.CARLISLE_BRIDGE_REVIEW||'docs/carlisle-bonus/bridge-review';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[],report={base,errors};page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const state=()=>page.evaluate(()=>{const g=window.__game,l=g.getLevel(),p=g.player;return{position:p.pos.toArray(),grounded:p.grounded,deaths:p.totalDeaths,
 bridge:l.carlisleBonusBridgeDiagnostics,camera:g.camera.position.toArray(),fov:g.camera.fov,
 collider:l.groundMeshes.some(m=>m.userData.outlinedSurface),stamp:document.querySelector('.hud-build')?.textContent};});
const place=x=>page.evaluate(x=>{const g=window.__game,p=g.player;p.respawn(g.getLevel(),true,false,{position:p.pos.clone().set(x,.15,0),heading:p.camDir.clone().set(1,0,0)});p.lives=30;},x);
try{
 await page.goto(`${base}/?playtest&level=bonus-test-course${process.argv.includes('--lite')?'&lite':''}`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();g.restoreBuiltin('bonus-test-course');await g.switchLevel('bonus-test-course');await g.getLevel().prepareJungleAssets();});
 await page.waitForFunction(()=>!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await place(29.8);await page.waitForTimeout(500);report.before=await state();
 assert.equal(report.before.bridge.length,1);assert.equal(report.before.bridge[0].loaded,true);assert.equal(report.before.bridge[0].active,false);
 assert.equal(report.before.collider,false,'ghost is not physical');assert.equal(report.before.fov,52);
 await page.keyboard.press('KeyF',{delay:180});
 await page.waitForFunction(()=>window.__game.getLevel().carlisleBonusBridgeDiagnostics[0].active,null,{timeout:5000});
 report.activated=await state();assert.equal(report.activated.collider,true,'the real switch adds the crossing');
 // Stage this view without respawn(), which intentionally resets the switch.
 await page.evaluate(()=>{const g=window.__game,p=g.player;p.pos.set(35,.15,0);p.settle(g.getLevel(),p.camDir.clone().set(1,0,0));});
 await page.waitForTimeout(600);
 assert.equal((await state()).bridge[0].active,true,'staged view keeps the switch active');
 if(!process.argv.includes('--lite')){
  await page.addStyleTag({content:'.game-hud-layer,.hud-build,#render-diagnostics,#frame-probe {display:none!important}'});
  await page.evaluate(()=>{const g=window.__game;g.ui.drawIcons=()=>{};g.ui.drawGameHud=()=>{};g.player.drawFlyingFruit=()=>{};});
  await page.waitForTimeout(150);await page.screenshot({path:`${out}/revealed-bridge.png`});
 }
 report.surface=await page.evaluate(()=>{
  const g=window.__game,l=g.getLevel(),p=g.player,meshes=[];l.root.updateMatrixWorld(true);
  l.root.traverse(o=>{if(o.isMesh&&o.userData.jungleAsset==='coastbonusbridge')meshes.push(o);});
  const samples=[];for(let x=37.5;x<49;x+=.5){p.raycaster.set(p.pos.clone().set(x,2,0),p.pos.clone().set(0,-1,0));p.raycaster.far=4;const hit=p.raycaster.intersectObjects(meshes,false)[0];samples.push({x,y:hit?.point.y??null});}
  return{meshes:meshes.length,samples,textures:meshes.map(m=>({width:m.material.map?.image?.width,height:m.material.map?.image?.height,normal:!!m.material.normalMap}))};
 });
 assert.equal(report.surface.meshes,1,'real Meshy high-detail mesh is present');
 assert.ok(report.surface.samples.every(s=>s.y!==null&&Math.abs(s.y)<.16),'walking lane matches the rendered surface');
 assert.ok(report.surface.textures.every(t=>t.width===2048&&t.normal),'full texture atlas and normal map are loaded');
 const forwardKey=await page.evaluate(()=>Math.abs(window.__game.player.camDir.x)>.7?'ArrowUp':'ArrowRight');
 report.forwardKey=forwardKey;
 await page.keyboard.down(forwardKey);try{await page.waitForFunction(()=>window.__game.player.pos.x>50.3&&window.__game.player.grounded,null,{timeout:8000});}
 finally{await page.keyboard.up(forwardKey);report.walkAttempt=await state();}
 report.crossed=await state();assert.equal(report.crossed.deaths,report.before.deaths,'native movement crosses without dying');
 await page.evaluate(()=>{const g=window.__game;g.getLevel().reset();g.player.respawn(g.getLevel(),true,false);g.getLevel().update(0);});await page.waitForTimeout(250);
 report.reset=await state();assert.equal(report.reset.bridge[0].active,false);assert.equal(report.reset.collider,false,'reset restores the pass-through ghost');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({pass:true,before:report.before.bridge,activated:report.activated.bridge,crossed:report.crossed.position,reset:report.reset.bridge,surface:report.surface,errors}));
}finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');await browser.close();}
