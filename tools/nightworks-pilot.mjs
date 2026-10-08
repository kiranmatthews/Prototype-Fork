import {createAfterHoursFreightPilot,createAfterHoursCutbackPilot,createAfterHoursWorkbayPilot,createAfterHoursCrownPilot} from './nightworks-ground-pilot.mjs';
import {createNightworksFerryPilot} from './nightworks-ferry-pilot.mjs';
import {createAfterHoursPhasePilot} from './nightworks-phase-pilot.mjs';
import {createCounterweightPilot,createFinaleRailPilot} from './nightworks-rail-pilot.mjs';

// Full-course input composition: no warped positions, fake velocity, restored
// lives, advanced phase clocks or direct checkpoint activations. Every chapter
// inherits the production rider and clock left by the preceding challenge.
export function createAfterHoursPilot(source,options={}) {
 const factories=[()=>createAfterHoursFreightPilot(),()=>createNightworksFerryPilot(source,{tuning:options.tuning,fixedStep:options.fixedStep}),
  ()=>createAfterHoursCutbackPilot(source),()=>createAfterHoursPhasePilot(source,{tuning:options.tuning,fixedStep:options.fixedStep}),()=>createCounterweightPilot(source,options),
  ()=>createAfterHoursWorkbayPilot(),()=>createAfterHoursCrownPilot(),()=>createFinaleRailPilot(source)];
 let stage=0,helper=factories[0](),frame=0,mounted=false;
 const evidence={chapters:[{id:source.AFTER_HOURS_STAGES[0].id,firstFrame:1,lastFrame:null}],checkpoints:[],footFrames:0,mountedFrames:0,finished:false,chapterEvidence:{}};
 const result={evidence,get stage(){return stage;},get helper(){return helper;},
  sample(p,l){
   const sample=helper.sample(p,l);
   // The checkpoint crate uses the game's actual spin/break rules; a slow
   // reading approach must bank it rather than trip over an inactive crate.
   if(p.grounded&&l.checkpoints.some(cp=>!cp.active&&Math.hypot(p.pos.x-cp.spawnPos.x,p.pos.z-cp.spawnPos.z)<2.5))sample.spinHeld=true;
   return sample;
  },observe(p,l){
   frame++;helper.observe(p,l);mounted||=p.boardRolling;
   if(mounted){if(p.boardRolling)evidence.mountedFrames++;else if(p.state!=='finished')evidence.footFrames++;}
   for(const [i,cp]of l.checkpoints.entries())if(cp.active&&!evidence.checkpoints.includes(i))evidence.checkpoints.push(i);
   evidence.finished=p.state==='finished';
   if((helper.evidence.complete||helper.evidence.done||helper.done)&&stage<factories.length-1){
    evidence.chapters.at(-1).lastFrame=frame;evidence.chapterEvidence[source.AFTER_HOURS_STAGES[stage].id]=helper.evidence;
    stage++;helper=factories[stage]();evidence.chapters.push({id:source.AFTER_HOURS_STAGES[stage].id,firstFrame:frame+1,lastFrame:null});
   }
   if(evidence.finished){evidence.chapters.at(-1).lastFrame=frame;evidence.chapterEvidence[source.AFTER_HOURS_STAGES[stage].id]=helper.evidence;}
  }};
 return result;
}
