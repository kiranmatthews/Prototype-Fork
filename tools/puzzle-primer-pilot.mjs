import { puzzleControls } from './puzzle-controls.mjs';

/** Continuous source-spawn main route with every local box; linked bonus is separate. */
export function* runPrimer(r) {
  const {p,l}=r,c=puzzleControls(r),at=c.crateSpecAt;
  const beginDeaths=p.totalDeaths;
  function* harvest(a,b,label){
    const boxes=l.crates.filter(box=>box.alive&&!box.pending&&!box.bang&&!box.nitroBang&&!box.nitro&&!box.tnt&&!box.bouncy&&!box.metalBounce&&box.mesh.position.x>=a&&box.mesh.position.x<=b)
      .sort((a,b)=>a.box.min.y-b.box.min.y||a.mesh.position.x-b.mesh.position.x);
    for(const box of boxes)if(box.alive)yield* c.hit(box,label);
  }
  yield* c.stepFor(20);c.check(p.grounded,'Primer source spawn unsupported');
  yield* harvest(-3.8,7,'opening harvest groups');
  yield* c.enemy(l.enemies[0],'grunt spin lesson');
  yield* c.walk([15.4,0,0],'first gap takeoff');
  yield* c.hop([20.8,.6,0],'first ordinary gap');
  yield* c.enemy(l.enemies[1],'turtle stomp lesson');
  const highLife=r.source.components.find(component=>component.t==='crate'&&component.p[0]===35&&component.kind==='life');
  yield* c.highArrowBox(at(35,.6),at(35,highLife.p[1]),'first upper-before-lower room');
  yield* c.walk([41,.6,0],'first timber hinge approach');
  for(const [index,landing,rewards] of [[0,49,[43.8,47]],[1,56.8,[51.2,54.4]]]) {
    const bridge=l.spinBridges[index];
    yield* c.tick({spinHeld:true});
    yield* c.until(()=>bridge.deployed,{}, {label:'spin and wait for permanent timber footing',limit:90});
    for(const x of rewards)if(at(x,.6).alive)yield* c.hit(at(x,.6),'timber-route reward');
    yield* c.walk([landing,.6,0],'cross the deployed timber');
    c.check(bridge.activated&&bridge.deployed,'timber did not retain its deployed state');
    if(index===0)yield* c.walk([49, .6, 0],'second timber hinge approach');
  }
  yield* c.checkpoint(59,'bank before the preserve-and-return key room');
  const highY=r.source.components.find(c=>c.nm==='High key gallery').p[1]+.3;
  const arrow=at(63,.6),key=at(72,highY);
  yield* c.bounce(arrow,[68,highY,0],'preserve launch and reach high key gallery',{double:true,airSpinAbove:highY-1.2});
  yield* harvest(66,71,'upper key-gallery harvest');
  yield* c.hit(key,'upper materialisation switch');
  c.check(key.bangUsed,'upper key never fired');
  yield* c.walk([66.4,highY,0],'return left through the cleared gallery');
  yield* c.hop([60.6,.6,0],'descend to clear the preserved launcher',{heightTolerance:.2});
  yield* c.hit(arrow,'key-room launcher last');
  yield* c.walk([101.8,.6,0],'cross the materialized twenty-metre bridge');
  yield* c.checkpoint(104,'bank the completed key circuit');
  for(const x of [107,111.8]) {
    const tnt=at(x,.6);if(!tnt.alive)continue;const cx=tnt.mesh.position.x;
    yield* c.walk([cx-1.95,.6,0],`TNT ${x} takeoff`);
    r.report.evidence.push({action:'fuse approach',sourceX:x,x:cx,alive:tnt.alive,fuse:tnt.fuse??null});
    if(!tnt.alive)continue;
    yield* c.charge();yield* c.tick({jumpReleased:true});
    yield* c.until(()=>tnt.fuse!==undefined||!tnt.alive,()=>c.steer([cx,.6,0]),{label:`prime TNT ${x} by a real stomp`,limit:160});
    yield* c.until(()=>p.grounded,()=>c.steer([cx-4,.6,0]),{label:`retreat left outside TNT ${x} radius`,limit:180});
    yield* c.until(()=>!tnt.alive,{}, {label:`wait for TNT ${x} and its neighbor rewards`,limit:200});
    yield* c.stepFor(50);
  }
  c.check(l.crates.filter(box=>box.mesh.position.x>=106&&box.mesh.position.x<=113.5).every(box=>!box.alive),'explosive cluster stock remains');
  if(at(114,.6).alive)yield* c.hit(at(114,.6),'takeoff reward beyond the chain');
  yield* harvest(113,115,'takeoff stock beyond the chain');
  yield* c.walk([117.3,.6,0],'permanent-arrow gap takeoff');
  const gapArrow=at(121,.6);
  yield* c.charge();yield* c.tick({jumpReleased:true});
  yield* c.until(()=>p.vVel>15&&p.pos.y<gapArrow.box.max.y+.2,
    ()=>({...c.steer([121,1.58,0]),jumpHeld:true}),{label:'land on the permanent arrow in the gap',limit:140});
  yield* c.until(()=>p.grounded,()=>c.steer([125.5,1.2,0]),{label:'rebound to the synthesis terrace',limit:180});
  c.check(Math.abs(p.pos.y-1.2)<.14&&gapArrow.alive,'permanent arrow gap failed');
  yield* c.enemy(l.enemies[2],'spiker spin reprise');
  yield* c.hit(at(138,1.2),'green Nitro-clearing switch');
  yield* c.stepFor(45);
  for(const x of [144,145,146])c.check(!at(x,1.2).alive,`Nitro ${x} remains`);
  yield* c.hop([140.2,1.2,0],'hop over the spent solid green switch');
  if(at(149,1.2).alive)yield* c.hit(at(149,1.2),'final mystery reward');
  yield* harvest(148,152,'final sanctuary harvest');
  yield* c.clearAll('Primer active-stage crate route');
  const completion=yield* c.finish('cross the real Primer finish gate',{limit:200});
  c.check(p.totalDeaths===beginDeaths,'Primer positive route hid a death/reset');
  return {...completion,id:r.id,cratesBroken:p.cratesBroken,totalCrates:l.totalCrates,deaths:p.totalDeaths-beginDeaths,state:p.state,gemEarned:p.gemEarned};
}
