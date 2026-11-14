import {puzzleControls} from './puzzle-controls.mjs';

/** The normal jump passes below this optional reward. Pause horizontally
 * over the gap, double-jump, then keep moving onto the generous far bank. */
export function* collectCumulusFlightLife(r){
  const c=puzzleControls(r),{p}=r,reward=c.crateNamed('Cumulus final-flight life'),launch=p.pos.toArray();
  yield* c.charge();yield* c.tick({jumpReleased:true});
  yield* c.until(()=>p.vVel<.65,()=>c.steer([58.7,180.7,0]),{label:'hold the final flight below its life',limit:100});
  yield* c.tick({jumpHeld:true});yield* c.tick({jumpReleased:true});
  c.check(p.doubleJumpAir&&p.airJumpUsed,'the life flight uses a real double jump');
  yield* c.until(()=>!reward.alive,()=>({...c.steer([58.7,187,0]),spinHeld:true}),{label:'double-jump and spin for the cloud life',limit:100});
  yield* c.until(()=>p.grounded,()=>c.steer([61.2,180,0]),{label:'land after the cloud life',limit:180});
  c.check(Math.abs(p.pos.x-61.2)<.7&&Math.abs(p.pos.y-180)<.14,'life flight lands on the final cloud');
  r.report.evidence.push({action:'Cloud gap 5 reward flight',launch,landing:p.pos.toArray(),ground:p.groundHit?.name});
}

/** Controller samples only, shared by the native and browser journeys. */
export function* runSkystreamBonus(r){
  const c=puzzleControls(r),{p,l}=r,deaths=p.totalDeaths;
  yield* c.stepFor(24);c.check(p.grounded,'supported cloud bonus spawn');
  for(const [i,island] of r.islands.entries()){
    const boxes=l.crates.filter(b=>r.source.components[b.mesh.userData.editorIdx]?.nm?.startsWith(`Cumulus delivery / island ${i+1} /`));
    while(boxes.some(b=>b.alive)){
      const box=boxes.filter(b=>b.alive).sort((a,b)=>a.box.min.y-b.box.min.y||Math.abs(a.mesh.position.x-p.pos.x)-Math.abs(b.mesh.position.x-p.pos.x))[0];
      yield* c.hit(box,`Cloud delivery ${i+1}`);
    }
    if(i+1<r.islands.length){
      const next=r.islands[i+1];
      yield* c.walk([island.right-.75,island.top,0],`Cloud ${i+1} takeoff`);
      if(i===4)yield* collectCumulusFlightLife(r);
      else yield* c.hop([next.left+1.2,next.top,0],`Cloud gap ${i+1}`);
    }
  }
  yield* c.clearAll('All cloud bonus rewards');
  const result=yield* c.finish('Cloud return gate');
  c.check(p.totalDeaths===deaths,'Cloud route must not hide a restart');
  return {...result,cratesBroken:p.cratesBroken,totalCrates:l.totalCrates,deaths:p.totalDeaths-deaths};
}
