// Real Input polling, native Player gravity and the rendered Jungle Ruins camera.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.argv[2] || 'http://127.0.0.1:5317/';
const output=process.env.JUNGLE_CAMERA_OUTPUT || '/private/tmp/jungle-controller-camera';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],reports=[];
try{
 for(const lite of [true,false]){
  const page=await browser.newPage({viewport:{width:1280,height:720},serviceWorkers:'block'});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(()=>{
   window.__pad={axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,touched:false,value:0})),index:0,id:'Standard Gamepad test controller',mapping:'standard',connected:true,timestamp:0};
   Object.defineProperty(navigator,'getGamepads',{value:()=>[window.__pad]});
  });
  await page.goto(`${base.replace(/\/$/,'')}/?playtest&level=jungle${lite?'&lite':''}`);
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
  const stamp=await page.locator('.hud-build').textContent();assert.match(stamp,/Codex\/sol fork/);
  const directions=[];
  for(const [mx,my] of [[0,-1],[1,0],[-1,0],[0,1]]){
   await page.evaluate(({mx,my})=>{
    const g=window.__game,p=g.player,l=g.getLevel();g.gameFlow.hide();
    p.respawn(l,true,true,{position:p.pos.clone().set(8,3,52)});
    // Initial setup matches a backward skate splash; subsequent ticks use only the pad.
    const f=l.laneDirAt(8,3,52);p.axisF.set(-f.x,0,-f.z);p.axisL.set(-f.z,0,f.x);
    p.pos.set(8,-1.6,52);p.prevPos.copy(p.pos);p.state='air';p.grounded=false;p.freeSkate=true;p.speed=12;p.vVel=0;
    p.endlessDeaths=true;p.commitRenderStep(l);p.collapseRenderInterpolation();
    window.__pad.axes[0]=mx;window.__pad.axes[1]=-my;
    window.__startSwim=p.pos.toArray();
   },{mx,my});
   await page.waitForFunction(()=>window.__game.player.swimming);
   await page.waitForTimeout(800);
   const row=await page.evaluate(()=>{
    const g=window.__game,p=g.player,l=g.getLevel();return{state:p.state,input:[g.input.moveX,g.input.moveY],pos:p.pos.toArray(),start:window.__startSwim,velocity:p.swimVelocity.toArray(),forward:p.axisF.toArray(),lane:l.laneDirAt(p.pos.x,p.pos.y,p.pos.z)};
   });
   assert.equal(row.state,'swim');assert.deepEqual(row.input,[mx,my]);
   const wx=row.lane.x*my-row.lane.z*mx,wz=row.lane.z*my+row.lane.x*mx,v=row.velocity;
   assert.ok((v[0]*wx+v[2]*wz)/(Math.hypot(v[0],v[2])*Math.hypot(wx,wz))>.98,'pad direction reversed after splash');
   directions.push({mx,my,...row});
  }
  await page.screenshot({path:`${output}/${lite?'lite':'full'}-swimming.jpg`});
  // A supported camera first, then a staged missed landing in the real first pit.
  await page.evaluate(()=>{
   const g=window.__game,p=g.player,l=g.getLevel();window.__pad.axes.fill(0);
   p.respawn(l,true,true,{position:p.pos.clone().set(1.6,2,-32)});p.endlessDeaths=true;p.masks=0;p.invulnTimer=0;
   window.__fall={samples:[],active:false,initialSnap:p.renderSnapVersion,respawned:false};
   const native=p.restoreRenderPose.bind(p);
   p.restoreRenderPose=()=>{
    const s=window.__fall;
    if(s.active){s.samples.push({pos:p.pos.toArray(),state:p.state,ground:p.grounded,snap:p.renderSnapVersion,eye:g.camera.position.toArray(),q:g.camera.quaternion.toArray(),fov:g.camera.fov});
     if(p.renderSnapVersion!==s.initialSnap&&p.state!=='dead')s.respawned=true;}
    native();
   };
  });
  await page.waitForFunction(()=>window.__game.player.grounded);
  await page.waitForTimeout(350);
  const ledge=await page.evaluate(()=>{
   const g=window.__game,p=g.player,l=g.getLevel();const from=p.pos.toArray();
   p.pos.z=-36;p.prevPos.copy(p.pos);p.state='air';p.grounded=false;p.freeSkate=false;p.walkVelocity.set(0,0,0);p.speed=0;p.vVel=-3;
   p.commitRenderStep(l);p.collapseRenderInterpolation();window.__fall.active=true;return from;
  });
  await page.waitForFunction(()=>window.__game.player.state==='dead',null,{timeout:20000});
  await page.screenshot({path:`${output}/${lite?'lite':'full'}-death.jpg`});
  await page.waitForFunction(()=>window.__fall.respawned,null,{timeout:20000});
  await page.waitForFunction(()=>window.__game.player.grounded);
  const fall=await page.evaluate(()=>{window.__fall.active=false;return window.__fall;});
  const held=fall.samples.filter(s=>s.snap===fall.initialSnap&&s.pos[1]<ledge[1]-1);
  assert.ok(held.length>5,'pit did not exercise a sustained fall/death');
  for(const s of held){assert.deepEqual(s.eye,held[0].eye,'pit camera moved after hold');assert.deepEqual(s.q,held[0].q,'pit camera pitched after hold');assert.equal(s.fov,held[0].fov);}
  assert.ok(held[0].eye[1]>ledge[1],'held camera went below the ledge');
  const respawn=fall.samples.at(-1);assert.ok(respawn.eye[1]>respawn.pos[1]);
  reports.push({lite,stamp,directions,ledge,heldFrames:held.length,heldShot:held[0],respawn});
  await writeFile(`${output}/${lite?'lite':'full'}-fall.json`,JSON.stringify(fall,null,2));
  console.log(`${lite?'lite':'full'}: four native pad directions, real pit hold and respawn passed`);
  await page.close();
 }
 assert.deepEqual(errors,[]);
}finally{await writeFile(`${output}/results.json`,JSON.stringify({base,reports,errors},null,2));await browser.close();}
