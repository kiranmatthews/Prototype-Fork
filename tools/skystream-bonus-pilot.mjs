import {puzzleControls} from './puzzle-controls.mjs';

/** Controller samples only, shared by the native and browser journeys. */
export function* runSkystreamBonus(r){
  const c=puzzleControls(r),{p,l}=r,deaths=p.totalDeaths;
  yield* c.stepFor(24);c.check(p.grounded,'supported cloud bonus spawn');
  let box=0;
  for(const [i,island] of r.islands.entries()){
    for(const x of island.boxes){
      const name=`Cloud cache ${++box}`;
      yield* c.hit(c.crateNamed(name),name);
    }
    if(i+1<r.islands.length){
      const next=r.islands[i+1];
      yield* c.walk([island.right-.75,island.top,0],`Cloud ${i+1} takeoff`);
      yield* c.hop([next.left+1.2,next.top,0],`Cloud gap ${i+1}`);
    }
  }
  yield* c.clearAll('All cloud bonus rewards');
  const result=yield* c.finish('Cloud return gate');
  c.check(p.totalDeaths===deaths,'Cloud route must not hide a restart');
  return {...result,cratesBroken:p.cratesBroken,totalCrates:l.totalCrates,deaths:p.totalDeaths-deaths};
}
