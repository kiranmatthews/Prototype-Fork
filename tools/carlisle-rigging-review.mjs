import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {chromium} from '/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {grindPilot} from './carlisle-grind-pilot.mjs';
const baseline=process.argv.includes('--baseline'),lite=process.argv.includes('--lite'),normal=process.argv.includes('--normal');
const base=process.env.CARLISLE_BASE??'http://127.0.0.1:5484',out=process.env.RIGGING_OUT??`art/carlisle-shipyard/rigging/${baseline?'before':lite?'lite':normal?'normal':'review'}`;
await mkdir(out,{recursive:true});
const built=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const api=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const browser=await chromium.launch({channel:'chrome',headless:true}),report={base,baseline,lite,normal,errors:[],views:[],routes:[]},keys=new Set();
let page;
const press=async input=>{
 const wanted=new Set();if(input.moveX)wanted.add(input.moveX>0?'ArrowRight':'ArrowLeft');if(input.moveY)wanted.add(input.moveY>0?'ArrowUp':'ArrowDown');if(input.jumpHeld)wanted.add('Space');if(input.grindHeld)wanted.add('KeyE');
 for(const key of [...keys])if(!wanted.has(key)){await page.keyboard.up(key);keys.delete(key);}for(const key of wanted)if(!keys.has(key)){await page.keyboard.down(key);keys.add(key);}
};
const observe=()=>page.evaluate(()=>{const g=window.__game,p=g.player,f=p.courseInputDirection(g.getLevel())??p.camDir;return{at:p.pos.toArray(),state:p.state,grounded:p.grounded,forward:[f.x,0,f.z],side:[-f.z,0,f.x],speed:p.speed,vy:p.vVel,surface:p.surfaceName,spring:p.trampolineAir,mounted:p.freeSkate||p.airFromSkate,rail:p.grindRail?.object.userData.sourceName,railT:p.grindT,railTime:p.grindTime,railLength:p.grindRail?.totalLength,balance:p.balance,balanceVel:p.balanceVel,bail:p.isBailing,deaths:p.totalDeaths,time:p.runTime,screenFeet:p.renderPosition.clone().project(g.camera).toArray(),screenHead:p.renderPosition.clone().add({x:0,y:2.2,z:0}).project(g.camera).toArray()};});
const place=async station=>{
 const at=api.carlislePoint(station[0],station[1]+.15,station[2]??0),heading=api.carlislePoint(station[0]+3,0).map((v,i)=>v-api.carlislePoint(station[0],0)[i]);
 await page.evaluate(({at,heading})=>{const g=window.__game,p=g.player;p.respawn(g.getLevel(),true,false,{position:p.pos.clone().set(...at),heading:p.pos.clone().set(...heading)});},{at,heading});
};
try{
 page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block'});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
 await page.goto(base+'/?playtest&level=carlisle-coast&art=harbour'+(lite?'&lite':''),{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 report.main=await page.evaluate(async normal=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(normal?480:null);g.crtGuestSettings.setEnabled(normal);const l=g.getLevel();return{art:l.carlisleShipyardDiagnostics,grounds:l.groundMeshes.length,crates:l.crates.length,movers:l.movers.length,wet:l.groundMeshes.filter(m=>m.userData.slippy&&m.visible&&m.material.name==='Harbour wet').length,build:document.querySelector('.hud-build')?.textContent,rails:l.rails.filter(r=>/cable/.test(r.object.userData.sourceName??'')).map(r=>({name:r.object.userData.sourceName,points:r.points.map(p=>p.toArray()),length:r.totalLength,grindable:r.grindable}))};},normal);
 assert.equal(report.main.art.status,'ready');assert.equal(report.main.grounds,334);assert.equal(report.main.crates,270);assert.equal(report.main.movers,28);assert.equal(report.main.wet,18);assert.equal(report.main.rails.length,4);
 if(!baseline){
  assert.equal(report.main.art.rigging.cables,4);
  const before=JSON.parse(await readFile('art/carlisle-shipyard/rigging/before/browser.json','utf8'));assert.deepEqual(report.main.rails,before.main.rails,'native rail paths/lengths changed');
  report.materials=await page.evaluate(()=>window.__game.getLevel().rails.filter(r=>/cable/.test(r.object.userData.sourceName??'')).map(r=>{
   const group=r.object.getObjectByName('Braided harbour grind cable');return{name:r.object.userData.sourceName,nativeChromeHidden:r.object.children.filter(n=>n.isMesh).every(n=>(Array.isArray(n.material)?n.material:[n.material]).every(m=>m.visible===false)),parts:group.children.filter(n=>n.isMesh).map(n=>({name:n.name,type:n.material.type,color:n.material.color.getHex(),shader:n.material.customProgramCacheKey()}))};
  }));
  for(const rail of report.materials){assert.ok(rail.nativeChromeHidden,'old chrome overlaps braided cable');for(const part of rail.parts)assert.equal(part.type,'MeshStandardMaterial','shared rail styling overwrote the authored cable material');assert.equal(rail.parts.find(p=>p.name==='Orange cable collars').color,0xd45b26);}
 }
 for(const [id,name,t,offset]of normal?[]:[
  ['rigging-fairlead','Rigging · sweeping cable',0,[5,2.8,6]],
  ['rigging-strands','Rigging · sweeping cable',25,[2.2,1.5,3.4]],
  ['crown-return-curve','Crown · return cable',27,[15,15,24]],
  ['homecoming-dive','Homecoming · diving cable',66,[21,21,26]],
 ]){
  await page.evaluate(({name,t})=>{const g=window.__game,r=g.getLevel().rails.find(r=>r.object.userData.sourceName===name);g.player.respawn(g.getLevel(),true,false,{position:r.pointAt(t).add({x:0,y:1,z:0})});},{name,t});await page.waitForTimeout(100);
  const data=await page.evaluate(({name,t,offset})=>{const g=window.__game,r=g.getLevel().rails.find(r=>r.object.userData.sourceName===name),p=r.pointAt(t),c=g.camera.clone(),visible=g.player.group.visible;g.player.group.visible=false;c.position.copy(p).add({x:offset[0],y:offset[1],z:offset[2]});c.lookAt(p);c.fov=50;c.updateProjectionMatrix();c.updateMatrixWorld(true);g.renderer.render(g.scene,c);const result={url:g.renderer.domElement.toDataURL('image/png'),canvas:[g.renderer.domElement.width,g.renderer.domElement.height],render:{...g.renderer.info.render},point:p.toArray()};g.player.group.visible=visible;return result;},{name,t,offset});
  await writeFile(out+'/'+id+'.png',Buffer.from(data.url.split(',')[1],'base64'));delete data.url;report.views.push({id,name,...data});if(!lite)assert.deepEqual(data.canvas,[1920,1080]);
 }
 if(!baseline){
  // Place only at the entry of each authored beat, then use ordinary keys
  // throughout spring catches, charged exits, rebound catches and the gate.
  for(const [i,beat]of api.CARLISLE_RELAY_GRINDS.entries()){
   if((lite||normal)&&i!==0)continue;
   await place(beat.start);await page.waitForTimeout(100);await page.keyboard.press('ArrowUp');
   const targets={};for(const p of [...api.CARLISLE_RELAY_JUMPS.flatMap(j=>[j.from,j.to]),beat.finish,[4001,12]])targets[[p[0],p[1],p[2]??0].join(':')]=api.carlislePoint(...p);
   // Keep feedback beside the browser's frame loop. Only ordinary key events
   // enter Input; camera, movement, balance and machine state remain native.
   // Screenshot/CDP latency must not hold the last balance correction for .5s.
   await page.evaluate(({beat,jumps,targets,pilotSource})=>{
    const pilot=(0,eval)('('+pilotSource+')')(beat,jumps,(s,y,u=0)=>targets[[s,y,u].join(':')]),held=new Set();let request=0,frames=0;
    const row=window.__riggingRun={name:beat.name,catches:pilot.catches,launches:pilot.launches,pops:pilot.pops,samples:[],running:true};
    const key=(code,down)=>document.body.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,key:code==='Space'?' ':code==='KeyE'?'e':code,bubbles:true,cancelable:true}));
    const apply=input=>{const wanted=new Set();if(input.moveX)wanted.add(input.moveX>0?'ArrowRight':'ArrowLeft');if(input.moveY)wanted.add(input.moveY>0?'ArrowUp':'ArrowDown');if(input.jumpHeld)wanted.add('Space');if(input.grindHeld)wanted.add('KeyE');for(const code of held)if(!wanted.has(code)){key(code,false);held.delete(code);}for(const code of wanted)if(!held.has(code)){key(code,true);held.add(code);}};
    const stop=()=>{cancelAnimationFrame(request);apply({});row.running=false;};window.__stopRiggingKeys=stop;
    const step=()=>{
     try{
      const g=window.__game,p=g.player,f=p.courseInputDirection(g.getLevel())??p.camDir;
      const state={at:p.pos.toArray(),state:p.state,grounded:p.grounded,forward:[f.x,0,f.z],side:[-f.z,0,f.x],speed:p.speed,vy:p.vVel,surface:p.surfaceName,spring:p.trampolineAir,mounted:p.freeSkate||p.airFromSkate,rail:p.grindRail?.object.userData.sourceName,railT:p.grindT,railTime:p.grindTime,railLength:p.grindRail?.totalLength,balance:p.balance,balanceVel:p.balanceVel,bail:p.isBailing,deaths:p.totalDeaths,time:p.runTime,screenFeet:p.renderPosition.clone().project(g.camera).toArray(),screenHead:p.renderPosition.clone().add({x:0,y:2.2,z:0}).project(g.camera).toArray()};row.latest=state;
      if(state.bail||state.deaths||['dead','gameover'].includes(state.state))throw Error(JSON.stringify(state));
      if(state.state==='grind'&&state.railTime>.7&&!([state.screenFeet,state.screenHead].every(q=>Math.abs(q[0])<1&&Math.abs(q[1])<1)))throw Error('grind camera lost the rider');
      const control=pilot.sample(state);if(frames++%10===0)row.samples.push({...state,input:control.input});
      if(control.done){row.completed=true;row.end=state;stop();return;}apply(control.input);request=requestAnimationFrame(step);
     }catch(error){row.failure=error.message;stop();}
    };request=requestAnimationFrame(step);
   },{beat,jumps:api.CARLISLE_RELAY_JUMPS,targets,pilotSource:grindPilot.toString()});
   const captured=new Set(),started=Date.now();
   for(;;){
    const run=await page.evaluate(()=>({running:window.__riggingRun.running,p:window.__riggingRun.latest}));if(!run.running)break;
    if(run.p?.state==='grind'&&run.p.railTime>1.1&&!captured.has(run.p.rail)){captured.add(run.p.rail);await page.screenshot({path:`${out}/player-${i+1}-${captured.size}.png`});}
    assert.ok(Date.now()-started<180000,'keyboard route timed out');await page.waitForTimeout(100);
   }
   const row=await page.evaluate(()=>window.__riggingRun);report.routes.push(row);assert.ok(row.completed,JSON.stringify(row));assert.deepEqual(row.catches,beat.rails.map(r=>r.name));assert.deepEqual(row.launches,beat.launches);
  }
  if(!lite&&!normal){
   // The gate locks the victory camera; reload restores ordinary play before
   // reviewing level disposal and the normal-presentation approach camera.
   await page.reload({waitUntil:'domcontentloaded',timeout:180000});await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
   await page.evaluate(async()=>{const g=window.__game;g.switchLevel('bonus-carlisle-coast');await g.getLevel().prepareJungleAssets();});report.bonus=await page.evaluate(()=>({art:window.__game.getLevel().carlisleShipyardDiagnostics,movers:window.__game.getLevel().movers.length}));assert.equal(report.bonus.art.rigging.cables,0);assert.equal(report.bonus.movers,4);
   await page.evaluate(async()=>{const g=window.__game;g.switchLevel('carlisle-coast');await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true);});await place(api.CARLISLE_RELAY_GRINDS[0].start);await page.waitForTimeout(200);await page.screenshot({path:out+'/approach-normal.png'});report.returned=await page.evaluate(()=>window.__game.getLevel().carlisleShipyardDiagnostics);assert.equal(report.returned.rigging.cables,4);
  }
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.message;throw error;}
finally{if(page){await page.evaluate(()=>window.__stopRiggingKeys?.()).catch(()=>{});await press({}).catch(()=>{});}await writeFile(out+'/browser.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({passed:report.passed,build:report.main?.build,rigging:report.main?.art.rigging,views:report.views.length,routes:report.routes.map(({samples,...row})=>row),errors:report.errors}));
