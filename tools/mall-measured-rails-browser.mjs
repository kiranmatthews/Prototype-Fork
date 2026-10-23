import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(s=>s.startsWith('http'))||'http://127.0.0.1:5296';
const fixture=await build({stdin:{contents:"export * as source from './src/levels/mall-measured';export {Vector3} from 'three';export * from './tools/mall-measured-rail-pilot.mjs';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'}),errors=[],fixtures=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/mall-rail-fixture.js',r=>r.fulfill({contentType:'application/javascript',body:fixture.outputFiles[0].text}));
try{
 await page.goto(`${base}/?playtest&level=mall`,{timeout:120000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='mall'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 await page.evaluate(async()=>{
  const {source,Vector3,mallRailFixtures,createMallRailPilot}=await import('/mall-rail-fixture.js'),g=window.__game,p=g.player,l=g.getLevel();
  const canonical=o=>JSON.stringify(o,(_k,v)=>typeof v==='number'?Math.round(v*1e7)/1e7:v);
  if(canonical(source.MALL_LEVEL)!==canonical(g.getCurrentLevel().data))throw Error('Stale Mall source');
  const step=p.step.bind(p),update=g.input.update.bind(g.input);let pilot,sample={};
  window.startMallRail=i=>{
   const f=mallRailFixtures[i],q=source.mallPoint(...f.start);q[1]=source.mallSupport(q[0],q[2],q[1]+.4)+.1;
   const heading=new Vector3(...f.direction);p.respawn(l,true,false,{position:new Vector3(...q),heading});p.axisF.copy(heading);p.axisL.set(-heading.z,0,heading.x);
   pilot=createMallRailPilot(f,source,l,p,Vector3);window.mallRail=pilot.e;window.mallRail.tuning=JSON.stringify(g.TUNING);window.mallRail.startedAt=performance.now();
  };
  g.input.pollGamepad=()=>{const x=sample.moveX||0,y=sample.moveY||0,n=Math.hypot(x,y),v=n?.22+.78*Math.min(1,n):0,held={0:!!sample.jumpHeld,3:!!sample.grindHeld};return{id:'Mall rail controller',index:0,connected:true,mapping:'standard',axes:n?[x/n*v,-y/n*v,0,0]:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:!!held[i],touched:!!held[i],value:held[i]?1:0}))};};
  p.step=(dt,controls,level)=>{
   if(!pilot||pilot.e.done)return;
   sample=pilot.sample();update();step(dt,controls,level);pilot.observe();
   if(pilot.e.done){pilot.e.tuningUnchanged=pilot.e.tuning===JSON.stringify(g.TUNING);pilot.e.wallSeconds=(performance.now()-pilot.e.startedAt)/1000;}
  };
 });
 for(let i=0;i<5;i++){
  await page.evaluate(i=>window.startMallRail(i),i);
  await page.waitForFunction(i=>window.mallRail.done||(i===3?window.mallRail.crossedNodes.length===2:window.mallRail.grindFrames>=12),i,{timeout:60000});
  await page.screenshot({path:`/private/tmp/mall-recreation/measured/full-rail-${i}.png`});
  await page.waitForFunction(()=>window.mallRail.done,null,{timeout:60000});
  const r=await page.evaluate(()=>window.mallRail);delete r.tuning;fixtures.push(r);console.log(JSON.stringify({...r,trace:undefined}));
 }
 await writeFile('/private/tmp/mall-recreation/measured/rails-browser.json',JSON.stringify({fixtures,errors},null,2));
 assert.equal(errors.length,0);assert.ok(fixtures.every(f=>f.landed&&!f.bail&&f.tuningUnchanged&&f.rails.includes(f.targetRail)&&f.grindFrames>=20));
 const display=fixtures[3];assert.deepEqual(display.crossedNodes,[59,60]);assert.ok(display.grindDistance>38&&display.groundFrames===30);
}finally{await browser.close();}
