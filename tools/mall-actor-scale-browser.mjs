import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(value=>value.startsWith('http'))||'http://127.0.0.1:5292';
const root='/private/tmp/mall-recreation/research/actor',full=process.argv.includes('--full');
await mkdir(root,{recursive:true});
const fixture=await build({stdin:{contents:"export * as source from './src/levels/mall-measured';export {Box3,Vector3} from 'three';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/mall-actor-fixture.js',r=>r.fulfill({contentType:'application/javascript',body:fixture.outputFiles[0].text}));
try{
 await page.goto(`${base}/?playtest&level=mall${full?'':'&lite'}`,{timeout:60000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='mall'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:60000});
 await page.waitForTimeout(2500);
 await page.evaluate(async()=>{
  const {Box3,Vector3,source}=await import('/mall-actor-fixture.js'),g=window.__game,p=g.player,l=g.getLevel(),step=p.step.bind(p),update=g.input.update.bind(g.input);
  const canon=o=>JSON.stringify(o,(_k,v)=>typeof v==='number'?Math.round(v*1e7)/1e7:v);
  if(canon(source.MALL_LEVEL)!==canon(g.getCurrentLevel().data))throw Error('Stale source');
  window.startActorMeasurement=mode=>{
   const q=source.mallPoint(-8000,315,800);q[1]=source.mallSupport(q[0],q[2],q[1]+.4)+.1;const heading=new Vector3(0,0,-1);
   p.respawn(l,true,false,{position:new Vector3(...q),heading});p.axisF.copy(heading);p.axisL.set(1,0,0);
   window.actorMeasurement={mode,frames:0,done:false,samples:[],tuning:JSON.stringify(g.TUNING),sourceMatches:true};
  };
  g.input.pollGamepad=()=>{const mode=window.actorMeasurement?.mode;return{id:'Mall actor measurement controller',index:0,connected:true,mapping:'standard',axes:[0,mode==='idle'?0:-1,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:i===0&&mode==='crouch',touched:i===0&&mode==='crouch',value:i===0&&mode==='crouch'?1:0}))}};
  const visibleRider=()=>{const b=new Box3();if(!p.interactionMeasure.measureRelative(p.riderG,g.scene,b))throw Error('Cannot measure rider');return{min:b.min.toArray(),max:b.max.toArray(),size:b.getSize(new Vector3()).toArray()}};
  const bounds=o=>{const b=new Box3().setFromObject(o,true);return{min:b.min.toArray(),max:b.max.toArray(),size:b.getSize(new Vector3()).toArray()}};
  p.step=(dt,input,level)=>{
   const r=window.actorMeasurement;if(!r||r.done)return;update();step(dt,input,level);r.frames++;p.group.updateMatrixWorld(true);
   r.samples.push({frame:r.frames,source:source.mallSourcePoint(...p.pos.toArray()),state:p.state,grounded:p.grounded,speed:p.speed,bailing:p.isBailing,rider:visibleRider(),riderUnfiltered:bounds(p.riderG),board:bounds(p.boardG),body:bounds(p.bodyGroup),interaction:p.interactionBoundsDiagnostics,bodyRotation:p.bodyGroup.rotation.toArray(),crouch:p.crouch});
   if(r.frames>=240){r.done=true;r.tuningUnchanged=r.tuning===JSON.stringify(g.TUNING);}
  };
 });
 const reports=[];
 for(const mode of ['idle','coast','crouch']){
  await page.evaluate(mode=>window.startActorMeasurement(mode),mode);
  await page.waitForFunction(()=>window.actorMeasurement?.done,null,{timeout:15000});
  const r=await page.evaluate(()=>window.actorMeasurement);delete r.tuning;reports.push(r);assert.ok(r.tuningUnchanged&&r.sourceMatches);assert.ok(r.samples.every(s=>s.grounded&&!s.bailing));
  await page.screenshot({path:`${root}/current-${mode}-${full?'full':'lite'}.png`});
  console.log(JSON.stringify({mode,frames:r.frames,final:r.samples.at(-1),minHeight:Math.min(...r.samples.slice(-60).map(s=>s.rider.size[1])),maxHeight:Math.max(...r.samples.slice(-60).map(s=>s.rider.size[1]))}));
 }
 await writeFile(`${root}/current-actor-${full?'full':'lite'}.json`,JSON.stringify({reports,errors},null,2));if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();}
