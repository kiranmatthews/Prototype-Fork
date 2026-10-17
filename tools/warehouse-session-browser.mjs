#!/usr/bin/env node
/** Real-time acceptance runner: normal Gamepad -> Input -> main loop -> camera/render.
 * No player stepping, respawn, world/camera mutation, or synchronous route simulation.
 * See docs/warehouse-flow/session-testing.md for the JSON plan contract. */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';

export function validatePlan(plan){
 if(plan?.version!==1||!Array.isArray(plan.segments)||!plan.segments.length)throw Error('A version:1 plan with segments is required');
 const names=new Set();
 for(const segment of plan.segments){
  if(!segment.name||names.has(segment.name))throw Error('Each segment needs a unique name');names.add(segment.name);
  if(!segment.until&&!Number.isFinite(segment.seconds)&&!Number.isInteger(segment.frames))throw Error(`${segment.name}: specify until, seconds, or frames`);
  if(segment.seconds!==undefined&&(!Number.isFinite(segment.seconds)||segment.seconds<0))throw Error(`${segment.name}: seconds must be nonnegative`);
  if(segment.frames!==undefined&&(!Number.isInteger(segment.frames)||segment.frames<1))throw Error(`${segment.name}: frames must be a positive integer`);
  for(const key of ['spawn','place','teleport','position','respawn','heading','script','evaluate'])if(key in segment)throw Error(`${segment.name}: ${key} is not an input action`);
  if(segment.controller?.target&&(!Array.isArray(segment.controller.target)||segment.controller.target.length!==3))throw Error(`${segment.name}: controller.target must be [x,y,z]`);
 }
 for(const key of ['spawn','place','teleport','position','respawn','script','evaluate'])if(key in plan)throw Error(`${key} is forbidden: sessions begin at the real level spawn`);
 return plan;
}

/** Serialized by Playwright. Keep this function self-contained. */
function installSession(plan){
 const g=window.__game,p=g.player,l=g.getLevel(),frames=g.frameStats,authored=l.captureData();
 const originalPads=Object.getOwnPropertyDescriptor(navigator,'getGamepads');
 const pad={id:'Warehouse acceptance standard gamepad',index:0,connected:true,mapping:'standard',timestamp:0,
  axes:[0,0,0,0],buttons:Array.from({length:18},()=>({pressed:false,touched:false,value:0}))};
 Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[pad]});
 const bindings={jump:0,grab:1,spin:2,grind:3,inventory:6,transfer:7,up:12,down:13,left:14,right:15};
 const start=performance.now(),firstFrame=frames.frame,firstStep=frames.totalFixedSteps;
 const telemetry=[],events=[],captures=[],segmentResults=[],checkpointResults=[],captureJobs=[];
 const checkpoints=(plan.checkpoints??[]).map(c=>({...c,hit:false}));
 const globalCaptures=(plan.captures??[]).map(c=>({...c,hit:false}));
 const targets=plan.targets??[];
 const clamp=(n,a=-1,b=1)=>Math.max(a,Math.min(b,n));
 let segmentIndex=0,segmentFrame=firstFrame,segmentStep=firstStep,lastFrame=firstFrame,segmentCaptures=[],done=false,failure=null,previous=null,raf=0;
 let applied={move:[0,0],look:[0,0],buttons:[]},captureCount=0,lastVisibility=[],pendingInitialCapture=null;
 const callbacks=[];
 for(const [key,type]of [['onComboBank','combo-bank'],['onComboBail','combo-bail'],['onWipeout','wipeout'],['onDeath','death']]){
  const original=p[key];if(typeof original!=='function')continue;
  const wrapper=function(...args){events.push({type,frame:frames.frame-firstFrame,fixedStep:frames.totalFixedSteps-firstStep+1,seconds:(frames.totalFixedSteps-firstStep+1)/60,args});return original.apply(this,args);};
  callbacks.push({key,original,wrapper});p[key]=wrapper;
 }
 const V=p.pos.constructor,ray=new p.raycaster.constructor(),cameraPoint=new V(),direction=new V();
 const initialSnap=p.renderSnapVersion,initialDeaths=p.totalDeaths;
 const condition=(c,s)=>{
  if(!c)return true;
  if(c.all)return c.all.every(x=>condition(x,s));
  if(c.any)return c.any.some(x=>condition(x,s));
  if(c.not)return !condition(c.not,s);
  if(c.near){const q=c.near;return Math.hypot(s.x-q[0],s.z-q[2])<=(c.radius??2)&&Math.abs(s.y-q[1])<=(c.heightTolerance??2);}
  if(c.field){let value=s;for(const key of c.field.split('.'))value=value?.[key];const q=c.value;
   switch(c.op??'eq'){case'eq':return value===q;case'ne':return value!==q;case'lt':return value<q;case'lte':return value<=q;case'gt':return value>q;case'gte':return value>=q;case'includes':return Array.isArray(value)||typeof value==='string'?value.includes(q):false;default:throw Error('Unknown condition op '+c.op);}}
  throw Error('Condition needs all, any, not, near, or field');
 };
 const visibility=()=>{
  const active=targets.filter(t=>!t.segments||t.segments.includes(plan.segments[segmentIndex]?.name));
  if(!active.length)return [];
  const meshes=[];l.root.traverseVisible(o=>{
   if(!o.isMesh||o.userData.editorGhost||o.userData.warehouseContact)return;
   const ms=Array.isArray(o.material)?o.material:[o.material];if(ms.every(m=>m.visible===false||(m.transparent&&m.opacity<.15)))return;
   meshes.push(o);
  });
  return active.map(t=>{
   const point=new V(...t.point),projected=point.clone().project(g.camera),inFrame=Math.abs(projected.x)<=1&&Math.abs(projected.y)<=1&&projected.z>=-1&&projected.z<=1;
   g.camera.getWorldPosition(cameraPoint);direction.copy(point).sub(cameraPoint);const distance=direction.length();
   ray.set(cameraPoint,direction.normalize());ray.near=.05;ray.far=Math.max(.05,distance-(t.tolerance??.6));
   const hit=inFrame?ray.intersectObjects(meshes,false)[0]:null;
   const component=hit?authored.components[hit.object.userData.editorIdx]:null;
   return {name:t.name,point:t.point,inFrame,occluded:!!hit,visible:inFrame&&!hit,ndc:projected.toArray(),
    occluder:hit?{name:component?.nm||hit.object.name||hit.object.type,distance:hit.distance}:null};
  });
 };
 const sample=()=>{
  const pos=p.pos.toArray(),stepGap=previous?frames.totalFixedSteps-firstStep-previous.fixedSteps:0;
  const motionSpeed=previous&&stepGap>0&&p.renderSnapVersion-initialSnap===previous.snap
   ?Math.hypot(pos[0]-previous.x,pos[2]-previous.z)/(stepGap/60):previous?.motionSpeed??Math.abs(p.speed);
  const railComponent=p.grindRail?.object?.userData.editorIdx??l.surfaceEdgeOwners?.get(p.grindRail)?.userData.editorIdx??null;
  const groundComponent=p.groundHit?.mesh?.userData.editorIdx??p.groundHit?.halfpipe?.object?.userData.editorIdx??null;
  const state={frame:frames.frame-firstFrame,fixedSteps:frames.totalFixedSteps-firstStep,
   seconds:(frames.totalFixedSteps-firstStep)/60,wallSeconds:(performance.now()-start)/1000,
   segment:plan.segments[segmentIndex]?.name??null,segmentFrames:frames.frame-segmentFrame,segmentSeconds:(frames.totalFixedSteps-segmentStep)/60,
   position:pos,x:pos[0],y:pos[1],z:pos[2],heading:p.axisF.toArray(),speed:p.speed,motionSpeed,grounded:p.grounded,state:p.state,
   skating:p.freeSkate,bail:p.isBailing,deaths:p.totalDeaths-initialDeaths,snap:p.renderSnapVersion-initialSnap,
   ground:p.groundHit?.name??null,groundComponent,groundSource:groundComponent===null?null:authored.components[groundComponent]?.nm??null,
   grind:p.state==='grind',rail:p.grindRail?.object?.name??null,grindT:p.grindT,
   railComponent,railSource:railComponent===null?null:authored.components[railComponent]?.nm??null,railKind:p.grindRail?(l.surfaceEdgeRails.includes(p.grindRail)?'edge':'authored'):null,
   manual:p.manualing,balance:p.balance,balanceVelocity:p.balanceVel,vertAir:p.vertAir,
   combo:{points:p.comboPoints,multiplier:p.comboMult,timer:p.comboTimer,labels:[...p.comboLabels]},bankedPoints:p.points,
   tokens:l.skateCollectathon?.collected??0,collected:l.skateCollectathon?.tokens.map((t,i)=>t.collected?i+1:null).filter(Boolean)??[],
   checkpoint:l.activeCheckpoint?.spawnPos?.toArray()??null,camera:{position:g.camera.position.toArray(),quaternion:g.camera.quaternion.toArray(),fov:g.camera.fov},
   input:{moveX:g.input.moveX,moveY:g.input.moveY,jump:g.input.jumpHeld,grab:g.input.grabHeld,grind:g.input.grindHeld,spin:g.input.spinHeld,transfer:g.input.transferHeld},
   commanded:applied,simSteps:frames.simSteps,rawDt:frames.rawDt,visibility:lastVisibility};
  return state;
 };
 const capture=(name,s)=>{
  if(captureCount>=(plan.maxCaptures??40))throw Error('Capture budget exceeded');
  const id=String(++captureCount).padStart(3,'0')+'-'+name.replace(/[^a-z0-9_-]/gi,'-').slice(0,90);
  const entry={name,id,frame:s.frame,seconds:s.seconds,segment:s.segment,position:s.position,visibility:visibility()};captures.push(entry);
  // Same animation-frame callback as this observation: do not advance or pose the world.
  captureJobs.push(window.__warehouseSessionCapture({id,png:g.renderer.domElement.toDataURL('image/png')}));
 };
 const setInput=action=>{
  const move=action.move??[0,0],len=Math.hypot(...move),scale=len>.001?(.22+.78*Math.min(1,len))/len:0;
  pad.axes[0]=move[0]*scale;pad.axes[1]=-move[1]*scale;pad.axes[2]=action.look?.[0]??0;pad.axes[3]=-(action.look?.[1]??0);
  const buttons=new Set(action.buttons??[]);for(const name of buttons)if(!(name in bindings))throw Error('Unknown input button '+name);
  for(let i=0;i<pad.buttons.length;i++){const down=[...buttons].some(b=>bindings[b]===i);Object.assign(pad.buttons[i],{pressed:down,touched:down,value:down?1:0});}
  pad.timestamp=performance.now();applied={move:[...move],look:[...(action.look??[0,0])],buttons:[...buttons]};
 };
 const actionFor=(segment,s)=>{
  const action={move:[...(segment.input?.move??[0,0])],look:[...(segment.input?.look??[0,0])],buttons:[...(segment.input?.buttons??[])]},c=segment.controller;
  if(!c)return action;
  const buttons=new Set(action.buttons);
  if(c.target){const dx=c.target[0]-s.x,dz=c.target[2]-s.z,d=Math.hypot(dx,dz),cf=p.camDir;
   if(d>.001&&s.grounded){
    if(l.skatepark&&s.skating){
     const error=Math.atan2(dx,-dz)-Math.atan2(p.axisF.x,-p.axisF.z);
     action.move=[clamp(Math.atan2(Math.sin(error),Math.cos(error))*(c.steeringGain??2.7)),segment.input?.move?.[1]??1];
    }else action.move=[(-cf.z*dx+cf.x*dz)/d,(cf.x*dx+cf.z*dz)/d];
   }
   // Air input rotates the board; target feedback must not become a spin.
   // Explicit input.move is still honored for intentionally authored tricks.
   if(c.brakeAbove!==undefined&&s.skating&&s.grounded&&Math.abs(s.speed)>c.brakeAbove)buttons.add('grab');
  }
  if(c.charge)buttons.add('jump');
  if(c.balanceGrind&&s.grind)action.move[0]=clamp(-s.balance*14-s.balanceVelocity*2);
  if(c.balanceManual&&s.manual)action.move[1]=clamp(s.balance*14+s.balanceVelocity*2);
  action.buttons=[...buttons];return action;
 };
 const enter=(s,deferCapture=false)=>{
  const segment=plan.segments[segmentIndex];segmentFrame=frames.frame;segmentStep=frames.totalFixedSteps;
  segmentCaptures=(segment.captures??[]).map(c=>({...c,hit:false}));events.push({type:'segment-start',name:segment.name,frame:s.frame,seconds:s.seconds});
  const entered={...s,segment:segment.name,segmentFrames:0,segmentSeconds:0};
  if(segment.captureStart){if(deferCapture)pendingInitialCapture=segment.name+'-start';else capture(segment.name+'-start',entered);}setInput(actionFor(segment,entered));
 };
 const stop=reason=>{
  done=true;failure=reason??null;setInput({});cancelAnimationFrame(raf);
  for(const {key,original,wrapper}of callbacks)if(p[key]===wrapper)p[key]=original;
  if(originalPads)Object.defineProperty(navigator,'getGamepads',originalPads);else delete navigator.getGamepads;
 };
 const tick=()=>{
  if(done)return;
  try{
   if((performance.now()-start)/1000>(plan.timeoutSeconds??300)){stop('Session wall-time timeout');return;}
   if(frames.frame===lastFrame){raf=requestAnimationFrame(tick);return;}lastFrame=frames.frame;
   if((frames.frame-firstFrame)%(plan.visibilityEveryFrames??12)===0)lastVisibility=visibility();
   const s=sample(),segment=plan.segments[segmentIndex];
   if(pendingInitialCapture){capture(pendingInitialCapture,s);pendingInitialCapture=null;}
   if(previous){
    if(s.bail&&!previous.bail)events.push({type:'bail',frame:s.frame,seconds:s.seconds});
    if(s.grind&&!previous.grind)events.push({type:'grind-start',rail:s.rail,frame:s.frame,seconds:s.seconds});
    if(s.manual&&!previous.manual)events.push({type:'manual-start',frame:s.frame,seconds:s.seconds});
    if(s.combo.multiplier>previous.combo.multiplier)events.push({type:'combo-action',frame:s.frame,seconds:s.seconds,combo:s.combo});
    if(previous.combo.multiplier>0&&s.combo.multiplier===0)events.push({type:'combo-ended',frame:s.frame,seconds:s.seconds,banked:s.bankedPoints-previous.bankedPoints,previous:previous.combo});
    if(s.tokens>previous.tokens)events.push({type:'collect',tokens:s.collected,frame:s.frame,seconds:s.seconds});
    if(s.snap!==previous.snap)events.push({type:'render-snap',frame:s.frame,seconds:s.seconds,snap:s.snap});
   }
   for(const c of [...checkpoints,...globalCaptures,...segmentCaptures])if(!c.hit&&(!c.segment||c.segment===s.segment)&&condition(c.when,s)){
    c.hit=true;if(checkpoints.includes(c))checkpointResults.push({name:c.name,frame:s.frame,seconds:s.seconds,position:s.position});
    if(!checkpoints.includes(c)||c.capture)capture(c.name,s);
   }
   telemetry.push(s);previous=s;
   if(plan.failOnBail!==false&&s.bail){stop('Bail in '+segment.name);return;}
   if(plan.failOnDeath!==false&&s.deaths>0){stop('Death in '+segment.name);return;}
   if(s.wallSeconds>(plan.timeoutSeconds??300)){stop('Session wall-time timeout');return;}
   if(s.segmentSeconds>(segment.timeoutSeconds??40)){stop('Segment timeout: '+segment.name);return;}
   const complete=(segment.until?condition(segment.until,s):true)&&(segment.seconds!==undefined?s.segmentSeconds>=segment.seconds:true)&&(segment.frames!==undefined?s.segmentFrames>=segment.frames:true);
   if(complete){
    if(segment.captureEnd)capture(segment.name+'-end',s);
    segmentResults.push({name:segment.name,frames:s.segmentFrames,seconds:s.segmentSeconds,end:s});
    if(segment.expect&&!condition(segment.expect,s)){stop('End condition failed: '+segment.name);return;}
    segmentIndex++;if(segmentIndex>=plan.segments.length){stop();return;}enter(s);
   }else setInput(actionFor(segment,s));
   raf=requestAnimationFrame(tick);
  }catch(e){stop(e.stack??String(e));}
 };
 const initial=sample();telemetry.push(initial);previous=initial;enter(initial,true);raf=requestAnimationFrame(tick);
 window.__warehouseSession={get done(){return done;},get failure(){return failure;},stop,
  async result(){await Promise.all(captureJobs);return {initial,telemetry,events,captures,segments:segmentResults,checkpoints:checkpointResults,
   missingCheckpoints:checkpoints.filter(c=>!c.hit).map(c=>c.name),failure,final:previous,
   replay:g.exportReplay(),stamp:document.querySelector('.hud-build')?.textContent,
   config:{skatepark:l.skatepark,alwaysSkate:l.alwaysSkate,cameraRig:l.cameraRig??null,parkFov:g.TUNING.parkCamFov}};}};
}

export async function runSession(planPath,baseOverride){
 const plan=validatePlan(JSON.parse(await readFile(planPath,'utf8'))),output=resolve(process.env.WAREHOUSE_OUTPUT??plan.output??'/private/tmp/warehouse-session');
 await mkdir(output,{recursive:true});await mkdir(join(output,'captures'),{recursive:true});
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({headless:plan.headless!==false,channel:process.env.WAREHOUSE_BROWSER_CHANNEL||'chrome'});
 const errors=[],warnings=[],captured=[];let context,page,result=null,fatal=null,videoPath=null;
 try{
  const viewport=plan.viewport??{width:1440,height:900};
  context=await browser.newContext({viewport,...(plan.recordVideo?{recordVideo:{dir:join(output,'video'),size:viewport}}:{})});page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());else if(m.type()==='warning')warnings.push(m.text());});
  await page.exposeBinding('__warehouseSessionCapture',async(_,{id,png})=>{const name=`captures/${id}.png`;await writeFile(join(output,name),Buffer.from(png.split(',')[1],'base64'));captured.push(name);});
  const url=new URL(baseOverride??plan.baseUrl??'http://127.0.0.1:5321/');url.searchParams.set('playtest','');url.searchParams.set('level',plan.level??'warehouse');if(plan.lite)url.searchParams.set('lite','');else url.searchParams.delete('lite');
  await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay&&window.__game.player.grounded,null,{timeout:180000});
  if(plan.waitForArt!==false)await page.waitForFunction(()=>!window.__game.getLevel().warehouseArtEnabled||window.__game.getLevel().warehouseDiagnostics?.artReady,null,{timeout:180000});
  await page.evaluate(installSession,plan);
  await page.waitForFunction(()=>window.__warehouseSession.done,null,{timeout:(plan.timeoutSeconds??300)*1000+30000});
  result=await page.evaluate(()=>window.__warehouseSession.result());
  await page.screenshot({path:join(output,'final.png')});
 }catch(e){fatal=e.stack??String(e);if(page)try{result=await page.evaluate(async()=>{window.__warehouseSession?.stop('Browser runner error');return window.__warehouseSession?await window.__warehouseSession.result():null;});}catch{}}
 finally{if(context){const video=page?.video();await context.close();if(video)videoPath=await video.path();}await browser.close();}
 const samples=result?.telemetry??[],last=result?.final;
 let distance=0;for(let i=1;i<samples.length;i++)if(samples[i].snap===samples[i-1].snap)distance+=Math.hypot(...samples[i].position.map((v,k)=>v-samples[i-1].position[k]));
 const intervals=samples.slice(1).map((s,i)=>(s.wallSeconds-samples[i].wallSeconds)*1000).sort((a,b)=>a-b);
 const stopRanges=[];let range=null;
 for(const s of samples){if(s.grounded&&s.motionSpeed<.5){range??={start:s.seconds,end:s.seconds,segments:[]};range.end=s.seconds;if(!range.segments.includes(s.segment))range.segments.push(s.segment);}else if(range){if(range.end-range.start>=.5)stopRanges.push(range);range=null;}}
 if(range&&range.end-range.start>=.5)stopRanges.push(range);
 const pickupOrder=[],seenTokens=new Set();for(const event of result?.events??[])if(event.type==='collect')for(const token of event.tokens)if(!seenTokens.has(token)){seenTokens.add(token);pickupOrder.push(token);}
 const summary={frames:samples.length,distance,seconds:last?.seconds??0,wallSeconds:last?.wallSeconds??0,
  minSpeed:samples.length?Math.min(...samples.map(s=>Math.abs(s.speed))):null,maxSpeed:samples.length?Math.max(...samples.map(s=>Math.abs(s.speed))):null,
  maxMotionSpeed:samples.length?Math.max(...samples.map(s=>s.motionSpeed)):null,
  stops:stopRanges,bails:result?.events.filter(e=>e.type==='bail').length??0,deaths:last?.deaths??0,snaps:last?.snap??0,
  grindFrames:samples.filter(s=>s.grind).length,manualFrames:samples.filter(s=>s.manual).length,
  maxComboMultiplier:samples.length?Math.max(...samples.map(s=>s.combo.multiplier)):0,
  tokens:last?.tokens??0,collected:last?.collected??[],pickupOrder,finished:last?.state==='finished',
  frameTime:{median:intervals[Math.floor(intervals.length*.5)]??null,p95:intervals[Math.floor(intervals.length*.95)]??null},
  maxFixedStepsPerObservedFrame:samples.length?Math.max(...samples.map(s=>s.simSteps??0)):0};
 const failures=[fatal,result?.failure,...(result?.missingCheckpoints??[]).map(n=>'Missing checkpoint: '+n)].filter(Boolean),a=plan.assert??{};
 for(const [key,min]of Object.entries(a.min??{}))if(!(summary[key]>=min))failures.push(`${key} ${summary[key]} < ${min}`);
 for(const [key,max]of Object.entries(a.max??{}))if(!(summary[key]<=max))failures.push(`${key} ${summary[key]} > ${max}`);
 for(const [key,value]of Object.entries(a.equals??{}))if(Array.isArray(value)?JSON.stringify(summary[key])!==JSON.stringify(value):summary[key]!==value)failures.push(`${key} ${JSON.stringify(summary[key])} != ${JSON.stringify(value)}`);
 if(errors.length)failures.push(`${errors.length} browser console/page errors`);
 const {telemetry,replay,...rest}=result??{};
 const report={planPath:resolve(planPath),plan,summary,...rest,captured,videoPath,errors,warnings,failures,pass:failures.length===0,
  limitations:['Inputs are automated; this does not prove novice discoverability.','Visibility samples point targets against visible scene meshes, not semantic readability or pixel-perfect alpha masking.','Telemetry is sampled per rendered frame; multiple fixed steps can occur within one render.','World-target controller uses native board-relative ground steering in parks and camera-relative walking, with no target steering in air; it does not brake automatically for corners or alter the camera.']};
 await Promise.all([writeFile(join(output,'report.json'),JSON.stringify(report,null,2)),writeFile(join(output,'telemetry.jsonl'),(telemetry??[]).map(s=>JSON.stringify(s)).join('\n')+'\n'),writeFile(join(output,'replay.json'),JSON.stringify(replay??null))]);
 console.log(JSON.stringify({pass:report.pass,output,summary,failures},null,2));return report;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(!process.argv[2]){console.error('Usage: node tools/warehouse-session-browser.mjs PLAN.json [BASE_URL]');process.exitCode=2;}
 else try{const r=await runSession(process.argv[2],process.argv[3]);if(!r.pass)process.exitCode=1;}catch(e){console.error(e);process.exitCode=1;}
}
