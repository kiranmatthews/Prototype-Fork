import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

export const konaOptions={modulePath:'/src/levels/kona.ts',source:m=>m.KONA_LEVEL,levelId:'kona',controlFrame:({p})=>p.axisF};
await withBlockworksRuntime(async r=>{
 const {sourceModule:m,source,l,p,THREE,server}=r;
 const {normalizeCustomLevelData}=await server.ssrLoadModule('/src/level.ts');
 const count={components:source.components.length,vertices:0,triangles:0};
 for(const c of source.components.filter(c=>c.t==='mesh')){
  assert.ok(c.vertices.length<=12288,`${c.nm} mesh vertices`);assert.ok(c.indices.length<=12288,`${c.nm} mesh indices`);
  count.vertices+=c.vertices.length/3;count.triangles+=c.indices.length/3;
 }
 console.log(JSON.stringify(count));assert.ok(normalizeCustomLevelData(source),'editor round trip must accept the entire park');
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),hits=[];
 function support(q){ray.set(new THREE.Vector3(q[0],30,q[2]),down);hits.length=0;ray.intersectObjects(l.groundMeshes,false,hits);return hits[0];}
 const probes=[];
 for(const b of m.KONA_BOWLS){const hit=support(b.centre);probes.push({name:b.name,wanted:b.bottom,actual:hit?.point.y,surface:hit?.object.name});assert.ok(hit&&Math.abs(hit.point.y-b.bottom)<.12,`${b.name} must have a recessed supported bottom, without a foundation lid`);}
 for(let i=2;i<m.KONA_SNAKE.points.length-4;i+=9){const q=m.KONA_SNAKE.points[i],hit=support(q);assert.ok(hit&&Math.abs(hit.point.y-q[1])<.15,`Snake centre ${i}: wanted ${q[1]}, got ${hit?.point.y} on ${hit?.object.name}`);}
 r.stepFor(120);assert.ok(p.grounded&&p.boardRolling,'spawn must settle mounted');assert.equal(p.totalDeaths,0);
 console.log(JSON.stringify({probes,spawn:r.snapshot(),snakeProbes:Math.ceil(m.KONA_SNAKE.points.length/9),pipes:l.halfpipes.length,rails:l.rails.length}));
 assert.equal(m.KONA_PIPES.length,3);assert.ok(m.KONA_SNAKE.points.length>100);assert.ok(m.KONA_SNAKE.points.every(p=>p.every(Number.isFinite)));assert.equal(l.checkpoints.length,5);

 const normalized=normalizeCustomLevelData(source);
 assert.equal(normalized.components.filter(c=>c.coping===true).length,source.components.filter(c=>c.coping===true).length,'save/load must preserve authored coping');
 assert.ok(l.groundMeshes.filter(mesh=>mesh.userData.vert===true&&['Spinal grooves','Tombstone','Over the roll-in / timber vert'].includes(mesh.name)).every(mesh=>mesh.userData.authoredVertMesh===true),'custom vert meshes need native contact and landing support');
 for(const cp of m.KONA_CHECKPOINTS){const hit=support(cp.p);assert.ok(hit&&Math.abs(hit.point.y-cp.p[1])<.15,`${cp.name} checkpoint needs supported ground`);}
 const {Rail}=await server.ssrLoadModule('/src/rails.ts');
 const originalRails=l.rails,bar=new Rail([new THREE.Vector3(.5,1.2,-3),new THREE.Vector3(.5,1.2,3)]);
 l.rails=[bar];
 const contact=(coping,vert)=>{bar.coping=coping;p.pos.set(0,.2,0);p.prevPos.set(-.1,.2,0);p.axisF.set(1,0,0);p.axisL.set(0,0,-1);p.speed=6;p.freeSkate=p.grounded=true;p.state='ride';p.groundHit={y:.2,normal:new THREE.Vector3(-.58,.81,0).normalize(),vert,name:'mini transition'};p.railBlock(l);return{position:p.pos.clone(),speed:p.speed};};
 const lip=contact(true,true);assert.equal(lip.position.x,0,'shallow vert coping caught the rider before the steep section');assert.equal(lip.speed,6);
 const street=contact(false,true);assert.ok(street.position.x<-.1&&street.speed<6,'ordinary street rails must still block a grounded approach');
 const unconnected=contact(true,false);assert.ok(unconnected.position.x<-.1,'a high coping line on ordinary ground must remain solid');
 l.rails=originalRails;
 console.log('PASS authored vert contact tags, coping round trip, shallow transition clearance and ordinary rail collision');
 console.log('PASS Kona editor round trip, recessed bowls, complete snake support and mounted spawn');
},konaOptions);
