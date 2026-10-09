import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildBlockworksBrowserPilot} from './blockworks-browser-pilot.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>/^https?:/.test(a))||'http://127.0.0.1:5340/';
const full=process.argv.includes('--full'),output=process.env.BLOCKWORKS_BROWSER_OUTPUT||join(tmpdir(),'blockworks-whole-browser');
await mkdir(output,{recursive:true});const bundle=await buildBlockworksBrowserPilot();
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(new URL(`?playtest&level=codex-lab${full?'':'&lite'}`,base).href);
 await page.waitForFunction(()=>window.__game,null,{timeout:120000});
 await page.addScriptTag({content:bundle.source});
 await page.evaluate(pilot=>{
  const g=window.__game,p=g.player,l=g.getLevel(),m=window.BlockworksSource;
  const assertion=(value,message='pilot assertion failed')=>{if(!value)throw Error(message);};assertion.ok=assertion;
  assertion.equal=(a,b,message)=>assertion(Object.is(a,b),message??`${a} !== ${b}`);
  assertion.notEqual=(a,b,message)=>assertion(!Object.is(a,b),message);
  assertion.deepEqual=(a,b,message)=>assertion(JSON.stringify(a)===JSON.stringify(b),message);
  if(g.frameStats.totalFixedSteps!==0||l.time!==0)throw Error('Install before the first simulation tick');
  const THREE={Vector3:p.pos.constructor,Box3:p.playerBox.constructor,Raycaster:p.raycaster.constructor};
  const report=window.blockworksWhole={frame:0,done:false,failure:null,stage:'opening',trace:[],actions:[],checkpoints:[],tuning:JSON.stringify(g.TUNING),stamp:document.querySelector('.hud-build')?.textContent};
  const held=['jumpHeld','grindHeld','spinHeld','grabHeld','transferHeld'];let last={},context,next,advanced=false,lastCheckpoint=null;
  const snapshot=()=>({frame:report.frame,time:l.time,position:p.pos.toArray(),heading:p.axisF.toArray(),state:p.state,grounded:p.grounded,speed:p.speed,verticalSpeed:p.vVel,bailing:p.isBailing,deaths:p.totalDeaths,mover:p.groundHit?.moverId??null,ground:p.groundHit?{name:p.groundHit.name,y:p.groundHit.y,normal:p.groundHit.normal.toArray(),slippy:p.groundHit.slippy===true,iceGrip:p.groundHit.iceGrip??null}:null,rail:p.grindRail?l.rails.indexOf(p.grindRail):null,balance:p.balance,input:{...last}});
  const alive=label=>assertion(!p.isBailing&&!['dead','gameover'].includes(p.state),`${label}: ${JSON.stringify(snapshot())}`);
  const tick=function*(sample={}){yield sample;return snapshot();};
  const stepFor=function*(count,sample={}){for(let i=0;i<count;i++)yield* tick(typeof sample==='function'?sample(context,i):sample);return snapshot();};
  const until=function*(predicate,sample={},options={}){
   const firstFrame=report.frame;report.stage=options.label??report.stage;
   for(let i=0;i<(options.maxFrames??1800)&&!predicate(context);i++){yield* tick(typeof sample==='function'?sample(context,i):sample);if(!options.allowDeath)alive(options.label);}
   assertion(predicate(context),`${options.label} timed out: ${JSON.stringify(snapshot())}`);report.actions.push({name:options.label,firstFrame,lastFrame:report.frame});return snapshot();
  };
  const point=q=>Array.isArray(q)?{x:q[0],y:q[1],z:q[2]}:q,resolve=q=>point(typeof q==='function'?q(context):q);
  const distanceTo=q=>{const target=resolve(q);return Math.hypot(target.x-p.pos.x,target.z-p.pos.z);};
  const worldDirectionInput=(d,pace=1)=>{d=point(d);const length=Math.hypot(d.x,d.z),f=l.laneDirAt(p.pos.x,p.pos.y,p.pos.z)??{x:0,z:-1},scale=1/(Math.hypot(f.x,f.z)||1);return length<1e-8||pace===0?{moveX:0,moveY:0}:{moveX:(d.x*-f.z+d.z*f.x)/length*scale*pace,moveY:(d.x*f.x+d.z*f.z)/length*scale*pace};};
  const steerToward=(q,options={})=>{q=resolve(q);return distanceTo(q)<=(options.tolerance??.08)?{moveX:0,moveY:0}:worldDirectionInput({x:q.x-p.pos.x,z:q.z-p.pos.z},options.pace??1);};
  const walkTo=function*(q,options={}){
   yield* until(()=>distanceTo(q)<(options.tolerance??.1),()=>{if(options.requireGrounded!==false)assertion(p.grounded,'walking lost support');return{...steerToward(q,{pace:options.pace??.15,tolerance:options.tolerance??.1}),...options.buttons};},{maxFrames:options.maxFrames??1800,label:options.label});
   yield* stepFor(options.settleFrames??30,options.buttons??{});alive('walk settle');if(options.requireGrounded!==false)assertion(p.grounded,'walk settle lost support');assertion(distanceTo(q)<=(options.arrivalTolerance??.18),'walk stopping momentum missed target');return snapshot();
  };
  const skateAlong=function*(route,options){return yield* until(()=>options.progress(context)>=options.to,()=>{const s=Math.min(options.to,Math.max(options.from??0,options.progress(context))+(options.lookAhead??10));return{...steerToward(route(s),options),jumpHeld:options.charge!==false,...options.buttons};},{maxFrames:options.maxFrames??18000,label:options.label});};
  const charge=function*(count=26,sample={}){return yield* stepFor(count,(ctx,i)=>({...(typeof sample==='function'?sample(ctx,i):sample),jumpHeld:true}));};
  const releaseJump=function*(sample={}){return yield* tick({...sample,jumpHeld:false,jumpReleased:true});};
  const jumpTo=function*(q,options={}){
   yield* charge(options.chargeFrames??26,options.chargeInput??{});yield* releaseJump(options.releaseInput??{});assertion(p.state==='air','jump release failed');
   yield* until(()=>p.grounded||options.allowGrind&&p.state==='grind',()=>({...steerToward(q,options),...options.airButtons}),{maxFrames:options.maxAirFrames??180,label:options.label});
   assertion(distanceTo(q)<=(options.arrivalTolerance??1.4),'jump missed target');if(options.heightTolerance!==undefined)assertion(Math.abs(p.pos.y-resolve(q).y)<=options.heightTolerance,'jump landed at wrong height');return snapshot();
  };
  const grindUntil=function*(predicate,options={}){return yield* until(predicate,(ctx,i)=>{const approach=options.approachInput?typeof options.approachInput==='function'?options.approachInput(ctx,i):options.approachInput:{moveY:1},buttons=typeof options.buttons==='function'?options.buttons(ctx,i):options.buttons;return{...approach,...(p.state==='grind'&&options.balance!==false?{moveX:Math.max(-1,Math.min(1,-p.balance*5-p.balanceVel*.7))}:{}),grindHeld:true,...buttons};},{maxFrames:options.maxFrames??3600,label:options.label});};
  context={p,l,THREE,sourceModule:m,source:m.CODEX_LAB_LEVEL,TUNING:g.TUNING,dt:1/60,trace:report.trace,actions:report.actions,tick,stepFor,until,worldDirectionInput,steerToward,distanceTo,walkTo,skateAlong,charge,releaseJump,jumpTo,grindUntil,snapshot,get frame(){return report.frame;},get lastInput(){return last;}};
  const generator=new Function('assert','process',pilot)(assertion,{env:{}})(context);next=generator.next();
  const native=p.step.bind(p),commit=p.commitRenderStep.bind(p);
  p.step=(dt,input,level)=>{
   if(report.done)return;
   try{const sample=next.value??{},out={moveX:0,moveY:0,jumpCancelled:false,restartPressed:false};for(const h of held)out[h]=false;Object.assign(out,sample);
    const n=Math.hypot(out.moveX,out.moveY);if(n>1){out.moveX/=n;out.moveY/=n;}out.moveX=Math.round(out.moveX*100)/100;out.moveY=Math.round(out.moveY*100)/100;
    for(const h of held){const edge=h.replace('Held','Pressed');if(!(edge in sample))out[edge]=!!out[h]&&!last[h];}if(!('jumpReleased'in sample))out.jumpReleased=!out.jumpHeld&&!!last.jumpHeld;
    last={...out};Object.assign(input,out);native(dt,input,level);advanced=true;
   }catch(e){report.failure=String(e);report.done=true;}
  };
  p.commitRenderStep=(...args)=>{commit(...args);if(!advanced||report.done)return;advanced=false;report.frame++;report.trace.push(snapshot());
   if(l.activeCheckpoint&&l.activeCheckpoint!==lastCheckpoint){lastCheckpoint=l.activeCheckpoint;report.checkpoints.push({frame:report.frame,index:l.checkpoints.indexOf(lastCheckpoint)});}
   try{next=generator.next();if(next.done){report.done=true;report.evidence=next.value;report.end=snapshot();report.tuningUnchanged=JSON.stringify(g.TUNING)===report.tuning;}}
   catch(e){report.failure=String(e);report.done=true;}
  };
 },bundle.pilot);
 for(let i=0;i<3600;i++){
  await page.waitForTimeout(250);const state=await page.evaluate(()=>({done:window.blockworksWhole.done,frame:window.blockworksWhole.frame,stage:window.blockworksWhole.stage,failure:window.blockworksWhole.failure}));
  if(i%120===0)console.log(JSON.stringify(state));if(state.done)break;
 }
 const report=await page.evaluate(()=>window.blockworksWhole);await writeFile(join(output,'report.json'),JSON.stringify({base,report,errors},null,2));
 await page.screenshot({path:join(output,'finish.png')});assert.equal(report.done,true);assert.equal(report.failure,null);assert.equal(report.end.state,'finished');assert.equal(report.end.deaths,0);assert.equal(report.checkpoints.length,6);assert.equal(report.tuningUnchanged,true);assert.match(report.stamp,/Codex\/sol fork/);assert.deepEqual(errors,[]);
 console.log(`PASS complete ${full?'full':'lite'} browser Blockworks journey: ${report.frame} ticks, six checkpoints, no deaths or console errors.`);
}finally{await browser.close();}
