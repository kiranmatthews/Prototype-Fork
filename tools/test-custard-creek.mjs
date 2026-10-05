import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const options={modulePath:'/src/levels/custard-creek.ts',levelId:'custard-creek',source:m=>m.CUSTARD_CREEK_LEVEL,
 controlFrame:r=>r.p.courseInputDirection(r.l)??r.l.laneDirAt(r.p.pos.x,r.p.pos.y,r.p.pos.z)??{x:0,z:-1}};
const report={inventory:null,support:0,voids:0};
await withBlockworksRuntime(async r=>{
 const m=r.sourceModule,{CARLISLE_COAST_LEVEL:coast}=await r.server.ssrLoadModule('/src/levels/carlisle-coast.ts');
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 const normalized=normalizeCustomLevelData(structuredClone(r.source));
 if(!normalized){
  const invalid=[];
  for(const [i,c] of r.source.components.entries())if(!normalizeCustomLevelData({...r.source,components:[structuredClone(c)]}))invalid.push({i,t:c.t,nm:c.nm,vertices:c.vertices?.length,indices:c.indices?.length,pts:c.pts?.length});
  console.log('INVALID COMPONENTS',JSON.stringify(invalid));
  let low=1,high=r.source.components.length;
  while(low<high){const n=Math.floor((low+high)/2);if(normalizeCustomLevelData({...r.source,components:r.source.components.slice(0,n)}))low=n+1;else high=n;}
  console.log('FIRST GLOBAL BUDGET FAILURE',low,r.source.components[low-1]?.t,r.source.components[low-1]?.nm);
 }
 assert.ok(normalized);
 const pack=JSON.parse(await readFile(new URL('../public/levels.json',import.meta.url),'utf8'));
 assert.deepEqual(pack.levels.find(l=>l.id==='custard-creek').data,JSON.parse(JSON.stringify(r.source)));
 for(const t of ['enemy','stone','crusher','pendulum','mover','ropeswing','crumble','rail','vertramp','checkpoint','crate','gate'])
  assert.equal(r.source.components.filter(c=>c.t===t).length,coast.components.filter(c=>c.t===t).length,`${t}: retain the actual Coast gameplay`);
 report.inventory=m.CUSTARD_CREEK_GAMEPLAY;
 assert.equal(m.CUSTARD_CREEK_BOX_SECTIONS.length,20);
 for(const kind of new Set(coast.components.filter(c=>c.t==='crate').map(c=>c.kind)))assert.ok(r.source.components.some(c=>c.t==='crate'&&c.kind===kind),kind);
 assert.ok(r.l.laneActive);r.stepFor(20);assert.ok(r.p.grounded);
 const ray=new r.THREE.Raycaster(),down=new r.THREE.Vector3(0,-1,0);
 const floor=(p,far=3,meshes=r.l.groundMeshes)=>{ray.set(new r.THREE.Vector3(p[0],p[1]+.15,p[2]),down);ray.far=far;return ray.intersectObjects(meshes,false)[0];};
 const fail=[];
 for(const c of r.source.components.filter(c=>c.t==='crate'||c.t==='checkpoint')) {
  const hit=floor(c.p);
  const stacked=r.source.components.some(b=>b!==c&&b.t==='crate'&&Math.abs(b.p[0]-c.p[0])<.01&&Math.abs(b.p[2]-c.p[2])<.01&&Math.abs(c.p[1]-b.p[1]-.96)<.015);
  if(!stacked&&(!hit||Math.abs(hit.point.y-c.p[1])>.16))fail.push({name:c.nm,p:c.p,hit:hit?.point.y});report.support++;
 }
 assert.deepEqual(fail,[],'boxes/checkpoints stay supported after curvature');
 const staticFloors=r.l.groundMeshes.filter(o=>r.source.components[o.userData.editorIdx]?.t==='mesh'&&r.source.components[o.userData.editorIdx]?.solid!==false);
 for(const point of [[0,-13,-380],[0,-13,-625],[0,-13.5,-874],[152,-26,-2110]]){
  const p=m.custardWarp(point);assert.equal(floor(p,4,staticFloors),undefined,'do not fill a compulsory challenge gap');report.voids++;
 }
 assert.ok(r.l.crushers.length===2&&r.l.pendulums.length===2&&r.l.movers.length===2);
 // A simple held skating input must encounter real gameplay rather than
 // silently finish the whole level. This is a negative acceptance test.
 let challenged=false;
 for(let i=0;i<1200;i++){
  r.tick({moveY:1,jumpHeld:true});
  if(r.p.isBailing||['dead','gameover','grind'].includes(r.p.state)||!r.p.grounded&&r.p.vVel< -4){challenged=true;break;}
 }
 assert.ok(challenged,'the new course cannot be cleared by one held skate input');
 await writeFile('/private/tmp/custard-gameplay-structure.json',JSON.stringify(report,null,2));
},options);
console.log(JSON.stringify(report,null,2));
