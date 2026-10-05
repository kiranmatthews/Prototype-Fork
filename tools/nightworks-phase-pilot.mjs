import * as THREE from 'three';

// A device-input pilot for the shift-light chapter. Read the upcoming team's
// remaining lit time, charge while planted, and aim before releasing an ollie.
// The pilot does not move the player, advance the clock, or alter the pads.
export function createAfterHoursPhasePilot(source,options={}) {
 const tuning=options.tuning??globalThis.__game?.TUNING??{maxSpeed:23,chargeBoost:9,carveGripLow:360,carveGripHigh:60,jumpChargeTime:.4,
  ollieMinVelocity:6.5,ollieVelocity:11,boardRiseGravity:33,boardFallGravity:70,boardApexFloat:.35,boardApexBand:4.5};
 const dt=options.fixedStep??1/60;
 const stations=source.AFTER_HOURS_PHASES.filter((_,i)=>i%2===0).map(pad=>pad.p[2]);
 const components=source.NIGHTWORKS_AFTER_HOURS_LEVEL.components;
 const phaseComponents=components.map((c,i)=>({c,i})).filter(({c})=>c.t==='phasepad'&&c.grp===4);
 const dock=components.findIndex(c=>c.nm==='Counterweight launch dock');
 let row=0,selected=null,mounted=false,previousGrounded=true,air=null,frame=0;
 const evidence={phasePadContacts:[],jumps:[],mountedFrames:0,footFrames:0,complete:false};
 const componentOf=object=>{for(let node=object;node;node=node.parent)if(Number.isInteger(node.userData?.editorIdx))return node.userData.editorIdx;return null;};
 const direction=(p,l,x,z)=>{
  const f=p.courseInputDirection(l)??p.camDir,n=Math.hypot(x,z)||1,fn=Math.hypot(f.x,f.z)||1;
  return {moveX:(x*-f.z+z*f.x)/n/fn,moveY:(x*f.x+z*f.z)/n/fn};
 };
 const choose=(p,l)=>{
  const firstTakeoff=p.boardRolling&&p.speed>11?-290:-292.8;
  const z=stations[row],distance=Math.max(0,p.pos.z-(row===0?firstTakeoff:z+17-2));
  // Ground acceleration followed by the measured native flat ollie flight.
  // The first bank includes the supported push-off and its downhill catch.
  // An inherited mounted approach pops earlier to preserve re-aiming room
  // on the first pad; a checkpoint push-off retains its measured baseline.
  const groundTime=(Math.sqrt(p.speed*p.speed+18*distance)-p.speed)/9;
  const eta=row===0?(p.boardRolling?groundTime+.85:2.78):groundTime+.62;
  const room=lane=>{
   const pad=l.phasePads[row*2+lane],phase=((l.time+eta)/pad.cycle+pad.phase)%1;
   return phase<pad.duty?(pad.duty-phase)*pad.cycle:-5;
  };
  const lane=room(0)>room(1)?0:1;
  const x=lane===0?18:22;
  return {station:row,lane,x,z,firstTakeoff,turnEarly:row>0&&p.axisF.x*(x-p.pos.x)<0&&Math.abs(p.axisF.x)>.18,predictedLandingTime:l.time+eta};
 };
 const roofRay=new THREE.Raycaster(),roofDown=new THREE.Vector3(0,-1,0);
 const roofSupports=(mesh,x,z,top)=>{
  if(!mesh)return false;
  // The fitted rock roof has rounded corners. A box footprint alone can
  // predict a landing whose foot/body clips the real leading corner.
  for(const [dx,dz]of [[0,0],[-.3,0],[.3,0],[0,-.3],[0,.3],[-.22,-.22],[.22,-.22],[-.22,.22],[.22,.22]]){
   roofRay.set(new THREE.Vector3(x+dx,top+12,z+dz),roofDown);
   const hit=roofRay.intersectObject(mesh,false)[0];
   if(!hit||Math.abs(hit.point.y-top)>.055)return false;
  }
  return true;
 };
 const forecast=(p,l,target)=>{
  const dockExit=target.station==='dock',dockData=components[dock];
  const spec=dockExit?{p:[dockData.p[0],dockData.p[1]+dockData.s[1]/2,-371.4],s:[dockData.s[0],0,4.8]}:phaseComponents[target.station*2+target.lane].c;
  const pad=dockExit?null:l.phasePads[target.station*2+target.lane];
  // Release preserves the rider's current flight line. Never grant the
  // next ground tick's requested turn or acceleration to the prediction.
  const speed=p.speed,fx=p.axisF.x,fz=p.axisF.z,charge=Math.min(1,p.xHoldT/tuning.jumpChargeTime);
  let y=p.pos.y,v=tuning.ollieMinVelocity+(tuning.ollieVelocity-tuning.ollieMinVelocity)*charge,above=y>=spec.p[1];
  for(let t=dt;t<1.5;t+=dt){
   const apex=1-Math.min(1,Math.abs(v)/tuning.boardApexBand);
   const gravity=(v>0?tuning.boardRiseGravity:tuning.boardFallGravity)*(1-tuning.boardApexFloat*apex);
   v-=gravity*dt;y+=v*dt;above||=y>=spec.p[1];
   if(!above||v>=0||y>spec.p[1])continue;
   const travel=t+(p.grounded?dt:0),x=p.pos.x+fx*speed*travel,z=p.pos.z+fz*speed*travel;
   const roof=dockExit?l.groundMeshes.find(mesh=>componentOf(mesh)===dock):pad.mesh;
   const inside=Math.abs(x-spec.p[0])<=spec.s[0]/2-.45&&Math.abs(z-spec.p[2])<=spec.s[2]/2-.5&&roofSupports(roof,x,z,spec.p[1]);
   const litAt=time=>{if(!pad)return true;const k=((time/pad.cycle+pad.phase)%1+1)%1;return k<pad.duty;};
   // Level.update publishes pad membership one tick behind its clock. Leave
   // a real lit-window margin at both sides of the projected touchdown.
   const lit=litAt(l.time+travel-2*dt-.055)&&litAt(l.time+travel+dt+.055);
   return {safe:inside&&lit,position:[x,spec.p[1],z],time:l.time+travel,heading:[fx,0,fz],inside,lit};
  }
  return null;
 };
 return {evidence,
  sample(p,l){
   if(evidence.complete)return {};
   selected??=row<stations.length?choose(p,l):null;
   if(p.state==='air'){
    // A far-corner line can lose wheel contact one tick before release. The
    // neutral device sample releases that real charge in the native coyote
    // window; keep the launch in evidence just like a planted release.
    if(!air&&row<stations.length&&p.charging&&p.coyoteTimer>0){
     const prediction=forecast(p,l,selected);
     if(!prediction?.safe)return {jumpHeld:true};
     air={station:row,target:{...selected},start:p.pos.toArray(),peak:p.pos.y,airborne:false,predicted:prediction};
    }
    return {};
   }
   if(row>=stations.length){
    // A short hop lands before the checkpoint crate, so it can be banked on
    // wheels. A full late pop stomps that crate and adds an unwanted bounce
    // that carries the rider past the receiving dock's reading area.
    const target={station:'dock',x:p.pos.x,z:-371.4},prediction=p.grounded?forecast(p,l,target):null;
    const release=p.grounded&&p.xHoldT>=.05&&prediction?.safe;
    if(release&&!air)air={station:'dock',start:p.pos.toArray(),peak:p.pos.y,airborne:false,predicted:prediction};
    return {...direction(p,l,0,-15),jumpHeld:!release};
   }
   const lane=p.pos.x<20?0:1,cross=row>0&&lane!==selected.lane,previousZ=stations[row-1];
   const takeoff=selected.firstTakeoff;
   // Stay inside the present rock for the early run-up. The last few metres
   // set the diagonal; steering in ordinary street air cannot move the deck.
   const straight=false;
   const input={...direction(p,l,straight?0:selected.x-p.pos.x,straight?-10:selected.z+2-p.pos.z),jumpHeld:true};
   const prediction=row>0&&p.grounded?forecast(p,l,selected):null;
   if(p.grounded&&(row===0?p.pos.z<=takeoff:p.xHoldT>=.14&&prediction?.safe)){
    input.jumpHeld=false;
    if(!air)air={station:row,target:{...selected},start:p.pos.toArray(),peak:p.pos.y,airborne:false,predicted:prediction};
   }
   return input;
  },
  observe(p,l){
   frame++;mounted||=p.boardRolling;
   if(mounted){if(p.boardRolling)evidence.mountedFrames++;else evidence.footFrames++;}
   if(air){
    air.peak=Math.max(air.peak,p.pos.y);air.airborne||=!p.grounded;
    if(air.airborne&&p.grounded){evidence.jumps.push({...air,end:p.pos.toArray(),component:componentOf(p.groundHit?.mesh),time:l.time});air=null;}
   }
   if(p.grounded){
    const component=componentOf(p.groundHit?.mesh),index=phaseComponents.findIndex(value=>value.i===component);
    if(index>=0&&!evidence.phasePadContacts.some(contact=>contact.station===Math.floor(index/2)))
     evidence.phasePadContacts.push({station:Math.floor(index/2),lane:index%2,component,frame,time:l.time,position:p.pos.toArray(),speed:p.speed,lit:l.phasePads[index].on});
    if(!previousGrounded&&row<stations.length&&Math.abs(p.pos.z-selected.z)<7){row++;selected=row<stations.length?choose(p,l):null;}
    if(row===stations.length&&component===dock&&p.pos.z<-369)evidence.complete=true;
   }
   previousGrounded=p.grounded;
  },
 };
}
