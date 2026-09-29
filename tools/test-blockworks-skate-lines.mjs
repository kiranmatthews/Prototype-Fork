import assert from 'node:assert/strict';
import {withBlockworksRuntime,normalizeGameInput} from './blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const {l,sourceModule:m,THREE}=r;
 for(const label of ['Courtyard roof bays','Crown roof bays','Switch stair wedge']){
  const wedges=m.BLOCKWORKS_SKATE_RAMPS.filter(w=>w.name.startsWith(label)),first=wedges[0],dir=new THREE.Vector3().fromArray(first.high).sub(new THREE.Vector3().fromArray(first.low)).setY(0).normalize();
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);let start;
  for(const d of [6,5,4,3,2]){const q=new THREE.Vector3(...first.low).addScaledVector(dir,-d);ray.set(q.clone().setY(first.low[1]+.2),down);const hit=ray.intersectObjects(l.groundMeshes,false)[0];if(hit&&Math.abs(hit.point.y-first.low[1])<.2){start=q.setY(hit.point.y+.05);break;}}
  if(!start)throw Error('no runup '+label);
  const p=new r.Player(l.scene);p.enterLevel('live-wedges');p.respawn(l,true,false,{position:start,heading:dir});
  for(const c of l.crates.filter(c=>c.bang))l.triggerBang(c);l.root.updateMatrixWorld(true);
  const points=wedges.flatMap(w=>{const d=new THREE.Vector3(...w.high).sub(new THREE.Vector3(...w.low)).setY(0).normalize();return [new THREE.Vector3(...w.low),new THREE.Vector3(...w.high).addScaledVector(d,1.4)];});
  let index=0,last={},braking=false;
  for(let frame=0;frame<3600&&index<points.length;frame++){
   const q=points[index],distance=Math.hypot(q.x-p.pos.x,q.z-p.pos.z);
   if(distance<1.25&&p.pos.y>=q.y-.15){index++;continue;}
   const f=l.cameraDirAt(p.pos.x,p.pos.y,p.pos.z),dx=q.x-p.pos.x,dz=q.z-p.pos.z;
   if(p.speed>13.5)braking=true;else if(p.speed<11.5)braking=false;
   const input=normalizeGameInput({moveX:p.grounded?(dx*-f.z+dz*f.x)/distance:0,moveY:p.grounded?(dx*f.x+dz*f.z)/distance:0,jumpHeld:true,grabHeld:braking},last);last=input;
   p.step(1/60,input,l);l.update(1/60);p.commitRenderStep(l);
   if(p.isBailing||p.state==='dead')throw Error(JSON.stringify({label,index,frame,position:p.pos.toArray(),target:q.toArray(),speed:p.speed,state:p.state}));
  }
  if(index!==points.length)throw Error(JSON.stringify({label,index,position:p.pos.toArray(),target:points[index]?.toArray(),speed:p.speed}));
  assert.ok(p.freeSkate&&p.totalDeaths===0,label+' must finish on the board');console.log('PASS',label,p.pos.toArray(),p.freeSkate,p.speed);p.group.removeFromParent();
 }
});
