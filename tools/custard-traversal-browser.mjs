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
const folder=process.env.CUSTARD_TRAVERSAL_OUTPUT||'/private/tmp/custard-creek-independent-traversal',out=folder+'/browser';await mkdir(out,{recursive:true});
const channels=['jumpHeld','grindHeld','spinHeld','grabHeld','jumpPressed','jumpReleased','grindPressed','spinPressed','grabPressed','restartPressed','transferHeld','transferPressed','jumpCancelled'];
const reports=JSON.parse(await readFile(folder+'/report.json','utf8')).filter(r=>r.course==='independent-folded-creek');
const tests=names.length?names:['lockyard','inner-bank','outer-bank','mill-rail','spillway','sluice','ferry','boulder-run','backwater-finish','continuous-chapter'];
const browser=await chromium.launch({channel:'chrome',headless:true});const results=[],errors=[];
try{
 for(const name of tests){
  const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(120000);page.setDefaultNavigationTimeout(120000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const native=reports.find(r=>r.name===name);assert.ok(native?.pass,`${name} requires a passing native take`);
  const trace=JSON.parse(await readFile(folder+'/'+name+'-trace.json','utf8'));
  assert.ok(trace.every(t=>Number.isFinite(t.cameraYaw)),`${name} requires the actual native camera yaw recorded on every step`);
  const data={v:2,level:'custard-creek',date:new Date().toISOString(),tuning:{},tuningChanges:[],mx:trace.map(t=>t.input.moveX),my:trace.map(t=>t.input.moveY),b:trace.map(t=>channels.reduce((b,c,i)=>b|(t.input[c]?1<<i:0),0)),cy:trace.map(t=>t.cameraYaw),frames:trace.length,truncated:false,surfaceFrictionPolicy:1};
  const full=name==='backwater-finish'||name==='full-course';
  await page.goto(`${base}/?playtest&level=custard-creek${full?'':'&lite'}`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay);
  await page.evaluate(async({startWorld,heading,data,expectedFinish,goalStation})=>{
   const g=window.__game,l=g.getLevel(),p=g.player,m=await import('./src/levels/custard-creek.ts');
   p.respawn(l,true,false,{position:p.pos.clone().fromArray(startWorld),heading:p.axisF.clone().fromArray(heading)});
   window.__creekReplayEvidence={maxFrames:0,tailFrames:0,deaths:0,bails:0,states:[],grounds:[],rails:[],movers:[]};
   const old=p.step,oldPoll=g.input.pollGamepad;window.__creekRestoreStep=()=>{p.step=old;g.input.pollGamepad=oldPoll;};
   const snapshot=()=>({position:p.pos.toArray(),state:p.state,grounded:p.grounded,cratesBroken:p.cratesBroken,progress:m.custardProgress(p.pos)});
   const goal=()=>expectedFinish?p.state==='finished':goalStation===null||m.custardProgress(p.pos)>=goalStation&&p.grounded;
   const capture=e=>{e.final=snapshot();g.input.pollGamepad=oldPoll;if(!expectedFinish)g.gameFlow.showPause({levelName:'Custard Creek',inWarpRoom:false});};
   p.step=function(...args){
    const wasReplay=g.replayer.active,result=old.apply(this,args),e=window.__creekReplayEvidence;
    if(wasReplay||e.tailActive&&!e.final){
     if(wasReplay)e.maxFrames=Math.max(e.maxFrames,g.replayer.frame);else e.tailFrames++;
     if(p.state==='dead'||p.state==='gameover')e.deaths++;if(p.isBailing)e.bails++;
     if(!e.states.includes(p.state))e.states.push(p.state);const ground=p.groundHit?.name;if(ground&&!e.grounds.includes(ground))e.grounds.push(ground);
     const rail=p.grindRail?l.rails.indexOf(p.grindRail):null;if(rail!==null&&!e.rails.includes(rail))e.rails.push(rail);
     const mover=p.groundHit?.moverId;if(mover!==undefined&&!e.movers.includes(mover))e.movers.push(mover);
     if(wasReplay&&expectedFinish&&p.state==='finished'){e.earlyFinishFrame=g.replayer.frame;e.nativeTakeEnd=snapshot();g.replayer.end();capture(e);}
     else if(wasReplay&&g.replayer.frame>=data.frames){
      e.nativeTakeEnd=snapshot();g.replayer.end();
      if(goal())capture(e);
      else{
       e.tailActive=true;
       // A genuine held forward/jump device sample continues the live game.
       // No synthetic release, pose change or physics correction is injected.
       g.input.pollGamepad=()=>({id:'Creek forward continuation',mapping:'standard',connected:true,index:0,axes:[0,-1,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:i===0,value:i===0?1:0}))});
      }
     }else if(e.tailActive&&goal())capture(e);
    }
    return result;
   };
   g.replayer.begin(data);
  },{startWorld:native.startWorld,heading:native.startHeading,data,expectedFinish:native.final.state==='finished',goalStation:name==='continuous-chapter'?native.finalProgress:null});
  await page.waitForFunction(()=>window.__creekReplayEvidence.final||window.__creekReplayEvidence.deaths>0||window.__creekReplayEvidence.bails>0||window.__creekReplayEvidence.tailFrames>300);
  const result=await page.evaluate(()=>{const g=window.__game,p=g.player,e=window.__creekReplayEvidence;return {...e,...(e.final??{position:p.pos.toArray(),state:p.state,grounded:p.grounded,cratesBroken:p.cratesBroken}),stamp:document.querySelector('.hud-build')?.textContent};});
  result.name=name;result.render=full?'full':'lite';results.push(result);console.log(JSON.stringify(result));
  await page.screenshot({path:out+'/'+name+'.png'});await page.evaluate(()=>window.__creekRestoreStep());
  assert.equal(result.deaths,0,`${name}: real-browser input take must stay alive`);assert.equal(result.bails,0,`${name}: real-browser take must avoid bails`);
  if(native.final.state!=='finished')assert.ok(result.maxFrames>=data.frames,`${name}: browser consumed the full recorded input take`);
  else assert.ok(result.rails.includes(native.rails.at(-1)),`${name}: actual final-rail traversal precedes the finish`);
  assert.ok(result.tailFrames<=300,`${name}: ordinary continuation must reach its goal promptly`);
  assert.equal(result.state,native.final.state,`${name}: browser reaches the intended outcome`);
  if(name==='continuous-chapter')assert.ok(result.progress>=native.finalProgress&&result.grounded,`${name}: browser completes the supported route chapter`);
  result.nativeFinalDistance=Math.hypot(...result.position.map((v,i)=>v-native.final.position[i]));
  await page.close();
 }
 assert.deepEqual(errors,[],'no browser console or page errors');
}finally{
 const prior=JSON.parse(await readFile(out+'/report.json','utf8').catch(()=> '{}'));
 const combined=[...(prior.results??[]).filter(p=>!results.some(r=>r.name===p.name)),...results];
 await writeFile(out+'/report.json',JSON.stringify({base,results:combined,errors},null,2));await browser.close();
}
