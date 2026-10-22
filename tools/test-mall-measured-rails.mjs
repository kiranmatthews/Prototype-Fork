import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

// Each section begins at rest on a measured floor. Every later state is the
// result of ordinary controller samples, including the ollie and rail exit.
await withBlockworksRuntime(async r=>{
 const {p,l,THREE,sourceModule:m}=r,report={paths:0,edges:0,maxNodeError:0,fixtures:[]};
 assert.equal(l.rails.length,m.MALL_RAILS.length);
 for(const [i,source] of m.MALL_RAILS.entries()){
  const rail=l.rails[i];assert.equal(rail.closed,source.closed);
  for(const q of source.points){const error=rail.closest(new THREE.Vector3(...q)).distance;report.maxNodeError=Math.max(report.maxNodeError,error);assert.ok(error<.0001,`Rail ${i} moved from its source node`);}
  report.paths++;report.edges+=source.points.length-1+Number(source.closed);
 }
 assert.equal(report.edges,637);
 const fixtures=[
  {name:'Concourse bench',start:[-11100,314.7586,968.0928],target:[-11529.2539,355.9365,968.0928],direction:[0,0,1],lead:4.5},
  {name:'First concourse display ledge',start:[-13600,314.7586,349.7578],target:[-13107.0352,355.9365,369.8467],direction:[.04072,0,-.99917],lead:6.5},
  {name:'Crossrail low arch',start:[5500,-1467,5780],target:[4801,-1466.5,5910.4],direction:[.18229,0,.98324],lead:5,exitSide:-1},
 ];
 for(const f of fixtures){
  const start=m.mallPoint(...f.start),target=new THREE.Vector3(...m.mallPoint(...f.target)),heading=new THREE.Vector3(...f.direction);
  start[1]=m.mallSupport(start[0],start[2],start[1]+.4)+.1;assert.ok(Number.isFinite(start[1]),f.name);
  p.respawn(l,true,false,{position:new THREE.Vector3(...start),heading});p.axisF.copy(heading);p.axisL.set(-heading.z,0,heading.x);
  const targetRail=l.rails.map((rail,i)=>({i,d:rail.closest(target).distance})).sort((a,b)=>a.d-b.d)[0].i;
  const e={name:f.name,start,targetRail,grindFrames:0,grindDistance:0,rails:[],bail:false,landed:false,trace:[]};let launched=false,exited=false,previous=p.pos.clone();
  for(let i=0;i<720;i++){
   const remaining=target.clone().sub(p.pos).dot(heading);
   if(remaining<f.lead)launched=true;
   const grinding=p.state==='grind';
   if(e.grindFrames>=24||e.grindFrames>0&&!grinding)exited=true;
   const steer=(heading.x*-p.axisF.z+heading.z*p.axisF.x)*3;
   const moveX=grinding?(e.grindFrames>=22?(f.exitSide??0):Math.max(-1,Math.min(1,-p.balance*5-p.balanceVel*.7))):p.grounded?Math.max(-1,Math.min(1,steer)):0;
   r.tick({moveX,moveY:grinding?1:p.grounded?heading.dot(p.axisF):0,jumpHeld:grinding?!exited:!launched,grindHeld:launched&&!exited&&(grinding||!p.grounded)});
   if(p.state==='grind'){e.grindFrames++;e.grindDistance+=p.pos.distanceTo(previous);const rail=l.rails.indexOf(p.grindRail);if(!e.rails.includes(rail))e.rails.push(rail);}
   e.bail||=p.isBailing;previous.copy(p.pos);
   if(i%5===0)e.trace.push({frame:i,source:m.mallSourcePoint(...p.pos.toArray()),state:p.state,speed:p.speed,under:p.underK,rail:p.grindRail?l.rails.indexOf(p.grindRail):null});
   if(exited&&p.grounded&&p.state==='ride'){e.landed=true;break;}
   if(e.bail||p.state==='dead')break;
  }
  e.end=m.mallSourcePoint(...p.pos.toArray());report.fixtures.push(e);
 }
 await writeFile('/private/tmp/mall-recreation/measured/rails.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,fixtures:report.fixtures.map(({trace,...f})=>f)}));
 assert.ok(report.fixtures.every(f=>f.rails.includes(f.targetRail)&&f.grindFrames>=20&&f.grindDistance>3&&f.landed&&!f.bail),'Measured rails need an ordinary-input catch, sustained grind and clean exit');
},{modulePath:'/src/levels/mall-measured.ts',source:m=>m.MALL_LEVEL,levelId:'mall',endlessDeaths:true,maxFrames:4000,controlFrame:r=>r.p.axisF});
