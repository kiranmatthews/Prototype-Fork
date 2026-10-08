import { puzzleControls } from './puzzle-controls.mjs';

/** Each yield is an ordinary device sample. No position, physics, crate state,
 * hit counters, gem flags or finish state are changed by these pilots. */
export function* runThemedBonusJourney(r) {
  const c=puzzleControls(r), {p,l}=r, course=r.course;
  const deaths=p.totalDeaths;
  yield* c.stepFor(20);c.check(p.grounded,'bonus source spawn unsupported');
  const box=(room,role)=>c.crateNamed(room.crates.find(crate=>crate.role===role)?.name);
  const settle=function*(target,label){yield* c.until(()=>p.grounded,()=>c.steer(target),{label,limit:240});yield* c.stepFor(20);};
  for(const room of course.rooms) {
    const label=`${r.id} room ${room.index+1} ${room.pattern}`;
    yield* c.walk([room.a+1,0,0],`${label} observation`);
    if(room.pattern==='upper'||room.pattern==='return') {
      const arrow=box(room,'conserved arrow'),rewards=room.crates.filter(spec=>spec.role.startsWith('upper')).map(spec=>c.crateNamed(spec.name));
      if(room.pattern==='return') {
        c.check(rewards.every(crate=>crate.pending),'return row was active before its own switch');
        yield* c.walk([room.launchX-2,0,0],`${label} preserve arrow approach`);
        yield* c.hop([room.launchX+3,0,0],`${label} pass intact arrow`);
        yield* c.hit(box(room,'far reveal switch'),`${label} reveal earlier high row`);
        c.check(arrow.alive&&rewards.every(crate=>!crate.pending),'return switch failed or consumed access tool');
        yield* c.walk([room.launchX+1.8,0,0],`${label} backtrack to retained arrow`);
      }
      const shelf=room.shelf;
      if(rewards.some(reward=>reward.box.min.y>=shelf.y-.2)){
        yield* c.bounce(arrow,[shelf.a+1.3,shelf.y,0],`${label} conserved-arrow ascent`,
          {double:true,airSpinAbove:shelf.y-1.2});
        for(const reward of rewards)if(reward.alive)yield* c.hit(reward,`${label} high target before support`);
        yield* c.walk([shelf.a+.5,shelf.y,0],`${label} return-gallery edge`);
        yield* c.hop([room.launchX-2,0,0],`${label} descend before clearing arrow`,{heightTolerance:.2});
      }else{
        // Some authored rooms lower their rewards below the gallery. Follow
        // the live crate positions; spinning on the now-empty upper shelf
        // cannot prove those rooms playable.
        if(p.pos.x<room.launchX){
          yield* c.walk([room.launchX-2,0,0],`${label} retained-arrow approach`);
          yield* c.hop([room.launchX+3,0,0],`${label} pass retained arrow`);
        }
        for(const reward of rewards)if(reward.alive){
          yield* c.walk([reward.mesh.position.x-1.8,0,0],`${label} lowered-reward approach`);
          yield* c.hop([reward.mesh.position.x+1.2,0,0],`${label} collect lowered reward`,{airButtons:{spinHeld:true}});
          c.check(!reward.alive,`${label} lowered reward was not collected`);
        }
        yield* c.walk([room.launchX+2,0,0],`${label} retained-arrow return`);
        yield* c.hop([room.launchX-2,0,0],`${label} cross before clearing arrow`);
      }
      c.check(arrow.alive,'reward route consumed its arrow too early');
      yield* c.hit(arrow,`${label} destroy arrow last`);
      if(room.pattern==='return') {
        yield* c.walk([room.switchX-2,0,0],`${label} spent-switch approach`);
        yield* c.hop([room.switchX+2.4,0,0],`${label} pass permanent switch`);
      }
    } else if(room.pattern==='finite') {
      const upper=box(room,'upper finite support'),cap=box(room,'upper cap'),hits=upper.hitsRemaining,x=room.launchX;
      yield* c.walk([x-1.7,0,0],`${label} finite-stack approach`);
      yield* c.charge();yield* c.tick({jumpReleased:true});
      yield* c.until(()=>upper.hitsRemaining<hits,()=>c.steer([x,upper.box.max.y,0]),{label:`${label} upper support contact`,limit:160});
      yield* c.until(()=>p.vVel<.65,()=>c.steer([x,cap.box.min.y,0]),{label:`${label} rebound apex`,limit:90});
      yield* c.tick({jumpHeld:true});yield* c.tick({jumpReleased:true});
      yield* c.until(()=>!cap.alive,()=>c.steer([x,cap.box.min.y,0]),{label:`${label} cap before spending support`,limit:160});
      c.check(upper.alive,'finite support was exhausted before its high target');
      yield* settle([x-2,0,0],`${label} clear landing`);
      for(const role of ['upper finite support','lower finite support']) {
        const support=box(room,role);if(support.alive)yield* c.hit(support,`${label} spent ${role}`);
      }
    } else if(room.pattern==='bridge') {
      const button=box(room,'local switch');
      yield* c.hit(button,`${label} create visible bridge`);
      c.check(button.bangUsed,'bridge switch did not activate');
      yield* c.hop([room.switchX+2.4,0,0],`${label} pass used switch`);
      yield* c.walk([room.gap.b+1,0,0],`${label} cross actual materialized bridge`);
      for(const role of ['receiver reward','receiver mystery'])yield* c.hit(box(room,role),`${label} ${role}`);
    } else if(room.pattern==='fuse') {
      const x=room.launchX,wood=box(room,'wooden takeoff cap'),cap=box(room,'upper cap before fuse'),tnt=box(room,'timed support');
      yield* c.walk([x-2.1,0,0],`${label} upper-first staging`);
      yield* c.charge();yield* c.tick({jumpReleased:true});
      yield* c.until(()=>!wood.alive,()=>c.steer([x,wood.box.max.y,0]),{label:`${label} takeoff cap rebound`,limit:140});
      yield* c.until(()=>p.vVel<.65,()=>c.steer([x,cap.box.min.y,0]),{label:`${label} upper-first rebound apex`,limit:90});
      yield* c.tick({jumpHeld:true});yield* c.tick({jumpReleased:true});
      yield* c.until(()=>!cap.alive,()=>c.steer([x,cap.box.min.y,0]),{label:`${label} collect cap before timed support`,limit:160});
      c.check(tnt.alive,'fuse support disappeared before the cap was collected');
      yield* settle([room.refugeX,0,0],`${label} visible refuge`);
      yield* c.walk([x-1.7,0,0],`${label} deliberate fuse approach`);
      yield* c.charge();yield* c.tick({jumpReleased:true});
      yield* c.until(()=>tnt.fuse!==undefined,()=>c.steer([x,tnt.box.max.y,0]),{label:`${label} prime fuse by contact`,limit:160});
      yield* settle([room.refugeX,0,0],`${label} leave blast radius`);
      yield* c.until(()=>!tnt.alive&&l.explosions.length===0,{}, {label:`${label} supported post-blast recovery`,limit:240});
      yield* c.hit(box(room,'refuge reward'),`${label} recovery reward`);
    } else if(room.pattern==='relay') {
      yield* c.walk([room.gap.a-1.2,0,0],`${label} inspect receiver chain`);
      for(const x of room.anchors) {
        const anchor=c.crateSpecAt(x,0),reward=c.crateSpecAt(x,.96);
        yield* c.hop([x,.96,0],`${label} air-spin cap and retain anchor`,{airButtons:{spinHeld:true},tolerance:.85});
        c.check(anchor.alive&&!reward.alive,'relay failed to preserve permanent footing while harvesting');
      }
      yield* c.hop([room.gap.b+1.2,0,0],`${label} leave last steel receiver`);
    }
    yield* c.walk([room.b-1,0,0],`${label} supported room exit`);
    r.report.evidence.push({action:'room complete',pattern:room.pattern,index:room.index,position:p.pos.toArray()});
  }
  yield* c.clearAll('all actual authored bonus crates');
  yield* c.until(()=>p.state==='finished',{moveX:1},{label:p.bonusMode?'cross real bonus gate to bank parent rewards':'collect earned gem and cross real bonus gate',limit:300});
  // Active detours bank their boxes into the parent's gem objective. The
  // standalone editor entry awards its own gem using the same geometry.
  c.check(p.bonusMode ? !p.gemEarned : p.gemEarned,
    p.bonusMode ? 'detour granted a separate parent gem' : 'standalone bonus missed its real all-box gem');
  c.check(p.totalDeaths===deaths,'positive bonus journey hid a reset');
  return {id:r.id,state:p.state,gemEarned:p.gemEarned,totalCrates:l.totalCrates,cratesBroken:p.cratesBroken,deaths:p.totalDeaths-deaths};
}

/** Negative inputs applied to a fresh source course. These retain the actual
 * runtime volumes and show the failure caused by each irreversible choice. */
export function* runThemedBonusWrongOrder(r) {
  const c=puzzleControls(r),{p,l}=r,room=r.course.rooms[0],pattern=room.pattern;
  const box=role=>c.crateNamed(room.crates.find(spec=>spec.role===role)?.name);
  yield* c.stepFor(20);yield* c.walk([room.a+1,0,0],`${pattern} negative observation`);
  if(pattern==='upper'||pattern==='return') {
    const arrow=box('conserved arrow');
    if(pattern==='return') {
      yield* c.walk([room.launchX-2,0,0],'preserve return arrow outward');
      yield* c.hop([room.launchX+3,0,0],'pass arrow before revealing targets');
      yield* c.hit(box('far reveal switch'),'reveal row before wrong-order test');
      yield* c.walk([room.launchX+1.8,0,0],'return to destroy needed donor');
    }
    yield* c.hit(arrow,'wrong order: destroy required arrow before upper rewards');
    const rewards=room.crates.filter(spec=>spec.role.startsWith('upper')).map(spec=>c.crateNamed(spec.name));
    for(const timing of [7,3,.5,-1.5]) {
      yield* c.walk([room.shelf.a-1.5,0,0],'direct reach attempt takeoff');
      yield* c.charge();yield* c.tick({jumpReleased:true});
      yield* c.until(()=>p.vVel<=timing,{}, {label:'charged-jump timing',limit:100});
      yield* c.tick({jumpHeld:true});yield* c.tick({jumpReleased:true});
      const first=r.frame;
      yield* c.until(()=>p.grounded,()=>({...c.steer([room.shelf.a+2,0,0]),jumpHeld:p.state==='hang',spinHeld:p.pos.y>3.8}),
        {label:'attempt direct double, animated crown, air spin and ledge grab',limit:240});
      c.check(rewards.every(crate=>crate.alive),'missing arrow was bypassed');
      c.check(!r.trace.slice(first).some(frame=>frame.state==='hang'),'native clamber bypassed required arrow');
    }
    return {pattern,test:'donor loss blocks ordinary double/air-spin/native-clamber bypass',rewardRemaining:rewards.length};
  }
  if(pattern==='finite') {
    const x=room.launchX,upper=box('upper finite support'),lower=box('lower finite support'),cap=box('upper cap');
    yield* c.walk([x-1.7,0,0],'exhaust upper striped support too soon');
    yield* c.charge();yield* c.tick({jumpReleased:true});
    yield* c.until(()=>p.pos.y>1.8,{}, {label:'rise above lower support',limit:60});
    yield* c.until(()=>!upper.alive,()=>c.steer([x,1.8,0]),{label:'spend every upper bounce before claiming cap',limit:1200});
    c.check(lower.alive,'negative finite trial did not retain lower support');
    yield* c.until(()=>p.grounded,()=>c.steer([x-2,0,0]),{label:'land beside one remaining support',limit:180});
    const hits=lower.hitsRemaining;
    yield* c.charge();yield* c.tick({jumpReleased:true});
    yield* c.until(()=>lower.hitsRemaining<hits,()=>c.steer([x,.96,0]),{label:'single support contact',limit:160});
    yield* c.until(()=>p.vVel<.65,()=>c.steer([x,9,0]),{label:'single support apex',limit:100});
    yield* c.tick({jumpHeld:true});yield* c.tick({jumpReleased:true});
    yield* c.until(()=>p.vVel<.1,()=>({...c.steer([x,9,0]),spinHeld:p.pos.y>5}),{label:'attempt high reward with single support, double jump and air spin',limit:100});
    yield* c.until(()=>p.grounded,()=>c.steer([x+2.1,0,0]),{label:'single support recovery',limit:180});
    c.check(cap.alive,'finite height dependency bypassed after exhausting upper support');
    return {pattern,test:'spending upper finite support first loses high cap access',capAlive:cap.alive};
  }
  if(pattern==='fuse') {
    yield* c.walk([room.launchX-1.1,0,0],'unsafe direct spin approach');
    let previousSpin=false;
    yield* c.until(()=>p.state==='dead',()=>{const spinHeld=p.spinning||!previousSpin;previousSpin=spinHeld;return {spinHeld};},
      {label:'wrong ground spin detonates useful TNT support',limit:180,allowDeath:true});
    c.check(box('upper cap before fuse').alive,'early blast unexpectedly collected high cap');
    return {pattern,test:'early ground spin destroys timed access and kills exposed player',capAlive:true,state:p.state};
  }
  if(pattern==='bridge') {
    // Pass the switch without attacking; a walk into its absent floor must fall.
    yield* c.walk([room.switchX-2,0,0],'unused switch approach');
    yield* c.hop([room.switchX+2.4,0,0],'skip bridge switch');
    c.check(!box('local switch').bangUsed,'negative bridge switch was accidentally activated');
  }
  yield* c.walk([room.gap.a-1,0,0],'unsupported crossing approach');
  yield* c.charge();yield* c.tick({jumpReleased:true});
  yield* c.until(()=>p.state==='dead',()=>c.steer([(room.gap.a+room.gap.b)/2,0,0]),{label:'jump into the gap without using the required crossing tool',limit:240,allowDeath:true});
  return {pattern,test:'skipping visible crossing footholds leads to real chasm death',state:p.state,steelIntact:pattern==='relay'?room.anchors.every(x=>c.crateSpecAt(x,0).alive):undefined};
}
