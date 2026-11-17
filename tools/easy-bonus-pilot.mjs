import {puzzleControls} from './puzzle-controls.mjs';

/** Eight cargo groups and two short jumps, using ordinary device samples. */
export function* runEasyBonus(r){
 const c=puzzleControls(r),{p,l}=r;
 function* harvest(x){
  const boxes=l.crates.filter(b=>Math.abs(b.mesh.position.x-x)<.01);
  c.check(boxes.length===3,'three-crate group missing');
  while(boxes.some(b=>b.alive))yield* c.hit(boxes.filter(b=>b.alive).sort((a,b)=>a.box.min.y-b.box.min.y)[0],`harvest group ${x}`);
 }
 yield* c.stepFor(20);
 yield* harvest(-9);yield* harvest(-4);
 yield* c.walk([.7,0,0],'first terrace departure');yield* c.hop([5.1,.35,0],'first short gap');
 for(const x of [7,13,18])yield* harvest(x);
 yield* c.walk([18.9,.35,0],'second terrace departure');yield* c.hop([23.1,0,0],'second short gap');
 for(const x of [25,34,45])yield* harvest(x);
 yield* c.walk([48,0,0],'last count before return');yield* c.clearAll();yield* c.finish();
 c.check(p.totalDeaths===0,'bonus hid a death');
 return {state:p.state,cratesBroken:p.cratesBroken,totalCrates:l.totalCrates,gemEarned:p.gemEarned,deaths:p.totalDeaths};
}
