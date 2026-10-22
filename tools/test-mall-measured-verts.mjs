import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const {p,l,THREE,sourceModule:m}=r,report=[];
 const fixtures=[{name:'Courtyard north wall',p:[9000,-1512,5700],direction:[-1,0,0]},{name:'Courtyard south wall',p:[9000,-1512,5900],direction:[1,0,0]},{name:'Atrium curved wall',p:[-3300,-270,-220],direction:[-.258819,0,-.965926]}];
 for(const fixture of fixtures){
  const start=m.mallPoint(...fixture.p);start[1]=m.mallSupport(start[0],start[2],start[1]+.4)+.1;const d=new THREE.Vector3(...fixture.direction);
  p.respawn(l,true,false,{position:new THREE.Vector3(...start),heading:d});p.axisF.copy(d);p.axisL.set(-d.z,0,d.x);
  const e={name:fixture.name,start,frames:0,vert:0,air:0,peak:start[1],returned:false,bail:false,end:null,trace:[]};let entered=false;
  for(let i=0;i<720;i++){r.tick({moveY:p.grounded?1:0,jumpHeld:true});e.frames++;e.peak=Math.max(e.peak,p.pos.y);e.bail||=p.isBailing;
   if(p.groundHit?.vert&&p.rideNormal.y<.97){entered=true;e.vert++;}
   if(i%3===0||!p.grounded)e.trace.push({frame:i,source:m.mallSourcePoint(...p.pos.toArray()),ground:p.groundHit?.name,normal:p.rideNormal.toArray(),hitNormal:p.groundHit?.normal.toArray(),vert:p.groundHit?.vert,air:p.vertAir,state:p.state,speed:p.speed,velocity:p.vVel,lastTy:p.lastTy});
   if(entered&&!p.grounded)e.air++;
   if(entered&&e.air&&p.grounded&&p.axisF.dot(d)<-.25&&p.rideNormal.y>.98){e.returned=true;break;}
   if(p.isBailing||p.state==='dead')break;
  }
  e.end=m.mallSourcePoint(...p.pos.toArray());report.push(e);
 }
 await writeFile('/private/tmp/mall-recreation/measured/verts.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report.map(({trace,...e})=>e)));
 assert.ok(report.every(e=>e.vert>0&&e.air>0&&e.peak>e.start[1]+1.5&&e.returned&&!e.bail),'Measured quarters must climb, air and return with normal input');
},{modulePath:'/src/levels/mall-measured.ts',source:m=>m.MALL_LEVEL,levelId:'mall',endlessDeaths:true,maxFrames:3000,controlFrame:r=>r.p.axisF});
