import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const output=process.env.SPAGHETTI_OUTPUT??'/private/tmp/spaghetti-rails-evidence';
await mkdir(output,{recursive:true});
const solo=!process.argv.includes('--race'),seed=Number(process.env.SPAGHETTI_SEED??270327);
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
 const stats=Array.from({length:race.count},()=>({grindFrames:0,airFrames:0,groundFrames:0,jumps:0,rails:new Set(),lastState:null,maxBalance:0,edgeFrames:0}));
 const maxFrames=Number(process.env.SPAGHETTI_FRAMES??54000);
 let frames=0,lastProgress=0,stalledAt=0;
 for(;frames<maxFrames&&race.riders.slice(0,race.count).some(a=>a.finish===null);frames++){
  r.scene.updateMatrixWorld(true);
  const input=race.phase==='running'?race.drive(0,false,process.env.SPAGHETTI_CHOICE===undefined?undefined:Number(process.env.SPAGHETTI_CHOICE)):{moveX:0,moveY:0};
  race.step(r.dt,input);r.l.update(r.dt);r.p.commitRenderStep(r.l);race.commitRenderStep();
  for(const a of race.riders.slice(0,race.count)){
   const s=stats[a.id],p=a.player;
   if(p.state==='grind'){s.grindFrames++;s.maxBalance=Math.max(s.maxBalance,Math.abs(p.balance));if(Math.abs(p.balance)>.65)s.edgeFrames++;s.rails.add(r.l.rails.indexOf(p.grindRail));}
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
  const lead=Math.max(...race.riders.slice(0,race.count).map(a=>a.progress));
  if(lead>lastProgress+10){lastProgress=lead;stalledAt=frames;}
  if(frames-stalledAt>12000)break;
 }
 const report={at:new Date().toISOString(),choice:process.env.SPAGHETTI_CHOICE??'default',solo,seed,frames,length:race.course.length,seconds:race.elapsed,tuningUnchanged:tuning===JSON.stringify(r.TUNING),riders:race.riders.slice(0,race.count).map((a,i)=>({id:a.id,finish:a.finish,falls:a.falls,deaths:a.player.totalDeaths,progress:a.progress,...stats[i],rails:[...stats[i].rails]})),records};
 await writeFile(`${output}/${solo?'solo':'race'}-${seed}.json`,JSON.stringify(report,null,2));
 await writeFile(`${output}/${solo?'solo':'race'}-${seed}-trace.json`,JSON.stringify(trace));
 console.log(JSON.stringify({...report,records:undefined}));
 assert.equal(report.tuningUnchanged,true);
 assert.ok(report.riders.every(a=>a.finish!==null),'Every active racer must finish using production controls');
 assert.ok(report.riders.every(a=>a.rails.length>=source.skateRace.railChoices.length),'The race must actually use the authored rails');
 if(solo)assert.equal(report.riders[0].falls,0,'The reference line must complete without a fall');
},{modulePath:process.env.SPAGHETTI_MODULE??'/src/levels/spaghetti-rails.ts',source:m=>m.SPAGHETTI_RAILS_LEVEL,levelId:'spaghetti-rails'});
