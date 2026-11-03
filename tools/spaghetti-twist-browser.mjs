import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
const {chromium}=await import(homedir()+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const output=process.env.SPAGHETTI_OUTPUT??'/private/tmp/spaghetti-p1-twist';
const base=process.argv.find(a=>a.startsWith('http'))??'http://127.0.0.1:5248';
const full=process.argv.includes('--full');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1600,height:1000},serviceWorkers:'block'});
const errors=[],report={full};page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error(m.text());}});
const shot=async name=>page.screenshot({path:output+'/'+(full?'full-':'lite-')+name+'.png'});
try{
 await page.goto(base+'/?playtest&renderdiag&level=spaghetti-rails-platforming'+(full?'':'&lite'),{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='spaghetti-rails-platforming'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 if(full)await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(null));
 await page.waitForTimeout(700);await shot('spawn');
 report.spawn=await page.evaluate(()=>{const g=window.__game,l=g.getLevel();return {p:g.player.pos.toArray(),grounded:g.player.grounded,loop:l.verticalLoop,render:g.renderer.info.render,view:l.verticalLoopDiagnostics,stamp:document.querySelector('.hud-build')?.textContent};});
 assert.ok(report.spawn.grounded);assert.match(report.spawn.stamp,/Codex\/sol fork/);
 await page.keyboard.down('ArrowUp');await page.keyboard.down('KeyE');await page.waitForTimeout(5000);await page.keyboard.up('KeyE');await page.keyboard.up('ArrowUp');
 report.travel=await page.evaluate(()=>{const p=window.__game.player;return {p:p.pos.toArray(),state:p.state,deaths:p.totalDeaths};});await shot('travel');
 // Initial clear-space placement. Every subsequent transform and rendered
 // frame comes from the production loop; no camera or position nudges.
 await page.evaluate(async()=>{
  const g=window.__game,p=g.player,l=g.getLevel();window.twistModule=await import('/src/verticalLoop.ts');
  const point=p.pos.clone().set(0,164,100).applyMatrix4(window.twistModule.verticalLoopTransform(l.verticalLoop,-l.verticalLoop.height));
  p.respawn(l,true,false,{position:point.setY(4),heading:p.camDir.clone().set(0,0,-1)});
  window.twistStart=p.verticalLoopOffset;window.twistSamples=[];window.twistSampling=true;
  window.twistSampleFrame=function sample(t){
   if(!window.twistSampling)return;
   const offset=p.verticalLoopOffset-window.twistStart,undo=window.twistModule.verticalLoopTransform(l.verticalLoop,-offset),yaw=window.twistModule.verticalLoopYaw(l.verticalLoop,-offset);
   const bounds=p.cameraPoseBounds;if(!bounds){requestAnimationFrame(sample);return;}
   const center=bounds.getCenter(p.pos.clone()),ndc=center.clone().project(g.camera);
   const forward=p.camDir.clone().applyAxisAngle(g.camera.up,yaw),q=g.camera.quaternion.clone().premultiply(g.camera.quaternion.clone().setFromAxisAngle(g.camera.up,yaw));
   window.twistSamples.push({t,offset,position:p.renderPosition.clone().applyMatrix4(undo).toArray(),camera:g.camera.position.clone().applyMatrix4(undo).toArray(),q:q.toArray(),inputForward:forward.toArray(),ndc:ndc.toArray(),grounded:p.grounded});
   if(window.twistSamples.length<2000)requestAnimationFrame(sample);
  };requestAnimationFrame(window.twistSampleFrame);
 });
 await page.waitForFunction(()=>window.__game.player.verticalLoopOffset>window.twistStart,null,{timeout:7000});await shot('seam');
 await page.waitForFunction(()=>window.__game.player.grounded,null,{timeout:7000});await shot('catch');
 report.wrap=await page.evaluate(()=>{
  window.twistSampling=false;const g=window.__game,p=g.player,s=window.twistSamples,i=s.findIndex((v,i)=>i>0&&v.offset!==s[i-1].offset),a=s[i-1],b=s[i];
  const distance=(x,y)=>Math.hypot(...x.map((v,i)=>v-y[i]));
  return {p:p.pos.toArray(),state:p.state,deaths:p.totalDeaths,offset:p.verticalLoopOffset-window.twistStart,ground:p.groundHit?.name,
   seam:a&&b?{milliseconds:b.t-a.t,riderStep:distance(a.position,b.position),cameraStep:distance(a.camera,b.camera),inputStep:distance(a.inputForward,b.inputForward),quaternionDot:Math.abs(a.q.reduce((sum,v,i)=>sum+v*b.q[i],0)),before:a.ndc,after:b.ndc}:null,
   samples:s};
 });
 assert.equal(report.wrap.offset,192);assert.equal(report.wrap.deaths,report.travel.deaths);assert.ok(Math.abs(report.wrap.p[1]-164)<.15);
 assert.ok(report.wrap.seam&&report.wrap.seam.inputStep<.002,'Held input keeps its world direction through the rotated seam');
 assert.ok(report.wrap.seam.cameraStep<4&&report.wrap.seam.riderStep<4&&report.wrap.seam.quaternionDot>.999,'No seam camera snap');
 assert.ok(report.wrap.samples.every(s=>Math.abs(s.ndc[0])<.98&&Math.abs(s.ndc[1])<.98&&s.ndc[2]>-1&&s.ndc[2]<1),'The character stays in frame through the fall and landing');
 if(full){
  // Native exact geometry, inspected with a cloned camera only.
  for(const direction of [-1,1]){
   const png=await page.evaluate(direction=>{
    const g=window.__game,c=g.camera.clone();c.position.set(-70,90,-140);c.up.set(0,0,-1);c.lookAt(-70,90+direction*200,-140);c.updateMatrixWorld();
    g.getLevel().updateSceneryView(c);g.renderer.setRenderTarget(null);g.renderer.clear();g.renderer.render(g.scene,c);return g.renderer.domElement.toDataURL('image/png').split(',')[1];
   },direction);
   await writeFile(output+'/full-'+(direction>0?'up':'down')+'.png',Buffer.from(png,'base64'));
  }
  await page.evaluate(()=>{const g=window.__game,p=g.player;p.respawn(g.getLevel(),true,false,{position:p.pos.clone().set(700,191.9,700),heading:p.camDir.clone().set(0,0,-1)});window.twistStart=p.verticalLoopOffset;window.twistSamples=[];window.twistSampling=true;requestAnimationFrame(window.twistSampleFrame);});
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(()=>window.__game.player.verticalLoopOffset-window.twistStart>=576,null,{timeout:30000});
  await page.keyboard.up('ArrowUp');await shot('repeated-moving-fall');
  report.repeatedFall=await page.evaluate(()=>{window.twistSampling=false;return {samples:window.twistSamples,deaths:window.__game.player.totalDeaths};});
  const seams=report.repeatedFall.samples.filter((s,i,all)=>i>0&&s.offset!==all[i-1].offset);
  assert.ok(seams.length>=3);assert.equal(report.repeatedFall.deaths,report.travel.deaths);
  assert.ok(report.repeatedFall.samples.every(s=>Math.abs(s.ndc[0])<.98&&Math.abs(s.ndc[1])<.98),'Held movement stays framed through repeated falls');
  for(let i=1;i<report.repeatedFall.samples.length;i++){
   const a=report.repeatedFall.samples[i-1],b=report.repeatedFall.samples[i];if(a.offset===b.offset)continue;
   assert.ok(Math.abs(a.q.reduce((sum,v,k)=>sum+v*b.q[k],0))>.999,'Successive falls preserve the view orientation');
  }
  await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(480));await shot('normal-presentation');
 }
 await page.evaluate(()=>{const g=window.__game,p=g.player;p.respawn(g.getLevel(),true,false,{position:p.pos.clone().set(15,20.08,-400),heading:p.camDir.clone().set(0,0,-1)});});
 await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>window.__game.player.state==='finished',null,{timeout:15000});await page.keyboard.up('ArrowUp');
 report.finish=await page.evaluate(()=>({state:window.__game.player.state,crystal:window.__game.player.hasCrystal}));assert.ok(report.finish.crystal);await shot('finish');
 if(full){
  await page.goto(base+'/?playtest&renderdiag&level=spaghetti-rails',{timeout:180000});
  await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='spaghetti-rails'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(null));await page.getByRole('button',{name:'RACE',exact:true}).click();
  await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running');
  await page.keyboard.down('ArrowUp');await page.waitForTimeout(2000);await page.keyboard.up('ArrowUp');await shot('race-unchanged');
  report.race=await page.evaluate(()=>{const g=window.__game;return {loop:g.getLevel().verticalLoop,state:g.player.state,speed:g.player.speed,phase:g.getSkateRace().phase};});
  assert.ok(!report.race.loop.twist);assert.equal(report.race.loop.height,288);
 }
 assert.deepEqual(errors,[]);report.errors=errors;await writeFile(output+'/'+(full?'full':'lite')+'-browser.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report,wrap:{...report.wrap,samples:report.wrap.samples.length},repeatedFall:report.repeatedFall?{samples:report.repeatedFall.samples.length,deaths:report.repeatedFall.deaths}:undefined}));
}catch(e){await shot('failure');await writeFile(output+'/'+(full?'full':'lite')+'-failure.json',JSON.stringify({...report,errors},null,2));throw e;}finally{await browser.close();}
