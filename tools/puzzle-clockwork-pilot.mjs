import { puzzleControls } from './puzzle-controls.mjs';

/** Production-input main route from authored spawn through all local boxes to the gate.
 * The linked bonus remains a separate required detour for the course gem.
 * Reads live collision/machinery state; never edits position, crate state,
 * checkpoints, tuning or enemy state to advance the route.
 */
export function* runClockworkJourney(r) {
  const {p,l}=r,c=puzzleControls(r),at=c.crateSpecAt;
  const deaths=p.totalDeaths;
  function* evadeTo(target,label,{ready=()=>true,double=true}={}) {
    let evadeCharge=0,evading=false,secondPop=false;
    const approaching=reach=>l.projectiles.some(shot=>shot.vel.x<0&&shot.mesh.position.x>p.pos.x-.4
      &&shot.mesh.position.x<p.pos.x+reach&&shot.mesh.position.y>p.pos.y-.4);
    // Finish in a real safe opening, not on the landing tick while an orb is
    // still approaching. The next action may need a grounded jump charge.
    yield* c.until(()=>p.grounded&&c.distance(target)<.15&&!approaching(20)&&ready(),()=>{
      const sample=c.steer(target);
      // Air steering immediately adopts the commanded speed, so the last
      // grounded tick is not a reliable predictor during a turn or start.
      const velocityX=(sample.moveX??0)*r.TUNING.walkSpeed;
      const incoming=l.projectiles.some(shot=>{
        if(shot.vel.x>=0||shot.mesh.position.x<p.pos.x-.4)return false;
        const closing=velocityX-shot.vel.x;
        if(closing<=0)return false;
        const timeToContact=(shot.mesh.position.x-p.pos.x-1)/closing;
        const crossingY=shot.mesh.position.y+shot.vel.y*Math.max(0,timeToContact);
        return timeToContact<.32&&timeToContact>-.12
          &&crossingY+.35>=p.playerBox.min.y&&crossingY-.35<=p.playerBox.max.y;
      });
      if(p.grounded){evading=false;secondPop=false;}
      if(p.grounded&&incoming&&evadeCharge===0){evadeCharge=3;evading=true;}
      if(evadeCharge>1){evadeCharge--;return {...sample,jumpHeld:true};}
      if(evadeCharge===1){evadeCharge=0;return {...sample,jumpReleased:true};}
      // Keep the same defensive jump above the orb through its crossing;
      // the rendered collider can extend beyond the foot-based prediction.
      if(double&&evading&&!p.grounded&&!secondPop&&p.vVel<.65){secondPop=true;return {...sample,jumpHeld:true};}
      return sample;
    },{label,limit:700});
  }
  yield* c.stepFor(20);c.check(p.grounded,'Clockwork source spawn unsupported');
  yield* c.hit(at(-2,0),'opening protective mask');
  yield* c.enemy(l.enemies[0],'opening spiker action choice');
  const intakeArrow=c.crateNamed('Preserve the intake launch until the upper box is gone');
  const intakeCap=c.crateNamed('High reward needs the intact wooden arrow');
  yield* c.highArrowBox(intakeArrow,intakeCap,'intake upper-before-arrow reward');

  function* relayArrow(x,base,target,label) {
    const arrow=at(x,base);
    yield* c.charge();yield* c.tick({jumpReleased:true});
    yield* c.until(()=>p.vVel>15&&p.pos.y<arrow.box.max.y+.2,
      ()=>({...c.steer([x,arrow.box.max.y,0]),jumpHeld:true}),{label:`${label} arrow contact`,limit:140});
    yield* c.until(()=>p.grounded,()=>({...c.steer(target),spinHeld:p.pos.y>target[1]+.4}),{label,limit:180});
    c.check(Math.abs(p.pos.y-target[1])<.16,`${label} wrong receiving height`);
  }
  const firstRelay=c.crateNamed('First relay arrow');
  yield* c.walk([21.65,0,0],'first relay takeoff');
  yield* relayArrow(firstRelay.mesh.position.x,0,[29,2.18,0],'first arrow to metal relay');
  c.check(!at(29,2.16).alive,'relay airborne reward was not collected');
  yield* relayArrow(33,0,[40,1.6,0],'second arrow to fuse-room terrace');
  yield* c.checkpoint(41,'bank before the irreversible fuse stack');

  // Use the highest intact TNT as a height tool before its timed destruction.
  const bottom=at(47,1.6),middle=at(47,2.56),top=at(47,3.52),cap=at(47,9.8);
  yield* c.walk([44.8,1.6,0],'fuse stack high approach');
  yield* c.charge();yield* c.tick({jumpReleased:true});
  yield* c.until(()=>p.pos.y>4.2,{}, {label:'rise clear of the lower fuse stack',limit:100});
  yield* c.tick({jumpHeld:true});yield* c.tick({jumpReleased:true});
  yield* c.until(()=>top.fuse!==undefined,()=>c.steer([47,4.48,0]),{label:'stomp the top TNT as an intact height tool',limit:140});
  yield* c.until(()=>p.vVel<.7,{}, {label:'top TNT rebound apex',limit:120});
  yield* c.tick({jumpHeld:true});yield* c.tick({jumpReleased:true});
  yield* c.until(()=>!cap.alive,()=>({...c.steer([47,9.8,0]),spinHeld:p.pos.y>8.5}),{label:'claim cap before TNT support disappears',limit:160});
  yield* c.until(()=>p.grounded,()=>c.steer([41.8,1.6,0]),{label:'retreat outside the TNT blast',limit:180});
  yield* c.until(()=>!top.alive,{}, {label:'wait for upper TNT geometry transformation',limit:240});
  yield* c.stepFor(50);
  c.check(!middle.alive,'TNT transformation left its middle wood');
  if(bottom.alive) {
    yield* c.walk([45.05,1.6,0],'remaining bottom fuse approach');
    yield* c.charge();yield* c.tick({jumpReleased:true});
    yield* c.until(()=>bottom.fuse!==undefined,()=>c.steer([47,1.6,0]),{label:'prime remaining bottom TNT',limit:160});
    yield* c.until(()=>p.grounded,()=>c.steer([42,1.6,0]),{label:'second safe fuse retreat',limit:180});
    yield* c.until(()=>!bottom.alive,{}, {label:'finish the TNT cluster',limit:240});
    yield* c.stepFor(50);
  }
  if(at(51,1.6).alive)yield* c.hit(at(51,1.6),'safe five-hit workshop reward');
  yield* c.hit(at(55,1.6),'first independent bridge circuit');
  yield* c.hop([57.2,1.6,0],'jump over the spent solid bridge switch');
  yield* c.walk([78,1.6,0],'cross the fuse-room materialized bridge');
  yield* c.checkpoint(80,'bank the completed fuse puzzle');
  yield* c.enemy(l.enemies[1],'turtle armor stomp');
  yield* c.enemy(l.enemies[2],'first retracted spinner opening');

  function* phaseCross(index,takeoff,padX,landing,label) {
    const pad=l.phasePads[index];
    yield* c.walk(takeoff,`${label} permanent observation position`);
    yield* c.until(()=>{
      const k=(l.time/pad.cycle+pad.phase)%1;
      return pad.on&&(pad.duty-k)*pad.cycle>2;
    },{}, {label:`${label} wait for a fresh readable solid window`,limit:900});
    yield* c.hop([padX,1.6,0],`${label} board phased footing`);
    yield* c.hop(landing,`${label} spin the far timber and leave for permanent footing`,{airButtons:{spinHeld:true}});
  }
  yield* phaseCross(0,[103.3,1.6,0],107,[112,1.6,0],'first phase relay');
  yield* phaseCross(1,[115.25,1.6,0],119,[123,2.8,0],'offset phase relay');
  yield* c.checkpoint(126,'bank both timed relays');
  yield* c.enemy(l.enemies[3],'charger bait and recovery opening');
  yield* c.walk([144.3,2.8,0],'vertical lift takeoff');
  const lift=l.movers[0];
  yield* c.until(()=>lift.mesh.position.y<3.4,{}, {label:'wait for a low lift receiver',limit:900});
  yield* c.hop(()=>[150,lift.mesh.position.y+.3,0],'board the vertical lift',{heightTolerance:.2});
  yield* c.until(()=>lift.mesh.position.y>3.8,{}, {label:'ride lift to upper deck height',limit:900});
  yield* c.hop([156,4,0],'leave lift for upper blade terrace',{heightTolerance:.2});
  yield* c.enemy(l.enemies[4],'upper blade recovery window');
  const returnArrow=at(162,4);
  const returnHigh=r.source.components.find(component=>component.nm==='Second outward-then-return high gallery').p[1]+.3;
  yield* c.walk([160.3,4,0],'approach the intact return launcher');
  yield* c.hop([165,4,0],'pass the wooden arrow without destroying it');
  yield* c.hit(at(170,4),'second outward materialization circuit');
  yield* c.bounce(returnArrow,[166,returnHigh,0],'second circuit conserved-arrow return',{double:true,airSpinAbove:returnHigh-1.2});
  for(const spec of r.source.components.filter(component=>component.nm==='Activated upper row: preserve launch and return'))
    if(at(spec.p[0],spec.p[1]).alive)yield* c.hit(at(spec.p[0],spec.p[1]),`second upper return target ${spec.p[0]}`);
  yield* c.walk([163.3,returnHigh,0],'second upper return descent takeoff');
  yield* c.hop([159.4,4,0],'descend before clearing the return arrow',{heightTolerance:.2});
  yield* c.hit(returnArrow,'second-circuit arrow after all dependents');
  yield* c.walk([168.4,4,0],'second bridge switch takeoff');
  yield* c.hop([173,4,0],'clear the second spent solid switch');
  yield* c.walk([192.5,4,0],'cross second independently wired bridge');
  yield* c.checkpoint(195,'bank before the two-destination launcher');
  const floater=l.enemies[5];
  yield* c.walk([floater.x0-2,4,0],'floater jump-spin safe approach');
  yield* c.charge();yield* c.tick({jumpReleased:true});
  yield* c.until(()=>!floater.alive,()=>({...c.steer([floater.group.position.x,4,0]),
    spinHeld:c.distance([floater.group.position.x,4,0])<2.2&&p.pos.y>floater.group.position.y-.9}),
    {label:'defeat the hovering foe with an airborne spin',limit:150});
  yield* c.until(()=>p.grounded,()=>c.steer([211,4,0]),{label:'land beyond the defeated floater',limit:180});

  const finalArrow=at(216,4);
  const clearHigh=r.source.components.find(component=>component.nm==='High Nitro clearing perch').p[1]+.3;
  const farSwitch=c.crateNamed('Final return circuit local ! switch');
  yield* c.bounce(finalArrow,[219.65,clearHigh,0],'preserve arrow for high Nitro clear and return',{double:true});
  yield* c.hit(at(221,clearHigh),'high green Nitro clearance');
  yield* c.stepFor(45);
  c.check(l.crates.filter(cr=>cr.nitro).every(cr=>!cr.alive),'high switch failed to clear the three-high Nitro field');
  c.check(!farSwitch.bangUsed,'green Nitro clearance automatically activated the far return switch');
  r.report.evidence.push({action:'green clearance preserves the separate far-switch dependency',
    greenUsed:at(221,clearHigh).bangUsed,farSwitchUsed:farSwitch.bangUsed,
    nitroRemaining:l.crates.filter(cr=>cr.nitro&&cr.alive).length});
  yield* c.hop([223.8,4,0],'descend beyond the cleared wall',{heightTolerance:.2});
  // The real enemy asset can miss this reward with its fling, so it remains
  // an authored obstacle until the player clears it. It precedes the switch.
  if(at(232,4).alive) {
    yield* evadeTo([230.85,4,0],'approach the intact outward reward while evading visible orbs');
    yield* c.hit(at(232,4),'clear the outward reward before approaching the far switch');
  }
  yield* evadeTo([farSwitch.mesh.position.x-1.1,4,0],'approach the far return switch under sentry pressure');
  yield* c.hit(farSwitch,'far switch materializes the backward upper sweep');
  // Resolve the ranged enemy before the long return. This keeps the far
  // circuit active and the shared arrow alive while removing its pressure.
  const fuse=at(237,4),secondFuse=at(241.8,4),sentry=l.enemies[6];
  yield* c.hop([farSwitch.mesh.position.x+1.7,4,0],'jump over the spent far return switch');
  if(fuse.alive||secondFuse.alive) {
    const first=fuse.alive?fuse:secondFuse;
    if(first===secondFuse)yield* evadeTo([239.9,4,0],'approach the surviving second fuse');
    yield* c.charge();yield* c.tick({jumpReleased:true});
    yield* c.until(()=>first.fuse!==undefined,()=>c.steer([first.mesh.position.x,4,0]),{label:'prime surviving final TNT with deliberate stomp',limit:160});
    if(first===fuse&&secondFuse.alive)
      yield* c.until(()=>secondFuse.fuse!==undefined,()=>c.steer([241.8,secondFuse.box.max.y,0]),
        {label:'prime the second separated TNT with the first rebound',limit:180});
    yield* c.until(()=>p.grounded,()=>({...c.steer([247.2,4,0]),
      spinHeld:sentry.alive&&c.distance([249,4,0])<2.2&&p.pos.y<6.1}),
      {label:'use the last rebound to attack and reach right-hand refuge',limit:180});
  } else {
    r.report.evidence.push({action:'earlier airborne enemy fling already cleared the final explosive cluster',
      firstTntAlive:fuse.alive,secondTntAlive:secondFuse.alive,middleAlive:at(239.4,4).alive});
    yield* evadeTo([242.8,4,0],'read the sentry shot from its safe outer approach',
      {double:false,ready:()=>sentry.state==='cooldown'});
    r.report.evidence.push({action:'commit to the sentry only after its shot and while it recovers',
      sentryState:sentry.state,position:p.pos.toArray(),approachingProjectiles:l.projectiles.filter(shot=>shot.mesh.position.x>p.pos.x).length});
  }
  if(sentry.alive)yield* c.enemy(sentry,'finish the sentry during its charge window');
  yield* c.until(()=>!fuse.alive&&!secondFuse.alive,{}, {label:'wait for both deliberately primed final TNT',limit:240});
  yield* c.stepFor(55);
  for(const x of [237,239.4,241.8])c.check(!at(x,4).alive,`final explosive cluster ${x} survived`);
  c.check(!sentry.alive&&finalArrow.alive,'priority takeout consumed the return tool or left the sentry alive');
  r.report.evidence.push({action:'defeat the ranged enemy before committing to the long upper return',
    sentryAlive:sentry.alive,returnArrowAlive:finalArrow.alive,farSwitchUsed:farSwitch.bangUsed,
    sentryProjectiles:l.projectiles.filter(shot=>shot.owner===sentry).length});
  yield* c.walk([farSwitch.mesh.position.x+1.7,4,0],'return through the cleared explosive room');
  yield* c.hop([farSwitch.mesh.position.x-1.9,4,0],'jump back over the used far switch');
  yield* c.walk([217.65,4,0],'return to the conserved arrow after removing sentry pressure');
  yield* c.bounce(finalArrow,[208,clearHigh,0],'same conserved arrow for the far-switch return',{double:true,airSpinAbove:clearHigh-1.2});
  for(const spec of r.source.components.filter(component=>component.nm==='Last return row: appears only after the far !')
    .sort((a,b)=>b.p[0]-a.p[0]))
    if(at(spec.p[0],spec.p[1]).alive)yield* c.hit(at(spec.p[0],spec.p[1]),`backward sweep target ${spec.p[0]}`);
  yield* c.walk([210.3,clearHigh,0],'backward gallery return descent');
  yield* c.hop([213.5,4,0],'return right to dismantle the exhausted launcher',{heightTolerance:.2});
  yield* c.hit(finalArrow,'two-destination wooden arrow last');
  yield* c.walk([farSwitch.mesh.position.x-1.9,4,0],'return to the cleared finish approach');
  yield* c.hop([farSwitch.mesh.position.x+1.7,4,0],'cross the far switch after the complete upper sweep');
  yield* c.walk([254.1,4,0],'final crumble observation ledge');
  yield* c.hop([259,4,0],'board the familiar crumble receiver');
  yield* c.hop([264.2,5.2,0],'leave crumble before it disappears',{heightTolerance:.2});
  for(const x of [271,275])if(at(x,5.2).alive)yield* c.hit(at(x,5.2),`final permanent-floor reward ${x}`);
  yield* c.clearAll('Clockwork active-stage crate route');
  const completion=yield* c.finish('cross the real Clockwork gate',{limit:220});
  c.check(p.totalDeaths===deaths,'Clockwork positive journey concealed a reset/death');
  return {...completion,id:r.id,cratesBroken:p.cratesBroken,totalCrates:l.totalCrates,deaths:p.totalDeaths-deaths,state:p.state,gemEarned:p.gemEarned};
}

/** Wrong-order proof from the actual source spawn: remove the intake tool,
 * then try several ordinary charged-double-jump timings at its former spot.
 * These are real input attempts, not analytic height assertions or warps.
 */
export function* runClockworkGroundDoubleNegative(r) {
  const {p,l}=r,c=puzzleControls(r),deaths=p.totalDeaths;
  yield* c.stepFor(20);c.check(p.grounded,'negative intake source spawn unsupported');
  yield* c.hit(c.crateSpecAt(-2,0),'negative run protective mask');
  yield* c.enemy(l.enemies[0],'negative run clear the approach spiker');
  const arrow=c.crateNamed('Preserve the intake launch until the upper box is gone');
  const cap=c.crateNamed('High reward needs the intact wooden arrow');
  c.check(cap.alive,'negative run cap was already removed');
  yield* c.hit(arrow,'wrong order: destroy the intake launch before its cap');
  c.check(cap.alive&&!arrow.alive,'wrong-order setup did not preserve the upper target');
  yield* c.walk([17,0,0],'stand below the now-unreachable intake cap');
  const attempts=[];
  for(const doubleAtVelocity of [7,4,1,0,-2]) {
    yield* c.charge();yield* c.tick({jumpReleased:true});
    yield* c.until(()=>p.vVel<=doubleAtVelocity,{},
      {label:`ground jump before double at ${doubleAtVelocity}`,limit:120});
    yield* c.tick({jumpHeld:true});yield* c.tick({jumpReleased:true});
    let peak=p.pos.y;
    yield* c.until(()=>p.grounded,()=>{
      peak=Math.max(peak,p.pos.y);
      return {...c.steer([17,0,0]),spinHeld:p.pos.y>3.3};
    },{label:`ground double and air-spin attempt ${doubleAtVelocity}`,limit:180});
    c.check(cap.alive,`ground-double bypass reached the raised intake cap at timing ${doubleAtVelocity}`);
    attempts.push({doubleAtVelocity,peakFeet:peak,capAlive:cap.alive});
    yield* c.stepFor(25);
  }
  c.check(p.totalDeaths===deaths&&!p.isBailing,'negative intake test concealed a death/reset');
  r.report.evidence.push({action:'early intake destruction loses the ground-double collection route',
    authoredCapBase:cap.homeY-.48,arrowAlive:arrow.alive,capAlive:cap.alive,attempts});
  return {id:r.id,test:'destroyed intake arrow blocks ordinary charged-double/air-spin harvesting',
    deaths:p.totalDeaths-deaths,attempts,capAlive:cap.alive,arrowAlive:arrow.alive};
}

/** Run the same real journey only through green clearance. The negative
 * assertion is that this successful action must not solve the later circuit.
 */
export function* runClockworkGreenIsolationNegative(r) {
  const journey=runClockworkJourney(r);
  while(true) {
    const next=journey.next();
    const evidence=r.report.evidence.find(item=>item.action==='green clearance preserves the separate far-switch dependency');
    if(evidence) {
      journey.return();
      const controls=puzzleControls(r);
      controls.check(!evidence.farSwitchUsed&&evidence.nitroRemaining===0,
        'green clearance solved the far return circuit');
      controls.check(controls.crateNamed('Conserve this launch for BOTH high galleries').alive,
        'green-prefix run consumed the needed return launcher');
      return {id:r.id,test:'successful green clearance does not activate the far return switch',
        greenUsed:evidence.greenUsed,farSwitchUsed:evidence.farSwitchUsed,
        nitroRemaining:evidence.nitroRemaining,deaths:r.p.totalDeaths};
    }
    if(next.done)throw Error('Clockwork journey ended before the green isolation evidence');
    yield next.value;
  }
}
