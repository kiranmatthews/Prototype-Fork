import {puzzleControls} from './puzzle-controls.mjs';

/** Device input only: the lift and collapsing bones keep their real clocks. */
export function* runRollingBonesBonus(r) {
  const c=puzzleControls(r),{p,l}=r,deaths=p.totalDeaths;
  const hit=function*(name){const box=c.crateNamed(name);if(box.alive)yield* c.hit(box,name);};
  yield* c.stepFor(20);c.check(p.grounded,'supported Moonbone arrival');
  for(const name of ['Crypt offering','Crypt offering cap','Sarcophagus waiting cache'])yield* hit(name);
  yield* c.walk([6.7,0,0],'read the sarcophagus lift');
  const lift=l.movers[0],liftTop=()=>lift.mesh.position.y+.7;
  yield* c.until(()=>liftTop()<.45,{}, {label:'wait for the descending sarcophagus',limit:900});
  yield* c.hop(()=>[12,liftTop(),0],'board the rising sarcophagus');
  const boarded=p.pos.y;
  yield* c.until(()=>liftTop()>5.8,()=>c.steer([12,liftTop(),0]),{label:'ride the sarcophagus into the upper crypt',limit:900});
  c.check(p.grounded&&p.pos.y>boarded+2,'lift must carry the player upward');
  r.report.evidence.push({action:'real vertical lift ride',boarded,exit:p.pos.y});
  yield* c.hop([17.5,6,0],'leave the lift for the moon gallery');
  for(const name of ['Upper gallery cache','Upper gallery cap','Ivory arch cache','Last cache before the bones'])yield* hit(name);
  yield* c.walk([30.5,6,0],'breakaway spine takeoff');
  for(const x of [34.8,40.4,45.7,49.3])yield* c.hop([x,6,0],'cross the breakaway spine '+x);
  for(const name of ['Far crypt cache','Far crypt cap','Moon-eye offering'])yield* hit(name);
  yield* c.highArrowBox(c.crateNamed('Moon-eye arrow'),c.crateNamed('Moon-eye high life'),'moon-eye high cache before its arrow');
  yield* c.walk([62,6,0],'read the descending jawbones');
  yield* c.hop([66.5,4.2,0],'first jawbone landing');
  yield* c.hop([71.7,2.1,0],'lower jawbone landing');
  yield* c.hop([75,0,0],'descend into the last vault');
  for(const name of ['Vault cache','Vault cache cap','Last moonbone mystery','Vault life'])yield* hit(name);
  yield* c.clearAll('all sixteen Moonbone offerings');
  const result=yield* c.finish('Moonbone return gate');
  c.check(p.totalDeaths===deaths,'Moonbone journey must not hide a reset');
  return {state:p.state,cratesBroken:p.cratesBroken,totalCrates:l.totalCrates,deaths:p.totalDeaths-deaths,...result};
}
