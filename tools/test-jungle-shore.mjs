import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const report={drySandProbes:0,inlandProbes:0,swims:[]};
await withBlockworksRuntime(async r=>{
 const {l,p,THREE}=r;
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 assert.ok(normalizeCustomLevelData(l.captureData()),'edited cove survives capture/import');
 const sand=r.source.components.find(c=>c.nm==='Jungle cove beach and seabed');
 const [cx,cy]=sand.p,ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),camera=new THREE.PerspectiveCamera();
 const water=l.water.group.getObjectByName('Unity curved shoreline ocean ribbon');
 const horizon=l.water.group.getObjectByName('Unity ocean horizon fill');
 for(let x=cx-14;x<=cx+14;x+=.5)for(let z=14;z<=30;z+=.25){
  ray.set(new THREE.Vector3(x,cy+6,z),down);
  const ground=ray.intersectObjects(l.groundMeshes,false)[0];
  if(!ground||ground.point.y<l.water.seaLevel+.15)continue;
  assert.equal(ray.intersectObject(water).length,0,`detailed water over dry sand ${x}/${z}`);
  assert.equal(ray.intersectObject(horizon).length,0,`far water over dry sand ${x}/${z}`);
  report.drySandProbes++;
 }
 assert.ok(report.drySandProbes>1000,'dense coverage of the curved sand-water edge');
 for(const c of r.source.components.filter(c=>c.t==='camnode'&&!c.cameraView&&c.p[2]<0)){
  ray.set(new THREE.Vector3(c.p[0],l.water.seaLevel+10,c.p[2]),down);
  assert.equal(ray.intersectObject(horizon).length,0,'opening sea cannot cover inland hollows');
  assert.equal(l.swimmingSurfaceAt(c.p[0],c.p[2]),null,'no inland swimming volume');report.inlandProbes++;
 }
 for(const offset of [-7,0,7]){
  // Captured meshes recenter their local vertices. Their p.y is not a deck
  // height: begin on the actual sand triangle, as a normal player would.
  ray.set(new THREE.Vector3(cx+offset,20,18),down);
  const floor=ray.intersectObjects(l.groundMeshes,false)[0];assert.ok(floor);
  const start=[cx+offset,floor.point.y+.06,18];
  p.respawn(l,true,false,{position:new THREE.Vector3(...start),heading:new THREE.Vector3(0,0,1)});
  const step=input=>{l.water.update(r.dt,camera);r.tick(input);assert.equal(p.totalDeaths,0,'recoverable cove swim');};
  let entry;
  for(let i=0;i<900;i++){
   step(r.worldDirectionInput(new THREE.Vector3(0,0,1),.8));
   if(p.state==='swim'&&!entry)entry=p.pos.toArray();
   if(entry&&p.pos.z>43)break;
  }
  assert.ok(entry&&entry[2]>25,'walk from dry sand into swimming depth');assert.equal(p.state,'swim',JSON.stringify({offset,entry,position:p.pos.toArray()}));
  const deep=p.pos.toArray();let returned=false;
  for(let i=0;i<1100;i++){
   step(r.steerToward(start,{pace:.8}));
   if(p.grounded&&Math.hypot(p.pos.x-start[0],p.pos.z-start[2])<.7){returned=true;break;}
  }
  assert.ok(returned,'swimmer can walk back onto supported sand');
  report.swims.push({offset,entry,deep,returned:p.pos.toArray(),deaths:p.totalDeaths});
 }
},{modulePath:'/src/level.ts',levelId:'jungle',source:m=>{
 const l=new m.Level(new THREE.Scene(),{id:'jungle',name:'Jungle Ruins'}),data=l.captureData();l.dispose();return data;
},controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir});
await writeFile(process.env.JUNGLE_SHORE_REPORT||'/private/tmp/jungle-shore-native.json',JSON.stringify(report,null,2)+'\n');
console.log(`PASS ${report.drySandProbes} dry-sand probes, ${report.inlandProbes} inland probes and three input-only swim/return journeys.`);
