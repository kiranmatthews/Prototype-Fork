import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(s=>s.startsWith('http'))||'http://127.0.0.1:5290';
const fixture=await build({stdin:{contents:"export * as source from './src/levels/mall-measured';export {Vector3} from 'three';export {mallBreakableFixtures} from './tools/mall-breakable-fixtures.mjs';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'}),errors=[],fixtures=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/mall-breakable-fixture.js',r=>r.fulfill({contentType:'application/javascript',body:fixture.outputFiles[0].text}));
try{
 await page.goto(`${base}/?playtest&level=mall`,{timeout:120000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='mall'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 await page.evaluate(async()=>{
  const {source,Vector3,mallBreakableFixtures}=await import('/mall-breakable-fixture.js'),g=window.__game,p=g.player,l=g.getLevel();
  const canonical=o=>JSON.stringify(o,(_k,v)=>typeof v==='number'?Math.round(v*1e7)/1e7:v);
  if(canonical(source.MALL_LEVEL)!==canonical(g.getCurrentLevel().data))throw Error('Stale Mall source');
  const step=p.step.bind(p),update=g.input.update.bind(g.input);let active,object;
  window.startMallBreakable=i=>{
   const f=mallBreakableFixtures[i],q=source.mallPoint(...f.start);q[1]=source.mallSupport(q[0],q[2],q[1]+3)+.1;
   const heading=new Vector3(...f.heading);p.respawn(l,true,false,{position:new Vector3(...q),heading});p.axisF.copy(heading);p.axisL.set(-heading.z,0,heading.x);
   object=l.breakableScenery.objects.find(o=>o.id===f.id);
   active=window.mallBreakable={id:f.id,label:f.label,frames:0,bail:false,done:false,contact:null,tuning:JSON.stringify(g.TUNING),trace:[]};
  };
  g.input.pollGamepad=()=>({id:'Mall breakable controller',index:0,connected:true,mapping:'standard',axes:[0,-1,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:i===0,touched:i===0,value:i===0?1:0}))});
  p.step=(dt,controls,level)=>{
   if(!active||active.done)return;
   const speed=p.speed;update();step(dt,controls,level);active.bail||=p.isBailing;
   active.trace.push([p.pos.x,p.pos.y,p.pos.z,p.speed,p.state]);
   if(object.broken&&!active.contact)active.contact={frame:active.frames,speedBefore:speed,speedAfter:p.speed,sourcePosition:source.mallSourcePoint(...p.pos.toArray()),fragments:l.breakableScenery.fragmentCount};
   active.frames++;
   if(active.frames>=110){active.done=true;active.tuningUnchanged=active.tuning===JSON.stringify(g.TUNING);active.brokenIds=l.breakableScenery.objects.filter(o=>o.broken).map(o=>o.id);active.allMembersHidden=object.members.every(m=>!m.mesh.visible);}
  };
 });
 for(let i=0;i<7;i++){
  await page.evaluate(i=>window.startMallBreakable(i),i);
  if(i===0||i===2){
   await page.waitForFunction(()=>window.mallBreakable.done||(window.mallBreakable.contact&&window.mallBreakable.frames>=window.mallBreakable.contact.frame+26),null,{timeout:30000});
   await page.screenshot({path:`/private/tmp/mall-recreation/measured/full-breakable-${i}.png`});
  }
  await page.waitForFunction(()=>window.mallBreakable.done,null,{timeout:30000});
  const r=await page.evaluate(()=>{
   const g=window.__game,l=g.getLevel(),r=window.mallBreakable;delete r.tuning;
   l.reset(false);r.softResetPreserved=l.breakableScenery.brokenCount===1&&l.breakableScenery.fragmentCount===0;
   l.reset(true);r.hardResetRestored=l.breakableScenery.objects.every(o=>!o.broken&&o.members.every(m=>m.mesh.visible));return r;
  });fixtures.push(r);console.log(JSON.stringify({...r,trace:undefined}));
  assert.ok(r.contact&&!r.bail&&r.allMembersHidden&&r.tuningUnchanged&&r.softResetPreserved&&r.hardResetRestored);assert.deepEqual(r.brokenIds,[r.id]);
 }
 const stamp=await page.locator('.hud-build').textContent();
 const report={fixtures,stamp,fullRenderer:true,errors};await writeFile('/private/tmp/mall-recreation/measured/breakables-browser.json',JSON.stringify(report,null,2));
 assert.deepEqual(errors,[]);assert.match(stamp,/Codex\/sol fork/);
}finally{await browser.close();}
