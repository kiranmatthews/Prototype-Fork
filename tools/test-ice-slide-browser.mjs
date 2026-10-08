import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {homedir} from 'node:os';
import {join} from 'node:path';
const require=createRequire(import.meta.url);let module=process.env.PLAYWRIGHT_MODULE;
if(!module){try{module=require.resolve('playwright');}catch{module=join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');}}
const {chromium}=await import(module.startsWith('/')?pathToFileURL(module).href:module);
const base=process.env.ICE_SLIDE_URL||'http://127.0.0.1:5218',out=process.env.ICE_SLIDE_OUTPUT||'/private/tmp/ice-slide-review';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],report={base,cases:[],errors};
const page=await browser.newPage({viewport:{width:1280,height:800}});page.setDefaultTimeout(90000);page.setDefaultNavigationTimeout(90000);
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const advance=async(count,input)=>{
 await page.evaluate(({count,input})=>{window.__slideProbe.input=input;window.__slideProbe.left=count;},{count,input});
 await page.waitForFunction(()=>window.__slideProbe.left===0);
 return page.evaluate(()=>window.__slideProbe.trace.at(-1));
};
try{
 for(const lite of (process.env.ICE_SLIDE_QUICK?[true]:[true,false]))for(const held of (process.env.ICE_SLIDE_QUICK?[false]:[false,true])){
  await page.goto(base+'/?playtest&level=sky&v=ice-slide-carry'+(lite?'&lite':''));
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay);
  await page.evaluate(()=>window.__game.getLevel().prepareJungleAssets());
  await page.evaluate(()=>{
   const g=window.__game,p=g.player,l=g.getLevel();p.respawn(l,true,false,{position:p.pos.clone().set(-.95,.11,-20.7),heading:p.pos.clone().set(0,0,-1)});p.commitRenderStep(l);
   const step=p.step.bind(p),poll=g.input.pollGamepad,q=window.__slideProbe={input:{},left:0,trace:[]};
   window.__restoreSlideProbe=()=>{p.step=step;g.input.pollGamepad=poll;};
   g.input.pollGamepad=()=>({id:'Circle ice slide review',mapping:'standard',connected:true,index:0,axes:[q.input.moveX||0,-(q.input.moveY||0),0,0],
    buttons:Array.from({length:18},(_,i)=>{const pressed=(i===0&&!!q.input.jumpHeld)||(i===1&&!!q.input.grabHeld);return {pressed,value:pressed?1:0};})});
   p.step=(dt,input,level)=>{if(q.left<=0)return;step(dt,input,level);q.left--;
    q.trace.push({p:p.pos.toArray(),v:p.walkVelocity.toArray(),speed:p.walkVelocity.length(),slide:p.slideTimer,carry:p.iceSlideCarry,
     recovery:p.slideRecoverT,board:p.freeSkate,crawl:p.crawling,grounded:p.grounded,ice:!!p.groundHit?.slippy,state:p.state,ground:p.groundHit?.name,
     active:g.characterAnimationRuntime.activeClipId,deaths:p.totalDeaths});};
  });
  await advance(3,{});let state=await advance(1,{moveY:1,grabHeld:true});assert.ok(state.slide>0);
  for(let i=0;i<40&&state.slide>0;i++)state=await advance(1,held?{grabHeld:true}:{});
  const exit=state;assert.equal(exit.slide,0);assert.ok(exit.speed>20);assert.ok(exit.carry);assert.equal(exit.board,false);
  const coast=await advance(16,held?{grabHeld:true}:{});
  assert.equal(coast.grounded,true);assert.equal(coast.ice,true);assert.equal(coast.crawl,false);assert.equal(coast.recovery,0);assert.equal(coast.board,false);
  assert.ok(coast.speed>20&&coast.p[2]<exit.p[2]-5,'slide ended in a stop');
  await page.screenshot({path:`${out}/${lite?'lite':'full'}-${held?'held':'released'}-coast.jpg`,type:'jpeg',quality:90});
  await advance(3,{moveY:1,jumpHeld:true});state=await advance(1,{moveY:1});assert.equal(state.state,'air');
  for(let i=0;i<100&&!state.grounded&&state.state!=='dead';i++)state=await advance(1,{moveY:1});
  assert.equal(state.grounded,true,'could not jump out of the ice coast');assert.equal(state.board,false);assert.equal(state.deaths,0);
  assert.ok(state.p[2]<-36&&state.p[2]>-53,'jump did not reach supported course beyond the ice: '+JSON.stringify({exit,coast,landing:state}));
  const stamp=await page.locator('.hud-build').textContent();assert.match(stamp,/Codex\/sol fork/);
  report.cases.push({lite,held,exit,coast,landing:state,stamp});await page.evaluate(()=>window.__restoreSlideProbe());
  console.log(`PASS ${lite?'lite':'full'} ${held?'held':'released'} Circle: coast ${coast.speed.toFixed(2)} m/s, no forced stop/crawl/board, jump reaches supported course`);
 }
 assert.deepEqual(errors,[]);await writeFile(out+'/report.json',JSON.stringify(report,null,2));
}finally{await browser.close();}
