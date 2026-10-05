const direction=(p,l,x,z)=>{
 const f=p.courseInputDirection(l)??p.camDir,n=Math.hypot(x,z)||1,fn=Math.hypot(f.x,f.z)||1;
 return {moveX:(x*-f.z+z*f.x)/n/fn,moveY:(x*f.x+z*f.z)/n/fn};
};
const toward=(p,l,q)=>direction(p,l,q[0]-p.pos.x,q[2]-p.pos.z);
const position=p=>p.pos.toArray();

export function createAfterHoursFreightPilot() {
 let jump=0,air=null,brake=false;
 const evidence={launches:[],landings:[],complete:false};
 return {evidence,sample(p,l){
  let target=jump===0?[7.5,10,-42]:jump===1?[-6,12,-80]:[-8,12,-92],jumpHeld=true;
  if(jump===0&&p.grounded&&p.pos.z<-21.9||jump===1&&p.grounded&&p.pos.z<-57.2){
   jumpHeld=false;air={index:jump,start:position(p),peak:p.pos.y,airborne:false};jump++;evidence.launches.push({...air});
  }
  if(jump===2&&evidence.landings.length===2&&p.grounded&&p.pos.z<-80){if(p.speed>14.5)brake=true;if(p.speed<12.5)brake=false;}
  return {...toward(p,l,target),jumpHeld,grabHeld:brake};
 },observe(p){
  if(air){air.peak=Math.max(air.peak,p.pos.y);air.airborne||=!p.grounded;
   if(air.airborne&&p.grounded){evidence.landings.push({...air,end:position(p)});air=null;}}
  evidence.complete=jump===2&&p.grounded&&p.pos.z<-88;
 }};
}

export function createAfterHoursCutbackPilot(source) {
 const path=source.AFTER_HOURS_CUTBACK_PATH;let cursor=0,brake=false;
 const evidence={complete:false,brakeFrames:0,lateral:0,last:null};
 return {evidence,sample(p,l){
  let best=Infinity;
  for(let j=cursor;j<Math.min(path.length,cursor+50);j++){const d=Math.hypot(path[j][0]-p.pos.x,path[j][2]-p.pos.z);if(d<best){best=d;cursor=j;}}
  let target=path[cursor],look=0;
  for(let j=cursor+1;j<path.length;j++){look+=Math.hypot(path[j][0]-path[j-1][0],path[j][2]-path[j-1][2]);target=path[j];if(look>=6)break;}
  if(cursor>path.length-5)target=[20,14,-279];
  if(p.speed>14.5)brake=true;if(p.speed<12.5)brake=false;
  evidence.brakeFrames+=brake;
  return {...toward(p,l,target),jumpHeld:true,grabHeld:brake};
 },observe(p){
  if(evidence.last)evidence.lateral+=Math.abs(p.pos.x-evidence.last[0]);evidence.last=position(p);
  evidence.complete=p.grounded&&p.pos.z<-278&&Math.abs(p.pos.x-20)<3;
 }};
}

export function createAfterHoursWorkbayPilot() {
 const path=[[114,14,-390],[116.5,14,-416.6],[116.5,14,-421],[116.5,14,-426],[111.5,14,-439.6],[111.5,14,-448],[111.5,14,-452],[117,14,-459],[114,14,-479]];
 let cursor=0,reframe=true,setup='brake',bootstrap=null;const evidence={complete:false,points:[],setupFrames:0,pendulumChoices:[]};
 return {evidence,sample(p,l){
  bootstrap??=!p.boardRolling;
  if(reframe){reframe=false;return {moveX:0,moveY:0,jumpHeld:p.charging};}
  if(bootstrap){
   if(!p.boardRolling||p.speed<12)return {...toward(p,l,[114,14,-400]),jumpHeld:true};
   bootstrap=false;setup='north';
  }
  if(setup!=='done'){
   evidence.setupFrames++;
   if(p.state==='air')return {};
   if(setup==='brake'){
    if(p.speed>13)return {jumpHeld:false,grabHeld:true};
    setup='turn';
   }
   if(setup==='turn'){
    if(p.boardRolling&&Math.hypot(p.pos.x-114,p.pos.z+386)<3)setup='north';
    else {
     // One real Circle stop gives room for the ground turn. Then coast at
     // the authored cruise speed so charging cannot repeatedly widen it.
     const input=toward(p,l,[114,14,-386]);
     return {moveX:input.moveX*.55,moveY:input.moveY*.55,jumpHeld:!p.boardRolling};
    }
   }
   if(setup==='north'){
    if(p.grounded&&p.pos.z<-388&&Math.abs(p.pos.x-114)<3.2&&p.axisF.z<-.93)setup='done';
    else {const input=toward(p,l,[114,14,-400]);return {moveX:input.moveX*.55,moveY:input.moveY*.55,jumpHeld:false};}
   }
  }
  while(cursor<path.length-1&&p.pos.z<=path[cursor][2]+2){evidence.points.push({index:cursor,at:position(p)});cursor++;}
  const pendulumIndex=cursor===2?0:cursor===5?1:null;
  if(pendulumIndex!==null&&!evidence.pendulumChoices.some(choice=>choice.index===pendulumIndex)){
   const bob=l.pendulums[pendulumIndex],eta=Math.max(0,p.pos.z-bob.pivot.position.z)/Math.max(1,p.speed);
   const angle=Math.sin((l.time+eta)*bob.speed+bob.phase)*bob.amp;
   const predictedX=bob.pivot.position.x+Math.sin(angle)*bob.len;
   const lane=predictedX>bob.pivot.position.x?110.8:117.2;
   path[cursor][0]=lane;path[cursor+1][0]=lane;
   evidence.pendulumChoices.push({index:pendulumIndex,time:l.time,predictedX,lane,position:position(p)});
  }
  const q=path[cursor];
  const spinHeld=l.enemies.some(enemy=>enemy.alive&&Math.hypot(p.pos.x-enemy.group.position.x,p.pos.z-enemy.group.position.z)<4.5);
  return {...toward(p,l,q),jumpHeld:false,spinHeld};
 },observe(p){evidence.complete=p.grounded&&p.boardRolling&&p.pos.z<-477&&Math.abs(p.pos.x-114)<5;}};
}

export function createAfterHoursCrownPilot() {
 let jump=0,air=null,brake=false,reading=false;const evidence={complete:false,launches:[],landings:[]};
 return {evidence,sample(p,l){
  const z=p.pos.z;let q,jumpHeld=true;
  if(jump===0){q=[99.5,22,-525];if(p.grounded&&z<-517.5){jumpHeld=false;air={index:0,start:position(p),peak:p.pos.y,airborne:false};jump=1;evidence.launches.push({...air});}}
  else if(jump===1){q=p.grounded?(z>-541.5?[96,24,-543]:[120,34,-590]):[95,24,-537];if(p.grounded&&z<-570.5){jumpHeld=false;air={index:1,start:position(p),peak:p.pos.y,airborne:false};jump=2;evidence.launches.push({...air});}}
  else q=[120,34,-600];
  if(jump===2){
   // Keep the real release through flight. On the receiving island one
   // brake then a coasting turn returns through the final checkpoint.
   jumpHeld=false;
   if(evidence.landings.length===2&&p.grounded){
    if(!reading&&p.speed>13)brake=true;
    else {reading=true;brake=false;}
    const input=toward(p,l,q);
    return {moveX:input.moveX*.55,moveY:input.moveY*.55,jumpHeld:false,grabHeld:brake};
   }
  }
  return {...toward(p,l,q),jumpHeld,grabHeld:brake};
 },observe(p){
  if(air){air.peak=Math.max(air.peak,p.pos.y);air.airborne||=!p.grounded;
   if(air.airborne&&p.grounded){evidence.landings.push({...air,end:position(p)});air=null;}}
  evidence.complete=jump===2&&evidence.landings.length===2&&p.grounded&&Math.abs(p.pos.x-120)<2.5&&p.pos.z<-591&&p.pos.z>-598&&p.axisF.z<-.9&&p.speed>0&&p.speed<=13&&p.boardRolling;
 }};
}
