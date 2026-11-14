import {puzzleControls} from './puzzle-controls.mjs';

/** Ordinary player input from spawn to return. The ferry and phase clock are
 * never advanced or reset, and all authored reward boxes must be collected. */
export function* runCalderaBonusJourney(r){
  const c=puzzleControls(r),{p,l}=r,deaths=p.totalDeaths;
  yield* c.stepFor(20);c.check(p.grounded,'caldera arrival is supported');
  const hit=function*(name){const box=c.crateNamed(name);if(box.alive)yield* c.hit(box,name);};
  const harvest=function*(prefix){
    const boxes=l.crates.filter(b=>r.source.components[b.mesh.userData.editorIdx]?.nm?.startsWith(prefix));
    while(boxes.some(b=>b.alive))yield* c.hit(boxes.filter(b=>b.alive).sort((a,b)=>a.box.min.y-b.box.min.y)[0],prefix);
  };
  yield* harvest('Arrival ');
  yield* c.walk([2.6,0,0],'approach the rising shelf');
  yield* c.hop([7.5,2,0],'first lifted basalt landing');
  yield* harvest('Low shelf ');
  yield* c.walk([12.6,2,0],'second shelf takeoff');yield* c.hop([17.5,4,0],'second lifted basalt landing');
  yield* harvest('Middle shelf ');
  yield* c.walk([23.7,4,0],'upper crucible takeoff');yield* c.hop([28.5,6,0],'upper crucible landing');
  yield* c.highArrowBox(c.crateNamed('Crucible arrow'),c.crateNamed('Crucible high life'),'crucible high cache before arrow');
  yield* hit('Crucible dispatch crate');
  yield* c.walk([37.5,6,0],'read counterweight ferry');
  const ferry=l.movers[0];
  yield* c.until(()=>ferry.mesh.position.x<43.4,{}, {label:'wait for returning ferry',limit:800});
  yield* c.hop(()=>[ferry.mesh.position.x,6,0],'board actual moving basalt ferry',{tolerance:1.4});
  c.check(p.grounded,'ferry landing required');
  yield* c.until(()=>ferry.mesh.position.x>49.4,()=>c.steer([ferry.mesh.position.x,6,0]),{label:'ride the counterweight across the lava',limit:900});
  yield* c.hop([55.5,6,0],'leave the moving ferry');
  yield* harvest('Receiver ');
  yield* c.walk([63.4,6,0],'last ember reading ledge');
  const pad=l.phasePads[0];
  yield* c.until(()=>!pad.on,{}, {label:'read cooling ember',limit:800});
  yield* c.until(()=>pad.on,{}, {label:'read renewed ember glow',limit:800});
  yield* c.hop([69,6,0],'land on the live breathing rock');
  yield* c.walk([73,6,0],'cross the live breathing rock');
  yield* c.hop([78,6,0],'last vault landing');
  yield* harvest('Vault ');yield* hit('Last dispatch');
  yield* c.clearAll('all caldera supply crates');
  const result=yield* c.finish('return through the real caldera gate');
  c.check(p.totalDeaths===deaths,'caldera journey must not hide a reset');
  return {id:r.id,state:p.state,gemEarned:p.gemEarned,totalCrates:l.totalCrates,cratesBroken:p.cratesBroken,deaths:p.totalDeaths-deaths,...result};
}
