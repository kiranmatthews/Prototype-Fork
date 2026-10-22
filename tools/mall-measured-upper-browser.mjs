import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(s=>s.startsWith('http'))||'http://127.0.0.1:5288';
const fixture=await build({stdin:{contents:"export * as source from './src/levels/mall-measured';export {Vector3} from 'three';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'}),errors=[],fixtures=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/mall-upper-fixture.js',r=>r.fulfill({contentType:'application/javascript',body:fixture.outputFiles[0].text}));
try{
 await page.goto(`${base}/?playtest&level=mall`,{timeout:120000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='mall'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 await page.evaluate(async()=>{
  const {source,Vector3}=await import('/mall-upper-fixture.js'),g=window.__game,p=g.player,l=g.getLevel();
  const canonical=o=>JSON.stringify(o,(_k,v)=>typeof v==='number'?Math.round(v*1e7)/1e7:v);
  if(canonical(source.MALL_LEVEL)!==canonical(g.getCurrentLevel().data))throw Error('Stale Mall source');
  const step=p.step.bind(p),update=g.input.update.bind(g.input);
  window.startMallUpper=f=>{
   const q=source.mallPoint(...f.start);q[1]=source.mallSupport(q[0],q[2],q[1]+.4)+.1;const heading=new Vector3(0,0,f.heading);
   p.respawn(l,true,false,{position:new Vector3(...q),heading});p.axisF.copy(heading);p.axisL.set(-heading.z,0,heading.x);
   window.mallUpper={...f,frames:0,done:false,bail:false,airFrames:0,minSeamSpeed:Infinity,seamSamples:0,trace:[],tuning:JSON.stringify(g.TUNING),startedAt:performance.now()};
  };
  g.input.pollGamepad=()=>({id:'Mall upper-route controller',index:0,connected:true,mapping:'standard',axes:[0,-1,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:i===0,touched:i===0,value:i===0?1:0}))});
  p.step=(dt,controls,level)=>{
   const r=window.mallUpper;if(!r||r.done)return;
   update();step(dt,controls,level);const q=source.mallSourcePoint(...p.pos.toArray());r.frames++;r.bail||=p.isBailing;r.source=q;if(!p.grounded)r.airFrames++;
   if(Math.abs(q[0]-r.seam)<80){r.minSeamSpeed=Math.min(r.minSeamSpeed,p.speed);r.seamSamples++;}
   if(r.frames%6===0)r.trace.push({frame:r.frames,source:q,speed:p.speed,state:p.state,ground:p.groundHit?.name});
   r.reached=(q[0]-r.end)*-r.heading>0;
   if(r.reached||r.bail||p.state==='dead'||r.frames>1800){r.done=true;r.tuningUnchanged=r.tuning===JSON.stringify(g.TUNING);r.wallSeconds=(performance.now()-r.startedAt)/1000;}
  };
 });
 for(const f of [
  {name:'First escalator up',image:'escalator-up',start:[-13450,315,180],end:-11800,heading:-1,seam:-12160.4473},
  {name:'First escalator down',image:'escalator-down',start:[-11800,717,180],end:-13200,heading:1,seam:-12160.4473},
  {name:'Gallery escalator up',image:'gallery-up',start:[-6300,315,185],end:-4350,heading:-1,seam:-4541.5342},
  {name:'Gallery escalator down',image:'gallery-down',start:[-4350,686,185],end:-5500,heading:1,seam:-4541.5342},
 ]){
  await page.evaluate(f=>window.startMallUpper(f),f);
  await page.waitForFunction(()=>window.mallUpper?.done||window.mallUpper.seamSamples>1,null,{timeout:60000});
  await page.screenshot({path:`/private/tmp/mall-recreation/measured/full-${f.image}.png`});
  await page.waitForFunction(()=>window.mallUpper?.done,null,{timeout:60000});
  const r=await page.evaluate(()=>window.mallUpper);delete r.tuning;fixtures.push(r);console.log(JSON.stringify({...r,trace:undefined}));
 }
 await writeFile('/private/tmp/mall-recreation/measured/upper-browser.json',JSON.stringify({fixtures,errors},null,2));
 assert.equal(errors.length,0);for(const f of fixtures){assert.ok(f.reached&&!f.bail&&f.tuningUnchanged);assert.ok(f.minSeamSpeed>8&&f.airFrames<4&&f.seamSamples>0);}
}finally{await browser.close();}
