import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const report={runs:[],pads:[],camera:[],miss:{}};
await withBlockworksRuntime(async r=>{
 const {p,l,source:d,sourceModule:m,THREE}=r;
 const w=await r.server.ssrLoadModule('/src/levels/sunset-waterfalls.ts');
 const {LaunchCamera}=await r.server.ssrLoadModule('/src/launchCamera.ts');
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 assert.ok(normalizeCustomLevelData(structuredClone(d)),'published/editor geometry contract');
 const route=w.SUNSET_WATERFALL_ROUTE,point=m.custardPoint,heading=m.custardTangent(2430);
 const pads=l.groundMeshes.filter(mesh=>mesh.userData.trampolineBounce!==undefined);
 assert.equal(pads.length,12);assert.equal(d.components.filter(c=>c.t==='gate').length,1);
 const gate=d.components.find(c=>c.t==='gate');assert.deepEqual(gate.p,point(3052,-254));assert.ok(d.killY<-270);
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 for(const mesh of pads){
  const c=d.components[mesh.userData.editorIdx];assert.ok(mesh.userData.trampolineNetBounds,'same rope/rim classification as Carlisle');
  ray.set(new THREE.Vector3(c.p[0],c.p[1]+2,c.p[2]),down);ray.far=5;
  const hit=l.raycastGround(ray).find(h=>h.object===mesh);assert.ok(hit);assert.ok(Math.abs(hit.point.y-c.p[1])<.001);
  assert.ok(!l.pitBoxes.some(b=>b.containsPoint(new THREE.Vector3(...c.p))&&!l.pitMissesPoly(b,c.p[0],c.p[2])),'reset volume must stay below each pad');
  report.pads.push({name:c.nm,y:c.p[1],launch:c.speed});
 }
 // One initial placement on the old finish bank. Thereafter only ordinary input
 // samples move the production Player, including the two walkable terraces.
 const camera=new THREE.PerspectiveCamera(55,16/9,.1,1000),launchCamera=new LaunchCamera();
 for(const boosted of (process.env.SUNSET_MISS_ONLY?[]:[true])){
  p.respawn(l,true,false,{position:new THREE.Vector3(...point(2400,-5.95)),heading:new THREE.Vector3(...heading)});
  p.freeSkate=false;p.speed=0;p.walkVelocity.set(0,0,0);
  let target=0,lastLaunch=p.trampolineLaunchId,jumps=0,charge=0,wasHeld=false,frames=0,maxCameraStep=0,lastShot=null,checkpointRecovery=false;
  const baseDeaths=p.totalDeaths;
  while(frames++<12000){
   const node=route[target];if(!node)break;
   let input={};
   if(p.trampolineLaunchId!==lastLaunch){
    lastLaunch=p.trampolineLaunchId;jumps++;console.log('LAUNCH',JSON.stringify({jumps,speed:p.trampolineLaunchSpeed,position:p.pos.toArray()}));
    if(node.kind==='spring')target++;
   }
   const dest=route[target];if(!dest)break;
   const q=point(dest.s,dest.y),distance=Math.hypot(q[0]-p.pos.x,q[2]-p.pos.z);
   input={...r.steerToward(q,{pace:Math.min(1,distance/2),tolerance:.08}),jumpHeld:boosted&&!p.grounded,jumpPressed:false};
   if(dest.kind==='rest'&&p.grounded&&distance<3){target++;charge=0;}
   if(dest.kind==='spring'&&p.grounded&&distance<2){
    // Jump in place from a checkpoint shelf onto its adjacent spring.
    input.moveX=input.moveY=0;charge++;
    input.jumpHeld=charge<22;input.jumpPressed=charge===1;input.jumpReleased=charge===22;
    if(charge>23)charge=0;
   }
   if(dest.kind==='finish'&&p.grounded&&distance<3){
    r.until(()=>p.state==='finished',()=>r.steerToward(gate.p),{maxFrames:600,label:'new finish shelf'});break;
   }
   if(Math.abs(input.moveX??0)<.1)input.moveX=0;
   if(!input.jumpHeld&&wasHeld&&!input.jumpReleased)input.jumpReleased=true;
   if(p.isBailing){input={};charge=0;}
   wasHeld=!!input.jumpHeld;r.tick(input);
   if(p.checkpointTripActive)checkpointRecovery=true;
   if(!p.isBailing)checkpointRecovery=false;
   const launch=p.launchCameraPresentation;
   launchCamera.restore(camera);camera.position.copy(p.pos).addScaledVector(new THREE.Vector3(...heading),-8);camera.position.y+=5;camera.lookAt(p.pos);
   launchCamera.apply(camera,p.pos,launch,1/60,frames===1);
   if(launch){assert.ok(launch.strength>.99,'Carlisle full launch camera activates');assert.ok(camera.position.toArray().every(Number.isFinite));
    if(lastShot)maxCameraStep=Math.max(maxCameraStep,camera.position.distanceTo(lastShot));lastShot=camera.position.clone();}
   if(p.totalDeaths>baseDeaths||p.state==='dead'||(p.isBailing&&!checkpointRecovery))throw Error(JSON.stringify({boosted,target,jumps,frame:frames,snapshot:r.snapshot()}));
  }
  assert.ok(frames<12000,'whole trampoline descent completes');assert.equal(jumps,12);assert.equal(p.totalDeaths,baseDeaths);
  report.runs.push({boosted,seconds:frames/60,jumps,position:p.pos.toArray(),maxCameraStep});
 }
 // Missing the lowest net meets its own water plane, not a global high reset.
 const miss=point(2980,-235,15);p.respawn(l,true,false,{position:new THREE.Vector3(...miss),heading:new THREE.Vector3(...heading)});
 p.state='air';p.grounded=false;p.vVel=-2;const before=p.totalDeaths;
 for(let i=0;i<180&&p.totalDeaths===before&&p.state!=='dead';i++)r.tick();
 assert.ok(p.totalDeaths>before||p.state==='dead',JSON.stringify(r.snapshot()));report.miss={caught:true,y:p.pos.y};
 const b=await readFile('public/props/sunset-waterfalls/rope-corner.glb'),glb=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
 const triangles=glb.meshes.flatMap(m=>m.primitives).reduce((n,p)=>n+glb.accessors[p.indices].count/3,0);assert.equal(triangles,5082);assert.ok(triangles<30000);report.assetTriangles=triangles;
},{modulePath:'/src/levels/custard-creek.ts',levelId:'custard-creek',source:m=>m.CUSTARD_CREEK_LEVEL,controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir,allowCheckpointTrips:true});
await writeFile('/private/tmp/sunset-waterfall-runtime.json',JSON.stringify(report,null,2));console.log('PASS Sunset waterfall run',JSON.stringify(report));
