/** One input-only traversal used by native physics and the browser review. */
export function* runTribalRebuild(r,{first=0,last=r.sourceModule.TRIBAL_RUN_CROSSINGS.length-1,finish=true}={}){
 const {p,l,sourceModule:m}=r,at=m.tribalPoint,s=()=>m.tribalProgress(p.pos),report=r.report??(r.report={});
 report.rides??=[];report.actions??=[];report.rails??=[];report.jumps??=[];
 const pose=()=>({frame:r.frame,s:s(),position:p.pos.toArray(),state:p.state,grounded:p.grounded,mover:p.groundHit?.moverId,deaths:p.totalDeaths});
 const check=(ok,msg)=>{if(!ok)throw Error(msg+': '+JSON.stringify(pose()));};
 const distance=q=>Math.hypot(q[0]-p.pos.x,q[2]-p.pos.z);
 const steer=(q,pace=1)=>{const dx=q[0]-p.pos.x,dz=q[2]-p.pos.z,d=Math.hypot(dx,dz),f=p.courseInputDirection(l)??{x:0,z:-1},n=Math.hypot(f.x,f.z)||1;
  return d<.04?{}:{moveX:(-dx*f.z+dz*f.x)/d/n*pace,moveY:(dx*f.x+dz*f.z)/d/n*pace};};
 function* frames(n,input={}){for(let i=0;i<n;i++)yield typeof input==='function'?input():input;}
 function* until(done,input,label,limit=1800){report.stage=label;const start=r.frame;
  for(let i=0;i<limit&&!done();i++){yield typeof input==='function'?input():input;check(!['dead','gameover'].includes(p.state)&&(!p.isBailing||p.checkpointTripActive),label+' alive');}
  check(done(),label+' timed out');report.actions.push({label,start,end:r.frame});}
 const combat=()=>({spinPressed:r.frame%8===0&&(
  l.enemies.some(e=>e.alive&&e.group.position.distanceTo(p.pos)<4)||
  l.crates.some(c=>c.alive&&c.mesh.position.distanceTo(p.pos)<3.5)||
  m.TRIBAL_RUN_CHECKPOINTS.some(c=>distance(at(c.s,c.y,c.u))<3.5))});
 const route=(station)=>at(station,m.tribalHeight(station),m.tribalOffset(station));
 function* walk(to){
  yield* until(()=>s()>=to-.18,()=>{
   const remaining=to-s(),next=Math.min(to,s()+4);let u=m.tribalOffset(next);
   for(const [station,side]of m.TRIBAL_RUN_AMBUSHES){const d=Math.abs(station-next);if(d<12)u-=side*3.7*Math.min(1,(12-d)/6);}
   return{...steer(at(next,m.tribalHeight(next),u),Math.min(.95,Math.max(.13,remaining/3))),...combat()};
  },'Follow climbing path to '+to,12000);yield* frames(22);check(p.grounded,'approach supported');
 }
 function* hop(target,label,id,runTo){
  const start=pose();
  if(runTo!==undefined){
   yield* until(()=>s()>runTo-5,()=>steer(target(),.9),label+' run up',180);
   yield* until(()=>s()>runTo-.9,()=>({...steer(target()),jumpHeld:true}),label+' running charge',120);
  }else{yield* frames(26,{jumpHeld:true});yield* frames(6,()=>({...steer(target()),jumpHeld:true}));}
  yield{...steer(target()),jumpReleased:true};check(!p.grounded,'charged jump launched');let doubled=false;
  yield* until(()=>p.grounded,()=>{const q=target(),input=steer(q,Math.min(1,distance(q)/1.8));
   if(!doubled&&p.vVel<2&&(distance(q)>2.2||q[1]+.6>p.pos.y-.5)){input.jumpHeld=true;input.jumpPressed=true;doubled=true;}return input;},label,180);
  if(id!==undefined)check(p.groundHit?.moverId===id,'jump reached intended moving drum');
  report.jumps.push({name:label,start,end:pose(),doubled});
 }
 yield* frames(24);check(p.grounded,'supported spawn');
 for(const cross of m.TRIBAL_RUN_CROSSINGS.slice(first,last+1)){
  yield* walk(cross.a-(cross.kind==='rail'?7:cross.kind==='jump'?8:1.8));
  if(cross.kind==='rail'){
   const rail=l.rails.find(rail=>rail.name===cross.rail||rail.object?.name===cross.rail);
   yield* until(()=>p.state==='grind',()=>({...steer(route(cross.a+2)),grindHeld:true}),cross.name+' catch',240);
   report.rails.push({name:cross.name,start:pose()});
   yield* until(()=>s()>cross.b+4.5,()=>p.state==='grind'?{grindHeld:true,moveX:Math.max(-1,Math.min(1,-p.balance*5-p.balanceVel*.7))}:{grindHeld:true},cross.name+' grind',1200);
   // In board air, the lateral stick spins the rider. Coast straight onto
   // the receiver before steering/braking, rather than throwing a late trick.
   yield* until(()=>p.grounded&&p.state!=='grind',{},cross.name+' landing',180);
   report.rails.at(-1).end=pose();
   yield* until(()=>!p.freeSkate&&Math.abs(p.speed)<.1,{grabHeld:true,jumpHeld:true},cross.name+' brake on dry runout',240);
   yield* frames(2);yield* until(()=>p.grounded,{},cross.name+' settle on runout',180);yield* frames(20);continue;
  }
  if(cross.kind==='jump'){
   yield* hop(()=>route(cross.b+7),cross.name,undefined,cross.a);check(s()>cross.b,'gap receiver reached');
   if(p.freeSkate){yield* until(()=>!p.freeSkate&&Math.abs(p.speed)<.1,{grabHeld:true,jumpHeld:true},cross.name+' landing brake',240);yield* frames(2);yield* until(()=>p.grounded,{},cross.name+' settle',180);}
   continue;
  }
  const movers=cross.movers.map(name=>l.movers.find(v=>r.source.components[v.mesh.userData.editorIdx]?.nm===name));check(movers.every(Boolean),'all moving drums exist');
  const d=m.tribalTangent((cross.a+cross.b)/2);
  for(let i=0;i<movers.length;i++){
   const mover=movers[i],id=mover.mesh.userData.moverId;
   const extent=(r.source.components[mover.mesh.userData.editorIdx]?.s?.[2]??12)/2;
   const target=()=>{
    const x=mover.mesh.position.x,z=mover.mesh.position.z,dx=x-p.pos.x,dz=z-p.pos.z,len=Math.hypot(dx,dz)||1;
    const inset=Math.min(2.7,extent-1.1);return[x-dx/len*inset,mover.mesh.position.y,z-dz/len*inset];
   };
   yield* until(()=>distance(target())<(cross.kind==='weave'?14:10)&&mover.mesh.position.y<p.pos.y+(cross.kind==='lifts'&&i>0?1.6:2.2),{},cross.name+' boarding window '+i,1600);
   yield* hop(target,cross.name+' board '+i,id);
   report.rides.push({name:cross.name,mover:id,board:pose()});
   const before=p.pos.clone();yield* frames(18);check(p.groundHit?.moverId===id,'moving support retained');report.rides.at(-1).carry=before.distanceTo(p.pos);
   const next=i+1<movers.length?()=>[movers[i+1].mesh.position.x,movers[i+1].mesh.position.y,movers[i+1].mesh.position.z]:()=>route(cross.b+2.4);
   const edge=()=>{const q=next(),dx=q[0]-mover.mesh.position.x,dz=q[2]-mover.mesh.position.z,len=Math.hypot(dx,dz)||1;
    const reach=Math.min(4.1,extent-1.1);return[mover.mesh.position.x+dx/len*reach,mover.mesh.position.y,mover.mesh.position.z+dz/len*reach];};
   yield* until(()=>distance(edge())<.4,()=>steer(edge(),Math.min(.6,distance(edge())/2.5)),cross.name+' cross moving deck '+i,600);yield* frames(14);
   if(i<movers.length-1)continue;
   const bank=next();yield* until(()=>distance(bank)<7.2&&mover.mesh.position.y>bank[1]-1.8&&(!['ferry','orbit'].includes(cross.kind)||mover.lastDelta.x*d[0]+mover.lastDelta.z*d[2]>-.002),()=>steer(edge(),Math.min(.45,distance(edge())/2.5)),cross.name+' exit window',1600);
   yield* hop(()=>bank,cross.name+' fixed landing');check(s()>cross.b,'fixed exit reached');report.rides.at(-1).exit=pose();
  }
 }
 if(finish){yield* walk(2292);yield* until(()=>p.state==='finished',()=>({...steer(at(2310,6)),...combat()}),'Festival finish',600);}
 return{...pose(),seconds:r.frame/60,checkpoints:l.checkpoints.filter(c=>c.active).length,crystal:p.hasCrystal};
}
