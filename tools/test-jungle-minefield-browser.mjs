import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(s=>s.startsWith('http'))??'http://127.0.0.1:5259',full=process.argv.includes('--full');
const output='/private/tmp/grove-browser';await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],report={full,fields:[]};
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=jungle-minefield${full?'':'&lite'}`,{timeout:120000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='jungle-minefield'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 await page.evaluate(async()=>{const g=window.__game;await Promise.all([g.getLevel().prepareJungleAssets(),g.player.preparePresentationAssets()]);});
 await page.screenshot({path:`${output}/${full?'full':'lite'}-entrance.png`});
 report.spawn=await page.evaluate(()=>{const g=window.__game,l=g.getLevel();return{position:g.player.pos.toArray(),grounded:g.player.grounded,mines:l.minefields.mineCount,boulder:!!l.boulder,tunnels:l.hollowwakeTunnels.diagnostics};});
 assert.ok(report.spawn.grounded);assert.equal(report.spawn.boulder,false);assert.equal(report.spawn.tunnels.failures.length,0);
 await page.evaluate(()=>{
  const g=window.__game,p=g.player,step=p.step.bind(p);
  window.groveReview={frames:[],frame:0,done:true};
  p.step=(dt,input,level)=>{
   const r=window.groveReview;
   if(r.done)return; // Keep a completed review pose stable for screenshots.
   const sample=r.frames?.[r.frame]??r.input??{};
   if(r.exitJump!==undefined){sample.moveY=1;sample.jumpHeld=-p.pos.z<r.exitJump;sample.jumpReleased=!sample.jumpHeld&&!r.released;sample.jumpPressed=sample.jumpHeld&&r.frame===0;if(sample.jumpReleased)r.released=true;}
   for(const k of ['moveX','moveY'])input[k]=sample[k]??0;
   for(const k of ['jumpHeld','jumpPressed','jumpReleased','grindHeld','grindPressed','spinHeld','spinPressed','grabHeld','grabPressed','transferHeld','transferPressed','restartPressed'])input[k]=sample[k]??false;
   step(dt,input,level);r.frame++;
   if(p.state==='dead'||p.state==='finished'||r.frames?.length&&r.frame>=r.frames.length||r.untilS!==undefined&&-p.pos.z>r.untilS||r.maxFrames&&r.frame>=r.maxFrames){r.done=true;r.result={state:p.state,pos:p.pos.toArray(),grounded:p.grounded,detonated:level.minefields.fields.filter(f=>f.detonated).map(f=>f.data.id),frame:r.frame};}
  };
 });
 const run=async(spec)=>{
  await page.evaluate(spec=>{const g=window.__game,p=g.player,l=g.getLevel(),V=p.pos.constructor;
   p.respawn(l,true,false,{position:new V(...spec.start),heading:new V(0,0,-1)});
   window.groveReview={frame:0,done:false,...spec};
  },spec);
  await page.waitForFunction(()=>window.groveReview.done,null,{timeout:120000});return page.evaluate(()=>window.groveReview.result);
 };
 report.entrance=await run({start:report.spawn.position,input:{moveY:1},untilS:63,maxFrames:1800});assert.equal(report.entrance.state,'ride');assert.ok(report.entrance.pos[2]<-63);assert.deepEqual(report.entrance.detonated,[]);
 await page.screenshot({path:`${output}/${full?'full':'lite'}-arrival.png`});
 for(const id of [1,2,3,4,5,6,7,8,9,10]){
  const replay=JSON.parse(await readFile(`/private/tmp/grove-traversal/${id}-inputs.json`,'utf8'));
  const result=await run(replay);report.fields.push({id,...result});
  assert.notEqual(result.state,'dead',`field ${id} died in browser`);assert.deepEqual(result.detonated,[],`field ${id} tripped`);assert.ok(result.grounded,`field ${id} has no supported landing`);
  if([3,5,7,9].includes(id))await page.screenshot({path:`${output}/${full?'full':'lite'}-after-${id}.png`});
  console.log(`Browser field ${id}: ${result.frame} real movement steps, safe camp reached.`);
 }
 // Deliberate pressure contact, native checkpoint banking and restoration.
 report.recovery=await page.evaluate(()=>{
  const g=window.__game,p=g.player,l=g.getLevel(),V=p.pos.constructor,cp=l.checkpoints[2];
  p.respawn(l,true,false,{position:cp.spawnPos.clone().add(new V(0,0,2)),heading:new V(0,0,-1)});
  window.groveReview={frame:0,done:false,input:{moveY:1,spinHeld:true,spinPressed:true},maxFrames:25};return{checkpoint:cp.spawnPos.toArray()};
 });
 await page.waitForFunction(()=>window.groveReview.done);
 const cpActive=await page.evaluate(()=>!!window.__game.getLevel().activeCheckpoint);assert.ok(cpActive);
 await page.evaluate(()=>{const g=window.__game,p=g.player,l=g.getLevel(),f=l.minefields.data[7];p.pos.set(-5,0,f.p[2]);p.prevPos.copy(p.pos);p.settle(l);window.groveReview={frame:0,done:false,input:{},maxFrames:8};});
 await page.waitForFunction(()=>window.groveReview.done);
 assert.equal(await page.evaluate(()=>window.groveReview.result.state),'dead');
 await page.screenshot({path:`${output}/${full?'full':'lite'}-detonation.png`});
 await page.evaluate(()=>{const g=window.__game,p=g.player,l=g.getLevel();p.respawn(l,false);window.groveReview={frame:0,done:false,input:{},maxFrames:20};});
 await page.waitForFunction(()=>window.groveReview.done);
 report.recovery.restored=await page.evaluate(()=>{const g=window.__game,p=g.player,l=g.getLevel();return{position:p.pos.toArray(),distance:p.pos.distanceTo(l.activeCheckpoint.spawnPos),armed:l.minefields.fields.every(f=>!f.detonated)};});
 assert.ok(report.recovery.restored.distance<.5);assert.ok(report.recovery.restored.armed);
 const exit=await page.evaluate(()=>{const l=window.__game.getLevel();return{start:l.minefields.data.at(-1).p[2]-l.minefields.data.at(-1).s[1]/2-20,jump:-l.gateSpec.z-8};});
 report.exit=await run({start:[0,-.5,exit.start],input:{moveY:1},exitJump:exit.jump,maxFrames:1200});assert.equal(report.exit.state,'finished');
 await page.screenshot({path:`${output}/${full?'full':'lite'}-finish.png`});
 assert.deepEqual(errors,[]);report.errors=errors;report.pass=true;
}finally{await writeFile(`${output}/${full?'full':'lite'}-report.json`,JSON.stringify({...report,errors},null,2));await browser.close();}
console.log(`PASS ${full?'full':'lite'} browser: entrance, ten fields, native checkpoint recovery and finish.`);
