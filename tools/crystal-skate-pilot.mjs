/** Input-only skating routes. No position, velocity, collectible or tuning edits. */
function* runSkateSection(r, id, {finish=true, sectionOnly=false, entry, outgoingRail=false, handoffFrom=-Infinity}={}) {
 const {p,l,report}=r,o=r.offset??[0,0,0];
 const z=()=>p.pos.z-o[2],x=()=>p.pos.x-o[0];
 const pose=()=>({frame:r.frame,p:p.pos.toArray(),state:p.state,speed:p.speed,skate:p.freeSkate,ground:p.groundHit?.name});
 const check=(v,msg)=>{if(!v)throw Error(`${msg}: ${JSON.stringify(pose())}`);};
 const goal=r.goalToken??l.skateCollectathon.tokens.find(t=>Number(t.name.split('/')[0])===id);
 const switchesAtStart=l.crates.filter(c=>c.bangUsed).length;
 const gatesAtStart=l.trickGates.filter(g=>g.unlocked).length;
 const toward=(tx=0,tz=z()-18)=>{
  const desired=Math.atan2(tx-x(),tz-z()),heading=Math.atan2(p.axisF.x,p.axisF.z);
  const error=Math.atan2(Math.sin(desired-heading),Math.cos(desired-heading));
  return {moveY:1,moveX:Math.max(-1,Math.min(1,-error*3)),jumpHeld:true,skateRelative:true};
 };
 const balance=()=>({moveY:1,moveX:Math.max(-1,Math.min(1,-p.balance*5-p.balanceVel*.7)),grindHeld:true,jumpHeld:true,skateRelative:true});
 function* tick(s={}){yield {skateRelative:true,...s};check(!p.isBailing&&!['dead','gameover','hang','rope'].includes(p.state),'Line stopped or bailed');}
 function* until(test,input,label,limit=1800){
  report.stage=label;const start=r.frame;
  for(let n=0;n<limit&&!test();n++)yield* tick(typeof input==='function'?input():input);
  check(test(),`${label} timed out`);report.actions.push({name:label,firstFrame:start,lastFrame:r.frame,pose:pose()});
 }
 function* go(to,tx=0,extra={}){yield* until(()=>z()<=to,()=>({...toward(tx),...extra}),`Skate to ${to}`);}
 function* release(extra={}){yield* tick({moveY:1,jumpHeld:false,jumpReleased:true,...extra});}
 function* land(label='Roll onto the landing'){yield* until(()=>p.grounded||(outgoingRail&&z()<handoffFrom&&p.state==='grind'),()=>({moveY:1,jumpHeld:true,grindHeld:outgoingRail&&z()<handoffFrom}),label,240);}
 function* gap(edge,tx=0,extra={}){
  yield* go(edge,tx);report.evidence.push({action:'ollie',...pose()});yield* release({grindHeld:outgoingRail&&edge<handoffFrom,...extra});yield* land();
 }
 function* catchRail(at=-6,tx=0){
  yield* go(at,tx);yield* release({grindHeld:true});
  yield* until(()=>p.state==='grind',{moveY:1,grindHeld:true,jumpHeld:true},'Catch the authored rail',150);
  check(p.grindRail?.totalLength>35,'Caught an incidental edge');
  report.evidence.push({action:'rail catch',...pose(),length:p.grindRail.totalLength});
 }
 function* grind(to){yield* until(()=>z()<=to,balance,`Grind through ${to}`);}
 function* pop(to){yield* grind(to);report.evidence.push({action:'grind pop',...pose()});yield* release();yield* land('Land from the grind and keep rolling');}
 function* transfer(to,side){
  yield* grind(to);const from=p.grindRail;
  yield* tick({...balance(),moveX:side});yield* release({moveX:side});
  yield* tick({moveY:1,jumpHeld:true});
  yield* until(()=>p.state==='grind',{moveY:1,grindHeld:true,jumpHeld:true},'Catch the offset rail',180);
  check(p.grindRail!==from,'Transfer recaught the same rail');report.evidence.push({action:'rail transfer',...pose()});
 }
 if(!sectionOnly&&r.phaseWait)yield* until(()=>r.frame>=r.phaseWait,{grabHeld:true},'Observe the timing from the start');
 check(goal,'Missing crystal');
 const timingCycle=sectionOnly?undefined:({7:9,14:10,22:12,25:12})[id];
 if(timingCycle){
  if(z()>80)yield* go(80);
  yield* until(()=>Math.abs(p.speed)<.1,{grabHeld:true},'Observe the cycle on the wide approach');
  yield* until(()=>l.time%timingCycle<.035,{grabHeld:true},'Choose the next full skating window',900);
 }
 if(!entry)yield* go(20);
 if(id===5){
  yield* go(-38);
  let current=null,released=false;const airs=[];
  report.stage='Carve into the halfpipe and pump vert airs';
  for(let n=0;n<2400&&(!goal.collected||current);n++){
   const releaseAir=!current&&!released&&p.pos.y-o[1]>2&&p.groundHit?.normal.y<.45;
   const along=Math.max(-.4,Math.min(.4,(-54-z())*.08));
   const desired=Math.atan2(Math.sign(p.axisF.x)||1,along);
   const error=Math.atan2(Math.sin(desired-Math.atan2(p.axisF.x,p.axisF.z)),Math.cos(desired-Math.atan2(p.axisF.x,p.axisF.z)));
   const turn=p.grounded&&p.pos.y-o[1]<2?Math.max(-1,Math.min(1,-error*4)):0;
   yield* tick({moveX:turn,jumpHeld:current?p.vVel<0:!releaseAir&&!released,jumpReleased:releaseAir});
   if(releaseAir)released=true;
   if(!current&&!p.grounded&&(p.vertAir||p.pipeHang))current={side:Math.sign(x()),peak:p.pos.y,start:p.pos.toArray()};
   if(current){current.peak=Math.max(current.peak,p.pos.y);if(p.grounded){airs.push(current);current=null;released=false;}}
  }
  check(goal.collected,'Halfpipe air missed crystal');report.evidence.push({action:'pumped airs',airs});
  yield* until(()=>p.grounded&&Math.abs(x())<5,{jumpHeld:true},'Roll back into the flat',400);
  yield* go(-100);
 } else if([1,2,4,16].includes(id)){
  yield* gap(({1:-24,2:-26,4:-24,16:-28})[id]);
  if(id===4)yield* gap(-61);
 } else if([3,6,8,11,13,15,17,18,20,21,22,23,24,25].includes(id)){
  let aim=0;
  if(id===18&&!entry){
   yield* go(0);const moving=l.rails.find(q=>q.totalLength>80);aim=moving?.points?.[0]?.x??0;
  }
  if(!entry)yield* catchRail(id===13?-12:-6,aim);
  else {check(p.state==='grind'&&p.grindRail?.totalLength>35,'The previous air did not hand off to this rail');report.evidence.push({action:'air-to-rail handoff',...pose()});}
  if(id===11){yield* transfer(-46,1);yield* transfer(-96,-1);yield* pop(-146);}
  else if(id===13){yield* transfer(-46,1);yield* pop(-100);}
  else if(id===24){yield* transfer(-46,1);yield* pop(-100);yield* go(sectionOnly?-142:-126,-3);yield* go(sectionOnly?-161:-145,-3);yield* go(sectionOnly?-177:-161);yield* gap(sectionOnly?-192:-176);}
  else if([8,15,25].includes(id)){
   yield* pop(-68);check(l.crates.filter(c=>c.bangUsed).length>switchesAtStart,'Grind did not hit the switch');
   if(id===25){yield* go(-155);yield* go(-168);yield* release();yield* tick({spinHeld:true,spinPressed:true});yield* land();yield* gap(-216);check(l.trickGates.filter(g=>g.unlocked).length>gatesAtStart,'Kickflip gate did not unlock');}
   else yield* gap(-108);
  } else if(id===17){yield* pop(-68);yield* go(sectionOnly?-104:-90,6);yield* go(sectionOnly?-124:-108,6);yield* go(sectionOnly?-138:-122);yield* gap(sectionOnly?-152:-136);}
  else if(id===20){yield* pop(-54);yield* catchRail(-82);yield* pop(-136);yield* gap(-182);check(l.crates.filter(c=>c.bangUsed).length>=switchesAtStart+2,'Both switches must activate');}
  else if(id===21){yield* pop(-64);yield* go(-116);yield* release();yield* tick({spinHeld:true,spinPressed:true});yield* land();check(l.trickGates.filter(g=>g.unlocked).length>gatesAtStart,'Kickflip gate did not unlock');}
  else if(id===22){yield* pop(-68);yield* gap(-120);}
  else if(id===23){yield* pop(-62);yield* go(-126);yield* release({grindHeld:true});yield* until(()=>p.state==='grind',{moveY:1,grindHeld:true,jumpHeld:true},'Catch the high rail',180);yield* pop(-180);}
  else yield* pop(({3:-86,6:-82,18:sectionOnly?(r.movingRailPop??-89):-86})[id]);
 } else if([7,14,19].includes(id)){
  yield* gap(-60);if(id!==7)yield* gap(-104);
 } else if(id===9){
  yield* go(-25,-6);yield* go(-46,-6);yield* go(-73,-4);yield* go(-88);yield* gap(-104);
 } else if(id===10){
  yield* gap(-24);yield* gap(-96);
 } else if(id===12){
  yield* go(-20);yield* release();yield* until(()=>p.trampolineLaunchId>0,()=>toward(),'Ollie onto the spring while rolling',150);
  let rebounded=false;
  yield* until(()=>{rebounded ||= z()<-60&&p.vVel>15;return outgoingRail?p.state==='grind':z()<-108&&p.grounded;},
    ()=>({...toward(),grindHeld:outgoingRail&&z()<-80}),'Bounce from the airborne row into the next skating line',300);
  check(rebounded,'The airborne bounce row was not used');report.evidence.push({action:'airborne row rebound',...pose()});
 }
 if(sectionOnly)return {kind:id,position:p.pos.toArray(),board:p.freeSkate};
 yield* go(r.trial.exit[2]+20);
 check(goal.collected,'Rolling line missed its crystal');
 check(p.freeSkate,'The route dismounted');
 check(l.checkpoints.some(cp=>cp.active),'Rolling approach missed checkpoint');
 report.evidence.push({action:'rolling runout',...pose()});
 if(finish){yield* go(r.trial.exit[2]+10);yield* release();yield* until(()=>p.state==='finished',()=>toward(),'Ollie into the unlocked exit',240);}
 return {id,position:p.pos.toArray(),collected:goal.collected,board:p.freeSkate};
}


/** A complete secret-tape sequence, with one start and one final collectible. */
export function* runSkateTrial(r,id,{finish=true}={}) {
 if(!r.trial.skateSections)return yield* runSkateSection(r,id,{finish});
 const {p,l,trial,report}=r,o=r.offset??[0,0,0];
 const goal=l.skateCollectathon.tokens.find(t=>Number(t.name.split('/')[0])===id);
 const cycles=[...new Set(trial.components.filter(c=>c.t==='phasepad').map(c=>c.cycle))];
 const toward=()=>{
  const delta=Math.atan2(o[0]-p.pos.x,-18)-Math.atan2(p.axisF.x,p.axisF.z);
  const error=Math.atan2(Math.sin(delta),Math.cos(delta));
  return {moveY:1,moveX:Math.max(-1,Math.min(1,-error*3)),jumpHeld:true,skateRelative:true};
 };
 function* until(test,input,label,limit=4000){
  report.stage=label;const firstFrame=r.frame;
  for(let n=0;n<limit&&!test();n++){
   yield typeof input==='function'?input():input;
   if(p.isBailing||['dead','hang','rope','gameover'].includes(p.state))throw Error(`${label}: ${JSON.stringify({p:p.pos.toArray(),state:p.state,speed:p.speed})}`);
  }
  if(!test())throw Error(`${label} timed out`);
  report.actions.push({name:label,firstFrame,lastFrame:r.frame});
 }
 if(p.pos.z-o[2]>100){
  yield* until(()=>p.pos.z-o[2]<100,toward,'Roll toward the next challenge');
  // A normal setup ollie renews the held charge after long vert returns.
  yield {moveY:1,jumpReleased:true,skateRelative:true};
 }
 if(!cycles.length && r.phaseWait){
  const start=r.frame;
  yield* until(()=>r.frame>=start+r.phaseWait,{grabHeld:true,jumpHeld:true,skateRelative:true},'Observe the moving line before setting off');
 }
 if(cycles.length){
  if(p.pos.z-o[2]>65)yield* until(()=>p.pos.z-o[2]<65,toward,'Reach the wide observation bank');
  yield* until(()=>p.grounded,{moveY:1,jumpHeld:true,skateRelative:true},'Land the rolling approach before braking');
  yield* until(()=>Math.abs(p.speed)<.1,{grabHeld:true,jumpHeld:true,skateRelative:true},'Choose a timing window before committing');
  if(r.phaseWait){const frame=r.frame;yield* until(()=>r.frame>=frame+r.phaseWait,{grabHeld:true,skateRelative:true},'Observe a full cycle');}
  yield* until(()=>l.time%cycles[0]<.035,{grabHeld:true,skateRelative:true},'Start the continuous timed sequence',900);
 }
 report.sections=[];
 for(const [index,section] of trial.skateSections.entries()){
  const local={kind:section.kind,entry:section.entry,actions:[],evidence:[],firstFrame:r.frame};
  report.sections.push(local);
  const offset=section.origin.map((v,axis)=>v+o[axis]);
  const incoming=trial.skateSections[index+1];
  const handoffFrom=incoming?.entry==='air'?incoming.origin[2]-section.origin[2]+12:-Infinity;
  yield* runSkateSection({...r,offset,goalToken:goal,report:local,get frame(){return r.frame;}},section.kind,
    {sectionOnly:true,entry:section.entry,outgoingRail:section.outgoingRail,handoffFrom});
  local.lastFrame=r.frame;local.passed=true;
 }
 yield* until(()=>p.pos.z-o[2]<trial.exit[2]+20,toward,'Roll off the final roof onto the recovery floor');
 if(!goal.collected)throw Error('The final crystal was not retrieved');
 if(!p.freeSkate)throw Error('The sequence left the skateboard');
 if(!l.checkpoints.some(cp=>cp.active))throw Error('The start checkpoint was not banked');
 report.evidence.push({action:'complete linked sequence',p:p.pos.toArray(),speed:p.speed});
 if(finish){
  yield* until(()=>p.state==='finished',toward,'Ride onto the unlocked exit',240);
  if(!p.grounded||!p.groundHit?.finishPad)throw Error('The rolling finish missed the pad surface');
 }
 return {id,sections:report.sections.length,position:p.pos.toArray(),collected:goal.collected,board:p.freeSkate};
}
