/** Ordinary input samples only. Shared by native physics and the visible
 * browser review; each ride is confirmed against the real ground mover ID. */
export function* runTribalMoving(r,{first=0,last=28,finish=true}={}){
 const {p,l,sourceModule:m}=r,at=m.tribalPoint,progress=()=>m.tribalProgress(p.pos);
 const report=r.report??(r.report={rides:[],actions:[]});report.rides??=[];
 const pose=()=>({frame:r.frame,s:progress(),position:p.pos.toArray(),state:p.state,grounded:p.grounded,mover:p.groundHit?.moverId,deaths:p.totalDeaths});
 const check=(ok,label)=>{if(!ok)throw Error(label+': '+JSON.stringify(pose()));};
 const steer=(q,pace=1)=>{
  const dx=q[0]-p.pos.x,dz=q[2]-p.pos.z,d=Math.hypot(dx,dz),f=p.courseInputDirection?.(l)??l.laneDirAt(p.pos.x,p.pos.y,p.pos.z)??{x:0,z:-1},n=Math.hypot(f.x,f.z)||1;
  return d<.04?{}:{moveX:(dx*-f.z+dz*f.x)/d/n*pace,moveY:(dx*f.x+dz*f.z)/d/n*pace};
 };
 function* frames(n,input={}){for(let i=0;i<n;i++)yield typeof input==='function'?input():input;}
 function* until(done,input,label,limit=1800){
  report.stage=label;const start=r.frame;
  for(let i=0;i<limit&&!done();i++){
   yield typeof input==='function'?input():input;
   check(!['dead','gameover'].includes(p.state)&&(!p.isBailing||p.checkpointTripActive),label+' alive');
  }
  check(done(),label+' timed out');report.actions.push({label,start,end:r.frame});
 }
 const combat=()=>({spinPressed:r.frame%28===0});
 function* walk(s){
  yield* until(()=>progress()>=s-.22,()=>{
   const distance=s-progress(),next=Math.min(s,progress()+4);
   // Each head leaves the far verge open: steer around its telegraphed sweep.
   let u=0;for(const [station,side]of m.TRIBAL_RUN_AMBUSHES){const d=Math.abs(station-next);if(d<14)u=-side*4.6*Math.min(1,(14-d)/7);}
   return{...steer(at(next,m.tribalHeight(s),u),Math.min(.95,Math.max(.14,distance/3))),...combat()};
  },'Walk to bank '+s,12000);
  yield* frames(24);check(p.grounded,'bank has support');
 }
 const dist=q=>Math.hypot(q[0]-p.pos.x,q[2]-p.pos.z);
 function* hop(target,label,moverId){
  yield* frames(26,{jumpHeld:true});yield{jumpReleased:true};
  check(!p.grounded,'jump launched');
  let doubled=false;
  yield* until(()=>p.grounded,()=>{
   const q=target(),input=steer(q,Math.min(1,dist(q)/2));
   // A normal second press buys time to adjust to a moving receiver.
   if(!doubled&&p.vVel<1&&dist(q)>3){input.jumpHeld=true;input.jumpPressed=true;doubled=true;}
   return input;
  },label,180);
  if(moverId!==undefined)check(p.groundHit?.moverId===moverId,'landed on the moving deck');
 }
 yield* frames(24);check(p.grounded,'initial supported spawn');
 for(const cross of m.TRIBAL_RUN_CROSSINGS.slice(first,last+1)){
  yield* walk(cross.a-1.6);
  const movers=cross.movers.map(name=>l.movers.find(v=>r.source.components[v.mesh.userData.editorIdx]?.nm===name));
  check(movers.every(Boolean),'all crossing movers built');
  const d=m.tribalTangent((cross.a+cross.b)/2),start=r.frame;
  for(let i=0;i<movers.length;i++){
   const mover=movers[i],id=mover.mesh.userData.moverId;
   const aft=cross.kind==='orbit'?5.8:3.6;
   const target=()=>[mover.mesh.position.x-d[0]*aft,mover.mesh.position.y,mover.mesh.position.z-d[2]*aft];
   const forwardMotion=()=>mover.lastDelta.x*d[0]+mover.lastDelta.z*d[2];
   yield* until(()=>dist(target())<(cross.kind==='ferry'?7:8.8)&&forwardMotion()<.005&&mover.mesh.position.y<p.pos.y+1.5,{},cross.name+' wait for boarding',1400);
   yield* hop(target,cross.name+' board '+i,id);
   report.rides.push({name:cross.name,mover:id,kind:cross.kind,board:pose()});
   // Demonstrate actual carrying while hands are off the directional controls.
   const before=p.pos.clone();yield* frames(36);
   check(p.groundHit?.moverId===id,'ride retains moving support');
   report.rides.at(-1).carry=before.distanceTo(p.pos);
   if(i<movers.length-1){
    const front=()=>[mover.mesh.position.x+d[0]*4,mover.mesh.position.y,mover.mesh.position.z+d[2]*4];
    yield* until(()=>dist(front())<.35,()=>steer(front(),Math.min(.6,dist(front())/3)),cross.name+' walk to lift edge',600);
    yield* frames(18);continue;
   }
   const bank=at(cross.b+1.8,m.tribalHeight(cross.b));
   yield* until(()=>dist(bank)<8&&forwardMotion()>-.005&&mover.mesh.position.y>bank[1]-1.6,()=>{
    const front=cross.kind==='orbit'?5.5:3.2;
    const q=[mover.mesh.position.x+d[0]*front,mover.mesh.position.y,mover.mesh.position.z+d[2]*front];
    return steer(q,Math.min(.55,dist(q)/3));
   },cross.name+' ride to exit',1400);
   yield* hop(()=>bank,cross.name+' jump to fixed landing');
   check(progress()>cross.b&&p.groundHit?.moverId===undefined,'supported fixed exit');
  }
  report.rides.at(-1).exit=pose();report.rides.at(-1).seconds=(r.frame-start)/60;
 }
 if(finish){
  yield* walk(2292);
  yield* until(()=>p.state==='finished',()=>({...steer(at(2320,0)),...combat()}),'Finish gate',600);
 }
 return{...pose(),seconds:r.frame/60,checkpoints:l.checkpoints.filter(c=>c.active).length,crystal:p.hasCrystal};
}
