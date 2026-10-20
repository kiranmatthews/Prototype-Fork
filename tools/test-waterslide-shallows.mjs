import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const {normalizeCustomLevelData,Level,setEditorBuild}=await r.server.ssrLoadModule('/src/level.ts');
 assert.ok(normalizeCustomLevelData(r.source),'new water surfaces round-trip through the editor schema');
 const pockets=r.source.components.filter(c=>c.tex==='waterslide-shallows');assert.equal(pockets.length,7);
 assert.equal(r.source.components.filter(c=>c.swimDepth).length,8);assert.equal(r.source.skateRace.jumps.length,18);
 const floors=r.l.groundMeshes.filter(m=>{const c=r.source.components[m.userData.editorIdx];return c&&c.grp<420&&['mesh','vertramp'].includes(c.t)&&!c.outOfBounds&&c.solid!==false;});
 const ray=new r.THREE.Raycaster(),down=new r.THREE.Vector3(0,-1,0),report=[];
 for(const c of pockets){
  assert.equal(c.solid,false);assert.equal(c.scenerySolid,false);assert.equal(c.castShadow,false);assert.equal(c.swimDepth,undefined);
  const mesh=r.l.root.getObjectByName(c.nm);assert.ok(mesh);assert.ok(!r.l.groundMeshes.includes(mesh));assert.equal(mesh.material.depthWrite,false);
  assert.equal(mesh.material.map,null);assert.equal(mesh.material.normalMap,null);assert.equal(mesh.material.envMap,null);
  assert.equal(mesh.material.customProgramCacheKey(),'waterpark-shallow-pool-v1');
  const edges=new Map(),depths=[];
  for(let i=0;i<c.indices.length;i+=3){
   const ids=c.indices.slice(i,i+3);
   for(let j=0;j<3;j++){const key=[ids[j],ids[(j+1)%3]].sort((a,b)=>a-b).join(',');edges.set(key,(edges.get(key)??0)+1);}
   // Check every corner and triangle centre against the real collider, not
   // the source knot approximation used to find the initial low point.
   const vertices=ids.map(i=>new r.THREE.Vector3(...c.vertices.slice(i*3,i*3+3)).add(new r.THREE.Vector3(...c.p)));
   const centre=vertices.reduce((p,v)=>p.add(v),new r.THREE.Vector3()).multiplyScalar(1/3);
   // Mesh positions use Float32 and the bake rounds to 10 micrometres.
   // Step at most 0.1 mm inside each face for boundary rays.
   const samples=[...vertices.map(v=>v.clone().add(centre.clone().sub(v).clampLength(0,.0001))),centre];
   for(const point of samples){
    ray.set(point.clone().addScaledVector(down,-.04),down);ray.far=.4;
    const floor=ray.intersectObjects(floors,false)[0];assert.ok(floor,`${c.nm}: water extends past support at ${point.toArray()}`);
    const depth=point.y-floor.point.y;assert.ok(depth>=-.001&&depth<=.225,`${c.nm}: depth ${depth}`);depths.push(depth);
   }
  }
  for(const [edge,count]of edges){assert.ok(count<=2,'manifold water patch');if(count===1)for(const id of edge.split(',').map(Number))assert.ok(c.uvs[id*2]<.001,'every shoreline terminates against the rising floor');}
  assert.ok(c.vertices.filter((_,i)=>i%3===1).every(y=>y===0),'pooled water is horizontal');
  report.push({name:c.nm,triangles:c.indices.length/3,maxDepth:Math.max(...depths),probes:depths.length});
 }
 // Both loose editor and play copies retain the material choice and measured
 // depth attributes. The inherited source data remains editable.
 const data={v:1,name:'Measured shallow pools',spawn:[0,1,0],killY:-30,components:[...structuredClone(pockets),{t:'gate',p:[0,0,-10]}]};
 for(const editing of [false,true]){
  setEditorBuild(editing);const level=new Level(new r.THREE.Scene(),{id:'shallow-copy',name:data.name,data});
  assert.deepEqual(level.captureData(),normalizeCustomLevelData(data));
  const materials=pockets.map(c=>level.root.getObjectByName(c.nm).material),counts=new Map(materials.map(m=>[m,0]));
  for(const m of materials)m.addEventListener('dispose',()=>counts.set(m,counts.get(m)+1));
  level.dispose();assert.ok([...counts.values()].every(n=>n===1));
 }
 setEditorBuild(false);
 console.log(JSON.stringify({pools:report,totalTriangles:report.reduce((n,p)=>n+p.triangles,0)},null,2));
 console.log('PASS shallow water fits the unchanged ride surface, closes at every shoreline, remains non-solid/non-swimming, round-trips and disposes correctly.');
},{modulePath:'/src/levels/slipstream.ts',source:m=>m.SLIPSTREAM_LEVEL,levelId:'slipstream-race'});
