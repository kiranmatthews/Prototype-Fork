import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const report={solids:0,scenerySolids:0,triangles:0,vertices:0,closedEdges:0,bankClearance:0,shoreGrass:0};
await withBlockworksRuntime(async r=>{
 const {source:d,sourceModule:m,THREE,l}=r;
 const {normalizeCustomLevelData,levelJsonTextWithinLimits,MAX_LEVEL_PACK_BYTES}=await r.server.ssrLoadModule('/src/level.ts');
 const {validAtmosphere,resolveDataAtmosphere}=await r.server.ssrLoadModule('/src/levelAtmosphere.ts');
 assert.ok(normalizeCustomLevelData(structuredClone(d)),'detailed source respects retained editor work limits');
 const pack=await readFile(new URL('../public/levels.json',import.meta.url),'utf8');
 assert.ok(levelJsonTextWithinLimits(pack,MAX_LEVEL_PACK_BYTES,14),'entire current pack is importable');
 assert.equal(d.sky,'sunset');const sun=new THREE.Vector3(...d.atmosphere.sunDirection).normalize();
 const elevation=Math.asin(sun.y)*180/Math.PI;assert.ok(elevation>10&&elevation<25,'sun casts low evening light');
 for(const direction of [[0,0,0],[1,0],[1,0,0,1],[2,0,0],[0,NaN,1],'sunset'])assert.equal(validAtmosphere({sunDirection:direction}),false,'sun vectors are finite bounded nonzero triples');
 assert.equal(resolveDataAtmosphere({v:1,name:'Default',spawn:[0,1,0],killY:-10,components:[]}).sunDirection,undefined,'existing levels retain their existing directional-light policy');
 assert.deepEqual(l.captureData(),JSON.parse(JSON.stringify(d)),'editor capture retains authored atmosphere and geometry');
 assert.ok(d.components.filter(c=>c.t==='pit').every(c=>c.invisible),'hazard volumes do not replace river water with black plates');
 assert.ok(Math.abs(m.custardHeight(1642)-m.custardWaterHeight(1642)-1.1)<.001,'ferry freeboard meets its raised basin');
 const ferry=l.movers.find(v=>d.components[v.mesh.userData.editorIdx]?.nm==='Reedbed ferry');
 assert.ok(ferry);l.root.updateMatrixWorld(true);const floats=[];
 ferry.mesh.traverse(o=>{if(!o.isInstancedMesh||o.parent.userData.woodPathPartRole!=='pole')return;
  assert.ok(!l.groundMeshes.includes(o),'ferry dressing adds no collider');
  for(let i=0;i<o.count;i++){const matrix=new THREE.Matrix4();o.getMatrixAt(i,matrix);matrix.premultiply(o.matrixWorld);o.geometry.computeBoundingBox();const box=o.geometry.boundingBox.clone().applyMatrix4(matrix),size=box.getSize(new THREE.Vector3());
   if(size.z>8&&size.x<1.1)floats.push(box);
  }
 });
 assert.equal(floats.length,3,'three actual long timber pontoons');
 for(const box of floats){assert.ok(box.min.y<m.custardWaterHeight(1642)+.01,'float reaches the waterline');assert.ok(box.max.y<m.custardHeight(1642)-.2,'floats stay below the original walk surface');}
 report.ferryPontoons=floats.length;
 let dryFootProbes=0;
 for(const road of m.CUSTARD_CREEK_ROADS)for(let s=road.a+.2;s<road.b-.2;s+=2)for(const side of [-.42,0,.42]){
  const value=v=>typeof v==='function'?v(s):v,p=m.custardPoint(s,m.custardHeight(s),value(road.offset)+side*value(road.width));
  const body=new THREE.Box3(new THREE.Vector3(p[0]-.45,p[1]+.02,p[2]-.45),new THREE.Vector3(p[0]+.45,p[1]+1.8,p[2]+.45));
  assert.ok(!l.pitBoxes.some(box=>box.intersectsBox(body)&&!l.pitMissesPoly(box,p[0],p[2])),'river resets never intersect the actual playable lane');dryFootProbes++;
 }
 report.dryFootProbes=dryFootProbes;
 const failures=[];
 for(const c of d.components.filter(c=>c.t==='mesh'&&c.tex==='coast-terrain')){
  const verts=c.vertices,indices=c.indices,canonical=new Map(),ids=[];
  for(let i=0;i<verts.length;i+=3){const key=verts.slice(i,i+3).map(v=>Math.round(v*10000)).join(',');if(!canonical.has(key))canonical.set(key,canonical.size);ids.push(canonical.get(key));}
  const edges=new Map();let volume=0;
  for(let i=0;i<indices.length;i+=3){const a=new THREE.Vector3().fromArray(verts,indices[i]*3),b=new THREE.Vector3().fromArray(verts,indices[i+1]*3),c=new THREE.Vector3().fromArray(verts,indices[i+2]*3);
   assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()>1e-10,'finite non-degenerate rock triangle');
   volume+=a.dot(b.clone().cross(c))/6;
   for(let j=0;j<3;j++){const a=ids[indices[i+j]],b=ids[indices[i+(j+1)%3]],key=a<b?`${a}:${b}`:`${b}:${a}`,e=edges.get(key)??{n:0,w:0};e.n++;e.w+=a<b?1:-1;edges.set(key,e);}
  }
  const bad=[...edges].filter(([,v])=>v.n!==2||v.w!==0);if(bad.length||volume<=0)failures.push({name:c.nm,p:c.p,bad:bad.slice(0,4),volume});
  assert.ok(c.uvs.every(Number.isFinite)&&c.normals.every(Number.isFinite));
  for(let i=0;i<c.normals.length;i+=3)assert.ok(Math.abs(Math.hypot(...c.normals.slice(i,i+3))-1)<.001,'unit baked rock normal');
  report.closedEdges+=edges.size;report.vertices+=verts.length/3;report.triangles+=indices.length/3;
  if(c.solid===false)report.scenerySolids++;else report.solids++;
 }
 assert.deepEqual(failures,[],'native and scenic stone volumes are closed, outward wound manifolds after UV seam welding');
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);l.root.updateMatrixWorld(true);
 const bank=l.groundMeshes.filter(o=>d.components[o.userData.editorIdx]?.t==='vertramp');
 const foundation=[];l.root.traverse(o=>{if(o.isMesh&&d.components[o.userData.editorIdx]?.nm==='Custard spillway outer stone mass')foundation.push(o);});
 for(let s=852;s<1159;s+=2.7)for(const u of [-8.6,-8.2,-7.9,7.9,8.2,8.6]){
  const p=m.custardPoint(s,m.custardHeight(s)+5,u);ray.set(new THREE.Vector3(...p),down);ray.far=20;
  const native=ray.intersectObjects(bank,false)[0],rock=ray.intersectObjects(foundation,false)[0];
  if(native&&rock){assert.ok(rock.point.y<native.point.y-.04,`spillway backing remains below actual ride at ${s}/${u}`);report.bankClearance++;}
 }
 assert.ok(report.bankClearance>400,'actual curved bank overlap sampled across the whole descent');
 const shoulder=[];l.root.traverse(o=>{if(o.isMesh&&d.components[o.userData.editorIdx]?.nm==='Custard sculpted low river shoulder')shoulder.push(o);});
 for(const grass of d.components.filter(c=>c.nm?.startsWith('Custard riverbank meadow'))){
  ray.set(new THREE.Vector3(grass.p[0],grass.p[1]+.2,grass.p[2]),down);ray.far=.5;
  const hit=ray.intersectObjects(shoulder,false)[0];assert.ok(hit&&Math.abs(hit.point.y-grass.p[1])<.025,'meadow blades meet the actual interpolated shoulder');report.shoreGrass++;
 }
 report.elevation=elevation;report.bytes=Buffer.byteLength(JSON.stringify(d));report.components=d.components.length;
 await writeFile('/private/tmp/custard-sunset-surface-proof.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
},{modulePath:'/src/levels/custard-creek.ts',levelId:'custard-creek',source:m=>m.CUSTARD_CREEK_LEVEL});
