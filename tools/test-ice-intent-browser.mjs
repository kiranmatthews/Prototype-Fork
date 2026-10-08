import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {homedir} from 'node:os';
import {join} from 'node:path';
const require=createRequire(import.meta.url);
let module=process.env.PLAYWRIGHT_MODULE;
if(!module){try{module=require.resolve('playwright');}catch{module=join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');}}
const {chromium}=await import(module.startsWith('/')?pathToFileURL(module).href:module);
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.ICE_REVIEW_URL||'http://127.0.0.1:5218',out=process.env.ICE_REVIEW_OUTPUT||'/private/tmp/ice-intent-review';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],report={base,cases:[],errors};
const page=await browser.newPage({viewport:{width:1280,height:800}});page.setDefaultTimeout(90000);page.setDefaultNavigationTimeout(90000);
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const advance=async(count,input)=>{
 await page.evaluate(({count,input})=>{const q=window.__iceProbe;q.input=input;q.left=count;},{count,input});
 await page.waitForFunction(()=>window.__iceProbe.left===0);
 return page.evaluate(()=>window.__iceProbe.trace.slice(-1)[0]);
};
try{
 for(const lite of [true,false]){
  await page.goto(base+'/?playtest&level=sky&v=ice-intent'+(lite?'&lite':''));
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay);
  await page.evaluate(()=>window.__game.getLevel().prepareJungleAssets());
  await page.evaluate(()=>{
   const g=window.__game,p=g.player,l=g.getLevel();p.respawn(l,true,false,{position:p.pos.clone().set(-.95,.11,-23),heading:p.pos.clone().set(0,0,-1)});p.commitRenderStep(l);
   const step=p.step.bind(p),poll=g.input.pollGamepad,q=window.__iceProbe={input:{},left:0,trace:[]};
   window.__restoreIceProbe=()=>{p.step=step;g.input.pollGamepad=poll;};
   g.input.pollGamepad=()=>({id:'Ice intent review',mapping:'standard',connected:true,index:0,axes:[q.input.moveX||0,-(q.input.moveY||0),0,0],
     buttons:Array.from({length:18},(_,i)=>({pressed:i===0&&!!q.input.jumpHeld,value:i===0&&q.input.jumpHeld?1:0}))});
   p.step=(dt,input,level)=>{if(q.left<=0)return;step(dt,input,level);q.left--;
     q.trace.push({p:p.pos.toArray(),v:p.walkVelocity.toArray(),yaw:p.visualYaw,input:[input.moveX,input.moveY],
       grounded:p.grounded,ice:!!p.groundHit?.slippy,hint:p.animationClipHint,active:g.characterAnimationRuntime.activeClipId,
       transient:g.characterAnimationRuntime.diagnostics.transientClipId,time:g.characterAnimationRuntime.diagnostics.timelineTime});};
  });
  await advance(3,{});
  await advance(60,{moveY:.35});
  await advance(12,{moveY:.35,jumpHeld:true});
  await advance(70,{moveY:.35});
  const trace=await page.evaluate(()=>window.__iceProbe.trace);
  const landed=trace.find((r,i)=>i>65&&r.grounded&&r.ice&&!trace[i-1].grounded);
  assert.ok(landed,'review did not make a real jump onto ice');assert.equal(landed.hint,'player.ice-walk');assert.equal(landed.active,'player.ice-walk');assert.notEqual(landed.transient,'player.land');
  const reversed=await advance(4,{moveY:-1});
  assert.equal(reversed.active,'player.ice-walk');assert.ok(Math.abs(Math.abs(reversed.yaw)-Math.PI)<.0001,'body did not face backward promptly');
  assert.ok(reversed.v[2]<-.1,'momentum reversed with presentation');
  await page.screenshot({path:`${out}/${lite?'lite':'full'}-reversal.jpg`,type:'jpeg',quality:92});
  const caughtUp=await advance(80,{moveY:-1});assert.ok(caughtUp.v[2]>0,'ice never yielded to the new direction');
  assert.equal(caughtUp.active,'player.ice-walk');assert.ok(caughtUp.time!==reversed.time,'cycle froze during reversal');
  const sideways=await advance(4,{moveX:1});
  assert.ok(Math.abs(sideways.yaw+Math.PI/2)<.0001,'side input did not control body facing');assert.ok(sideways.v[2]>0,'side input erased old momentum');
  const coast=await advance(8,{});assert.ok(Math.abs(coast.yaw-sideways.yaw)<1e-8,'release turned body back toward drift');
  await page.screenshot({path:`${out}/${lite?'lite':'full'}-sideways.jpg`,type:'jpeg',quality:92});
  report.cases.push({lite,landed,reversed,caughtUp,sideways,coast,stamp:await page.locator('.hud-build').textContent()});
  await page.evaluate(()=>window.__restoreIceProbe());
  console.log('PASS '+(lite?'lite':'full')+' first-contact ice cycle, four-frame reversal, delayed physical crossover, sideways intent and coast-facing retention');
 }
 assert.deepEqual(errors,[]);await writeFile(out+'/report.json',JSON.stringify(report,null,2));
}finally{await browser.close();}
