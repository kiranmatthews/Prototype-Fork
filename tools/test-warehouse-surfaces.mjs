import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
import {warehouseUV} from './warehouse-reference-cases.mjs';
await withSkateRuntime(async({THREE,server,scene,Level,player:p,CONST})=>{
 const source=await server.ssrLoadModule('/src/levels/codex-lab.ts'),data=source.WAREHOUSE_REFERENCE_LEVEL,point=source.warehousePoint;
 const level=new Level(scene,{id:'warehouse-reference',name:data.name,data});scene.updateMatrixWorld(true);
 const names=['Raised loading bay deck','Left smooth roll-in','Right smooth roll-in','Box shelf return bank','Kicker gap · launch','Kicker gap · receiver','Taxi transfer · hood roof boot'];
 const solids=[];
 for(const name of names){
  const c=data.components.find(c=>c.nm===name),edges=new Map();let degenerate=0,volume=0;
  assert.ok(c?.vertices&&c.indices,name);
  const vertex=i=>new THREE.Vector3(...c.vertices.slice(i*3,i*3+3));
  const key=v=>v.toArray().map(n=>Math.round(n*1e6)).join(',');
  for(let i=0;i<c.indices.length;i+=3){
   const a=vertex(c.indices[i]),b=vertex(c.indices[i+1]),d=vertex(c.indices[i+2]);
   if(b.clone().sub(a).cross(d.clone().sub(a)).lengthSq()<1e-14)degenerate++;
   volume+=a.dot(b.clone().cross(d))/6;
   for(const [x,y]of [[a,b],[b,d],[d,a]]){const k=[key(x),key(y)].sort().join('/');edges.set(k,(edges.get(k)||0)+1);}
  }
  const open=[...edges.values()].filter(n=>n!==2).length;
  solids.push({name,triangles:c.indices.length/3,open,degenerate,volume});
  assert.equal(open,0,`${name}: open/nonmanifold edge`);assert.equal(degenerate,0,`${name}: degenerate triangle`);assert.ok(volume>0,`${name}: reversed shell`);
 }
 const ray=new THREE.Raycaster(),faceRays=[];
 for(const [name,u,v,y,dir,targetV]of [
  ['Kicker gap · launch',437,90,.5,-1,81],['Kicker gap · receiver',480,90,.5,-1,81],
  ['Taxi transfer · hood roof boot',520,260,.5,1,269],['Raised loading bay deck',230,170,.8,-1,157],
  ['Left smooth roll-in',200,213,1,-1,208],['Near wall · below channels · closed end',260,299,.4,1,306],
 ]){
  ray.set(new THREE.Vector3(...point(u,v,y)),new THREE.Vector3(dir,0,0));ray.far=5;
  const hit=ray.intersectObjects(level.groundMeshes,false).find(h=>h.object.name===name);
  const expected=Math.abs(targetV-v)*source.WAREHOUSE_SCALE,error=hit?Math.abs(hit.distance-expected):Infinity;
  faceRays.push({name,hit:!!hit,distance:hit?.distance,expected,error});assert.ok(error<.002,`${name}: missing or misplaced side face`);
 }
 const seams=[];
 for(let u=303;u<=473;u++){
  const heights=[];
  for(const offset of [-.01,.01]){
   const o=new THREE.Vector3(...point(u,208,25));o.x+=offset;ray.set(o,new THREE.Vector3(0,-1,0));ray.far=40;
   heights.push(ray.intersectObjects(level.groundMeshes,false)[0]?.point.y??NaN);
  }
  seams.push({u,heights,step:Math.abs(heights[1]-heights[0])});
 }
 assert.ok(seams.every(r=>Number.isFinite(r.step)&&r.step<.02),'The mouth must meet the U/deck/bank with continuous support');
 const impacts=[];
 for(const c of [
  {name:'launch kicker side',at:[437,95,0],h:[-1,0,0],plane:81,side:1},
  {name:'receiver kicker side',at:[480,95,0],h:[-1,0,0],plane:81,side:1},
  {name:'taxi side',at:[520,254,0],h:[1,0,0],plane:269,side:-1},
 ]){
  p.respawn(level,true,true,{position:new THREE.Vector3(...point(...c.at)).add(new THREE.Vector3(0,.12,0)),heading:new THREE.Vector3(...c.h)});
  p.axisF.set(...c.h);p.axisL.set(p.axisF.z,0,-p.axisF.x);p.freeSkate=true;p.speed=5;
  p.groundHit=p.queryGround(level);if(p.groundHit)p.rideNormal.copy(p.groundHit.normal);
  let closest=Infinity,bails=0,contact=false;
  for(let i=0;i<150;i++){
   p.step(CONST.fixedStep,makeInput(),level);level.update(CONST.fixedStep);
   const uv=warehouseUV(p,source),distance=(uv[1]-c.plane)*c.side*source.WAREHOUSE_SCALE;
   closest=Math.min(closest,distance);bails+=p.isBailing;contact||=p.softSkateImpactT>0;
  }
  const r={name:c.name,closest,bails,contact,end:p.pos.toArray()};impacts.push(r);
  if(!process.argv.includes('--probe')){assert.ok(closest>.25&&closest<.85,`${c.name}: body passed through or stopped away from visible side`);assert.equal(bails,0);assert.ok(contact,`${c.name}: did not exercise a native side collision`);}
 }
 const report={solids,faceRays,seams:{samples:seams.length,maxStep:Math.max(...seams.map(s=>s.step)),worst:seams.sort((a,b)=>b.step-a.step).slice(0,5)},impacts,groundMeshes:level.groundMeshes.length,walls:level.walls.length};
 if(process.env.WAREHOUSE_REPORT)await writeFile(process.env.WAREHOUSE_REPORT,JSON.stringify(report,null,2));console.log(JSON.stringify(report));level.dispose();
});
