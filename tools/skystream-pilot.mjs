// Ordinary controller samples only. The ordered lane keeps the long route
// distinct from the lower shortcut crossings; no position or speed writes.
export function createSkystreamPilot(source, options = {}) {
 const lane=source.SKYSTREAM_LEVEL.components.filter(c=>c.t==='camnode'&&!c.cameraView).map(c=>c.p);
 const wideHalo=source.SKYSTREAM_PARTS.find(part=>part.name==='Cloud eye · wide left oval');
 const laneIndex=q=>lane.findIndex(p=>p.every((n,i)=>n===q[i]));
 const wideStart=laneIndex(wideHalo.points[0]),wideEnd=laneIndex(wideHalo.points.at(-1));
 let index=options.startIndex??0, gap=options.startGap??0, loopSeen=false, loopDone=false, lastCompleted=0, airborne=false, finishJump=false;
 const evidence={gaps:[],inverted:false,loopEntrySpeed:null,finished:false,checkpoints:[],loops:[]};
 const position=p=>p.pos.toArray();
 function towards(p,l,q){
  const f=p.courseInputDirection(l)??p.camDir,dx=q[0]-p.pos.x,dz=q[2]-p.pos.z,d=Math.hypot(dx,dz)||1;
  return {moveX:(dx*-f.z+dz*f.x)/d,moveY:(dx*f.x+dz*f.z)/d};
 }
 return {evidence,get index(){return index;},
  sample(p,l){
   const camera=l.cameraDirAt(p.pos.x,p.pos.y,p.pos.z,{s:p.laneCursor.s});
   if(camera)p.camDir.set(camera.x,0,camera.z);
   if(p.loopStatus.active){
    if(!loopSeen)evidence.loopEntrySpeed=p.speed;
    if(!evidence.loops[p.loopStatus.completed])evidence.loops[p.loopStatus.completed]={entrySpeed:p.speed,inverted:false,wall:false};
    const loop=evidence.loops[p.loopStatus.completed];
    loop.inverted ||= p.rideNormal.y<-.9;
    loop.wall ||= Math.abs(p.rideNormal.y)<.05 && Math.abs(p.loopPresentationFrame?.tangent.y??1)<.15;
    loopSeen=true;return {moveY:1,jumpHeld:true};
   }
   if(p.loopStatus.completed>lastCompleted){
    lastCompleted=p.loopStatus.completed;
    index=source.SKYSTREAM_LOOP_EXITS[lastCompleted-1];
    loopDone=lastCompleted===3;
   }
   let best=Infinity,near=index;
   for(let i=Math.max(0,index-2);i<Math.min(lane.length,index+17);i++){
    const q=lane[i],d=Math.hypot(q[0]-p.pos.x,q[1]-p.pos.y,q[2]-p.pos.z);
    if(d<best){best=d;near=i;}
   }
   index=Math.max(index,near);
   const finish=source.SKYSTREAM_FINISH;
   if(loopDone&&p.pos.z<finish[2]+40){
    const release=!finishJump&&p.grounded&&p.pos.z<finish[2]+14;if(release)finishJump=true;
    return {...towards(p,l,finish),jumpHeld:!release};
   }
   // Read the next crate run early and trace the bend instead of cutting its
   // inside chord. These are ordinary steering samples at the same speed.
   const crateRun=l.crates.some(c=>c.alive&&c.mesh.position.distanceTo(p.pos)<30)||
    l.checkpoints.some(cp=>!cp.active&&cp.spawnPos.distanceTo(p.pos)<30);
   const edge=source.SKYSTREAM_GAPS[gap];
   const jumpApproach=edge&&Math.hypot(...edge.takeoff.map((n,i)=>n-p.pos.getComponent(i)))<55;
   const q=lane[Math.min(lane.length-1,index+(index>170?(!crateRun||jumpApproach?4:index>=wideStart&&index<=wideEnd?3:2):2))];
   const gx=edge?edge.landing[0]-edge.takeoff[0]:0,gz=edge?edge.landing[2]-edge.takeoff[2]:0,gn=Math.hypot(gx,gz)||1;
   const remaining=edge?((edge.takeoff[0]-p.pos.x)*gx+(edge.takeoff[2]-p.pos.z)*gz)/gn:Infinity;
   const across=edge?Math.abs((edge.takeoff[0]-p.pos.x)*gz-(edge.takeoff[2]-p.pos.z)*gx)/gn:Infinity;
   if(edge&&(p.grounded||p.coyoteTimer>0)&&remaining<3.4&&remaining>-.5&&across<9){
    evidence.gaps.push({index:gap,takeoff:position(p),landed:null});gap++;airborne=true;
    return {...towards(p,l,edge.landing),jumpHeld:false};
   }
   if(airborne){
    const last=evidence.gaps.at(-1);
    if(!p.grounded)last.aired=true;
    if(last.aired&&p.grounded){last.landed=position(p);airborne=false;}
    else return {jumpHeld:true};
   }
   return {...towards(p,l,q),jumpHeld:true,spinHeld:p.grounded&&l.checkpoints.some(cp=>!cp.active&&cp.spawnPos.distanceTo(p.pos)<4)};
  },
  observe(p,l){
   evidence.inverted ||= p.loopStatus.active&&p.rideNormal.y<-.9;
   evidence.finished=p.state==='finished';
   l.checkpoints.forEach((cp,i)=>{if(cp.active&&!evidence.checkpoints.includes(i))evidence.checkpoints.push(i);});
  },
 };
}
