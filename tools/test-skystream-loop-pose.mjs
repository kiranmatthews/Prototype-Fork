import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

// Isolate the production loop contacts and rig, with known approach momentum.
// Subsequent motion is driven only by ordinary input and Player.step.
const results=[];
await withBlockworksRuntime(async r=>{
 const {sampleLoop}=await r.server.ssrLoadModule('/src/loopRide.ts');
 const wall=r.l.loopMeshes.find(mesh=>mesh.userData.loopKind==='wall');
 const scenarios=[...r.l.loopMeshes.map(mesh=>({mesh,yaw:0,moveX:0})),{mesh:wall,yaw:.65,moveX:0},{mesh:wall,yaw:.65,moveX:.2}];
 for(const {mesh,yaw,moveX} of scenarios){
  mesh.rotation.y=yaw;mesh.updateMatrixWorld(true);
  const shape={radius:mesh.userData.loopRadius,width:mesh.userData.loopWidth,offset:mesh.userData.loopOffset,kind:mesh.userData.loopKind};
  r.p.respawn(r.l,true,false,{position:mesh.localToWorld(new r.THREE.Vector3(0,.1,.5)),heading:new r.THREE.Vector3(0,0,-1).transformDirection(mesh.matrixWorld)});
  r.p.freeSkate=true;r.p.speed=72;
  let samples=0,minBoardDot=1,minRootDot=1,maxContactError=0,minWheelGap=Infinity,maxWheelGap=-Infinity,firstFrame=null,lastFrame=null;
  const quarters=new Set();
  for(let i=0;i<1000;i++){
   r.tick({moveX,moveY:1,jumpHeld:true});const p=r.p,ride=p.loopRide;
   assert.ok(!p.isBailing&&!['dead','gameover'].includes(p.state),'Momentum fixture unexpectedly detached');
   if(ride?.mesh===mesh){
    samples++;firstFrame??=i;lastFrame=i;quarters.add(Math.min(3,Math.floor(p.loopStatus.progress*4)));
    const expected=sampleLoop(shape,ride.angle,ride.lateral),normal=new r.THREE.Vector3(...expected.normal).transformDirection(mesh.matrixWorld),point=mesh.localToWorld(new r.THREE.Vector3(...expected.point));
    maxContactError=Math.max(maxContactError,p.pos.distanceTo(point));
    p.boardG.updateWorldMatrix(true,false);
    minBoardDot=Math.min(minBoardDot,new r.THREE.Vector3(0,1,0).transformDirection(p.boardG.matrixWorld).dot(normal));
    minRootDot=Math.min(minRootDot,new r.THREE.Vector3(0,1,0).applyQuaternion(p.group.quaternion).dot(normal));
    if(shape.kind==='wall'&&p.loopStatus.progress>.13&&p.loopStatus.progress<.87){const v=new r.THREE.Vector3();p.boardG.updateWorldMatrix(true,true);p.boardG.traverse(w=>{if(!w.isMesh||!w.name.startsWith('Wheel_'))return;const vertices=w.geometry.attributes.position;let gap=Infinity;for(let j=0;j<vertices.count;j++)gap=Math.min(gap,v.fromBufferAttribute(vertices,j).applyMatrix4(w.matrixWorld).sub(p.pos).dot(normal));minWheelGap=Math.min(minWheelGap,gap);maxWheelGap=Math.max(maxWheelGap,gap);});}
   }
   if(p.loopStatus.completed===1)break;
  }
  assert.equal(r.p.loopStatus.completed,1);assert.equal(quarters.size,4);assert.ok(samples>60);assert.ok(maxContactError<1e-7);
  results.push({name:mesh.name,kind:shape.kind??'vertical',yaw,moveX,minWheelGap:Number.isFinite(minWheelGap)?minWheelGap:null,maxWheelGap:Number.isFinite(maxWheelGap)?maxWheelGap:null,samples,firstFrame,lastFrame,minBoardDot,minRootDot,maxContactError});
 }
},{modulePath:'/src/levels/skystream.ts',source:m=>({v:1,name:'Loop pose regression',spawn:[0,1,0],killY:-600,components:[
 ...m.SKYSTREAM_LEVEL.components.filter(c=>c.loopRadius).map(c=>({...c,cloudRoad:false,tex:'solid'})),
 ...m.SKYSTREAM_LOOPS.map(loop=>({t:'platform',p:[loop.entry[0],loop.entry[1]-.5,loop.entry[2]+6],s:[10,1,14]})),
 {t:'gate',p:[0,0,-30]}]}),levelId:'skystream',maxFrames:4000});
await writeFile(process.env.LOOP_POSE_OUTPUT||'/private/tmp/skystream-loop-pose.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results));
for(const result of results){const tolerance=result.kind==='wall'?.995:.96;assert.ok(result.minRootDot>tolerance,`${result.name}: rig up must follow contact normal`);assert.ok(result.minBoardDot>tolerance,`${result.name}: wheels must face the driving surface`);if(result.kind==='wall'){assert.ok(result.minWheelGap>-.02);assert.ok(result.maxWheelGap<.02);}}
console.log('PASS all three loop contacts and board/rig alignment through all four quarters');
