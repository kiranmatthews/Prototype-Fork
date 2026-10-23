import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

// Explicit section placements followed solely by ordinary controller input.
await withBlockworksRuntime(async r=>{
 const {p,l,THREE,sourceModule:m,source}=r,report={surfaces:[],grinds:[],boxes:[]};
 const boxes=l.crates.filter(c=>source.components[c.mesh.userData.editorIdx]?.nm==='Mezzanine breakable box');
 report.boxes=boxes.map(c=>({position:c.mesh.position.toArray(),base:c.box.min.y,top:c.box.max.y,empty:c.empty}));
 assert.equal(boxes.length,6);assert.ok(boxes.every(c=>c.empty&&c.alive));
 assert.deepEqual(report.boxes.map(c=>Math.round((c.base-m.MALL_EXIT.deckY)/.96)+0).sort(),[0,0,0,1,1,2],'The stack must keep three supported tiers');
 const start=(s,u)=>{const d=new THREE.Vector3(0,0,-1);p.respawn(l,true,false,{position:new THREE.Vector3(...m.mallPoint(s,u,m.mallHeight(s)+.1)),heading:d});p.axisF.copy(d);p.axisL.set(1,0,0);};
 for(const [s,y,d,expected,h]of [[384,0,1,'Raised exit passage',2.6],[394,4,-1,'Raised exit passage',2.8],[400,-2,-1,'Continuous mall floor',-3],[435,-8,-1,'Continuous mall floor',-10],[448,-8,-1,'Continuous mall floor',-10]]){
  const ray=new THREE.Raycaster(new THREE.Vector3(...m.mallPoint(s,0,y)),new THREE.Vector3(0,d,0),0,5),hit=ray.intersectObjects(l.groundMeshes,false)[0];
  report.surfaces.push({s,name:hit?.object.name,y:hit?.point.y});assert.equal(hit?.object.name,expected);assert.ok(Math.abs(hit.point.y-h)<.02);
 }
 for(const side of [-1,1])for(const stair of [false,true]){
  const name=stair?'Thirty-two stair handrail':'Exit corridor ledge rim',origin=stair?404:387,u=side*(stair?1.75:4.4);
  start(origin,u);let caught=0,travel=0,last=null,landed=false,bailed=false,popped=false;
  const traceStart=r.trace.length;
  for(let i=0;i<700;i++){
   const s=104-p.pos.z,grinding=p.state==='grind';if(stair&&s>410.4&&p.grounded)popped=true;
   r.tick({moveY:grinding?0:p.grounded?1:0,moveX:grinding?Math.max(-1,Math.min(1,-p.balance*8-p.balanceVel*1.8)):0,jumpHeld:!popped,grindHeld:!stair||popped});
   bailed||=p.isBailing;
   if(p.state==='grind'&&source.components[p.grindRail.object.userData.editorIdx]?.nm===name){caught++;if(last!==null)travel+=Math.abs(p.grindT-last);last=p.grindT;}
   else if(caught&&p.grounded){landed=true;break;}
   if(bailed||p.state==='dead')break;
  }
  report.grinds.push({name,side,caught,travel,landed,bailed,end:p.pos.toArray(),speed:p.speed});
  await writeFile(`/private/tmp/mall-recreation/exit-${stair?'stairs':'ledge'}-${side}-trace.json`,JSON.stringify(r.trace.slice(traceStart)));
 }
 await writeFile('/private/tmp/mall-recreation/exit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 assert.ok(report.grinds.every(v=>v.travel>18&&v.caught>60&&v.landed&&!v.bailed),'Both corridor ledges and both stair handrails must grind continuously and return to supported ground');
},{modulePath:'/src/levels/mall.ts',source:m=>m.MALL_LEVEL,levelId:'mall',endlessDeaths:true,maxFrames:4000,controlFrame:r=>r.p.axisF});
