/** Main-course device input shared by native physics and Chrome. Nothing in
 * this controller changes player position, velocity, world time or tuning. */
export function* runTribalJourney(r,{phase='all',upper=false}={}){
 const {p,l,sourceModule:m}=r,report=r.report??(r.report={actions:[],evidence:[]}),at=m.tribalPoint;
 const progress=()=>m.tribalProgress(p.pos);
 const pose=()=>({frame:r.frame,s:progress(),p:p.pos.toArray(),state:p.state,grounded:p.grounded,bailing:p.isBailing,deaths:p.totalDeaths,speed:p.speed});
 const check=(yes,label)=>{if(!yes)throw Error(label+': '+JSON.stringify(pose()));};
 const alive=label=>check(!p.isBailing&&!['dead','gameover'].includes(p.state),label);
 const steer=(target,pace=1)=>{
  const dx=target[0]-p.pos.x,dz=target[2]-p.pos.z,d=Math.hypot(dx,dz),f=l.laneDirAt(p.pos.x,p.pos.y,p.pos.z)??{x:0,z:-1},n=Math.hypot(f.x,f.z)||1;
  return d<.02?{}:{moveX:(dx*-f.z+dz*f.x)/d/n*pace,moveY:(dx*f.x+dz*f.z)/d/n*pace};
 };
 function* tick(sample={}){yield sample;}
 function* stepFor(n,sample={}){for(let i=0;i<n;i++)yield typeof sample==='function'?sample():sample;}
 function* until(predicate,input={},label='advance',limit=3000){
  report.stage=label;const first=r.frame;
  for(let i=0;i<limit&&!predicate();i++){yield typeof input==='function'?input():input;alive(label);}
  check(predicate(),label+' timed out');report.actions.push({label,first,last:r.frame});
 }
 function* skate(to,u=0){
  yield* until(()=>progress()>=to,()=>{
   const s=Math.min(to,progress()+8),offset=typeof u==='function'?u(s):u;
   const nearCheckpoint=l.checkpoints.some(c=>!c.active&&p.pos.distanceTo(c.spawnPos)<2.8);
   return{...steer(at(s,0,offset)),jumpHeld:true,spinHeld:nearCheckpoint};
  },'skate to '+to,18000);
 }
 function* brake(){
  yield* until(()=>!p.freeSkate&&Math.abs(p.speed)<.1,{grabHeld:true,jumpHeld:true},'brake to walking',240);
  yield* stepFor(2);yield* until(()=>p.grounded,{},'settle the released charge',180);yield* stepFor(24);
 }
 function* walk(s,y=0,u=0){
  const target=at(s,y,u),distance=()=>Math.hypot(target[0]-p.pos.x,target[2]-p.pos.z);
  yield* until(()=>distance()<.18,()=>{check(p.grounded,'walk has supported ground');return steer(target,.15+.5*Math.min(1,Math.max(0,(distance()-.5)/2)));},'walk to '+s,3200);
  yield* stepFor(18);check(p.grounded&&distance()<.5,'supported walking stop');
 }
 function* hop(s,y=0,u=0){
  const target=at(s,y,u),before=pose();yield* stepFor(26,{jumpHeld:true});yield {jumpReleased:true};
  check(p.state==='air','jump launched');yield* until(()=>p.grounded,()=>steer(target),'hop to '+s,180);
  check(Math.abs(p.pos.y-y)<.16&&Math.hypot(target[0]-p.pos.x,target[2]-p.pos.z)<2,'landed on the intended drum');
  report.evidence.push({action:'drum hop',before,after:pose()});
 }
 function* skatingGap(a,b,y,u=0){
  yield* skate(a-3,u);const before=pose();yield {...steer(at(b+6,y,u)),jumpReleased:true};
  yield* until(()=>p.grounded,()=>steer(at(b+8,y,u)),'skating gap '+a,180);
  check(progress()>b,'gap reached the receiver');report.evidence.push({action:'skating gap',a,b,before,after:pose()});
 }
 function* steps(name,y){
  yield* brake();const specs=m.TRIBAL_RUN_STEPS.filter(s=>s.name===name);
  for(let i=0;i<specs.length;i++){
   const q=specs[i],prev=specs[i-1];yield* walk(prev?prev.b-.65:q.a-2.7,prev?.top??y);yield* hop(q.a+1.1,q.top);
  }
 }
 const chapter=name=>report.evidence.push({chapter:name,...pose()});
 yield* stepFor(24);check(p.grounded,'source spawn is supported');
 if(phase==='opening'||phase==='all'){
  yield* skatingGap(176,182,0);yield* skate(292);yield* steps('Offbeat drum crown',0);
  yield* walk(378.1,4.4);yield* hop(382.3,4.4);yield* skate(515);chapter('Gathering Ground and Offbeat Steps');
 }
 if(phase==='basins'||phase==='all'){
  yield* skatingGap(676,683,-3);yield* skate(902);yield* brake();chapter('Crescent Basins');
 }
 if(phase==='loom'||phase==='all'){
  yield* steps('Great Drum Court optional crowns',0);
  yield* skate(1070);chapter('Great Drum Court upper gallery');
  const braid=m.tribalBraid(upper?-1:1),y=upper?m.tribalLoomHeight(1166):0,a=upper?1162:1245,b=upper?1170:1250;
  yield* skate(a-3,braid);yield {...steer(at(b+6,y,braid(b+6))),jumpReleased:true};
  yield* until(()=>p.grounded,()=>{const s=progress()+7;return steer(at(s,y,braid(s)));},upper?'upper woven leap':'lower woven hop',180);
  check(progress()>b&&Math.abs(p.pos.y-y)<.2,'woven hop landed on its chosen ribbon');
  yield* skate(1405,braid);chapter('Great Drum Court and Canopy Loom');
 }
 if(phase==='stair'||phase==='all'){
  yield* steps('Sunken stair drum',0);yield* walk(1495.1,4.8);yield* hop(1499.1,4.8);yield* skate(1650);chapter('Sunken Stair');
 }
 if(phase==='finale'||phase==='all'){
  yield* skate(2048,s=>s>1740&&s<1785?4.8:s>1860&&s<1910?-4.8:0);
  yield* steps('Last chorus drum',-1);yield* walk(2122.1,2.3);yield* hop(2126.1,2.3);
  yield* skatingGap(2235,2243,0);yield* skate(2305);
  yield* until(()=>p.state==='finished',()=>({...steer(at(2320)),jumpHeld:true}),'finish gate',240);chapter('Echo Bowls and Last Chorus');
 }
 return{...pose(),checkpoints:l.checkpoints.filter(c=>c.active).length,checkpointTotal:l.checkpoints.length,crystal:p.hasCrystal};
}
