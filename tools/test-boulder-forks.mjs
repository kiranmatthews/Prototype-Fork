import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}}),report={routes:[],retryScales:[],lightning:false};
try{
 const {BoulderChase,validBoulderChase}=await server.ssrLoadModule('/src/boulderChase.ts');
 const m=await server.ssrLoadModule('/src/levels/rumblewater-run.ts'),spec=m.RUMBLEWATER_RUN_LEVEL.boulderChase;
 const stones=()=>Array.from({length:7},()=>({mesh:new THREE.Mesh(),box:new THREE.Box3(),r:spec.radius,speed:0}));
 const make=()=>new BoulderChase(spec,stones(),new THREE.Vector3(...m.RUMBLEWATER_RUN_LEVEL.spawn));
 assert.ok(validBoulderChase(spec));
 for(const forks of [null,Array(17).fill(spec.forks[0]),[{paths:[]}],[{paths:[spec.forks[0].paths[0].slice().reverse(),spec.forks[0].paths[1]]}],spec.forks.slice().reverse()])assert.ok(!validBoulderChase({...spec,forks}));
 for(let index=0;index<spec.forks.length;index++)for(const choice of [0,1]){
  const chase=make(),f=chase.forks[index],owner=chase.actors.find(a=>a.start<f.start&&a.end>=f.end);
  assert.ok(owner,'fork must fit between its cradle and gate');
  const sample=(s,route=choice)=>{
   const path=f.paths[route];let i=1;while(i<path.progress.length-1&&path.progress[i]<s)i++;
   const t=(s-path.progress[i-1])/(path.progress[i]-path.progress[i-1]);return path.points[i-1].clone().lerp(path.points[i],t);
  };
  // Explicit initial pursuer fixture; every subsequent move uses update().
  chase.stage=owner.index;owner.progress=f.start-2;owner.phase='chasing';owner.speed=owner.pace;owner.drop=0;
  owner.stone.mesh.position.copy(chase.sample(owner.progress)).y+=spec.radius;
  let frames=0,maxStep=0,chosenAfterLock=false;
  while(owner.progress<f.end-.001&&frames++<1200){
   const before=owner.stone.mesh.position.clone(),runnerAt=Math.min(f.end-6,Math.max(f.start+12,owner.progress+23));
   chase.update(1/60,sample(runnerAt));
   if(owner.progress>f.start+1){assert.equal(f.choice,choice,'follows the runner’s actual side');chosenAfterLock=true;}
   maxStep=Math.max(maxStep,owner.stone.mesh.position.distanceTo(before));
   assert.ok(owner.stone.mesh.position.distanceTo(before)<owner.pace/60+.005,'physical branch speed stays fixed without snapping');
   assert.ok(owner.crushBox.containsPoint(owner.stone.mesh.position),'crushing follows the real body');
  }
  assert.ok(chosenAfterLock&&frames<1200);assert.equal(f.locked,true);
  chase.update(1/60,sample(f.start+20,1-choice));assert.equal(f.choice,choice,'cannot switch through the middle after committing');
  chase.reset(sample(f.start+25,1-choice));assert.equal(f.choice,1-choice,'respawn forgets the previous attempt’s route');
  report.routes.push({name:m.RUMBLEWATER_FORKS[index].name,choice,frames,maxStep});
 }
 const c=make(),spawn=new THREE.Vector3(...m.RUMBLEWATER_RUN_LEVEL.spawn);
 for(let deaths=0;deaths<10;deaths++){
  if(deaths)c.recordDeath(spawn);c.reset(spawn);
  const scale=1-.04*Math.min(5,Math.max(0,deaths-2));assert.equal(c.actors[0].pace,spec.paces[0]*scale);report.retryScales.push(c.speedScale(0));
 }
 c.reset(new THREE.Vector3(...m.rumblePoint(324)));assert.equal(c.speedScale(),1,'new checkpoint starts at full speed');
 assert.equal(c.actors[1].pace,spec.paces[1]);c.reset(spawn,true);assert.ok(c.sectionDeaths.every(n=>n===0),'new run clears assistance');
 const straight={path:[[0,0,20],[0,0,-400]],radius:3,speed:20,headStart:20};
 const c2=new BoulderChase(straight,{mesh:new THREE.Mesh(),box:new THREE.Box3(),r:3,speed:0},new THREE.Vector3());
 const hidden=new THREE.Vector3(40,0,-30);let charged=0;
 for(let i=0;i<1800&&!c2.consumeLightning();i++){
  c2.update(1/60,hidden);if(c2.overtakenSeconds>0)charged++;
  if(c2.overtakenSeconds<3)assert.equal(c2.consumeLightning(),false);
 }
 assert.ok(charged>=180&&charged<=181,'three seconds of grace after the whole boulder passes');
 for(let i=0;i<600;i++){c2.update(1/60,hidden);assert.equal(c2.consumeLightning(),false,'only one strike per attempt');}
 c2.reset(new THREE.Vector3());assert.equal(c2.overtakenSeconds,0);assert.equal(c2.consumeLightning(),false);report.lightning=true;
 console.log(JSON.stringify(report));await mkdir('/private/tmp/rumblewater-chase-revision',{recursive:true});await writeFile('/private/tmp/rumblewater-chase-revision/forks.json',JSON.stringify(report,null,2));
}finally{await server.close();}
