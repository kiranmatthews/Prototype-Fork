import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5277';
const full=process.argv.includes('--full'),out='/private/tmp/warehouse-reconstruction';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=warehouse-reference${full?'':'&lite'}`,{timeout:120000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='warehouse-reference'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 await page.waitForTimeout(1800);
 await page.screenshot({path:`${out}/spawn-${full?'full':'lite'}.png`});
 const info=await page.evaluate(()=>{const g=window.__game,p=g.player;return{level:g.getCurrentLevel().name,spawn:p.pos.toArray(),grounded:p.grounded,freeSkate:p.freeSkate,stamp:document.querySelector('.hud-build')?.textContent,meshes:g.getLevel().groundMeshes.length,rails:g.getLevel().rails.length};});
 // Each fixture starts at a surveyed landmark, then uses an ordinary gamepad
 // through Input.update, the live fixed-step loop and the live chase camera.
 await page.evaluate(async()=>{
  const g=window.__game,p=g.player,l=g.getLevel();
  const source=await import('/src/levels/codex-lab.ts');
  const api=await import('/tools/warehouse-reference-cases.mjs');
  const realStep=p.step.bind(p),realUpdate=g.input.update.bind(g.input);let sample={},c=null,r=null;
  window.warehouseReports=[];
  g.input.pollGamepad=()=>{
   const x=sample.moveX||0,y=sample.moveY||0,len=Math.hypot(x,y),raw=len?.22+.78*Math.min(1,len):0;
   const held={0:!!sample.jumpHeld,3:!!sample.grindHeld};
   return{id:'Warehouse validation controller',index:0,connected:true,mapping:'standard',
    axes:len?[x/len*raw,-y/len*raw,0,0]:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:!!held[i],touched:!!held[i],value:held[i]?1:0}))};
  };
  window.startWarehouseCase=name=>{
   c=api.warehouseCases(p).find(q=>q.name===name);if(!c)throw Error(name);
   const position=p.pos.clone().fromArray(source.warehousePoint(...c.at));position.y+=.12;
   p.respawn(l,true,true,{position,heading:p.axisF.clone().fromArray(c.h)});
   p.axisF.fromArray(c.h).normalize();p.axisL.set(p.axisF.z,0,-p.axisF.x);p.freeSkate=true;p.speed=c.speed;
   p.groundHit=p.queryGround(l);if(p.groundHit)p.rideNormal.copy(p.groundHit.normal);
   sample={};realUpdate();r=api.warehouseResult(name);r.done=false;r.paused=false;r.shot=false;
   window.warehouseReview=r;window.warehouseReports.push(r);
  };
  p.step=(dt,input,level)=>{
   if(!r)return realStep(dt,input,level);if(r.done||r.paused)return;
   try{
    sample=c.sample(r.frames,r,api.warehouseUV(p));realUpdate();
    const old=p.pos.clone(),wasVert=p.vertAir;realStep(dt,input,level);api.observeWarehouse(p,r,wasVert,old);
    const uv=api.warehouseUV(p);r.end={p:p.pos.toArray(),uv,grounded:p.grounded,state:p.state,speed:p.speed};
    if(r.frames%20===0)r.trace.push({...r.end,f:r.frames});
    if(p.isBailing||['dead','gameover'].includes(p.state))throw Error('Bail/death during '+r.name);
    if(c.stop(r.frames-1,r,uv,r.airFrames>0)){r.ok=true;r.done=true;}
    else if(r.frames>=c.max)throw Error('Line did not complete');
    const interesting=r.name.startsWith('roll-in')?uv[0]>255:r.name.startsWith('secret')?r.roomFrames>10:r.name==='Big Rail kink'?r.railFrames>45:r.name==='high rail'?r.highRailFrames>25:r.name==='kicker gap'?r.gapAirFrames>4:r.name==='taxi transfer'?uv[0]>525:r.peak>5&&p.vVel<0&&!p.grounded;
    if(interesting&&!r.shot){r.shot=true;r.paused=true;}
   }catch(e){r.failed=String(e);r.done=true;}
  };
 });
 const routes=process.argv.includes('--views-only')?[]:['roll-in 268','halfpipe repeated airs','over the pipe','secret room 15/330','Big Rail kink','high rail','kicker gap','taxi transfer','loading bay transition','left channel gap','right channel gap'];
 for(const name of routes){
  await page.evaluate(name=>window.startWarehouseCase(name),name);
  let state,deadline=Date.now()+90000;
  while(Date.now()<deadline){
   await page.waitForTimeout(150);state=await page.evaluate(()=>({done:window.warehouseReview.done,paused:window.warehouseReview.paused,failed:window.warehouseReview.failed,frames:window.warehouseReview.frames}));
   if(state.paused){await page.waitForTimeout(250);await page.screenshot({path:`${out}/${name.replaceAll(/[^a-z0-9]+/g,'-')}-${full?'full':'lite'}.png`});await page.evaluate(()=>{window.warehouseReview.paused=false;});}
   if(state.done)break;
  }
  console.log(JSON.stringify({mode:full?'full':'lite',name,...state}));
  assert.ok(state?.done&&!state?.failed,JSON.stringify({name,state}));
 }
 const reports=await page.evaluate(()=>window.warehouseReports);
 await page.evaluate(()=>{window.startWarehouseCase('supported start');window.warehouseReview.done=true;});
 await page.waitForTimeout(600);
 const rendering=await page.evaluate(async()=>{const g=window.__game,ms=[];let last;for(let i=0;i<61;i++){const now=await new Promise(requestAnimationFrame);if(last!==undefined)ms.push(now-last);last=now;}ms.sort((a,b)=>a-b);return{calls:g.getRenderFrameStats(),memory:g.renderer.info.memory,frameMs:{median:ms[30],p95:ms[57]},limiter:g.getRenderFrameLimiterStats()};});
 await page.evaluate(async()=>{
  const g=window.__game,THREE=await import('/node_modules/three/build/three.module.js');
  g.scene.fog=null;g.getLevel().root.traverse(n=>{if(n.name.startsWith('Warehouse roof')||n.userData.component?.nm?.startsWith('Warehouse roof'))n.visible=false;});const shot=new THREE.PerspectiveCamera(45,1440/1000,.1,500);shot.position.set(-70,100,-66);shot.lookAt(0,0,-10);shot.updateMatrixWorld();
  const render=g.renderer.render.bind(g.renderer);g.renderer.render=(s,c)=>{if(c===g.camera){const fog=s.fog;s.fog=null;render(s,shot);s.fog=fog;}else render(s,c);};
  window.warehouseShot=shot;
 });
 await page.waitForTimeout(600);await page.screenshot({path:`${out}/isometric-${full?'full':'lite'}.png`});
 await page.evaluate(()=>{const c=window.warehouseShot;c.position.set(-.01,115,-10);c.up.set(-1,0,0);c.lookAt(0,0,-10);c.updateMatrixWorld();});
 await page.waitForTimeout(300);await page.screenshot({path:`${out}/plan-${full?'full':'lite'}.png`});
 await writeFile(`${out}/browser-${full?'full':'lite'}.json`,JSON.stringify({info,reports,rendering,errors},null,2));
 assert.deepEqual(errors,[]);assert.equal(info.grounded,true);assert.match(info.stamp,/Codex\/sol fork/);console.log(JSON.stringify({info,rendering,errors}));
}finally{await browser.close();}
