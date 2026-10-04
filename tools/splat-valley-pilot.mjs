import { puzzleControls } from './puzzle-controls.mjs';

/** Ordinary production inputs from the source spawn through the finish. */
export function* splatValleyJourney(r) {
  const {p,l}=r,c=puzzleControls(r),deaths=p.totalDeaths;
  yield* c.stepFor(20); c.check(p.grounded,'Splat Valley spawn unsupported');
  yield* c.walk([0,0,-7],'supported bridge start');
  yield* c.walk([0,3,-26],'first lookout landing');
  const first=l.crates.find(crate=>crate.alive && Math.abs(crate.mesh.position.z+27)<.1);
  yield* c.hit(first,'lookout crate spin');
  yield* c.walk([0,3,-35.9],'first lookout climb');
  yield* c.hop([0,3,-41.1],'first river gap',{tolerance:1.1});
  yield* c.walk([0,3,-46.6],'first checkpoint approach');
  yield* c.until(()=>l.checkpoints[0].active,{moveY:.3,spinHeld:true},{label:'bank first checkpoint',limit:100});
  yield* c.walk([0,3,-50],'first checkpoint exit');
  yield* c.walk([0,6,-90.8],'upper lookout climb');
  yield* c.hop([0,6,-96.2],'second river gap',{tolerance:1});
  yield* c.walk([0,6,-103.6],'second checkpoint approach');
  yield* c.until(()=>l.checkpoints[1].active,{moveY:.3,spinHeld:true},{label:'bank second checkpoint',limit:100});
  yield* c.walk([0,6,-107],'second checkpoint exit');
  yield* c.walk([0,3,-134],'descending final bridge');
  yield* c.until(()=>p.state==='finished',{moveY:1},{label:'actual finish gate',limit:300});
  c.check(p.totalDeaths===deaths,'source-to-gate journey died');
  return {frames:r.frame,seconds:r.frame/60,deaths:p.totalDeaths-deaths,state:p.state,
    position:p.pos.toArray(),scenery:l.splatScenery?.diagnostics,evidence:r.report.evidence};
}
