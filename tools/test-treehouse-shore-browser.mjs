import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv[2]||'http://127.0.0.1:5441/').replace(/\/?$/,'/');
const out=process.env.TREEHOUSE_SHORE_OUTPUT||join(tmpdir(),'treehouse-shore-browser');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[],reports=[];
try{
for(const lite of [true,false]){
 const mode=lite?'lite':'full',page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto(`${base}?playtest&level=treehouse-trail${lite?'&lite':''}`);
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay&&window.__game.player.grounded,null,{timeout:180000});
 await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets()});
 const sample=()=>page.evaluate(()=>{const g=window.__game,l=g.getLevel(),p=g.player;return {position:p.pos.toArray(),state:p.state,grounded:p.grounded,deaths:p.totalDeaths,camera:g.camera.position.toArray(),assets:l.jungleAssetDiagnostics.errors,glError:g.renderer.getContext().getError(),stamp:document.querySelector('.hud-build')?.textContent}});
 const stage=p=>page.evaluate(p=>{const g=window.__game;g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(...p),heading:g.player.camDir.clone().set(0,0,-1)});g.player.snapRenderInterpolation()},p);
 const report={mode,spawn:await sample(),swims:[]};reports.push(report);
 assert.equal(report.spawn.grounded,true);assert.match(report.spawn.stamp,/Codex\/sol fork/);
 for(const x of [0,30]){
  const z=16+x*.07+Math.sin(x*.1)*1.4;
  await stage([x,.05,z+1]);await page.waitForFunction(()=>window.__game.player.grounded);
  await page.keyboard.down('ArrowDown');
  await page.waitForFunction(()=>window.__game.player.state==='swim',null,{timeout:15000});const entry=await sample();
  await page.waitForFunction(z=>window.__game.player.pos.z>z+11.5,z,{timeout:15000});
  await page.waitForTimeout(2200);await page.keyboard.up('ArrowDown');const wall=await sample();
  assert.equal(wall.state,'swim');assert.ok(wall.position[2]>entry.position[2]+2.5);assert.ok(wall.position[2]<34);assert.equal(wall.deaths,0);
  await page.screenshot({path:`${out}/${mode}-swimming-${x}.png`});
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(z=>{const p=window.__game.player;return p.grounded&&p.pos.z<z+2},z,{timeout:20000});
  await page.keyboard.up('ArrowUp');const returned=await sample();assert.equal(returned.deaths,0);
  report.swims.push({x,entry,wall,returned});
 }
 // Match the supplied view toward the path entrance and inspect a full wave cycle.
 await stage([30,.1,22]);await page.waitForFunction(()=>window.__game.player.grounded);
 for(let i=0;i<3;i++){await page.waitForTimeout(2400);await page.screenshot({path:`${out}/${mode}-path-shore-${i}.png`});}
 report.final=await sample();assert.equal(report.final.glError,0);assert.deepEqual(report.final.assets,[]);
 await page.evaluate(()=>{const g=window.__game,render=g.renderer.render.bind(g.renderer);g.renderer.render=(...args)=>{if(args[1]===g.camera){g.camera.position.set(0,34,55);g.camera.lookAt(0,0,13);g.camera.updateMatrixWorld(true)}return render(...args)}});
 await page.waitForTimeout(1000);await page.screenshot({path:`${out}/${mode}-overview.png`});
 console.log(`PASS ${mode}: supported spawn, two keyboard swim/wall/return journeys, wave-cycle shore review, clean console.`);
 await page.close();
}
assert.deepEqual(errors,[]);
}finally{try{await writeFile(`${out}/report.json`,JSON.stringify({base,reports,errors},null,2))}finally{await browser.close()}}
