import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

await withSkateRuntime(async({player:p,Level,THREE,CONST})=>{
  const v=(...xyz)=>new THREE.Vector3(...xyz);
  const level=new Level(new THREE.Scene(),{id:'wall-facing-test',name:'Wall facing',data:{v:1,name:'Wall facing',spawn:[0,4,0],killY:-30,
    components:[{t:'platform',p:[0,-.5,0],s:[1000,1,1000]},
      {t:'wallpath',p:[20,0,0],pts:[[0,-30],[8,0],[0,30]],w:.2,rise:20,curve:'spline'},
      {t:'gate',p:[0,0,-450]}]}});
  const surfaces=[];
  for(const axis of ['x','z'])for(const sign of [-1,1]){
    const normal=axis==='x'?v(sign,0,0):v(0,0,sign);
    const box=axis==='x'?new THREE.Box3(v(-.1,0,-60),v(.1,20,60)):new THREE.Box3(v(-60,0,-.1),v(60,20,.1));
    surfaces.push({name:`box ${axis}/${sign}`,normal,point:v(),box,thickness:.1});
  }
  const pathBox=level.walls.find(box=>level.wallPathForBox(box));
  const path=level.wallPathForBox(pathBox);
  for(const side of [-1,1]){
    const sample=level.wallPathSample(path,path.length*.45,side),normal=v(sample.nx,0,sample.nz),point=v(sample.x,0,sample.z);
    const boxes=level.walls.filter(box=>level.wallPathForBox(box)===path);
    const box=boxes.reduce((best,next)=>next.distanceToPoint(point)<best.distanceToPoint(point)?next:best);
    surfaces.push({name:`curved/${side}`,normal,point,box,thickness:path.halfThickness});
  }
  let attempts=0,accepted=0,frames=0;
  for(const surface of surfaces)for(const stance of [-1,1])for(const movement of ['forward','reverse','into','away','up','down'])for(const angle of [0,60,90,120,180]){
    const n=surface.normal,tangent=v(-n.z,0,n.x);
    const velocity=movement==='forward'?tangent.clone().multiplyScalar(12):movement==='reverse'?tangent.clone().multiplyScalar(-12)
      :movement==='into'?n.clone().multiplyScalar(-12):movement==='away'?n.clone().multiplyScalar(12):v(0,movement==='up'?9:-9,0);
    const position=surface.point.clone().addScaledVector(n,surface.thickness+Math.abs(n.x)*CONST.playerHalf.x+Math.abs(n.z)*CONST.playerHalf.z-.03);position.y=4;
    p.respawn(level,true,true,{position,heading:tangent});
    p.freeSkate=p.airFromSkate=true;p.state='air';p.grounded=false;p.skateMountT=-1;p.sidePose=p.deckPose=p.skatePose=1;p.stance=stance;
    p.wallCoolT=0;p.wallrideLatched=false;p.vertAir=false;p.wallriding=false;p.wallridePose=0;
    p.speed=Math.hypot(velocity.x,velocity.z);p.vVel=velocity.y;
    p.axisF.copy(p.speed>0?v(velocity.x,0,velocity.z).normalize():tangent);p.axisL.set(p.axisF.z,0,-p.axisF.x);
    const face=n.clone().negate().applyAxisAngle(v(0,1,0),angle*Math.PI/180),worldYaw=Math.atan2(face.x,face.z);
    p.visualYaw=worldYaw-Math.PI-stance*Math.PI/2;
    p.group.position.copy(position);p.group.rotation.set(0,Math.PI,0);p.bodyGroup.rotation.set(0,worldYaw-Math.PI,0);p.riderG.rotation.set(0,0,0);
    // Looking back over a shoulder does not turn the torso into a valid catch.
    p.headM.rotation.y=Math.PI;
    p.rawInput=makeInput({grindHeld:true});
    const result=p.tryWallride(surface.box,level),expected=angle<76;attempts++;
    assert.equal(result,expected,`${surface.name}, stance ${stance}, ${movement}, facing ${angle}°`);
    if(!result)continue;
    accepted++;
    if(!p.wallPath){p.wallBox=surface.box;}
    for(let frame=0;frame<20;frame++){
      p.step(1/60,makeInput(),level);frames++;
      assert.equal(p.wallriding,true,'a valid direction lost its wallride');
      const f=p.riderG.getWorldDirection(v()),horizontal=Math.hypot(f.x,f.z);
      assert.ok(-(f.x*p.wallNormal.x+f.z*p.wallNormal.z)/horizontal>.9,'torso turned its back to the wall while riding');
    }
    p.riderG.rotateY(Math.PI);
    p.stepWallride(1/60,makeInput(),level);
    assert.equal(p.wallriding,false,'a back-to-wall pose retained the wallride');
  }
  level.dispose();
  console.log(`PASS ${attempts} facing/direction cases, ${accepted} permitted entries and ${frames} native wallride frames; straight/curved walls, both sides/stances, head-on/reverse/vertical travel, back-facing rejection and continuation gate.`);
});
