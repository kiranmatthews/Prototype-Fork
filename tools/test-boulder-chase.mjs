import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createServer} from 'vite';
import {readFile,writeFile} from 'node:fs/promises';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
const report={};
try{
 const {BoulderChase,BoulderChaseCamera,validBoulderChase}=await server.ssrLoadModule('/src/boulderChase.ts');
 const m=await server.ssrLoadModule('/src/levels/rumblewater-run.ts'),data=m.RUMBLEWATER_RUN_LEVEL;
 assert.ok(validBoulderChase(data.boulderChase));
 for(const patch of [{radius:0},{speed:Infinity},{headStart:2},{path:[[0,0,0],[0,1,0]]},{extra:1}])assert.ok(!validBoulderChase({...data.boulderChase,...patch}));
 const stone={mesh:new THREE.Mesh(),box:new THREE.Box3(),r:data.boulderChase.radius,speed:0};
 const pool=[stone,...Array.from({length:data.boulderChase.shelters?.length??0},()=>({mesh:new THREE.Mesh(),box:new THREE.Box3(),r:data.boulderChase.radius,speed:0}))];
 const spawn=new THREE.Vector3(...data.spawn),chase=new BoulderChase(data.boulderChase,pool,spawn);
 const resting=stone.mesh.position.clone();for(let i=0;i<300;i++)chase.update(1/60,spawn);
 assert.ok(!chase.active&&resting.distanceTo(stone.mesh.position)<1e-8,'wait for the player at supported spawn');
 const exposed=new THREE.Vector3(...m.rumblePoint(9));let caught=false,lastSpeed=0;
 for(let i=0;i<1200;i++){
  const old=stone.mesh.position.clone();chase.update(1/60,exposed);
  assert.ok(old.distanceTo(stone.mesh.position)<.72,'pursuit never teleports');
  assert.ok(Math.abs(chase.speed-lastSpeed)<=.201,'speed is acceleration limited');lastSpeed=chase.speed;
  if(stone.box.containsPoint(exposed.clone().add(new THREE.Vector3(0,.46,0))))caught=true;
 }assert.ok(caught,'stopping during a live chase gets caught');report.stallCaught=true;
 const cp=new THREE.Vector3(...m.rumblePoint(578));chase.reset(cp);
 assert.ok(!chase.active&&!chase.falling&&stone.box.isEmpty());
 assert.ok(Math.abs(chase.project(cp)-chase.progress-data.boulderChase.headStart)<.001,'checkpoint provides a consistent head start');
 for(let i=0;i<600;i++)chase.update(1/60,cp);
 assert.ok(!chase.active,'checkpoint does not consume its head start while waiting');report.checkpointReset=true;
 const survivor=new THREE.Vector3(...m.rumblePoint(m.RUMBLEWATER_END-12));
 for(let i=0;i<16000;i++)chase.update(1/60,survivor);
 assert.ok(chase.finished&&!stone.mesh.visible&&stone.box.isEmpty(),'boulder falls into final gap and stays harmless');report.finalFall=true;
 const trace=JSON.parse(await readFile('/private/tmp/rumblewater-evidence/outer-high-trace.json','utf8'));
 report.framing=[];
 for(const [width,height] of [[1280,720],[960,720],[390,844],[844,390]]){
  const camera=new THREE.PerspectiveCamera(54,width/height,.1,300),rig=new BoulderChaseCamera();
  let heroMaxX=0,heroMaxY=0,aheadVisible=0,total=0,boulderVisible=0,boulderTotal=0;
  for(const [i,t]of trace.entries()){
   const subject=new THREE.Vector3(...t.position),bounds=new THREE.Box3(subject.clone().add(new THREE.Vector3(-.8,0,-.8)),subject.clone().add(new THREE.Vector3(.8,2.6,.8)));
   rig.update(camera,chase,subject,t.speed,1/60,i===0,bounds);
   const s=chase.project(subject),f=chase.tangent(s);
   assert.ok(camera.position.clone().sub(subject).dot(f)>(chase.shelterCameraWeight(s)>.01?12:15),'camera remains ahead, including the closer refuge framing');
   assert.ok(camera.getWorldDirection(new THREE.Vector3()).dot(f)<-.65,'camera looks back at the runner');
   for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    const v=new THREE.Vector3(x,y,z).project(camera);heroMaxX=Math.max(heroMaxX,Math.abs(v.x));heroMaxY=Math.max(heroMaxY,Math.abs(v.y));
   }
   if(m.rumbleProgress(subject)<m.RUMBLEWATER_BOULDER_END-12){
    const v=chase.sample(s+18).project(camera);if(Math.abs(v.x)<1&&Math.abs(v.y)<1)aheadVisible++;
    if(t.chaseActive){const b=chase.sample(s-t.chaseGap).add(new THREE.Vector3(0,data.boulderChase.radius,0)).project(camera);
     if(Math.abs(b.x)<1&&Math.abs(b.y)<1)boulderVisible++;boulderTotal++;}total++;
   }
  }
  assert.ok(heroMaxX<=.87&&heroMaxY<=.87,'complete hero remains safely framed');
  report.framing.push({width,height,heroMaxX,heroMaxY,ahead18mVisible:aheadVisible/total,activeBoulderCentreVisible:boulderVisible/boulderTotal});
 }
 console.log(JSON.stringify(report));await writeFile('/private/tmp/rumblewater-evidence/runtime-camera.json',JSON.stringify(report,null,2));
}finally{await server.close();}
