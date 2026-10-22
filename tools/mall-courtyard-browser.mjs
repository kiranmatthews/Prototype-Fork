import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5276';
const out='/private/tmp/mall-recreation',errors=[],results=[];
const fixture=await build({stdin:{contents:"export * as source from './src/levels/mall';export {Raycaster,Vector3} from 'three';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 for(const [side,pop] of [[-1,false],[1,true]]){
  const tag=`full-courtyard-${side<0?'left':'right'}-${pop?'pop':'roll'}`;
  const trace=JSON.parse(await readFile(`${out}/courtyard-return-${side}-${pop?'pop':'roll'}-trace.json`,'utf8'));
  const page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/mall-courtyard-fixture.js',r=>r.fulfill({contentType:'application/javascript',body:fixture.outputFiles[0].text}));
  await page.goto(`${base}/?playtest&level=mall`,{timeout:120000});
  await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='mall'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
  await page.evaluate(async ({side,inputs})=>{
   const {source:m,Raycaster,Vector3}=await import('/mall-courtyard-fixture.js'),g=window.__game,p=g.player,l=g.getLevel();
   const canonical=o=>JSON.stringify(o,(_k,v)=>typeof v==='number'?Math.round(v*1e7)/1e7:v);
   const r=window.mallCourtReview={ready:false,done:false,frames:0,contacts:0,air:0,peak:0,bailed:false,camera:[],obstructions:[],sourceMatches:canonical(m.MALL_LEVEL)===canonical(g.getCurrentLevel().data),initialTuning:JSON.stringify(g.TUNING)};
   if(!r.sourceMatches)throw Error('Browser loaded a stale courtyard snapshot');
   const heading=new Vector3(side,0,0);
   // Explicit section fixture, as in the headless test. Subsequent movement
   // uses recorded device samples, never trace positions or velocities.
   p.respawn(l,true,false,{position:new Vector3(...m.mallPoint(340,-side*6,.1)),heading});p.axisF.copy(heading);p.axisL.set(-heading.z,0,heading.x);
   let sample={};const update=g.input.update.bind(g.input),step=p.step.bind(p),render=g.renderer.render.bind(g.renderer),ray=new Raycaster(),focus=new Vector3(),direction=new Vector3();
   g.input.pollGamepad=()=>{const x=sample.moveX||0,y=sample.moveY||0,n=Math.hypot(x,y),a=n?.22+.78*Math.min(1,n):0,held={0:!!sample.jumpHeld,1:!!sample.grabHeld,2:!!sample.spinHeld,3:!!sample.grindHeld};return{id:'Mall courtyard validation',index:0,connected:true,mapping:'standard',axes:n?[x/n*a,-y/n*a,0,0]:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:!!held[i],touched:!!held[i],value:held[i]?1:0}))};};
   p.step=(dt,input,level)=>{
    if(!r.ready||r.done)return;
    sample=inputs[r.frames];update();step(dt,input,level);r.frames++;
    r.peak=Math.max(r.peak,p.pos.y);r.bailed||=p.isBailing;
    if(p.grounded&&p.groundHit?.mesh?.userData.vertComp?.nm===`Courtyard ${side<0?'left':'right'} wall transition`)r.contacts++;
    if(r.contacts&&!p.grounded)r.air++;
    r.position=p.pos.toArray();r.state=p.state;r.grounded=p.grounded;r.speed=p.speed;r.verticalSpeed=p.vVel;r.deaths=p.totalDeaths;
    if(r.frames>=inputs.length){r.done=true;r.finalTuning=JSON.stringify(g.TUNING);}
   };
   g.renderer.render=(scene,camera)=>{
    render(scene,camera);
    if(scene!==g.scene||!r.ready||r.done||!r.contacts)return;
    focus.copy(p.renderPosition);focus.y+=1.25;direction.subVectors(camera.position,focus);
    ray.set(focus,direction.clone().normalize());ray.near=.15;ray.far=direction.length()-.2;
    const hit=ray.intersectObjects(l.groundMeshes,false)[0];
    if(hit)r.obstructions.push({frame:r.frames,name:hit.object.name,distance:hit.distance});
    r.camera.push({frame:r.frames,distance:camera.position.distanceTo(p.renderPosition),eye:camera.position.toArray(),subject:p.renderPosition.toArray()});
   };
  },{side,inputs:trace.map(v=>v.input)});
  await page.waitForTimeout(1200);
  await page.evaluate(()=>{window.mallCourtReview.ready=true;});
  let shot=false;
  for(let i=0;i<300;i++){
   await page.waitForTimeout(100);
   const r=await page.evaluate(()=>({done:window.mallCourtReview.done,peak:window.mallCourtReview.peak,air:window.mallCourtReview.air,verticalSpeed:window.mallCourtReview.verticalSpeed}));
   if(!shot&&r.peak>4&&r.air>8&&r.verticalSpeed<0){await page.screenshot({path:`${out}/${tag}-air.png`});shot=true;}
   if(r.done)break;
  }
  await page.screenshot({path:`${out}/${tag}-return.png`});
  const r=await page.evaluate(()=>window.mallCourtReview);
  r.cameraSummary={samples:r.camera.length,minimumDistance:Math.min(...r.camera.map(v=>v.distance))};
  r.tuningUnchanged=r.initialTuning===r.finalTuning;delete r.initialTuning;delete r.finalTuning;
  r.endError=Math.hypot(...r.position.map((v,i)=>v-trace.at(-1).position[i]));
  results.push({tag,...r});await writeFile(`${out}/${tag}-browser.json`,JSON.stringify(r,null,2));
  assert.ok(r.sourceMatches&&r.done&&r.grounded&&!r.bailed&&r.deaths===0&&r.speed>12&&r.contacts>=8&&r.air>=20&&r.tuningUnchanged);
  assert.ok(r.endError<.1,'Device replay must reproduce the native section result');
  assert.ok(r.cameraSummary.samples>=15&&r.cameraSummary.minimumDistance>3&&r.obstructions.length===0,'The courtyard air and return must retain a clear, usable normal camera');
  await page.close();
 }
 assert.deepEqual(errors,[]);
}finally{
 await writeFile(`${out}/courtyard-browser.json`,JSON.stringify({results,errors},null,2));
 console.log(JSON.stringify({results:results.map(({camera,...r})=>r),errors},null,2));await browser.close();
}
