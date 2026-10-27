/** Recovery and optional-route scenarios. Each has one declared setup placement;
 * all movement after that is ordinary input. Used by Chrome's normal RAF loop. */
export function* runTribalVariants(r,{selected}={}){
 const {p,l,sourceModule:m}=r,at=m.tribalPoint,progress=()=>m.tribalProgress(p.pos),rows=[];
 const pose=()=>({frame:r.frame,s:progress(),position:p.pos.toArray(),state:p.state,grounded:p.grounded,bailing:p.isBailing,lives:p.lives,speed:p.speed,rail:l.rails.indexOf(p.grindRail)});
 const check=(v,label)=>{if(!v)throw Error(label+': '+JSON.stringify(pose()));};
 const steer=(q)=>{const dx=q[0]-p.pos.x,dz=q[2]-p.pos.z,n=Math.hypot(dx,dz)||1,f=l.laneDirAt(p.pos.x,p.pos.y,p.pos.z);
  return{moveX:(dx*-f.z+dz*f.x)/n,moveY:(dx*f.x+dz*f.z)/n};};
 function* stepFor(n,input={}){for(let i=0;i<n;i++)yield input;}
 function* until(done,input,label,limit=2400,allowDeath=false){
  r.report.stage=label;const first=r.frame;
  for(let i=0;i<limit&&!done();i++){yield typeof input==='function'?input():input;if(!allowDeath)check(!p.isBailing&&!['dead','gameover'].includes(p.state),label);}
  check(done(),label+' timed out');r.report.actions.push({label,first,last:r.frame});
 }
 function* setup(s,y,u=0){
  const point=at(s,y+.12,u),heading=m.tribalTangent(s);
  p.respawn(l,true,false,{position:p.pos.clone().set(...point),heading:p.pos.clone().set(...heading)});
  r.report.evidence.push({action:'scenario setup before input',station:s,point,heading,frame:r.frame});
  yield* stepFor(24);check(p.grounded,'supported scenario start');
 }
 function* skate(to,u=0){yield* until(()=>progress()>=to,()=>{const s=Math.min(to,progress()+7);return{...steer(at(s,0,typeof u==='function'?u(s):u)),jumpHeld:true};},'skate to '+to,12000);}
 function* grindUntil(done,label,approach){yield* until(done,()=>({...(p.state==='grind'?{moveX:Math.max(-1,Math.min(1,-p.balance*5-p.balanceVel*.7)),moveY:1}:approach?.()??{moveY:1}),grindHeld:true}),label);}
 const scenarios=[
 ['offbeat-recovery',function*(){
  yield* setup(309.9,0);yield* stepFor(26,{jumpHeld:true});yield{jumpReleased:true};
  yield* until(()=>p.grounded,()=>steer(at(319,-4.5,10.2)),'miss the crown into its recovery court',180);
  check(Math.abs(p.pos.y+4.5)<.1,'lower court catches the missed jump');r.report.evidence.push({action:'recovery catch',...pose()});
  const u=s=>s<480?10.2:10.2*(1-Math.min(1,(s-480)/25));yield* skate(515,u);
  check(p.grounded&&Math.abs(p.pos.y)<.1,'recovery lane rejoins supported main road');
 }],
 ['court-lower-line',function*(){
  yield* setup(902,0,-6);
  yield* skate(1070,s=>s<913?-6-5.8*Math.min(1,(s-902)/11):s<1035?-11.8:-11.8*(1-Math.min(1,(s-1035)/35)));
  check(p.grounded&&Math.abs(p.pos.y)<.1,'continuous lower court line');
 }],
 ['checkpoint-pit-return',function*(){
  yield* setup(237,0);
  yield* until(()=>!!l.activeCheckpoint,()=>({...steer(at(260)),jumpHeld:true,spinHeld:p.pos.distanceTo(l.checkpoints[0].spawnPos)<2.8}),'bank checkpoint with an attack',300);
  const bank=l.activeCheckpoint.spawnPos.clone();
  yield* until(()=>p.state==='dead',()=>({...steer(at(275,0,30)),jumpHeld:true}),'fall into the visible basin',360,true);
  r.report.evidence.push({action:'pit death',...pose()});
  yield* until(()=>p.state==='ride'&&p.grounded,{},'native checkpoint return',360,true);
  check(p.lives===3&&p.pos.distanceTo(bank)<1.5,'one lost life and correct supported return');
 }],
 ];
 const railCases=[
  {name:'offbeat-grind',from:260,y:0,u:()=>-4,launch:296,a:299,b:424,after:440},
  {name:'crescent-grind',from:689,y:-3,u:()=>5.8,launch:706,a:709,b:794,after:817},
  {name:'loom-grind',from:1102,y:0,u:s=>m.tribalBraid(-1)(s)-2.4,launch:1142,a:1145,b:1290,after:1310},
  {name:'echo-grind',from:1805,y:1.2,u:()=>-6.2,launch:1819,a:1822,b:1924,after:1940},
 ];
 for(const [index,c]of railCases.entries())scenarios.push([c.name,function*(){
  yield* setup(c.from,c.y,c.u(c.from));yield* skate(c.launch,c.u);const launch=pose();
  yield{...steer(at(c.a+6,0,c.u(c.a+6))),jumpReleased:true};
  yield* until(()=>p.pos.y>launch.position[1]+.7&&progress()>c.a+.6,()=>steer(at(c.a+6,0,c.u(c.a+6))),'ollie over the rail start',60);
  yield* grindUntil(()=>p.state==='grind',c.name+' catch',()=>steer(at(c.a+10,0,c.u(c.a+10))));
  check(p.grindRail===l.rails[index],'catch the intended authored rail');r.report.evidence.push({action:c.name+' caught',...pose()});
  yield* grindUntil(()=>progress()>c.b-1,c.name+' full ride');
  yield* until(()=>p.grounded&&p.state==='ride',()=>({...steer(at(c.after,0,c.u(c.after))),grindHeld:true}),c.name+' end landing',240);
  check(p.lives===4&&!p.isBailing,'safe optional rail landing');
 }]);
 for(const [name,run]of scenarios){
  if(selected&&name!==selected)continue;
  const first=r.frame;try{yield* run();rows.push({name,pass:true,first,last:r.frame,end:pose()});}
  catch(error){rows.push({name,pass:false,first,last:r.frame,error:error.message,end:pose()});}
  r.report.scenarios=[...rows];
 }
 check(rows.length>0,'scenario exists');
 check(rows.every(row=>row.pass),rows.filter(row=>!row.pass).map(row=>row.name+': '+row.error).join('\n'));
 return{scenarios:rows,state:p.state};
}
