import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
const bundled=await build({stdin:{contents:"export {CarlisleRigging} from './src/carlisleRigging'; export {Rail} from './src/rails'; export {roundCorners} from './src/pathNodes'; export * as THREE from 'three'; export {CARLISLE_TIDAL_RELAY_LEVEL} from './src/levels/carlisle-tidal-relay';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const {CarlisleRigging,Rail,roundCorners,THREE,CARLISLE_TIDAL_RELAY_LEVEL:level}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const rigging=new CarlisleRigging(),root=new THREE.Group(),report={rows:[]},ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
for(const c of level.components.filter(c=>c.t==='rail'&&/cable/.test(c.nm??''))){
 const points=roundCorners(c.pts,false).map(p=>new THREE.Vector3(c.p[0]+p.x,c.p[1]+p.y,c.p[2]+p.z)),rail=new Rail(points,false),before=points.map(p=>p.toArray());root.add(rail.object);rigging.add(c,rail.object);root.updateMatrixWorld(true);
 const group=rail.object.children[0],braid=group.getObjectByName('Seven steel rope strands'),row={name:c.nm,length:rail.totalLength,vertices:braid.geometry.attributes.position.count,raySamples:0,maxCrown:-Infinity,minCrown:Infinity,maxLateral:0};
 assert.deepEqual(rail.points.map(p=>p.toArray()),before,'dressing moved the native path');assert.ok(Math.abs(group.userData.rigging.length-rail.totalLength)<1e-8,'cable length differs from native path');
 group.traverse(n=>{if(!n.isMesh)return;for(const a of Object.values(n.geometry.attributes))for(const value of a.array)assert.ok(Number.isFinite(value));});
 const p=new THREE.Vector3();
 // Every strand vertex is checked against the native closest point, including
 // the six-segment bends and descending return/homecoming lines.
 for(let i=0;i<row.vertices;i++){
  p.fromBufferAttribute(braid.geometry.attributes.position,i).applyMatrix4(braid.matrixWorld);const sample=rail.closest(p),delta=p.clone().sub(sample.point);row.maxCrown=Math.max(row.maxCrown,delta.y);row.minCrown=Math.min(row.minCrown,delta.y);row.maxLateral=Math.max(row.maxLateral,Math.hypot(delta.x,delta.z));
  assert.ok(delta.y<=.091,'strand rises above native chrome crown');assert.ok(delta.y>=-group.userData.rigging.maxDrop-.2,'strand hangs outside cable envelope');assert.ok(row.maxLateral<.245,'strand drifts from the authored cable');
 }
 for(let distance=1;distance<rail.totalLength-1;distance+=.75){
  const at=rail.pointAt(distance);ray.set(at.clone().addScaledVector(THREE.Object3D.DEFAULT_UP,1),down);ray.far=1.5;const hit=ray.intersectObject(group,true)[0];assert.ok(hit,'cable skin has a hole under the native grind path');const crown=hit.point.y-at.y;assert.ok(crown<=.091&&crown>-.18,'cable contact appearance no longer follows native grind line: '+JSON.stringify({name:c.nm,distance,crown,part:hit.object.name}));row.raySamples++;
 }
 assert.equal(group.children.filter(n=>n.name==='Winch cable fairlead').length,2);report.rows.push(row);
}
assert.equal(report.rows.length,4);report.diagnostics={...rigging.diagnostics};
const geometries=new Set(),materials=new Set();root.traverse(n=>{if(n.isMesh){geometries.add(n.geometry);materials.add(n.material);}});let disposedGeometry=0,disposedMaterial=0;geometries.forEach(g=>g.addEventListener('dispose',()=>disposedGeometry++));materials.forEach(m=>m.addEventListener('dispose',()=>disposedMaterial++));
rigging.dispose();assert.ok(root.children.every(n=>n.children.length===0));assert.equal(disposedGeometry,geometries.size);assert.equal(disposedMaterial,materials.size);report.disposal={geometries:disposedGeometry,materials:disposedMaterial};report.passed=true;
await mkdir('art/carlisle-shipyard/rigging',{recursive:true});await writeFile('art/carlisle-shipyard/rigging/geometry.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
