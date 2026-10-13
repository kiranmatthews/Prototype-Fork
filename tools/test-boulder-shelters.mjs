import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
const results=[];
try{
 const {BoulderChase,BoulderChaseCamera,validBoulderChase}=await server.ssrLoadModule('/src/boulderChase.ts');
 const m=await server.ssrLoadModule('/src/levels/rumblewater-run.ts'),spec=m.RUMBLEWATER_RUN_LEVEL.boulderChase;
 const pool=()=>Array.from({length:spec.shelters.length+1},()=>({mesh:new THREE.Mesh(),box:new THREE.Box3(),r:spec.radius,speed:0}));
 assert.ok(validBoulderChase(spec));
 const initial=new BoulderChase(spec,pool(),new THREE.Vector3(...m.RUMBLEWATER_RUN_LEVEL.spawn));
 initial.update(0,{x:0,y:0,z:-1e9});assert.equal(initial.stage,0);assert.equal(initial.events.length,0,'zero-time preparation cannot release stones');
 for(const shelters of [null,[{entry:[0,NaN,0],exit:[0,0,0]}],spec.shelters.slice().reverse(),[{...spec.shelters[0],exit:spec.shelters[0].entry}],Array(17).fill(spec.shelters[0])])
  assert.ok(!validBoulderChase({...spec,shelters}),'invalid shelter schema is rejected');
 for(let index=0;index<m.RUMBLEWATER_REFUGES.length;index++){
  const room=m.RUMBLEWATER_REFUGES[index],stones=pool(),spawn=new THREE.Vector3(...m.rumblePoint(room.entry-75));
  const chase=new BoulderChase(spec,stones,spawn),gate=chase.shelters[index];let p=chase.project(spawn),impacts=0;
  while(p<chase.project(new THREE.Vector3(...m.rumblePoint(room.checkpoint)))){
   p+=26/60;chase.update(1/60,chase.sample(p));impacts+=chase.events.filter(e=>e.kind==='gate').length;
   assert.ok(stones.filter(s=>!s.box.isEmpty()).length<=1,'there is only one damaging pursuer');
  }
  const inside=chase.sample(p),next=stones[index+1],previous=stones[index];
  for(let i=0;i<1200;i++){chase.update(1/60,inside);impacts+=chase.events.filter(e=>e.kind==='gate').length;}
  assert.equal(chase.stage,index+1);assert.equal(chase.actors[index].phase,'jammed');assert.ok(!previous.box.intersectsBox(new THREE.Box3().setFromCenterAndSize(inside,new THREE.Vector3(1,3,1))));
  assert.ok(!chase.active&&chase.sheltered&&stones.every(s=>s.box.isEmpty()),'twenty seconds in the shelter stays completely safe');
  assert.equal(chase.actors[index+1].phase,'waiting');assert.equal(chase.actors[index+1].drop,13);assert.ok(impacts>=1);
  const trigger=chase.actors[index+1].trigger;
  for(let i=0;i<240;i++)chase.update(1/60,chase.sample(trigger-.2));
  assert.equal(chase.actors[index+1].phase,'waiting','waiting does not consume a timed release');
  chase.update(1/60,chase.sample(trigger+.2));assert.equal(chase.actors[index+1].phase,'dropping');assert.notEqual(chase.stone,previous);
  let low=next.mesh.position.y,dropFrames=0,landed=0;
  const runner=chase.sample(trigger+18);
  while(chase.actors[index+1].phase==='dropping'){
   chase.update(1/60,runner);assert.ok(next.mesh.position.y<=low&&low-next.mesh.position.y<.7,'the new sphere falls continuously');low=next.mesh.position.y;dropFrames++;
   landed+=chase.events.filter(e=>e.kind==='land').length;
  }
  assert.equal(landed,1);assert.ok(dropFrames>35&&dropFrames<80);assert.ok(chase.active);
  let caught=false;for(let i=0;i<600;i++){chase.update(1/60,runner);if(next.box.containsPoint(runner.clone().add(new THREE.Vector3(0,.6,0))))caught=true;}
  assert.ok(caught,'stopping after the exit remains dangerous');
  chase.reset(new THREE.Vector3(...m.rumblePoint(room.checkpoint)));
  assert.equal(chase.stage,index+1);assert.equal(chase.actors[index+1].phase,'waiting');assert.equal(chase.actors[index+1].drop,13);assert.ok(chase.sheltered);
  results.push({name:room.name,stage:index+1,safeSeconds:20,dropFrames,independentStone:true,exitStallCaught:caught});
 }
 // A full moving pass checks intro framing with every staged drop active.
 const chase=new BoulderChase(spec,pool(),new THREE.Vector3(...m.RUMBLEWATER_RUN_LEVEL.spawn));
 const cameras=[[1280,720],[390,844]].map(([w,h])=>({camera:new THREE.PerspectiveCamera(48,w/h,.1,300),rig:new BoulderChaseCamera(),w,h,maxHero:0}));
 for(let s=0;s<m.RUMBLEWATER_END+5;s+=.5){
  const at=new THREE.Vector3(...m.rumblePoint(s));chase.update(1/60,at);
  const bounds=new THREE.Box3(at.clone().add(new THREE.Vector3(-.8,0,-.8)),at.clone().add(new THREE.Vector3(.8,2.6,.8)));
  for(const c of cameras){
   c.rig.update(c.camera,chase,at,30,1/60,s===0,bounds);
   for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    const q=new THREE.Vector3(x,y,z).project(c.camera);c.maxHero=Math.max(c.maxHero,Math.abs(q.x),Math.abs(q.y));
   }
  }
 }
 for(const c of cameras)assert.ok(c.maxHero<.9,'the player stays framed during cave and drop camera transitions');
 const result={refuges:results,framing:cameras.map(({w,h,maxHero})=>({w,h,maxHero}))};
 console.log(JSON.stringify(result));await mkdir('/private/tmp/rumblewater-refuges',{recursive:true});await writeFile('/private/tmp/rumblewater-refuges/runtime.json',JSON.stringify(result,null,2));
}finally{await server.close();}
