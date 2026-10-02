/** Input-only side-scrolling pilots shared by Node physics and real Chrome.
 * Every yielded object is one ordinary device sample. The only placements in
 * the tests are optional starts before a run, never changes during traversal.
 */
export function puzzleControls(r) {
  const { p, l } = r;
  const pose = () => ({ frame: r.frame, position: p.pos.toArray(), state: p.state,
    grounded: p.grounded, bailing: p.isBailing, speed: p.speed,
    verticalSpeed: p.vVel, deaths: p.totalDeaths, ground: p.groundHit?.name });
  const check = (condition, message) => { if (!condition) throw Error(`${message}: ${JSON.stringify(pose())}`); };
  const live = label => check(!p.isBailing && !['dead', 'gameover'].includes(p.state), label);
  const resolve = target => typeof target === 'function' ? target() : target;
  const distance = target => { const q = resolve(target); return Math.hypot(q[0]-p.pos.x, q[2]-p.pos.z); };
  const steer = (target, pace = undefined) => {
    const q = resolve(target), dx = q[0]-p.pos.x, dz = q[2]-p.pos.z, n = Math.hypot(dx,dz);
    const throttle=pace??Math.min(1,n/.65);
    return n < .035 ? {} : { moveX: dx/n*throttle, moveY: -dz/n*throttle };
  };
  function* tick(sample = {}) { yield sample; return pose(); }
  function* stepFor(count, sample = {}) {
    for (let i=0;i<count;i++) yield* tick(typeof sample === 'function' ? sample(i) : sample);
    return pose();
  }
  function* until(predicate, sample = {}, { limit=1800, label='advance', allowDeath=false } = {}) {
    r.report.stage = label;
    const firstFrame = r.frame;
    for (let i=0;i<limit && !predicate();i++) {
      yield* tick(typeof sample === 'function' ? sample(i) : sample);
      if (!allowDeath) live(label);
    }
    check(predicate(),`${label} timed out`);
    r.report.actions.push({ name:label, firstFrame, lastFrame:r.frame });
    return pose();
  }
  function* walk(target, label='walk', { buttons={}, tolerance=.12, limit=2400, settle=18 } = {}) {
    yield* until(() => distance(target)<tolerance, () => {
      check(p.grounded, `${label} lost support`);
      const pace=.15+.7*Math.max(0,Math.min(1,(distance(target)-.6)/2.4));
      return {...steer(target,pace), ...buttons};
    },{label,limit});
    yield* stepFor(settle,buttons);
    live(`${label} stop`);
    check(p.grounded && distance(target)<.3,`${label} failed to stop on target`);
    return pose();
  }
  function* charge(count=26, sample={}) { yield* stepFor(count,{...sample,jumpHeld:true}); }
  function* hop(target, label='hop', { chargeFrames=26, heightTolerance=.14, tolerance=.7,
    airButtons={}, chargeInput={}, releaseInput={}, limit=180 } = {}) {
    const launch=pose();
    yield* charge(chargeFrames,chargeInput);
    yield* tick({...releaseInput,jumpHeld:false,jumpReleased:true});
    check(p.state==='air',`${label} did not launch`);
    yield* until(()=>p.grounded,()=>({...steer(target),...airButtons}),{label,limit});
    check(distance(target)<tolerance,`${label} missed target`);
    check(Math.abs(p.pos.y-resolve(target)[1])<heightTolerance,`${label} landed at wrong height`);
    r.report.evidence.push({action:label,launch:launch.position,landing:p.pos.toArray(),ground:p.groundHit?.name});
    return pose();
  }
  function* hit(crate,label='spin crate') {
    check(crate?.alive,`${label} missing crate`);
    const before={alive:crate.alive,pending:crate.pending,bangUsed:crate.bangUsed};
    const side=p.pos.x>crate.mesh.position.x?1:-1;
    if(distance([crate.mesh.position.x,p.pos.y,crate.mesh.position.z])>1.35)
      yield* walk([crate.mesh.position.x+side*1.1,p.pos.y,crate.mesh.position.z],`approach ${label}`);
    yield* tick({});yield* tick({spinHeld:true});
    let previousSpin=true;
    yield* until(()=>crate.bang||crate.nitroBang?crate.bangUsed:!crate.alive,()=>{
      const spinHeld=p.spinning||!previousSpin;previousSpin=spinHeld;
      return {...steer([crate.mesh.position.x,p.pos.y,crate.mesh.position.z],.3),spinHeld};
    },{label,limit:90});
    yield* stepFor(22);
    check(crate.bang||crate.nitroBang ? crate.bangUsed : !crate.alive,`${label} did not respond to input`);
    r.report.evidence.push({action:label,before,after:{alive:crate.alive,pending:crate.pending,bangUsed:crate.bangUsed}});
  }
  function* bounce(launcher,target,label='preserve launcher and bounce',{boost=true,double=false,airSpinAbove=Infinity,ascentTarget}={}) {
    check(launcher?.alive&&(launcher.bouncy||launcher.metalBounce),`${label} missing launcher`);
    const side=p.pos.x>launcher.mesh.position.x?1:-1;
    yield* walk([launcher.mesh.position.x+side*1.65,launcher.box.min.y,launcher.mesh.position.z],`${label} takeoff`);
    yield* charge();yield* tick({jumpReleased:true});
    yield* until(()=>p.vVel>15&&p.pos.y<launcher.box.max.y+.2,
      ()=>({...steer([launcher.mesh.position.x,launcher.box.max.y,launcher.mesh.position.z]),jumpHeld:boost}),
      {label:`${label} arrow contact`,limit:140});
    const contact=pose();
    if(double) {
      const q=resolve(target);
      if(!ascentTarget) {
        const roof=r.source.components.find(component=>['mesh','platform'].includes(component.t)&&component.s
          &&Math.abs(component.p[1]+component.s[1]/2-q[1])<.05
          &&q[0]>=component.p[0]-component.s[0]/2&&q[0]<=component.p[0]+component.s[0]/2);
        ascentTarget=roof?[roof.p[0]+(q[0]>launcher.mesh.position.x?-1:1)*(roof.s[0]/2+.85),q[1],q[2]]:[launcher.mesh.position.x,q[1],q[2]];
      }
      yield* stepFor(3,steer(ascentTarget));
      yield* until(()=>p.vVel<.65,()=>steer(ascentTarget),{label:`${label} apex outside the shelf`,limit:90});
      yield* tick({...steer(ascentTarget),jumpHeld:true});yield* tick({...steer(ascentTarget),jumpReleased:true});
      yield* until(()=>p.pos.y>q[1]+.06,()=>steer(ascentTarget),{label:`${label} rise above the shelf`,limit:70});
    }
    let lastSpin=false;
    yield* until(()=>p.grounded&&distance(target)<.32,()=>{
      const wants=p.pos.y>airSpinAbove&&l.crates.some(box=>box.alive&&!box.metal&&!box.metalBounce&&Math.abs(box.mesh.position.x-p.pos.x)<1.75&&Math.abs(box.box.min.y-resolve(target)[1])<1.2);
      const spinHeld=wants&&(p.spinning||!lastSpin);lastSpin=spinHeld;
      return {...steer(target),jumpHeld:p.state==='hang'||(boost&&!double),spinHeld};
    },{label,limit:200});
    check(Math.abs(p.pos.y-resolve(target)[1])<.14&&distance(target)<.8,`${label} missed high receiving perch`);
    check(launcher.alive,`${label} destroyed the required launcher early`);
    r.report.evidence.push({action:label,contact,landing:p.pos.toArray(),launcherAlive:launcher.alive});
  }
  function* enemy(foe,label='read and defeat enemy') {
    check(foe?.alive,`${label} missing enemy`);
    yield* walk([foe.x0-2,foe.baseY,foe.group.position.z],`${label} safe approach`);
    if(foe.kind==='turtle') {
      yield* charge();yield* tick({jumpReleased:true});
      yield* until(()=>!foe.alive,()=>steer([foe.group.position.x,foe.box.max.y,foe.group.position.z]),{label:`${label} stomp`,limit:140});
      yield* until(()=>p.grounded,()=>steer([foe.group.position.x+2,foe.baseY,0]),{label:`${label} rebound landing`,limit:180});
    } else {
      if(!foe.spinKill)yield* until(()=>foe.spinKill,{}, {label:`${label} attack opening`,limit:360});
      yield* until(()=>!foe.alive,()=>({...steer([foe.group.position.x,foe.baseY,0]),
        spinHeld:distance([foe.group.position.x,foe.baseY,0])<2.1}),{label:`${label} spin`,limit:120});
    }
    live(label);r.report.evidence.push({action:label,kind:foe.kind,alive:foe.alive,position:p.pos.toArray()});
  }
  const crateAt = (x,y=undefined) => l.crates.find(c=>Math.abs((c.home?.x??c.mesh.position.x)-x)<.04
    && (y===undefined || Math.abs(c.box.min.y-y)<.04));
  const crateNamed = name => {
    const specs=r.source.components.filter(c=>['crate','metal','outline'].includes(c.t));
    const index=specs.findIndex(c=>c.nm===name);return index<0?undefined:l.crates[index];
  };
  const crateSpecAt = (x,y) => {
    const specs=r.source.components.filter(c=>['crate','metal','outline'].includes(c.t));
    const index=specs.findIndex(c=>Math.abs(c.p[0]-x)<.03&&Math.abs(c.p[1]-y)<.03);
    return index<0?undefined:l.crates[index];
  };
  function* checkpoint(x,label='bank checkpoint') {
    const cp=l.checkpoints.find(cp=>Math.abs(cp.spawnPos.x-x)<.04);check(cp,`${label} missing checkpoint`);
    yield* walk([x-1.1,cp.box.min.y,0],`${label} approach`);
    yield* tick({spinHeld:true});yield* stepFor(22);
    check(cp.active,`${label} did not activate`);r.report.evidence.push({action:label,x,active:true});
  }
  function* highArrowBox(launcher,reward,label='collect upper before launch support') {
    check(launcher?.alive&&reward?.alive,`${label} missing launcher or reward`);
    const side=p.pos.x>launcher.mesh.position.x?1:-1,x=launcher.mesh.position.x,y=launcher.box.min.y;
    yield* walk([x+side*1.65,y,0],`${label} takeoff`);yield* charge();yield* tick({jumpReleased:true});
    yield* until(()=>p.vVel>15&&p.pos.y<launcher.box.max.y+.2,()=>({...steer([x,y,0]),jumpHeld:true}),{label:`${label} arrow contact`,limit:140});
    yield* until(()=>!reward.alive||p.vVel<.65,{jumpHeld:true},{label:`${label} high reward ascent`,limit:100});
    if(reward.alive) {
      yield* tick({});yield* tick({jumpHeld:true});yield* tick({jumpReleased:true});
      yield* until(()=>!reward.alive,{}, {label:`${label} apex double-jump head bump`,limit:100});
    }
    check(launcher.alive,`${label} destroyed support before upper reward`);
    yield* until(()=>p.grounded,()=>steer([x+side*2.3,y,0]),{label:`${label} leave intact launcher`,limit:180});
    yield* hit(launcher,`${label} support last`);
    r.report.evidence.push({action:label,upperAlive:reward.alive,launcherAlive:launcher.alive});
  }
  function* clearAll(label='all crates in the active stage') {
    const remaining=l.crates.filter(c=>!c.bang&&!c.nitroBang&&!c.metalBounce&&!c.metal&&c.alive);
    check(!remaining.length,`${label} left boxes at ${JSON.stringify(remaining.map(c=>[c.mesh.position.x,c.box.min.y]))}`);
    check(l.checkpoints.every(cp=>cp.active),`${label} missed a checkpoint box`);
    const activeStageCrates=l.totalCrates-l.bonusCrateTotal;
    yield* stepFor(2);check(p.cratesBroken===activeStageCrates,`${label} counter does not match actual active-stage boxes`);
    r.report.evidence.push({action:label,totalCrates:l.totalCrates,activeStageCrates,bonusCrateTotal:l.bonusCrateTotal,cratesBroken:p.cratesBroken,remaining:0});
  }
  function* finish(label='cross the real finish gate',{limit=220}={}) {
    yield* until(()=>p.state==='finished',{moveX:1},{label,limit});
    const bonusCrateTotal=l.bonusCrateTotal,activeStageCrates=l.totalCrates-bonusCrateTotal;
    check(p.cratesBroken===activeStageCrates,'finish lost an active-stage crate');
    check(p.bonusCrates===0,'active-stage pilot must not invent banked bonus rewards');
    const needsLocalGem=!p.bonusMode&&bonusCrateTotal===0;
    check(p.gemEarned===needsLocalGem,p.bonusMode
      ?'bonus detour awarded a local gem instead of returning its boxes to the parent'
      :bonusCrateTotal>0?'main-only clear awarded a gem despite uncollected linked-bonus crates'
      :'complete standalone stage did not collect its actual all-box gem');
    return {completionScope:p.bonusMode?'bonus-detour':bonusCrateTotal>0?'main-route-only':'complete-stage',activeStageCrates,bonusCrateTotal,bonusCrates:p.bonusCrates,gemEarned:p.gemEarned};
  }
  return { pose, check, live, resolve, distance, steer, tick, stepFor, until, walk, charge, hop, hit, bounce, enemy,
    crateAt,crateNamed,crateSpecAt,checkpoint,highArrowBox,clearAll,finish };
}
