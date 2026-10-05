// Native input takes, replayed by the production Replayer in real Chrome.
// A normal respawn establishes each independent fixture before the take;
// playback uses the game's fixed-step loop with no pose/state/velocity edits.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {join} from 'node:path';
const require=createRequire(import.meta.url);let playwright=process.env.PLAYWRIGHT_MODULE;
if(!playwright){try{playwright=require.resolve('playwright');}catch{playwright=join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');}}
const {chromium}=await import(playwright.startsWith('/')?pathToFileURL(playwright).href:playwright);
const base=(process.argv.find(a=>/^https?:/.test(a))||'http://127.0.0.1:5196').replace(/\/$/,'');
const names=process.argv.filter(a=>!/^https?:/.test(a)).slice(2);
const tests=names.length?names:['first-gap','first-rail','slalom-rail','halfpipe','crumble','lift','moving-crossing','crusher','split-dock','pendulum-finish','rail-chapter','last-kicker','late-weave-rail'];
const folder=process.env.CUSTARD_TRAVERSAL_OUTPUT||'/private/tmp/custard-creek-traversal',out=folder+'/browser';await mkdir(out,{recursive:true});
const channels=['jumpHeld','grindHeld','spinHeld','grabHeld','jumpPressed','jumpReleased','grindPressed','spinPressed','grabPressed','restartPressed','transferHeld','transferPressed','jumpCancelled'];
const reports=JSON.parse(await readFile(folder+'/report.json','utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true});const results=[],errors=[];
try{
 for(const name of tests){
  const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(120000);page.setDefaultNavigationTimeout(120000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const native=reports.find(r=>r.name===name);assert.ok(native?.pass,`${name} requires a passing native take`);
  const trace=JSON.parse(await readFile(folder+'/'+name+'-trace.json','utf8'));
  const data={v:2,level:'custard-creek',date:new Date().toISOString(),tuning:{},tuningChanges:[],mx:trace.map(t=>t.input.moveX),my:trace.map(t=>t.input.moveY),b:trace.map(t=>channels.reduce((b,c,i)=>b|(t.input[c]?1<<i:0),0)),frames:trace.length,truncated:false,surfaceFrictionPolicy:1};
  const full=name==='pendulum-finish';
  await page.goto(`${base}/?playtest&level=custard-creek${full?'':'&lite'}`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay);
  await page.evaluate(async({start,heading,data})=>{
   const g=window.__game,l=g.getLevel(),p=g.player,m=await import('./src/levels/custard-creek.ts');
   const from=m.custardWarp(start),a=m.custardWarp(start),b=m.custardWarp([start[0],start[1],start[2]-1]);
   const dir=heading??b.map((v,i)=>v-a[i]);
   p.respawn(l,true,false,{position:p.pos.clone().fromArray(from),heading:p.axisF.clone().fromArray(dir)});
   window.__creekReplayEvidence={maxFrames:0,deaths:0,bails:0,states:[],grounds:[],rails:[],movers:[]};
   const old=p.step;window.__creekRestoreStep=()=>{p.step=old;};
   p.step=function(...args){
    const result=old.apply(this,args),e=window.__creekReplayEvidence;
    if(g.replayer.active){e.maxFrames=Math.max(e.maxFrames,g.replayer.frame);if(p.state==='dead'||p.state==='gameover')e.deaths++;if(p.isBailing)e.bails++;
    if(!e.states.includes(p.state))e.states.push(p.state);const ground=p.groundHit?.name;if(ground&&!e.grounds.includes(ground))e.grounds.push(ground);
    const rail=p.grindRail?l.rails.indexOf(p.grindRail):null;if(rail!==null&&!e.rails.includes(rail))e.rails.push(rail);
    const mover=p.groundHit?.moverId;if(mover!==undefined&&!e.movers.includes(mover))e.movers.push(mover);
    if(g.replayer.frame>=data.frames){e.final={position:p.pos.toArray(),state:p.state,grounded:p.grounded,cratesBroken:p.cratesBroken};g.replayer.end();g.gameFlow.showPause({levelName:'Custard Creek',inWarpRoom:false});}}
    return result;
   };
   g.replayer.begin(data);
  },{start:native.start,heading:native.startHeading,data});
  await page.waitForFunction(frames=>window.__creekReplayEvidence.maxFrames>=frames||window.__creekReplayEvidence.deaths>0||window.__creekReplayEvidence.bails>0,data.frames);
  const result=await page.evaluate(()=>{const g=window.__game,p=g.player;g.gameFlow.showPause({levelName:'Custard Creek',inWarpRoom:false});return {...window.__creekReplayEvidence,...(window.__creekReplayEvidence.final??{position:p.pos.toArray(),state:p.state,grounded:p.grounded,cratesBroken:p.cratesBroken}),stamp:document.querySelector('.hud-build')?.textContent};});
  result.name=name;result.render=full?'full':'lite';results.push(result);console.log(JSON.stringify(result));
  await page.screenshot({path:out+'/'+name+'.png'});await page.evaluate(()=>window.__creekRestoreStep());
  assert.equal(result.deaths,0,`${name}: real-browser input take must stay alive`);assert.equal(result.bails,0,`${name}: real-browser take must avoid bails`);
  assert.ok(result.maxFrames>=data.frames,`${name}: browser consumed full input take`);
  assert.equal(result.state,native.final.state,`${name}: browser reaches native outcome`);
  const distance=Math.hypot(...result.position.map((v,i)=>v-native.final.position[i]));assert.ok(distance<2,`${name}: browser/native final distance ${distance}`);
  await page.close();
 }
 assert.deepEqual(errors,[],'no browser console or page errors');
}finally{
 const prior=JSON.parse(await readFile(out+'/report.json','utf8').catch(()=> '{}'));
 const combined=[...(prior.results??[]).filter(p=>!results.some(r=>r.name===p.name)),...results];
 await writeFile(out+'/report.json',JSON.stringify({base,results:combined,errors},null,2));await browser.close();
}
