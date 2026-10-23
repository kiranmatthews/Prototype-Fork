import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(s=>s.startsWith('http'))||'http://127.0.0.1:5291';
const bundled=await build({stdin:{contents:"export * as source from './src/levels/mall-measured';export {Vector3} from 'three';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'}),errors=[],fixtures=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/mall-opening-fixture.js',r=>r.fulfill({contentType:'application/javascript',body:bundled.outputFiles[0].text}));
try{
 await page.goto(`${base}/?playtest&level=mall`,{timeout:120000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='mall'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 await page.evaluate(async()=>{
  const {source:m,Vector3}=await import('/mall-opening-fixture.js'),g=window.__game,p=g.player,l=g.getLevel();
  const canonical=o=>JSON.stringify(o,(_k,v)=>typeof v==='number'?Math.round(v*1e7)/1e7:v);
  if(canonical(m.MALL_LEVEL)!==canonical(g.getCurrentLevel().data))throw Error('Stale Mall source');
  const step=p.step.bind(p),update=g.input.update.bind(g.input);let e,headingSign;
  window.startMallOpening=sign=>{
   headingSign=sign;const q=m.mallPoint(-8650,591,370);q[1]=m.mallSupport(q[0],q[2],q[1]+.4)+.1;
   const heading=new Vector3(0,0,sign);p.respawn(l,true,false,{position:new Vector3(...q),heading});p.axisF.copy(heading);p.axisL.set(-heading.z,0,heading.x);
   e={name:sign===1?'Fountain front exit':'Fountain rear exit',frames:0,bail:false,passageFrames:0,groundedAfterExit:0,trace:[],done:false,tuning:JSON.stringify(g.TUNING)};window.mallOpening=e;
  };
  g.input.pollGamepad=()=>({id:'Mall opening controller',index:0,connected:true,mapping:'standard',axes:[0,-1,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:i===0,touched:i===0,value:i===0?1:0}))});
  p.step=(dt,controls,level)=>{
   if(!e||e.done)return;
   update();step(dt,controls,level);const s=m.mallSourcePoint(...p.pos.toArray());e.frames++;e.bail||=p.isBailing;
   if(s[0]>-8920&&s[0]<-8360&&s[1]>580&&s[1]<620)e.passageFrames++;
   const beyond=headingSign===1?s[0]<-9140:s[0]>-8130;
   if(beyond&&p.grounded)e.groundedAfterExit++;
   if(e.frames%6===1||e.bail)e.trace.push({frame:e.frames-1,source:s,speed:p.speed,state:p.state,ground:p.groundHit?.name});
   if(e.bail||p.state==='dead'||e.groundedAfterExit>=15||e.frames>=900){e.end=s;e.state=p.state;e.reached=e.groundedAfterExit>=15;e.done=true;e.tuningUnchanged=e.tuning===JSON.stringify(g.TUNING);}
  };
 });
 for(const sign of [1,-1]){
  await page.evaluate(sign=>window.startMallOpening(sign),sign);
  await page.waitForFunction(()=>window.mallOpening.done||window.mallOpening.frames>=70,null,{timeout:30000});
  await page.screenshot({path:`/private/tmp/mall-recreation/measured/fountain-${sign===1?'front':'rear'}-opening19.png`});
  await page.waitForFunction(()=>window.mallOpening.done,null,{timeout:30000});
  const e=await page.evaluate(()=>window.mallOpening);delete e.tuning;fixtures.push(e);console.log(JSON.stringify({...e,trace:undefined}));
 }
 await writeFile('/private/tmp/mall-recreation/measured/wall-openings-browser.json',JSON.stringify({fixtures,errors},null,2));
 assert.equal(errors.length,0);assert.ok(fixtures.every(f=>f.reached&&!f.bail&&f.passageFrames>50&&f.tuningUnchanged));
}finally{await browser.close();}
