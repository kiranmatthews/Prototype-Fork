import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(s=>s.startsWith('http'))||'http://127.0.0.1:5289';
const fixture=await build({stdin:{contents:"export * as source from './src/levels/mall-measured';export {Vector3} from 'three';export * from './tools/mall-measured-gap-pilot.mjs';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'}),errors=[],fixtures=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/mall-gap-fixture.js',r=>r.fulfill({contentType:'application/javascript',body:fixture.outputFiles[0].text}));
try{
 await page.goto(`${base}/?playtest&level=mall`,{timeout:120000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='mall'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 await page.evaluate(async()=>{
  const {source,Vector3,mallGapFixtures,createMallGapPilot}=await import('/mall-gap-fixture.js'),g=window.__game,p=g.player,l=g.getLevel();
  const canonical=o=>JSON.stringify(o,(_k,v)=>typeof v==='number'?Math.round(v*1e7)/1e7:v);
  if(canonical(source.MALL_LEVEL)!==canonical(g.getCurrentLevel().data))throw Error('Stale Mall source');
  const step=p.step.bind(p),update=g.input.update.bind(g.input);let pilot,sample={};
  window.startMallGap=i=>{
   const f=mallGapFixtures[i],q=source.mallPoint(...f.start);q[1]=source.mallSupport(q[0],q[2],q[1]+.4)+.1;
   const heading=new Vector3(...f.heading).normalize();p.respawn(l,true,false,{position:new Vector3(...q),heading});p.axisF.copy(heading);p.axisL.set(-heading.z,0,heading.x);
   pilot=createMallGapPilot(f);window.mallGap=pilot.e;window.mallGap.tuning=JSON.stringify(g.TUNING);window.mallGap.startedAt=performance.now();
  };
  g.input.pollGamepad=()=>{const x=sample.moveX||0,y=sample.moveY||0,n=Math.hypot(x,y),v=n?.22+.78*Math.min(1,n):0,held={0:!!sample.jumpHeld,3:!!sample.grindHeld};return{id:'Mall gap controller',index:0,connected:true,mapping:'standard',axes:n?[x/n*v,-y/n*v,0,0]:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:!!held[i],touched:!!held[i],value:held[i]?1:0}))};};
  p.step=(dt,controls,level)=>{
   if(!pilot||pilot.e.done)return;
   const rail=()=>p.grindRail?l.rails.indexOf(p.grindRail):null;
   sample=pilot.sample(p,source.mallSourcePoint(...p.pos.toArray()),rail());update();step(dt,controls,level);pilot.observe(p,source.mallSourcePoint(...p.pos.toArray()),rail());
   if(pilot.e.done){pilot.e.tuningUnchanged=pilot.e.tuning===JSON.stringify(g.TUNING);pilot.e.wallSeconds=(performance.now()-pilot.e.startedAt)/1000;}
  };
 });
 for(let i=0;i<3;i++){
  await page.evaluate(i=>window.startMallGap(i),i);
  await page.waitForFunction(()=>window.mallGap.done||(window.mallGap.kind==='drop'?window.mallGap.frames>365:window.mallGap.beamFrames>30),null,{timeout:60000});
  await page.screenshot({path:`/private/tmp/mall-recreation/measured/full-gap-${i}.png`});
  await page.waitForFunction(()=>window.mallGap.done,null,{timeout:60000});
  const r=await page.evaluate(()=>window.mallGap);delete r.tuning;fixtures.push(r);console.log(JSON.stringify({...r,trace:undefined}));
 }
 await writeFile('/private/tmp/mall-recreation/measured/gaps-browser.json',JSON.stringify({fixtures,errors},null,2));
 assert.equal(errors.length,0);assert.ok(fixtures.every(f=>f.reached&&!f.bail&&f.tuningUnchanged));
 const tape=fixtures.find(f=>f.kind==='tape');assert.deepEqual(tape.rails,[60,54]);assert.ok(tape.beamDistance>120);
}finally{await browser.close();}
