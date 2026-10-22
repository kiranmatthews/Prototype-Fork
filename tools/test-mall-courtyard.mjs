import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

// Section placements isolate the new courtyard geometry. Once placed, every
// climb, pop, return and grind uses the same controller samples as play.
await withBlockworksRuntime(async r=>{
 const {p,l,THREE,sourceModule:m,source}=r,report={returns:[],ledges:[],copings:[]},before=JSON.stringify(r.TUNING);
 const start=(s,u,y,d)=>{
  p.respawn(l,true,false,{position:new THREE.Vector3(...m.mallPoint(s,u,y)),heading:d});
  p.axisF.copy(d);p.axisL.set(-d.z,0,d.x);
 };
 for(const side of [-1,1])for(const pop of [false,true]){
  start(340,-side*6,.1,new THREE.Vector3(side,0,0));
  let entered=false,popped=false,air=0,contacts=0,peak=0,returned=false,bailed=false;
  const traceStart=r.trace.length;
  for(let i=0;i<500;i++){
   if(pop&&p.grounded&&p.groundHit?.vert&&p.rideNormal.y<.5)popped=true;
   r.tick({moveY:p.grounded?1:0,jumpHeld:!popped});
   peak=Math.max(peak,p.pos.y);bailed||=p.isBailing;
   if(p.grounded&&p.groundHit?.mesh?.userData.vertComp?.nm===`Courtyard ${side<0?'left':'right'} wall transition`){entered=true;contacts++;}
   if(entered&&!p.grounded)air++;
   if(air&&p.grounded&&p.axisF.x*side<-.3&&Math.abs(p.pos.x-108)<7&&p.pos.y<.3){returned=true;break;}
   if(bailed||p.state==='dead')break;
  }
  report.returns.push({side,pop,contacts,air,peak,returned,bailed,speed:p.speed,end:p.pos.toArray()});
  await writeFile(`/private/tmp/mall-recreation/courtyard-return-${side}-${pop?'pop':'roll'}-trace.json`,JSON.stringify(r.trace.slice(traceStart)));
 }
 for(const side of [-1,1])for(const direction of [-1,1]){
  start(direction>0?328:373,side*8.05,.15,new THREE.Vector3(0,0,-direction));
  let caught=0,bailed=false,landed=false,travel=0,last=null,firstS=null,lastS=null;
  const traceStart=r.trace.length;
  for(let i=0;i<950;i++){
   const grinding=p.state==='grind';
   r.tick({moveY:!grinding&&p.grounded?1:0,moveX:grinding?Math.max(-1,Math.min(1,-p.balance*8-p.balanceVel*1.8)):0,jumpHeld:true,grindHeld:true});
   bailed||=p.isBailing;
   if(p.state==='grind'&&source.components[p.grindRail.object.userData.editorIdx]?.nm==='Whole Atrium grind'){
    caught++;firstS??=104-p.pos.z;lastS=104-p.pos.z;
    if(last!==null)travel+=Math.abs(p.grindT-last);last=p.grindT;
   }else if(caught&&p.grounded){landed=true;break;}
   if(bailed||p.state==='dead')break;
  }
  report.ledges.push({side,direction,caught,travel,firstS,lastS,landed,bailed,end:p.pos.toArray()});
  await writeFile(`/private/tmp/mall-recreation/courtyard-ledge-${side}-${direction}-trace.json`,JSON.stringify(r.trace.slice(traceStart)));
 }
 // Catch the generated coping from a deck placement, hold it and ollie
 // inward. This is separate from the airs approached along each ledge.
 for(const side of [-1,1]){
  const name=`Courtyard ${side<0?'left':'right'} wall transition`;
  const rail=l.rails.find(v=>source.components[v.object.userData.editorIdx]?.nm===name);
  assert.ok(rail,'Each courtyard transition needs its real coping rail');
  const origin=rail.pointAt(2);origin.x-=side*.25;origin.y+=.12;
  const heading=rail.tangentAt(2);
  p.respawn(l,true,false,{position:origin,heading});p.axisF.copy(heading);p.axisL.set(-heading.z,0,heading.x);
  let caught=0,travel=0,last=null,popped=false,landed=false,bailed=false;
  const traceStart=r.trace.length;
  for(let i=0;i<600;i++){
   let moveX=0,moveY=p.grounded?1:0,jumpHeld=true,grindHeld=!popped;
   if(p.state==='grind'){
    moveX=Math.max(-1,Math.min(1,-p.balance*8-p.balanceVel*1.8));moveY=0;
    if(travel>18.85){const f=p.camDir,n=Math.hypot(f.x,f.z)||1;moveX=-side*.35*-f.z/n;moveY=-side*.35*f.x/n;}
    if(travel>19){jumpHeld=false;grindHeld=false;popped=true;}
   }
   r.tick({moveX,moveY,jumpHeld,grindHeld});bailed||=p.isBailing;
   if(p.state==='grind'&&p.grindRail===rail){caught++;if(last!==null)travel+=Math.abs(p.grindT-last);last=p.grindT;}
   if(popped&&p.grounded){landed=true;break;}
   if(bailed||p.state==='dead')break;
  }
  report.copings.push({side,length:rail.totalLength,caught,travel,popped,landed,bailed,end:p.pos.toArray(),landingSurface:p.groundHit?.name});
  await writeFile(`/private/tmp/mall-recreation/courtyard-coping-${side}-trace.json`,JSON.stringify(r.trace.slice(traceStart)));
 }
 report.tuningUnchanged=before===JSON.stringify(r.TUNING);
 await writeFile('/private/tmp/mall-recreation/courtyard.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 assert.ok(report.returns.every(v=>v.contacts>=8&&v.air>=20&&v.peak>3&&!v.bailed&&v.returned&&v.speed>12),'Both courtyard walls must support ordinary and charged airs followed by a useful return to the inner aisle');
 assert.ok(report.ledges.every(v=>v.travel>38&&v.caught>80&&v.landed&&!v.bailed),'Both ledges must grind past both planters in either direction and return to ground');
 assert.ok(report.copings.every(v=>v.length>43&&v.caught>80&&v.travel>19&&v.popped&&v.landed&&!v.bailed),'Both wall copings must support a sustained grind and an ollie back into the court');assert.ok(report.tuningUnchanged);
},{modulePath:'/src/levels/mall.ts',source:m=>m.MALL_LEVEL,levelId:'mall',endlessDeaths:true,maxFrames:8000,controlFrame:r=>r.p.axisF});
