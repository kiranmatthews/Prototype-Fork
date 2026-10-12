import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv[2]||'http://127.0.0.1:5199/').replace(/\/?$/,'/');
const out=process.env.TREEHOUSE_WATER_OUTPUT||'/private/tmp/treehouse-water-review';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[],reports=[];
try{
for(const lite of [true,false]){
 const mode=lite?'lite':'full',page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto(`${base}?playtest&level=treehouse-trail${lite?'&lite':''}`);
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay&&window.__game.player.grounded,null,{timeout:180000});
 await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets()});
 const sample=()=>page.evaluate(()=>{const g=window.__game,l=g.getLevel();return {position:g.player.pos.toArray(),grounded:g.player.grounded,state:g.player.state,deaths:g.player.totalDeaths,camera:g.camera.position.toArray(),checkpoint:!!l.activeCheckpoint,assets:l.jungleAssetDiagnostics.errors,glError:g.renderer.getContext().getError()}});
 const initial=await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),d=l.captureData();return {ocean:d.ocean.horizonMode,spawn:g.player.pos.toArray(),stamp:document.querySelector('.hud-build')?.textContent,checkpoints:d.components.filter(c=>c.t==='checkpoint').map(c=>({name:c.nm,p:c.p})),stations:d.components.filter(c=>c.t==='camnode'&&!c.cameraView).filter(c=>[344,366.1,446,531,619].includes(-c.p[2])).map(c=>c.p)}});
 assert.equal(initial.ocean,'shoreline');assert.match(initial.stamp,/Codex\/sol fork/);
 const report={mode,stamp:initial.stamp,spawn:await sample(),scenes:[]};reports.push(report);
 await page.screenshot({path:`${out}/${mode}-opening.png`});
 const stage=p=>page.evaluate(p=>{const g=window.__game;g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(...p),heading:g.player.camDir.clone().set(0,0,-1)});g.player.snapRenderInterpolation()},p);
 const positions=[...initial.checkpoints.map(c=>[c.name,[c.p[0]+2.1,c.p[1]+.05,c.p[2]]]),...initial.stations.map((p,i)=>[`inland-${i}`, [p[0],p[1]+.15,p[2]]])];
 for(const [index,[name,p]] of positions.entries()){
  await stage(p);await page.waitForTimeout(1200);
  const state=await sample();assert.equal(state.grounded,true,name);assert.equal(state.glError,0,name);assert.deepEqual(state.assets,[]);report.scenes.push({name,...state});
  await page.screenshot({path:`${out}/${mode}-${index}-trail.png`});
 }
 // Native walking on the formerly flooded downhill, stopping before its gap.
 await stage([35,-1.25,-67]);await page.waitForTimeout(700);const before=await sample();
 await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>window.__game.player.pos.z<-71,null,{timeout:10000});await page.keyboard.up('ArrowUp');
 await page.waitForTimeout(300);report.walk=await sample();assert.ok(report.walk.position[2]<before.position[2]-3);assert.equal(report.walk.grounded,true);assert.equal(report.walk.deaths,before.deaths);
 // Supported landing activates the existing checkpoint crate.
 const cp=initial.checkpoints[1].p;
 await stage([cp[0],cp[1]+2,cp[2]]);await page.waitForFunction(()=>window.__game.getLevel().activeCheckpoint!==null,null,{timeout:10000});
 await page.waitForFunction(()=>window.__game.player.grounded,null,{timeout:10000});report.checkpoint=await sample();
 await page.evaluate(()=>{const g=window.__game,p=g.player;p.pos.y=g.getLevel().killY-3;p.prevPos.copy(p.pos);p.grounded=false;p.state='air'});
 await page.waitForFunction(()=>window.__game.player.state==='dead',null,{timeout:15000});
 await page.waitForFunction(()=>window.__game.player.state!=='dead'&&window.__game.player.grounded,null,{timeout:15000});report.respawn=await sample();
 assert.ok(Math.abs(report.respawn.position[2]-cp[2])<1,'pit returns to checkpoint');
 await page.evaluate(()=>{const g=window.__game,l=g.getLevel();g.player.respawn(l,true,false,{position:l.finishGlow.getCenter(g.player.pos.clone()),heading:g.player.camDir.clone()});g.player.snapRenderInterpolation()});
 await page.waitForFunction(()=>window.__game.player.state==='finished',null,{timeout:15000});report.finish=true;
 console.log(JSON.stringify({mode,scenes:report.scenes.length,walk:report.walk.position,checkpoint:report.checkpoint.position,respawn:report.respawn.position,finish:report.finish,errors}));await page.close();
}
assert.deepEqual(errors,[]);
}finally{try{await writeFile(`${out}/report.json`,JSON.stringify({base,reports,errors},null,2))}finally{await browser.close()}}
