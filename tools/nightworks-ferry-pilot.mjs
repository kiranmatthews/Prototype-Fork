import * as THREE from 'three';

// Device-only reviewer for the three delivery decks. It reads the existing
// sine cycles and fitted collision surface; it never moves world/player state.
export function createNightworksFerryPilot(source, options = {}) {
  const tuning = options.tuning ?? {ollieVelocity:11,boardRiseGravity:33,boardFallGravity:70,boardApexFloat:.35,boardApexBand:4.5};
  const dt = options.fixedStep ?? 1/60;
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0,-1,0);
  let frame=0, goal=0, air=null, mounted=false, initialized=false, targets=[], committed=false, braking=false;
  const evidence={moverContacts:[],landings:[],launches:[],mountedFrames:0,footFrames:0,complete:false,waitFrames:0};
  const componentOf=object=>{for(let n=object;n;n=n.parent)if(Number.isInteger(n.userData?.editorIdx))return n.userData.editorIdx;return null;};
  const direction=(p,l,x,z)=>{
    const f=p.courseInputDirection(l)??p.camDir,n=Math.hypot(x,z)||1,fn=Math.hypot(f.x,f.z)||1;
    return {moveX:(x*-f.z+z*f.x)/n/fn,moveY:(x*f.x+z*f.z)/n/fn};
  };
  const initialize=l=>{
    targets=source.AFTER_HOURS_FERRIES.map((spec,index)=>({spec,index,mover:l.movers[index],mesh:l.movers[index].mesh}));
    const component=source.NIGHTWORKS_AFTER_HOURS_LEVEL.components.findIndex(c=>c.nm==='Cutback reading dock');
    const mesh=l.groundMeshes.find(m=>componentOf(m)===component);
    if(!mesh)throw new Error('Cutback receiving dock collision is missing');
    const cutback=source.NIGHTWORKS_AFTER_HOURS_LEVEL.components.findIndex(c=>c.nm==='Four quarry cutbacks');
    targets.push({spec:{p:[-8,12,-180],s:[22,10,24]},index:null,mesh,component,receivers:new Set([component,cutback])});initialized=true;
  };
  const future=(target,l,seconds)=>{
    if(!target.mover)return target.mesh.position.clone();
    const m=target.mover;return m.base.clone().addScaledVector(m.axisV,Math.sin((l.time+seconds)*m.speed+m.phase)*m.amp);
  };
  const surface=(target,l,x,z,seconds)=>{
    const f=future(target,l,seconds),d=f.clone().sub(target.mesh.position);
    ray.set(new THREE.Vector3(x-d.x,100,z-d.z),down);
    const hit=ray.intersectObject(target.mesh,false)[0];
    return hit?hit.point.y+d.y:null;
  };
  const forecast=(p,l,target)=>{
    const climb=p.grounded&&p.takeoffTy>0?Math.max(0,p.speed*p.takeoffTy):0;
    const descent=Math.min(0,p.speed*(p.takeoffTy??0));
    const floatAir=(climb>.5||p.rideNormal.y<.985)&&descent>=-.5;
    const charge=Math.min(1,p.xHoldT/(tuning.jumpChargeTime??.4));
    const pop=(tuning.ollieMinVelocity??6.5)+(tuning.ollieVelocity-(tuning.ollieMinVelocity??6.5))*charge;
    let y=p.pos.y,v=climb+Math.max(pop*.45,pop+descent*(tuning.ollieDownCouple??.65)),peak=y;
    for(let t=dt;t<1.6;t+=dt){
      const band=1-Math.min(1,Math.abs(v)/tuning.boardApexBand);
      let gravity=v>0?tuning.boardRiseGravity:(floatAir?(tuning.rampFallGravity??40):tuning.boardFallGravity);
      gravity*=1-tuning.boardApexFloat*band;v-=gravity*dt;y+=v*dt;peak=Math.max(peak,y);
      const x=p.pos.x+p.axisF.x*p.speed*t,z=p.pos.z+p.axisF.z*p.speed*t;
      if(v>=0)continue;
      const top=surface(target,l,x,z,t);
      if(top===null)continue;
      if(y<=top+.12&&y>=top-.7){
        const f=future(target,l,t),w=target.spec.s[0],d=target.spec.s[2];
        if(Math.abs(x-f.x)<w/2-1.5&&Math.abs(z-f.z)<d/2-2)return {t,position:[x,top,z],peak};
      }
    }
    return null;
  };
  return {evidence,
    sample(p,l){
      if(!initialized){initialize(l);braking=p.boardRolling&&p.grounded&&p.speed>(options.moverSpeed??15)+.5;}
      if(!committed){
        // A fresh checkpoint spawn can read the opposing decks before pushing
        // off. Existing mounted arrivals commit immediately; no hidden stop.
        const a=future(targets[0],l,2.25),b=future(targets[1],l,3.4);
        if(p.boardRolling||options.waitBeforeCommit===false||Math.abs(a.x-b.x)<4.5)committed=true;
        else{evidence.waitFrames++;return {moveX:0,moveY:0,jumpHeld:false};}
      }
      if(evidence.complete)return {...direction(p,l,0,-1),jumpHeld:true};
      const target=targets[goal];
      if(!target)return {...direction(p,l,0,-1),jumpHeld:true};
      // Aim towards a near-end landing, biased toward the following deck so
      // its next steering change has room on this supported surface.
      const f=future(target,l,.62),next=targets[goal+1];
      const towardNext=next?Math.sign(future(next,l,1.25).x-f.x):0;
      const x=f.x+towardNext*1.5,z=f.z+target.spec.s[2]/2-2.4;
      let input=direction(p,l,x-p.pos.x,z-p.pos.z);
      const previous=targets[goal-1];
      if(previous?.mover&&p.grounded&&p.groundHit?.moverId===previous.index&&p.pos.z>previous.spec.p[2]+3.5){
        const middle=future(previous,l,.2);input=direction(p,l,middle.x-p.pos.x,-8);
      }
      const brakeNow=braking&&p.grounded&&p.speed>(options.moverSpeed??15);
      if(braking&&p.speed<=(options.moverSpeed??15))braking=false;
      let jumpHeld=!(air&&!p.grounded);
      if(!brakeNow&&(p.grounded||(options.allowCoyote&&p.coyoteTimer>0))&&!air&&p.xHoldT>=(goal>=2?.32:(tuning.jumpChargeTime??.4)-.001)&&p.boardRolling){
        const prediction=forecast(p,l,target);
        if(prediction&&p.axisF.z<-.45&&p.speed>=12){
          jumpHeld=false;
          air={goal,start:p.pos.toArray(),startFrame:frame,startTime:l.time,charge:p.xHoldT,peak:p.pos.y,airborne:false,predicted:prediction};
          evidence.launches.push({...air});
        }
      }
      return {...(air&&!p.grounded?{moveX:0,moveY:0}:input),jumpHeld,grabHeld:brakeNow,spinHeld:false};
    },
    observe(p,l){
      frame++;mounted||=p.boardRolling;
      if(mounted){if(p.boardRolling)evidence.mountedFrames++;else if(p.state!=='finished')evidence.footFrames++;}
      if(air){air.peak=Math.max(air.peak,p.pos.y);air.airborne||=!p.grounded;}
      if(p.grounded){
        const id=p.groundHit?.moverId;
        const contact=componentOf(p.groundHit?.mesh);
        if(Number.isInteger(id)&&id<source.AFTER_HOURS_FERRIES.length&&!evidence.moverContacts.some(c=>c.moverIndex===id))
          evidence.moverContacts.push({moverIndex:id,component:contact,frame,time:l.time,position:p.pos.toArray()});
        const target=targets[goal],expected=target&&(target.index===null?(!Number.isInteger(id)&&p.pos.z<=-168&&p.pos.z>=-205&&target.receivers.has(contact)):id===target.index);
        if(expected&&air?.airborne){
          evidence.landings.push({...air,end:p.pos.toArray(),endFrame:frame,endTime:l.time,moverIndex:id??null,component:contact});
          goal++;air=null;braking=goal<targets.length&&p.speed>(options.moverSpeed??15)+.5;
        }
        if(goal===targets.length&&p.pos.z<=-168)evidence.complete=true;
      }
    },
    get goal(){return goal;},
  };
}

// Checkpoint checks intentionally report the pre-push timing read. They prove
// mounted catches after commit, not an unbroken whole-level journey.
export async function runNightworksFerryCheckpointChecks(offsets=[0,1,2,3,4,5,6,7,8,9,10]) {
  const {withAfterHoursRuntime}=await import('./nightworks-runner.mjs');
  const {default:assert}=await import('node:assert/strict');
  const reports=[];
  for(const timeOffset of offsets)await withAfterHoursRuntime(r=>{
    const before=JSON.stringify(r.TUNING);
    const pilot=createNightworksFerryPilot(r.source,{tuning:r.TUNING,fixedStep:r.CONST.fixedStep});
    for(let i=0;i<3000&&!pilot.evidence.complete;i++){
      r.tick(pilot.sample(r.p,r.l));pilot.observe(r.p,r.l);
      if(r.p.isBailing||['dead','gameover'].includes(r.p.state))break;
    }
    const details=JSON.stringify({timeOffset,evidence:pilot.evidence,end:r.snapshot()});
    assert.ok(pilot.evidence.complete,details);
    assert.deepEqual(pilot.evidence.moverContacts.map(c=>c.moverIndex),[0,1,2],details);
    assert.equal(pilot.evidence.landings.length,4,details);
    assert.equal(pilot.evidence.footFrames,0,details);
    assert.ok(r.p.boardRolling&&!r.p.isBailing&&r.p.totalDeaths===0,details);
    assert.equal(JSON.stringify(r.TUNING),before,'preserve authored movement');
    reports.push({timeOffset,time:r.snapshot().time,wait:pilot.evidence.waitFrames*r.CONST.fixedStep,evidence:pilot.evidence,end:r.snapshot()});
    console.log(`PASS ferry phase ${timeOffset}: three real moving catches, four landings, mounted exit; read ${(pilot.evidence.waitFrames*r.CONST.fixedStep).toFixed(2)}s before push-off.`);
  },{start:[-8,12.1,-89],timeOffset});
  return reports;
}
if(typeof process!=='undefined'&&process.versions?.node&&process.argv[1]){
  const {pathToFileURL}=await import('node:url');
  if(import.meta.url===pathToFileURL(process.argv[1]).href)await runNightworksFerryCheckpointChecks();
}
