import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {assertSpaghettiRaceTraversal} from './spaghetti-race-validation.mjs';
const output=process.env.SPAGHETTI_OUTPUT??'/private/tmp/spaghetti-rails-evidence';
await mkdir(output,{recursive:true});
const solo=!process.argv.includes('--race'),seed=Number(process.env.SPAGHETTI_SEED??270327);
const miss=process.argv.includes('--miss');
await withBlockworksRuntime(async r=>{
 const registry=await r.server.ssrLoadModule('/src/level.ts');
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts');
 const source=r.sourceModule.SPAGHETTI_RAILS_LEVEL;
 assert.ok(registry.normalizeCustomLevelData(source),'The full editor/save contract accepts the race');
 assert.equal(r.l.raceCheckpoints.length,source.components.filter(c=>c.t==='checkpoint').length,'Editor migration retains all authored rail-race retries');
 const race=new SkateRace(r.scene,r.p,false,()=>true);
 race.attach(r.l,'spaghetti-rails');race.start(solo?'time-trial':'race',seed);
 const traced=Number(process.env.SPAGHETTI_TRACE_RIDER??0),lastInputs=[],drive=race.drive.bind(race);
 race.drive=(id,...args)=>{const input=drive(id,...args);lastInputs[id]=input;return input;};
 const tuning=JSON.stringify(r.TUNING),records=[],trace=[];
 const stats=Array.from({length:race.count},()=>({grindFrames:0,authoredGrindMetres:0,airFrames:0,groundFrames:0,jumps:0,rails:new Set(),lastState:null,maxBalance:0,edgeFrames:0,maxSpecial:0,itemUses:0,itemPickups:0,itemHeights:new Set()}));
 const useItem=race.useItem.bind(race),crateBroken=race.crateBroken.bind(race);
 race.useItem=(id=0,...args)=>{const used=useItem(id,...args);if(used)stats[id].itemUses++;return used;};
 race.crateBroken=(crate,id)=>{const before=race.riders[id]?.item;crateBroken(crate,id);if(crate.mystery&&!before&&race.riders[id]?.item){stats[id].itemPickups++;stats[id].itemHeights.add(Math.floor((crate.mesh.position.y+144)/48));}};
 const previousRailSamples=Array.from({length:race.count},()=>({rail:null,t:0}));
 const maxFrames=Number(process.env.SPAGHETTI_FRAMES??54000);
 let frames=0,lastProgress=0,stalledAt=0,fault=null;const bestProgress=Array(race.count).fill(0);
 for(;frames<maxFrames&&race.riders.slice(0,race.count).some(a=>a.finish===null);frames++){
  r.scene.updateMatrixWorld(true);
  const input=race.phase==='running'?race.drive(0,false,process.env.SPAGHETTI_CHOICE===undefined?undefined:Number(process.env.SPAGHETTI_CHOICE)):{moveX:0,moveY:0};
  race.step(r.dt,input);r.l.update(r.dt);r.p.commitRenderStep(r.l);race.commitRenderStep();
  if(miss&&!fault&&race.riders[0].progress>90){
   // One explicit fault placement below all platforms; recovery thereafter
   // uses the same production input pilot and preserves race time/progress.
   fault={elapsed:race.elapsed,progress:race.riders[0].progress,offset:r.p.verticalLoopOffset};
   r.p.pos.y=source.verticalLoop.minY+1;r.p.prevPos.copy(r.p.pos);r.p.state='air';r.p.grounded=false;r.p.vVel=-45;r.p.speed=0;
   r.p.snapRenderInterpolation();
  }
  for(const a of race.riders.slice(0,race.count)){
   const s=stats[a.id],p=a.player;
   s.maxSpecial=Math.max(s.maxSpecial,p.specialMeter);
   if(p.state==='grind'){
    s.grindFrames++;s.maxBalance=Math.max(s.maxBalance,Math.abs(p.balance));if(Math.abs(p.balance)>.65)s.edgeFrames++;
    const index=r.l.rails.indexOf(p.grindRail),previous=previousRailSamples[a.id];s.rails.add(index);
    if(index>=0&&previous.rail===p.grindRail)s.authoredGrindMetres+=Math.abs(p.grindT-previous.t);
    previous.rail=p.grindRail;previous.t=p.grindT;
   }else previousRailSamples[a.id].rail=null;
   if(p.grounded)s.groundFrames++;
   if(p.state==='air'){s.airFrames++;if(s.lastState==='grind')s.jumps++;}
   s.lastState=p.state;
  }
  if(frames%20===0){const rider=race.riders[traced],p=rider.player,input=lastInputs[traced]??{};trace.push({frame:frames,id:traced,progress:rider.progress,anchor:rider.anchorProgress,p:p.pos.toArray(),state:p.state,grind:r.l.rails.indexOf(p.grindRail),grindT:p.grindT,speed:p.speed,grindSpeed:p.grindVel,balance:p.balance,heading:p.raceHeading.toArray(),aim:rider.aim.toArray(),basis:p.raceInputBasis(r.l),braking:rider.braking,skating:p.boardRolling,input:{moveX:input.moveX,moveY:input.moveY,jump:input.jumpHeld,grind:input.grindHeld,jumpReleased:input.jumpReleased,grindPressed:input.grindPressed}});}
  if(frames%1200===0){
   const state={frames,time:race.elapsed,length:race.course.length,riders:race.riders.slice(0,race.count).map(a=>({id:a.id,s:Math.round(a.progress),p:a.player.pos.toArray().map(v=>Math.round(v*10)/10),speed:Math.round(a.player.state==='grind'?a.player.grindVel:a.player.speed),state:a.player.state,rail:r.l.rails.indexOf(a.player.grindRail),falls:a.falls,finish:a.finish}))};
   records.push(state);console.log(JSON.stringify(state));await writeFile(output+'/latest.json',JSON.stringify(state,null,2));
   await writeFile(output+'/trace-latest.json',JSON.stringify(trace));
  }
  race.riders.slice(0,race.count).forEach((a,i)=>{bestProgress[i]=Math.max(bestProgress[i],a.progress);});
  const lead=bestProgress.reduce((a,b)=>a+b,0);
  if(lead>lastProgress+10){lastProgress=lead;stalledAt=frames;}
  if(frames-stalledAt>12000)break;
 }
 const report={at:new Date().toISOString(),choice:process.env.SPAGHETTI_CHOICE??'default',solo,seed,frames,length:race.course.length,seconds:race.elapsed,fault,wrap:r.p.verticalLoopOffset-(fault?.offset??r.p.verticalLoopOffset),tuningUnchanged:tuning===JSON.stringify(r.TUNING),riders:race.riders.slice(0,race.count).map((a,i)=>({id:a.id,finish:a.finish,falls:a.falls,deaths:a.player.totalDeaths,progress:a.progress,...stats[i],rails:[...stats[i].rails],itemHeights:[...stats[i].itemHeights]})),records};
 await writeFile(`${output}/${solo?'solo':'race'}-${seed}${miss?'-miss':''}.json`,JSON.stringify(report,null,2));
 await writeFile(`${output}/${solo?'solo':'race'}-${seed}-trace.json`,JSON.stringify(trace));
 console.log(JSON.stringify({...report,records:undefined}));
 if(miss)assert.ok(fault,'The requested miss fixture was applied');
 assertSpaghettiRaceTraversal(report,{club:source.skateRace.rivalSkill==='club',loopHeight:source.verticalLoop.height});
},{modulePath:process.env.SPAGHETTI_MODULE??'/src/levels/spaghetti-rails.ts',source:m=>m.SPAGHETTI_RAILS_LEVEL,levelId:'spaghetti-rails'});
