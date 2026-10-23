import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const survey=JSON.parse(await readFile(new URL('../docs/mall/source-survey.json',import.meta.url),'utf8'));
await withBlockworksRuntime(async r=>{
 const {sourceModule:m,source,p,l,THREE}=r,{normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 if(!normalizeCustomLevelData(JSON.parse(JSON.stringify(source)))){
  const bad=source.components.map((c,i)=>({c,i})).filter(({c})=>!normalizeCustomLevelData({v:1,name:'Component probe',spawn:[0,1,0],killY:-10,components:[c]}));
  console.log(JSON.stringify({invalid:bad.slice(0,3).map(({c,i})=>({i,...c,vertices:c.vertices?.length,indices:c.indices?.length,uvs:c.uvs?.length}))}));
 }
 assert.ok(normalizeCustomLevelData(JSON.parse(JSON.stringify(source))),'Measured Mall must survive an editor save/load');
 const k=p=>p.map(x=>x.toFixed(6)).join(','),vertices=new Set(source.components.filter(c=>c.t==='mesh').flatMap(c=>Array.from({length:c.vertices.length/3},(_,i)=>k(c.vertices.slice(i*3,i*3+3)))));
 let controls=0;for(const mesh of survey.meshes.filter(s=>s.id>=18&&s.id<54))for(const i of new Set(mesh.indices)){const q=m.mallPoint(...mesh.vertices.slice(i*3,i*3+3));assert.ok(vertices.has(k(q)),`Measured control vertex ${mesh.id}:${i} changed`);controls++;}
 const report={controls,components:source.components.length,stats:m.MALL_SURVEY_STATS,checkpoints:[],probes:[],boundary:null};
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),meshes=l.groundMeshes.filter(o=>o.name.endsWith('/ surface'));
 for(const mesh of survey.meshes.filter(s=>s.id>=18&&s.id<54))for(let i=0;i<mesh.indices.length;i+=3*67){
  if(mesh.flags[i/3]&24||[19,20,38].includes(mesh.id)||mesh.id>=33&&mesh.id<=37)continue;
  const points=mesh.indices.slice(i,i+3).map(j=>new THREE.Vector3(...m.mallPoint(...mesh.vertices.slice(j*3,j*3+3)))),n=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();if(n.y<.7)continue;
  const q=points.reduce((a,b)=>a.add(b),new THREE.Vector3()).multiplyScalar(1/3);ray.set(q.clone().addScaledVector(THREE.Object3D.DEFAULT_UP,.08),down);ray.near=0;ray.far=.2;
  const hits=ray.intersectObjects(meshes,false);if(!hits.length)continue; // refined transition patches have separate contact checks
  const error=Math.min(...hits.map(h=>Math.abs(h.point.y-q.y)));
  assert.ok(error<.025,`Surface ${mesh.id}:${i/3} differs from its measured plane: ${error}`);report.probes.push({source:mesh.id,triangle:i/3,error});
 }
 assert.ok(report.probes.length>55);
 r.stepFor(12);assert.ok(p.grounded,'supported measured restart');
 for(const [i,c]of l.checkpoints.entries()){ray.set(c.spawnPos.clone().add(new THREE.Vector3(0,.2,0)),down);ray.far=.5;const hits=ray.intersectObjects(l.groundMeshes,false);assert.ok(hits.length&&Math.abs(hits[0].point.y-m.MALL_CHECKPOINTS[i][1])<.03,`Checkpoint ${i} changed storey`);report.checkpoints.push(c.spawnPos.toArray());}
 // The source's curved garden skirt uses three triangles rather than a pair
 // of rectangles. Approach it from its lower lane with normal input.
 const start=m.mallPoint(-1480,-915.4849,5330),heading=new THREE.Vector3(0,0,-1);start[1]+=.1;
 p.respawn(l,true,false,{position:new THREE.Vector3(...start),heading});p.axisF.copy(heading);p.axisL.set(1,0,0);
 let contact=false,peak=0;
 for(let i=0;i<160;i++){const before=p.speed;r.tick({moveY:1,jumpHeld:true});peak=Math.max(peak,p.speed);if(peak>5&&(p.isBailing||p.speed<before*.5)){report.boundary={frame:i,source:m.mallSourcePoint(...p.pos.toArray()),speed:p.speed,peak,state:p.state};contact=true;break;}}
 assert.ok(contact,'Curved garden skirt must stop a frontal approach');assert.ok(report.boundary.source[0]<-1290,'Contact must occur before entering the raised island');assert.ok(report.boundary.source[1]>-930,'Boundary contact must not fall under the island');
 assert.equal(source.components.filter(c=>c.t==='gate').length,1);assert.equal(l.checkpoints.length,5);
 await writeFile('/private/tmp/mall-recreation/measured/surfaces.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,probes:report.probes.length}));
},{modulePath:'/src/levels/mall-measured.ts',source:m=>m.MALL_LEVEL,levelId:'mall',endlessDeaths:true,maxFrames:3000,controlFrame:r=>r.p.axisF});
