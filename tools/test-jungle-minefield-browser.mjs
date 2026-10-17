import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv.find(v=>v.startsWith('http'))||'http://127.0.0.1:5259').replace(/\/$/,'');
const full=process.argv.includes('--full'),mode=full?'full':'lite';
const out=process.env.MINEFIELD_OUTPUT||'/private/tmp/jungle-minefield';await mkdir(out,{recursive:true});
const fixture=await build({entryPoints:['src/levels/jungle-minefield.ts'],bundle:true,format:'esm',write:false});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];
const page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'});
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/minefield-fixture.js',r=>r.fulfill({contentType:'application/javascript',body:fixture.outputFiles[0].text}));
try {
 await page.goto(`${base}/?playtest&level=jungle-minefield${full?'':'&lite'}`,{timeout:120000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='jungle-minefield'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 await page.evaluate(async()=>{const g=window.__game;await Promise.all([g.getLevel().prepareJungleAssets(),g.player.preparePresentationAssets()]);});
 await page.waitForTimeout(600);
 await page.screenshot({path:`${out}/${mode}-spawn.png`});
 const initial=await page.evaluate(()=>{const g=window.__game,l=g.getLevel();return{supported:g.player.grounded,mines:l.crates.filter(c=>c.concealed).length,visible:l.crates.filter(c=>c.concealed&&c.mesh.visible).length,render:g.getRenderFrameStats()};});
 assert.equal(initial.supported,true);assert.equal(initial.visible,0);assert.ok(initial.mines>900);
 await page.evaluate(async()=>{
  const m=await import('./minefield-fixture.js'),g=window.__game,p=g.player,l=g.getLevel();
  const step=p.step.bind(p);let lastSpin=false;
  window.mineReview={mode:'course',frame:0,maxError:0,minesTriggered:0,checkpointHits:0,samples:[],maxBlast:0,done:false};
  p.step=(dt,input,level)=>{
   const r=window.mineReview;r.frame++;
   Object.assign(input,{moveX:0,moveY:0,jumpHeld:false,jumpPressed:false,jumpReleased:false,spinHeld:false,spinPressed:false,grindHeld:false,grindPressed:false,grabHeld:false,grabPressed:false,transferHeld:false,transferPressed:false,restartPressed:false});
   if(r.mode==='course'){
    const s=-p.pos.z,targetS=Math.min(m.MINEFIELD_END+5,s+1.8),dx=m.minefieldTrail(targetS)-p.pos.x,dz=-targetS-p.pos.z,n=Math.hypot(dx,dz)||1;
    const f=p.courseInputDirection(level)??p.camDir;
    input.moveX=(dx*-f.z+dz*f.x)/n;input.moveY=(dx*f.x+dz*f.z)/n;
    input.spinHeld=m.MINEFIELD_CHECKPOINTS.some(c=>Math.abs(c-s)<2.7);input.spinPressed=input.spinHeld&&!lastSpin;
    r.maxError=Math.max(r.maxError,Math.abs(p.pos.x-m.minefieldTrail(s)));
   } else if(r.mode==='mine') {
    const target=r.target,dx=target[0]-p.pos.x,dz=target[2]-p.pos.z,n=Math.hypot(dx,dz)||1,f=p.courseInputDirection(level)??p.camDir;
    input.moveX=(dx*-f.z+dz*f.x)/n;input.moveY=(dx*f.x+dz*f.z)/n;
   }
   lastSpin=input.spinHeld;step(dt,input,level);
   r.maxBlast=Math.max(r.maxBlast,level.explosions.length);
   if(r.frame%60===0)r.samples.push({frame:r.frame,pos:p.pos.toArray(),state:p.state,grounded:p.grounded,deaths:p.totalDeaths});
   if(r.mode==='course'&&(p.state==='finished'||p.state==='dead')){r.result={state:p.state,pos:p.pos.toArray(),deaths:p.totalDeaths,checkpoints:level.checkpoints.filter(c=>c.active).length,crystal:level.crystalPickup?.collected};r.mode='hold';r.done=true;}
   if(r.mode==='mine'&&p.state==='dead'){r.mineDeath=true;r.mode='recover';}
   if(r.mode==='recover'&&p.state!=='dead'&&p.grounded){r.recovered=true;r.mode='hold';}
   if(r.mode==='pit'&&p.state==='dead'){r.pitDeath=true;r.mode='pit-recover';}
   if(r.mode==='pit-recover'&&p.state!=='dead'&&p.grounded){r.pitRecovered=true;r.mode='hold';}
  };
 });
 // Capture a forward-facing forest frame while the real movement controller runs.
 await page.waitForFunction(()=>-window.__game.player.pos.z>34||window.mineReview.done,null,{timeout:30000});
 await page.screenshot({path:`${out}/${mode}-jungle.png`});
 await page.waitForFunction(()=>window.mineReview.done,null,{timeout:120000});
 let report=await page.evaluate(()=>window.mineReview);
 console.log(JSON.stringify({course:report.result,maxTrailError:report.maxError}));
 await page.screenshot({path:`${out}/${mode}-finish.png`});
 assert.equal(report.result.state,'finished',JSON.stringify(report.result));assert.equal(report.result.deaths,0);
 assert.equal(report.result.checkpoints,3);assert.equal(report.result.crystal,true);
 // Restart through the ordinary control, then enter the first real mine by input.
 await page.evaluate(()=>{window.__game.gameFlow.dismissResults?.();});
 await page.reload();await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='jungle-minefield'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 const hazards=await page.evaluate(async()=>{
  const m=await import('./minefield-fixture.js'),g=window.__game,p=g.player,l=g.getLevel();
  const cp=l.checkpoints[0];l.activateCheckpoint(cp,0);p.respawn(l,false);
  const mine=l.crates.find(c=>c.concealed&&c.mesh.position.z< -75&&Math.abs(c.mesh.position.x-m.minefieldTrail(-c.mesh.position.z))<2.6);
  const s=-mine.mesh.position.z;p.pos.set(m.minefieldTrail(s),.05,-s);p.invulnTimer=0;
  const step=p.step.bind(p),r=window.hazardReview={mineDeath:false,recovered:false,pitDeath:false,pitRecovered:false,maxBlast:0,stage:'mine',mine:[mine.mesh.position.x,0,mine.mesh.position.z],checkpoint:cp.spawnPos.toArray(),peakDead:0};
  p.step=(dt,input,level)=>{
   Object.assign(input,{moveX:0,moveY:0,jumpHeld:false,jumpPressed:false,jumpReleased:false,spinHeld:false,spinPressed:false,grindHeld:false,grindPressed:false,grabHeld:false,grabPressed:false,transferHeld:false,transferPressed:false,restartPressed:false});
   if(r.stage==='mine'){
    const dx=r.mine[0]-p.pos.x,dz=r.mine[2]-p.pos.z,n=Math.hypot(dx,dz)||1,f=p.courseInputDirection(level)??p.camDir;
    input.moveX=(dx*-f.z+dz*f.x)/n;input.moveY=(dx*f.x+dz*f.z)/n;
   }
   step(dt,input,level);r.maxBlast=Math.max(r.maxBlast,level.explosions.length);r.peakDead=Math.max(r.peakDead,level.crates.filter(c=>c.concealed&&!c.alive).length);
   if(r.stage==='mine'&&p.state==='dead'){r.mineDeath=true;r.stage='recover';}
   if(r.stage==='recover'&&p.state!=='dead'&&p.grounded){r.recovered=true;r.respawn=p.pos.toArray();r.hidden=level.crates.filter(c=>c.concealed&&c.mesh.visible).length;r.stage='ready';}
   if(r.stage==='pit'&&p.state==='dead'){r.pitDeath=true;r.stage='pit-recover';}
   if(r.stage==='pit-recover'&&p.state!=='dead'&&p.grounded){r.pitRecovered=true;r.pitRespawn=p.pos.toArray();r.stage='done';}
  };
  return r;
 });
 assert.ok(hazards.mine);
 await page.waitForFunction(()=>window.hazardReview.mineDeath,null,{timeout:20000});
 await page.screenshot({path:`${out}/${mode}-blast.png`});
 await page.waitForFunction(()=>window.hazardReview.recovered,null,{timeout:20000});
 await page.evaluate(async()=>{const m=await import('./minefield-fixture.js'),p=window.__game.player;p.pos.set(m.minefieldCenter(150.5)+4,1,-150.5);p.vVel=0;p.state='air';p.grounded=false;p.invulnTimer=0;window.hazardReview.stage='pit';});
 await page.waitForFunction(()=>window.hazardReview.pitRecovered,null,{timeout:20000});
 const hazardReport=await page.evaluate(()=>window.hazardReview);
 assert.equal(hazardReport.hidden,0);assert.ok(hazardReport.peakDead>1,'buried mines did not chain');assert.ok(hazardReport.pitDeath&&hazardReport.pitRecovered);
 assert.ok(Math.hypot(...hazardReport.respawn.map((v,i)=>v-hazardReport.checkpoint[i]))<1.5);
 assert.deepEqual(errors,[]);
 report={mode,initial,course:report.result,maxTrailError:report.maxError,hazards:hazardReport,errors};
 await writeFile(`${out}/${mode}.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
