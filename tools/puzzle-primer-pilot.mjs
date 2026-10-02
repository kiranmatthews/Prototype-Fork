import { puzzleControls } from './puzzle-controls.mjs';

/** Continuous source-spawn main route with every local box; linked bonus is separate. */
export function* runPrimer(r) {
  const {p,l}=r,c=puzzleControls(r),at=c.crateSpecAt;
  const beginDeaths=p.totalDeaths;
  yield* c.stepFor(20);c.check(p.grounded,'Primer source spawn unsupported');
  for(const x of [-2,2,6])yield* c.hit(at(x,0),`opening reward ${x}`);
  yield* c.enemy(l.enemies[0],'grunt spin lesson');
  yield* c.walk([15.4,0,0],'first gap takeoff');
  yield* c.hop([20.8,.6,0],'first ordinary gap');
  yield* c.enemy(l.enemies[1],'turtle stomp lesson');
  const highLife=r.source.components.find(component=>component.t==='crate'&&component.p[0]===35&&component.kind==='life');
  yield* c.highArrowBox(at(35,.6),at(35,highLife.p[1]),'first upper-before-lower room');
  yield* c.walk([41.35,.6,0],'crate-anchor bridge takeoff');
  const anchors=[43.8,47,50.2,53.4];
  for(let i=0;i<anchors.length;i++) {
    yield* c.hop([anchors[i],1.58,0],`preserve metal and collect anchor reward ${i+1}`,
      {airButtons:{spinHeld:true},heightTolerance:.16});
    c.check(!at(anchors[i],1.56).alive,'anchor reward survived its airborne spin');
    c.check(at(anchors[i],.6).alive,'permanent anchor broke');
  }
  yield* c.hop([56.8,.6,0],'leave last crate anchor');
  yield* c.checkpoint(59,'bank before the preserve-and-return key room');
  const highY=r.source.components.find(c=>c.nm==='High key gallery').p[1]+.3;
  const arrow=at(63,.6),key=at(72,highY);
  yield* c.bounce(arrow,[68,highY,0],'preserve launch and reach high key gallery',{double:true,airSpinAbove:highY-1.2});
  for(const x of [67,69])if(at(x,highY).alive)yield* c.hit(at(x,highY),`upper key-gallery box ${x}`);
  yield* c.hit(key,'upper materialisation switch');
  c.check(key.bangUsed,'upper key never fired');
  yield* c.walk([66.4,highY,0],'return left through the cleared gallery');
  yield* c.hop([60.6,.6,0],'descend to clear the preserved launcher',{heightTolerance:.2});
  yield* c.hit(arrow,'key-room launcher last');
  yield* c.walk([101.8,.6,0],'cross the materialized twenty-metre bridge');
  yield* c.checkpoint(104,'bank the completed key circuit');
  for(const x of [107,111.8]) {
    const tnt=at(x,.6);if(!tnt.alive)continue;
    yield* c.walk([x-1.95,.6,0],`TNT ${x} takeoff`);
    yield* c.charge();yield* c.tick({jumpReleased:true});
    yield* c.until(()=>tnt.fuse!==undefined,()=>c.steer([x,.6,0]),{label:`prime TNT ${x} by a real stomp`,limit:160});
    yield* c.until(()=>p.grounded,()=>c.steer([x-4,.6,0]),{label:`retreat left outside TNT ${x} radius`,limit:180});
    yield* c.until(()=>!tnt.alive,{}, {label:`wait for TNT ${x} and its neighbor rewards`,limit:200});
    yield* c.stepFor(50);
  }
  for(const x of [107,109.4,111.8])c.check(!at(x,.6).alive,`explosive cluster box ${x} remains`);
  if(at(114,.6).alive)yield* c.hit(at(114,.6),'takeoff reward beyond the chain');
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
  yield* c.clearAll('Primer active-stage crate route');
  const completion=yield* c.finish('cross the real Primer finish gate',{limit:200});
  c.check(p.totalDeaths===beginDeaths,'Primer positive route hid a death/reset');
  return {...completion,id:r.id,cratesBroken:p.cratesBroken,totalCrates:l.totalCrates,deaths:p.totalDeaths-beginDeaths,state:p.state,gemEarned:p.gemEarned};
}
