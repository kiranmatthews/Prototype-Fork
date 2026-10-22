import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

await withBlockworksRuntime(async r=>{
 const {p,l,THREE,sourceModule:m,source}=r,report={};
 const start=(s,u,y)=>{
  const d=new THREE.Vector3(0,0,-1);
  p.respawn(l,true,false,{position:new THREE.Vector3(...m.mallPoint(s,u,y)),heading:d});
  p.axisF.copy(d);p.axisL.set(1,0,0);
 };
 start(39,3.55,12.1);
 let caught=0,landed=false,bailed=false,popped=false,afterPop=0;
 const names=[];
 for(let i=0;i<350;i++){
  const grinding=p.state==='grind',name=grinding?source.components[p.grindRail.object.userData.editorIdx]?.nm:'';
  let moveX=0,moveY=p.grounded?1:0,jumpHeld=i<30,grindHeld=i>=30;
  if(name==='Entrance water trough rim'){
   caught++;if(!names.includes(name))names.push(name);
   moveX=Math.max(-1,Math.min(1,-p.balance*5-p.balanceVel*.7));moveY=1;jumpHeld=true;
   if(caught>25){const cam=p.camDir,n=Math.hypot(cam.x,cam.z)||1;moveX=.35*-cam.z/n;moveY=.35*cam.x/n;}
   if(caught>31){jumpHeld=false;grindHeld=false;popped=true;}
  }
  if(popped){afterPop++;if(afterPop<12)grindHeld=false;}
  r.tick({moveX,moveY,jumpHeld,grindHeld});bailed||=p.isBailing;
  if(popped&&p.grounded){landed=true;break;}
  if(bailed||p.state==='dead')break;
 }
 report.trough={caught,landed,bailed,names,end:p.pos.toArray()};
 const trace=r.trace.slice();
 start(370,7,0.1);
 let furthest=370;
 for(let i=0;i<120;i++){r.tick({moveY:1,jumpHeld:true});furthest=Math.max(furthest,m.mallProject(p.pos.x,p.pos.z,375));}
 report.exitCheek={furthest,end:p.pos.toArray(),bailing:p.isBailing};
 const ray=new THREE.Raycaster(new THREE.Vector3(...m.mallPoint(386,7,7)),new THREE.Vector3(0,-1,0),0,12);
 const sideTop=ray.intersectObjects(l.groundMeshes,false)[0];
 report.exitCheek.sideTop={name:sideTop?.object.name,y:sideTop?.point.y};
 await writeFile('/private/tmp/mall-recreation/details.json',JSON.stringify(report,null,2));
 await writeFile('/private/tmp/mall-recreation/trough-trace.json',JSON.stringify(trace));console.log(JSON.stringify(report,null,2));
 assert.ok(caught>=30&&!bailed&&landed,'The entrance water-trough rim must catch a grind and permit an ollie back to the lower aisle');
 assert.ok(furthest<375,'The solid portal cheek must block skating behind the exit transition');
 assert.ok(sideTop?.object.name==='Exit stair masonry wing'&&Math.abs(sideTop.point.y-3.4)<.01,'The bank back must meet the masonry under the upper passage');
},{modulePath:'/src/levels/mall.ts',source:m=>m.MALL_LEVEL,levelId:'mall',endlessDeaths:true,maxFrames:900,controlFrame:r=>r.p.axisF});
