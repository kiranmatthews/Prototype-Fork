import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

// These placements isolate the pool and its two flanking roofs. Subsequent
// motion is ordinary controller input, without pose or velocity overrides.
await withBlockworksRuntime(async r=>{
 const {p,l,THREE,sourceModule:m,source}=r,report={surfaces:[],jumps:[],canopies:[],canopyGrinds:[]};
 const start=(s,u,y,d)=>{p.respawn(l,true,false,{position:new THREE.Vector3(...m.mallPoint(s,u,y)),heading:d});p.axisF.copy(d);p.axisL.set(-d.z,0,d.x);};
 for(const [s,u,y,direction,name]of [[350.5,0,1,-1,'Courtyard blue pool'],[350.5,-7,5,-1,'Courtyard left blue canopy'],[350.5,7,5,-1,'Courtyard right blue canopy'],[350.5,-7,1,1,'Courtyard left blue canopy'],[350.5,7,1,1,'Courtyard right blue canopy']]){
  const ray=new THREE.Raycaster(new THREE.Vector3(...m.mallPoint(s,u,y)),new THREE.Vector3(0,direction,0),0,6),hit=ray.intersectObjects(l.groundMeshes,false)[0];
  report.surfaces.push({s,u,direction,name:hit?.object.name,y:hit?.point.y,normal:hit?.face.normal.toArray()});
  assert.equal(hit?.object.name,name);
  if(name==='Courtyard blue pool')assert.ok(Math.abs(hit.point.y+.8)<.01,'The pool floor must be below the surrounding mall floor');
  else assert.ok(hit.face.normal.y*direction<-.8,'Both canopy faces must have consistent outward normals');
 }
 for(const release of [null,344,344.8]){
  start(329,0,.1,new THREE.Vector3(0,0,-1));
  let popped=false,launchFrames=0,poolFrames=0,minimumFeetY=0,takeoff=null,landing=null,airFrames=0,peakFeetY=0,bailed=false,collected=false;
  const traceStart=r.trace.length;
  for(let i=0;i<400;i++){
   const s=104-p.pos.z;if(release!==null&&s>=release&&p.grounded)popped=true;
   r.tick({moveY:p.grounded?1:0,jumpHeld:!popped});bailed||=p.isBailing;peakFeetY=Math.max(peakFeetY,p.pos.y);
   if(p.grounded&&p.groundHit?.name==='Courtyard pool launch wedge')launchFrames++;
   if(p.grounded&&p.groundHit?.name==='Courtyard blue pool')poolFrames++;
   minimumFeetY=Math.min(minimumFeetY,p.pos.y);
   if(launchFrames&&!p.grounded){takeoff??={s:104-p.pos.z,speed:p.speed};airFrames++;}
   if(takeoff&&p.grounded)landing??={s:104-p.pos.z,speed:p.speed,surface:p.groundHit?.name};
   collected||=l.pickups.some(v=>Math.abs(v.mesh.position.z-m.mallPoint(350.5)[2])<1&&!v.alive);
   if(104-p.pos.z>=370||bailed||p.state==='dead')break;
  }
  report.jumps.push({release,popped,launchFrames,poolFrames,minimumFeetY,takeoff,landing,airFrames,peakFeetY,bailed,collected,end:p.pos.toArray()});
  await writeFile(`/private/tmp/mall-recreation/pool-section-${release??'roll'}-trace.json`,JSON.stringify(r.trace.slice(traceStart)));
 }
 for(const side of [-1,1]){
  start(343,side*7,4.5,new THREE.Vector3(0,0,-1));
  let contacts=0,landed=false,bailed=false,minimumSpeed=Infinity;
  for(let i=0;i<260;i++){
   r.tick({moveY:p.grounded?1:0,jumpHeld:true});bailed||=p.isBailing;
   if(p.grounded&&p.groundHit?.name===`Courtyard ${side<0?'left':'right'} blue canopy`){contacts++;minimumSpeed=Math.min(minimumSpeed,p.speed);}
   if(contacts&&p.grounded&&104-p.pos.z>358&&!p.groundHit?.name?.includes('blue canopy')){landed=true;break;}
   if(bailed||p.state==='dead')break;
  }
  report.canopies.push({side,contacts,landed,bailed,minimumSpeed,landingSpeed:p.speed,end:p.pos.toArray(),landingSurface:p.groundHit?.name});
 }
 for(const rail of l.rails.filter(v=>source.components[v.object.userData.editorIdx]?.nm==='Courtyard canopy edge')){
  const origin=rail.pointAt(1),heading=rail.tangentAt(1);origin.y+=.12;
  p.respawn(l,true,false,{position:origin,heading});p.axisF.copy(heading);p.axisL.set(-heading.z,0,heading.x);
  let caught=0,travel=0,last=null,landed=false,bailed=false;
  for(let i=0;i<600;i++){
   const grinding=p.state==='grind';
   // Let go before the edge so the runoff cannot auto-catch a neighbouring
   // wall coping; this fixture verifies the canopy's own exit and landing.
   r.tick({moveY:!grinding&&p.grounded?1:0,moveX:grinding?Math.max(-1,Math.min(1,-p.balance*8-p.balanceVel*1.8)):0,jumpHeld:true,grindHeld:travel<14.2});
   bailed||=p.isBailing;
   if(p.state==='grind'&&p.grindRail===rail){caught++;if(last!==null)travel+=Math.abs(p.grindT-last);last=p.grindT;}
   else if(caught&&p.grounded){landed=true;break;}
   if(bailed||p.state==='dead')break;
  }
  report.canopyGrinds.push({origin:origin.toArray(),caught,travel,landed,bailed,end:p.pos.toArray(),landingSurface:p.groundHit?.name});
 }
 await writeFile('/private/tmp/mall-recreation/pool-surfaces.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 const rolls=report.jumps.filter(v=>v.release===null),ollies=report.jumps.filter(v=>v.release!==null);
 assert.ok(rolls.every(v=>v.poolFrames>5&&v.minimumFeetY<-.65&&!v.collected&&!v.bailed),'Rolling through the basin must be safe and leave the elevated reward uncollected');
 assert.ok(ollies.every(v=>v.launchFrames>5&&v.takeoff&&v.landing&&v.landing.s>354&&v.landing.speed>10&&v.landing.speed>v.takeoff.speed*.7&&!v.bailed),'Both charged takeoff timings must clear the pool at a moderate approach speed');
 assert.ok(ollies.every(v=>v.collected),'Both charged takeoff timings must reach the pool reward');
 assert.ok(report.canopies.every(v=>v.contacts>20&&v.landed&&!v.bailed),'Both canopy tops must support skating and a safe roll-off');
 assert.equal(report.canopyGrinds.length,4);
 assert.ok(report.canopyGrinds.every(v=>v.caught>100&&v.travel>14&&v.landed&&!v.bailed),'All four canopy edges must support a sustained grind and a supported runoff');
},{modulePath:'/src/levels/mall.ts',source:m=>m.MALL_LEVEL,levelId:'mall',endlessDeaths:true,maxFrames:7000,controlFrame:r=>r.p.axisF});
