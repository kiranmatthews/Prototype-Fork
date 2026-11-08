import {puzzleControls} from './puzzle-controls.mjs';
// Authored positions from src/levels/ember-reliquary-bonus.ts (the pilot runs in plain Node).
const EMBER_RELIQUARY_BRIDGE=[62,74],EMBER_RELIQUARY_NITRO_X=[120,127,134];

/** Ordinary device input from the reliquary arrival to its return gate. The
 * sentinel's clock, the TNT fuse and the nitro blasts are never advanced or
 * reset; every authored reward box must be collected before the gate. */
export function* runEmberReliquaryJourney(r){
  const c=puzzleControls(r),{p,l}=r,deaths=p.totalDeaths;
  const hit=function*(name){const box=c.crateNamed(name);c.check(box,`missing crate ${name}`);if(box.alive)yield* c.hit(box,name);};
  yield* c.stepFor(20);c.check(p.grounded,'supported reliquary arrival');
  // Room 1 · vestibule: the count, the spin and the mask.
  for(const name of ['Vestibule offering','Vestibule offering pair','Ember mask: protection before the first flame','Vestibule mystery'])yield* hit(name);
  c.check(p.masks>=1,'the vestibule mask must protect the rider before the first flame');
  // Room 2 · ember gate: read a complete flame from the safe lamp, then take
  // both offerings and leave the sweep while the sentinel is still cooling.
  const tiki=l.fireTikis[0];c.check(tiki,'the ember gate needs its sentinel');
  yield* c.walk([23.5,0,0],'read the ember gate from the safe lamp');
  yield* c.until(()=>tiki.state.phase==='fire',{}, {label:'watch one complete flame cross the lane',limit:1200});
  yield* c.until(()=>tiki.state.phase==='cool',{}, {label:'wait for the sentinel to cool',limit:600});
  const masksBefore=p.masks;
  yield* hit('Ember gate offering');yield* hit('Ember gate offering pair');
  yield* c.walk([39,0,0],'leave the sweep before the next windup');
  c.check(p.masks===masksBefore,'a well-timed crossing spends no mask');
  // Room 3 · jade bridge chain: arrow → shelf → high switch → bridge → arrow last → cross.
  const arrow=c.crateNamed('Reliquary arrow: preserve it until the high switch is struck');
  const bridge=l.outlinedSurfaces.find(s=>s.component.nm.startsWith('Visible jade bridge'));
  c.check(bridge&&!l.groundMeshes.includes(bridge.mesh),'the jade bridge must begin as a ghost outline');
  yield* c.bounce(arrow,[49.3,7.8,0],'conserved-arrow ascent to the switch shelf',{double:true});
  yield* hit('High jade switch: strike it from the shelf');
  c.check(l.groundMeshes.includes(bridge.mesh),'the high switch must create the real jade bridge');
  yield* c.hop([53.4,7.8,0],'hop over the spent switch along the shelf',{tolerance:.8});
  yield* hit('Shelf mystery');
  yield* c.walk([56,7.8,0],'shelf edge above the switch court');
  yield* c.hop([58.5,0,0],'descend to the court before the chasm',{heightTolerance:.2});
  c.check(arrow.alive,'the arrow must survive until the shelf work is done');
  yield* hit('Reliquary arrow: preserve it until the high switch is struck');
  yield* c.walk([EMBER_RELIQUARY_BRIDGE[1]+1.5,0,0],'cross the created jade bridge');
  yield* hit('Receiver offering');yield* hit('Receiver mystery');
  // Room 4 · fuse vault: cap and life first, then prime the TNT and retreat.
  const x=96,wood=c.crateNamed('Vault wooden takeoff cap'),cap=c.crateNamed('Vault life before the fuse'),tnt=c.crateNamed('Vault timed support');
  yield* c.walk([x-2.1,0,0],'upper-first staging');
  yield* c.charge();yield* c.tick({jumpReleased:true});
  yield* c.until(()=>!wood.alive,()=>c.steer([x,wood.box.max.y,0]),{label:'takeoff cap rebound',limit:140});
  yield* c.until(()=>p.vVel<.65,()=>c.steer([x,cap.box.min.y,0]),{label:'upper-first rebound apex',limit:90});
  yield* c.tick({jumpHeld:true});yield* c.tick({jumpReleased:true});
  yield* c.until(()=>!cap.alive,()=>c.steer([x,cap.box.min.y,0]),{label:'collect the life before the timed support',limit:160});
  c.check(tnt.alive,'the fuse support disappeared before the life was collected');
  yield* c.until(()=>p.grounded,()=>c.steer([91.5,0,0]),{label:'settle in the visible refuge',limit:240});yield* c.stepFor(20);
  yield* c.walk([x-1.7,0,0],'deliberate fuse approach');
  yield* c.charge();yield* c.tick({jumpReleased:true});
  yield* c.until(()=>tnt.fuse!==undefined,()=>c.steer([x,tnt.box.max.y,0]),{label:'prime the fuse by contact',limit:160});
  yield* c.until(()=>p.grounded,()=>c.steer([91.5,0,0]),{label:'leave the blast radius',limit:240});yield* c.stepFor(20);
  yield* c.until(()=>!tnt.alive&&l.explosions.length===0,{}, {label:'supported post-blast recovery',limit:240});
  yield* hit('Vault refuge mystery');
  // Room 5 · nitro corridor: jump each volatile offering, then count them all.
  for(const nx of EMBER_RELIQUARY_NITRO_X){
    yield* c.walk([nx-2.6,0,0],`approach volatile offering ${nx}`);
    yield* c.hop([nx+2.6,0,0],`jump the volatile offering ${nx}`,{tolerance:.9});
  }
  const nitros=l.crates.filter(c=>c.nitro);c.check(nitros.length===3&&nitros.every(c=>c.alive),'all three nitros must survive the corridor');
  yield* hit('Green switch: detonate every volatile offering for the complete count');
  yield* c.until(()=>nitros.every(c=>!c.alive)&&l.explosions.length===0,{}, {label:'the green switch counts every nitro',limit:240});
  // A struck switch stays as a solid block in the lane, as everywhere else.
  yield* c.hop([143.6,0,0],'pass the spent green switch',{tolerance:.9});
  yield* c.clearAll('all seventeen reliquary offerings');
  const result=yield* c.finish('return through the reliquary gate');
  c.check(p.totalDeaths===deaths,'the reliquary journey must not hide a reset');
  return {id:r.id,state:p.state,gemEarned:p.gemEarned,totalCrates:l.totalCrates,cratesBroken:p.cratesBroken,deaths:p.totalDeaths-deaths,masks:p.masks,...result};
}
