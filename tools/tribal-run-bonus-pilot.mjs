import {puzzleControls} from './puzzle-controls.mjs';

/** Ordinary controller samples only. The drum, reveal group and crumble
 * slabs retain their real runtime behavior throughout the whole journey. */
export function* runTribalBonus(r){
 const c=puzzleControls(r),{p,l}=r,deaths=p.totalDeaths;
 const hit=function*(name){for(const spec of r.source.components.filter(v=>v.t==='crate'&&(v.nm===name||v.nm?.startsWith(name+' ·')))){const b=c.crateNamed(spec.nm);if(b?.alive)yield* c.hit(b,spec.nm);}};
 yield* c.stepFor(24);c.check(p.grounded,'supported vault spawn');
 for(const name of ['First offering','Second offering','Call'])yield* hit(name);
 yield* c.walk([7.1,0,0],'first listening takeoff');yield* c.hop([11.9,1.2,0],'first listening step');yield* hit('First response');
 yield* c.walk([18.2,1.2,0],'second listening takeoff');yield* c.hop([23,2.4,0],'second listening step');
 for(const name of ['Second response','Drum approach'])yield* hit(name);
 yield* c.walk([30,2.4,0],'resonance drum approach');
 const before=p.pos.y;
 yield* c.charge();yield* c.tick({jumpReleased:true});
 yield* c.until(()=>p.vVel>20,()=>c.steer([35.8,2.4,0]),{label:'land on the resonance drum and let it lift the player',limit:240});
 const bounce={position:p.pos.toArray(),verticalSpeed:p.vVel};
 yield* c.until(()=>p.grounded&&p.pos.y>6.5,()=>c.steer([42.8,6.8,0]),{label:'steer the drum bounce onto the echo gallery',limit:240});
 r.report.evidence.push({action:'resonance drum bounce',before,bounce,landing:p.pos.toArray()});
 for(const name of ['High echo','Vault cache','Gallery gift'])yield* hit(name);
 yield* hit('Reveal the three echoes');
 c.check(l.crates.find(b=>b.bang)?.bangUsed,'echo reveal switch activated');
 yield* c.hop([59.2,6.8,0],'pass the spent reveal switch');
 yield* c.walk([60.3,6.8,0],'cross the breakaway gallery lip');
 for(const [x,name,next]of [[64, 'Stone one',66.2],[70.4,'Stone two',72.6],[76.8,'Stone three',79]]){
  yield* c.hop([x,6.8,0],'reveal bridge '+name);yield* hit(name);yield* c.walk([next,6.8,0],'echo stepping-stone takeoff');
 }
 yield* c.hop([83.8,3.4,0],'lower answering drum');yield* hit('Lower answer');
 yield* c.walk([89.2,3.4,0],'last drop takeoff');yield* c.hop([94,0,0],'vault return court',{airButtons:{spinHeld:true}});
 c.check(!c.crateNamed('Vault life').alive,'claim the visible life during the last drop');
 for(const name of ['Return offering','Last call','Final answer'])yield* hit(name);
 yield* c.clearAll('all fifty-two Tribal Run bonus offerings');
 const result=yield* c.finish('Resonance Vault return');
 c.check(p.totalDeaths===deaths,'vault clear cannot conceal a reset');
 return{...result,state:p.state,cratesBroken:p.cratesBroken,totalCrates:l.totalCrates,deaths:p.totalDeaths-deaths};
}
